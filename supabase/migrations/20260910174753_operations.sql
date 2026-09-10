alter table public.inventory add column business_date date not null default ((now() at time zone 'Asia/Seoul')::date);
grant usage on schema private to service_role;
create or replace function public.ensure_inventory_day() returns date language plpgsql security invoker set search_path='' as $$
declare d date;
begin
 perform pg_advisory_xact_lock(hashtextextended('juseyo-inventory-day',0));
 d := (clock_timestamp() at time zone 'Asia/Seoul')::date;
 update public.inventory set remaining=0,business_date=d where business_date<d;
 return d;
end $$;
revoke all on function public.ensure_inventory_day() from public,anon,authenticated;
grant execute on function public.ensure_inventory_day() to service_role;
create or replace function private.order_snapshots(payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb; ing record; prod record; amount integer; total_amount integer:=0;
 snapshots jsonb:='[]'; snapshot jsonb; included jsonb; excluded jsonb; toppings jsonb;
begin
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
   snapshot:=jsonb_build_object('kind','extra','name',prod.name,'productId',prod.id,'included',included,'excluded',excluded,'toppings',toppings,'amount',amount);
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
     toppings:=toppings||jsonb_build_array(jsonb_build_object('id',ing.id,'name',ing.name,'price',ing.price)); amount:=amount+ing.price;
    end if;
   end loop;
   snapshot:=jsonb_build_object('kind',item->>'kind','name',prod.name,'included',included,'excluded',excluded,'toppings',toppings,'amount',amount);
  end if;
  total_amount:=total_amount+amount; snapshots:=snapshots||jsonb_build_array(snapshot);
 end loop;
 if total_amount is distinct from (payload->>'expectedTotal')::integer then raise exception 'PRICE_CHANGED'; end if;
 return snapshots;
end $$;
revoke all on function private.order_snapshots(jsonb) from public,anon,authenticated;
grant execute on function private.order_snapshots(jsonb) to service_role;
create or replace function public.create_order(payload jsonb) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
 oid uuid; key uuid := (payload->>'idempotencyKey')::uuid; item jsonb; ing record; prod record;
 amount integer; total_amount integer:=0; snapshots jsonb:='[]'; snapshot jsonb; included jsonb; excluded jsonb; toppings jsonb;
 needed record; bdate date; seq integer; idx integer:=0;
begin
 bdate:=public.ensure_inventory_day();
 if key is null then raise exception 'INVALID_ORDER'; end if;
 -- 같은 제출의 재시도가 동시에 들어와도 기존 결과를 기다린 뒤 반환합니다.
 perform pg_advisory_xact_lock(hashtextextended(key::text,0));
 select id into oid from public.orders where idempotency_key=key;
 if oid is not null then return oid; end if;
 if jsonb_typeof(payload->'items') is distinct from 'array' or jsonb_array_length(payload->'items') not between 1 and 30 then raise exception 'INVALID_ORDER'; end if;
 snapshots:=private.order_snapshots(payload);
 select sum((s->>'amount')::integer) into total_amount from jsonb_array_elements(snapshots) s;
 -- 모든 주문에서 같은 순서로 잠가 교착을 방지합니다.
 for needed in select t->>'id' id, count(*) qty from jsonb_array_elements(snapshots) s cross join lateral jsonb_array_elements(s->'toppings') t group by t->>'id' order by t->>'id' loop
  update public.inventory set remaining=remaining-needed.qty where ingredient_id=needed.id and remaining>=needed.qty and not forced_sold_out;
  if not found then raise exception 'OUT_OF_STOCK:%',needed.id; end if;
 end loop;
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

create or replace function public.change_order_status(p_order uuid, p_status text, p_version integer, p_actor uuid, p_reason text default null) returns public.orders language plpgsql security invoker set search_path='' as $$
declare o public.orders; before_value text; needed record; d date;
begin
 d:=public.ensure_inventory_day();
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
   update public.inventory set remaining=remaining+needed.qty where ingredient_id=needed.id and o.business_date=d;
  end loop;
 end if;
 before_value:=o.status;
 update public.orders set status=p_status,version=version+1,updated_at=clock_timestamp(),cancel_reason=case when p_status='CANCELLED' then p_reason else null end where id=p_order returning * into o;
 insert into public.order_status_events(order_id,actor_id,before_status,after_status,reason,order_version) values(p_order,p_actor,before_value,p_status,p_reason,o.version);
 return o;
end $$;
revoke all on function public.change_order_status(uuid,text,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.change_order_status(uuid,text,integer,uuid,text) to service_role;


create table public.order_edit_events (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
 actor_id uuid not null references auth.users(id), before_items jsonb not null, after_items jsonb not null,
 before_total integer not null, after_total integer not null, created_at timestamptz not null default now()
);
alter table public.order_edit_events enable row level security;
create policy admin_read on public.order_edit_events for select to authenticated using ((select public.is_admin()));
grant select on public.order_edit_events to authenticated;
grant all on public.order_edit_events to service_role;
create index on public.order_edit_events(order_id);
create index on public.order_edit_events(actor_id);
create function public.edit_order(p_order uuid,p_version integer,p_actor uuid,p_payload jsonb) returns public.orders language plpgsql security invoker set search_path='' as $$
declare o public.orders; d date; snapshots jsonb; old_items jsonb; item_snapshot jsonb; needed record; idx integer:=0; new_total integer;
begin
 d:=public.ensure_inventory_day();
 if not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'FORBIDDEN'; end if;
 select * into o from public.orders where id=p_order for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if o.version<>p_version then raise exception 'STALE_ORDER'; end if;
 if o.status<>'PENDING' or o.business_date<>d then raise exception 'FINAL_STATE'; end if;
 snapshots:=private.order_snapshots(p_payload);
 select coalesce(jsonb_agg(snapshot order by position),'[]') into old_items from public.order_items where order_id=o.id;
 -- 변경 전후의 수량 차이만 재고에 반영합니다.
 for needed in
  select id,sum(qty) qty from (
   select t->>'id' id, count(*)::integer qty from jsonb_array_elements(snapshots) s cross join lateral jsonb_array_elements(s->'toppings') t group by t->>'id'
   union all
   select t->>'id' id, -count(*)::integer qty from jsonb_array_elements(old_items) s cross join lateral jsonb_array_elements(s->'toppings') t group by t->>'id'
  ) changes group by id order by id loop
  if needed.qty>0 then
   update public.inventory set remaining=remaining-needed.qty where ingredient_id=needed.id and remaining>=needed.qty and not forced_sold_out;
   if not found then raise exception 'OUT_OF_STOCK:%',needed.id; end if;
  elsif needed.qty<0 then
   update public.inventory set remaining=remaining-needed.qty where ingredient_id=needed.id;
  end if;
 end loop;
 select sum((s->>'amount')::integer) into new_total from jsonb_array_elements(snapshots) s;
 insert into public.order_edit_events(order_id,actor_id,before_items,after_items,before_total,after_total) values(o.id,p_actor,old_items,snapshots,o.total,new_total);
 delete from public.order_items where order_id=o.id;
 for item_snapshot in select value from jsonb_array_elements(snapshots) loop
  insert into public.order_items(order_id,position,snapshot) values(o.id,idx,item_snapshot); idx:=idx+1;
 end loop;
 update public.orders set total=new_total,version=version+1,updated_at=clock_timestamp() where id=o.id returning * into o;
 return o;
end $$;
revoke all on function public.edit_order(uuid,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.edit_order(uuid,integer,uuid,jsonb) to service_role;
create function public.batch_order_status(p_orders jsonb,p_status text,p_actor uuid,p_reason text default null) returns setof public.orders language plpgsql security invoker set search_path='' as $$
declare r record; o public.orders;
begin
 perform public.ensure_inventory_day();
 if jsonb_typeof(p_orders) is distinct from 'array' or jsonb_array_length(p_orders) not between 1 and 30 then raise exception 'INVALID_INPUT'; end if;
 if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(p_orders)) then raise exception 'INVALID_INPUT'; end if;
 for r in select (value->>'id')::uuid id,(value->>'version')::integer version from jsonb_array_elements(p_orders) order by value->>'id' loop
  o:=public.change_order_status(r.id,p_status,r.version,p_actor,p_reason); return next o;
 end loop;
end $$;
revoke all on function public.batch_order_status(jsonb,text,uuid,text) from public,anon,authenticated;
grant execute on function public.batch_order_status(jsonb,text,uuid,text) to service_role;
create function public.set_inventory(p_id text,p_remaining integer,p_forced boolean,p_previous integer,p_previous_forced boolean,p_date date,p_actor uuid) returns void language plpgsql security invoker set search_path='' as $$
declare d date;
begin
 d:=public.ensure_inventory_day();
 if not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'FORBIDDEN'; end if;
 if p_date is distinct from d then raise exception 'STALE_ORDER'; end if;
 update public.inventory set remaining=p_remaining,forced_sold_out=p_forced where ingredient_id=p_id and remaining=p_previous and forced_sold_out=p_previous_forced;
 if not found then raise exception 'STALE_ORDER'; end if;
end $$;
revoke all on function public.set_inventory(text,integer,boolean,integer,boolean,date,uuid) from public,anon,authenticated;
grant execute on function public.set_inventory(text,integer,boolean,integer,boolean,date,uuid) to service_role;
-- 내용 수정도 고객 조회와 연구 데이터의 실시간 갱신을 발생시킵니다.
drop trigger notify_customer_order_changed on public.orders;
create trigger notify_customer_order_changed after update on public.orders for each row execute function private.notify_order_changed();
