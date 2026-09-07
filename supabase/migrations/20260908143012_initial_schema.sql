-- 주문과 재고를 하나의 트랜잭션으로 관리합니다. 공개 쓰기는 서버 전용 함수로 제한합니다.
create table public.ingredients (
 id text primary key, name text not null, label text not null, kind text not null check(kind in ('fixed','base','topping')),
 position integer not null, image text, price integer not null default 0 check(price>=0)
);
create table public.inventory (
 ingredient_id text primary key references public.ingredients(id), remaining integer not null default 0 check(remaining>=0), forced_sold_out boolean not null default false
);
create table public.products (
 id text primary key, name text not null, kind text not null check(kind in ('base','upgrade','extra')),
 price integer check(price>=0), active boolean not null default false, check(not active or price is not null)
);
create table public.survey_versions (id text primary key, questions jsonb not null check(jsonb_typeof(questions)='array'), active boolean not null default false);
create unique index one_active_survey on public.survey_versions(active) where active;
create table public.contents (
 id text not null, language text not null check(language in ('ko','en','ja','zh')), title text not null default '', body text not null default '',
 image_url text not null default '', video_url text not null default '', version integer not null default 1, primary key(id,language)
);
create table public.orders (
 id uuid primary key default gen_random_uuid(), business_date date not null, number integer not null check(number>0),
 language text not null check(language in ('ko','en','ja','zh')), status text not null default 'PENDING' check(status in ('PENDING','COMPLETED','CANCELLED')),
 total integer not null check(total>=0), source text not null check(source in ('customer','manual')), idempotency_key uuid not null unique,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 cancel_reason text, unique(business_date,number)
);
create index orders_date_status on public.orders(business_date,status,created_at desc);
create table public.order_items (id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, position integer not null, snapshot jsonb not null, unique(order_id,position));
create index order_items_order on public.order_items(order_id);
create table public.order_surveys (
 order_id uuid primary key references public.orders(id) on delete cascade, survey_version text references public.survey_versions(id),
 answers jsonb not null default '{}', survey_completed boolean not null default false, consent boolean not null default false,
 consent_at timestamptz, consent_version text, internal_test boolean not null default true
);
create table public.daily_order_counters (business_date date primary key, last_number integer not null check(last_number>0));
create table public.admin_users (user_id uuid primary key references auth.users(id) on delete cascade);
create table public.order_status_events (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 actor_id uuid not null references auth.users(id), before_status text not null, after_status text not null, reason text,
 created_at timestamptz not null default clock_timestamp(), order_version integer not null, unique(order_id,order_version)
);
create index order_events_order on public.order_status_events(order_id);

-- 관리자 자신의 권한 행을 조회합니다.
alter table public.admin_users enable row level security;
grant select on public.admin_users to authenticated;
create policy admin_self on public.admin_users for select to authenticated using(user_id=(select auth.uid()));
create function public.is_admin() returns boolean language sql stable security invoker set search_path = '' as $$
 select exists(select 1 from public.admin_users where user_id=(select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

do $$ declare t text; begin
 foreach t in array array['ingredients','inventory','products','contents','survey_versions'] loop
 execute format('alter table public.%I enable row level security', t);
 execute format('grant select on public.%I to anon, authenticated',t);
 execute format('create policy public_read on public.%I for select to anon, authenticated using(true)',t);
 execute format('grant insert, update on public.%I to authenticated',t);
 execute format('create policy admin_insert on public.%I for insert to authenticated with check((select public.is_admin()))',t);
 execute format('create policy admin_update on public.%I for update to authenticated using((select public.is_admin())) with check((select public.is_admin()))',t);
 end loop;
 foreach t in array array['orders','order_items','order_surveys','order_status_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy admin_read on public.%I for select to authenticated using((select public.is_admin()))',t);
 end loop;
end $$;
alter table public.daily_order_counters enable row level security;
grant all on all tables in schema public to service_role;

create function public.create_order(payload jsonb) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
 oid uuid; key uuid := (payload->>'idempotencyKey')::uuid; item jsonb; ing record; prod record;
 amount integer; total_amount integer:=0; snapshots jsonb:='[]'; snapshot jsonb; included jsonb; excluded jsonb; toppings jsonb;
 needed record; bdate date; seq integer; idx integer:=0;
begin
 if key is null then raise exception 'INVALID_ORDER'; end if;
 -- 같은 제출의 재시도가 동시에 들어와도 기존 결과를 기다린 뒤 반환합니다.
 perform pg_advisory_xact_lock(hashtextextended(key::text,0));
 select id into oid from public.orders where idempotency_key=key;
 if oid is not null then return oid; end if;
 if jsonb_typeof(payload->'items') is distinct from 'array' or jsonb_array_length(payload->'items') not between 1 and 30 then raise exception 'INVALID_ORDER'; end if;
 -- 메뉴 수정과 주문 생성이 서로 엇갈리지 않게 가격 행을 잠급니다.
 perform 1 from public.products order by id for share;
 perform 1 from public.ingredients order by id for share;
 for item in select value from jsonb_array_elements(payload->'items') loop
  amount:=0; included:='[]'; excluded:='[]'; toppings:='[]';
  if item->>'kind' = 'extra' then
   select * into prod from public.products where id=item->>'productId' and kind='extra' and active;
   if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
   amount:=prod.price;
   snapshot:=jsonb_build_object('kind','extra','name',prod.name,'included',included,'excluded',excluded,'toppings',toppings,'amount',amount);
  else
   if item->>'kind' not in ('gimbap','package') then raise exception 'INVALID_ORDER'; end if;
   if jsonb_typeof(item->'excluded') is distinct from 'array' or jsonb_typeof(item->'toppings') is distinct from 'array' then raise exception 'INVALID_ORDER'; end if;
   if exists(select 1 from jsonb_array_elements_text(item->'excluded') v where not exists(select 1 from public.ingredients i where i.id=v and i.kind='base')) or
      exists(select 1 from jsonb_array_elements_text(item->'toppings') v where not exists(select 1 from public.ingredients i where i.id=v and i.kind='topping')) or
      (select count(*)<>count(distinct value) from jsonb_array_elements_text(item->'toppings')) then raise exception 'INVALID_ORDER'; end if;
   select * into prod from public.products where id='gimbap' and active;
   if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
   amount:=prod.price;
   if item->>'kind'='package' then
    select * into prod from public.products where id='package' and active;
    if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    amount:=amount+prod.price;
   end if;
   for ing in select * from public.ingredients order by position loop
    if ing.kind in ('fixed','base') then
     if item->'excluded' ? ing.id then excluded:=excluded||jsonb_build_array(jsonb_build_object('id',ing.id,'name',ing.name));
     else included:=included||jsonb_build_array(jsonb_build_object('id',ing.id,'name',ing.name)); end if;
    elsif item->'toppings' ? ing.id then
     toppings:=toppings||jsonb_build_array(jsonb_build_object('id',ing.id,'name',ing.label,'price',ing.price)); amount:=amount+ing.price;
    end if;
   end loop;
   snapshot:=jsonb_build_object('kind',item->>'kind','name',case when item->>'kind'='package' then '패키지' else '기본 김밥' end,'included',included,'excluded',excluded,'toppings',toppings,'amount',amount);
  end if;
  total_amount:=total_amount+amount; snapshots:=snapshots||jsonb_build_array(snapshot);
 end loop;
 if total_amount is distinct from (payload->>'expectedTotal')::integer then raise exception 'PRICE_CHANGED'; end if;
 -- 모든 주문에서 같은 순서로 잠가 교착을 방지합니다.
 for needed in select t->>'id' id, count(*) qty from jsonb_array_elements(snapshots) s cross join lateral jsonb_array_elements(s->'toppings') t group by t->>'id' order by t->>'id' loop
  update public.inventory set remaining=remaining-needed.qty where ingredient_id=needed.id and remaining>=needed.qty and not forced_sold_out;
  if not found then raise exception 'OUT_OF_STOCK:%',needed.id; end if;
 end loop;
 bdate:=(clock_timestamp() at time zone 'Asia/Seoul')::date;
 insert into public.daily_order_counters values(bdate,1) on conflict(business_date) do update set last_number=public.daily_order_counters.last_number+1 returning last_number into seq;
 insert into public.orders(business_date,number,language,total,source,idempotency_key) values(bdate,seq,payload->>'language',total_amount,payload->>'source',key) returning id into oid;
 for snapshot in select value from jsonb_array_elements(snapshots) loop
  insert into public.order_items(order_id,position,snapshot) values(oid,idx,snapshot); idx:=idx+1;
 end loop;
 insert into public.order_surveys(order_id,survey_version,answers,survey_completed,consent,consent_at,consent_version,internal_test)
 values(oid,payload->>'surveyVersion',coalesce(payload->'answers','{}'),coalesce((payload->>'surveyCompleted')::boolean,false),coalesce((payload->>'consent')::boolean,false),
 case when (payload->>'consent')::boolean then coalesce((payload->>'consentAt')::timestamptz,now()) else null end,payload->>'consentVersion',(payload->>'internalTest')::boolean);
 return oid;
end $$;
revoke all on function public.create_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;

create function public.change_order_status(p_order uuid, p_status text, p_version integer, p_actor uuid, p_reason text default null) returns public.orders language plpgsql security invoker set search_path='' as $$
declare o public.orders; before_value text; needed record;
begin
 if not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'FORBIDDEN'; end if;
 select * into o from public.orders where id=p_order for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if o.version<>p_version then raise exception 'STALE_ORDER'; end if;
 if o.status='CANCELLED' then raise exception 'FINAL_STATE'; end if;
 if p_status not in ('PENDING','COMPLETED','CANCELLED') or p_status=o.status then raise exception 'INVALID_STATE'; end if;
 if p_status='PENDING' and (o.status<>'COMPLETED' or clock_timestamp()>o.updated_at+interval '5 seconds' or not exists(select 1 from public.order_status_events where order_id=o.id and order_version=o.version and actor_id=p_actor)) then raise exception 'UNDO_EXPIRED'; end if;
 if p_status='CANCELLED' then
  if nullif(trim(p_reason),'') is null then raise exception 'REASON_REQUIRED'; end if;
  for needed in select t->>'id' id,count(*) qty from public.order_items oi cross join lateral jsonb_array_elements(oi.snapshot->'toppings') t where oi.order_id=p_order group by t->>'id' order by t->>'id' loop
   update public.inventory set remaining=remaining+needed.qty where ingredient_id=needed.id;
  end loop;
 end if;
 before_value:=o.status;
 update public.orders set status=p_status,version=version+1,updated_at=clock_timestamp(),cancel_reason=case when p_status='CANCELLED' then p_reason else null end where id=p_order returning * into o;
 insert into public.order_status_events(order_id,actor_id,before_status,after_status,reason,order_version) values(p_order,p_actor,before_value,p_status,p_reason,o.version);
 return o;
end $$;
revoke all on function public.change_order_status(uuid,text,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.change_order_status(uuid,text,integer,uuid,text) to service_role;

-- 로컬 PostgreSQL 테스트에서도 같은 SQL을 실행할 수 있게 publication 존재 여부를 확인합니다.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.orders, public.inventory;
 end if;
end $$;
