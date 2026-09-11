-- 기성품은 기본 재료처럼 수량을 세지 않아도 되게 합니다.
-- 앞선 마이그레이션의 "판매 중지(active)"는 요청과 달라 되돌립니다.
alter table public.ingredients drop column if exists active;
alter table public.ingredients
 add column if not exists tracked boolean not null default true;

-- 판매 중지 검사를 빼고 원래의 토핑 검증으로 되돌립니다.
create or replace function private.order_snapshots(payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb; ing record; prod record; amount integer; total_amount integer:=0;
 snapshots jsonb:='[]'; snapshot jsonb; included jsonb; excluded jsonb; toppings jsonb;
 free_index integer; free_price integer; i integer;
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
      exists(select 1 from jsonb_array_elements_text(item->'toppings') v where not exists(select 1 from public.ingredients i where i.id=v and i.kind in ('topping','ready'))) or
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
   if item->>'kind'='package' and jsonb_array_length(toppings)>0 then
    free_index:=0; free_price:=(toppings->0->>'price')::integer;
    for i in 1..jsonb_array_length(toppings)-1 loop
     if (toppings->i->>'price')::integer > free_price then
      free_price:=(toppings->i->>'price')::integer; free_index:=i;
     end if;
    end loop;
    -- 무료로 제공한 토핑도 재고는 그대로 차감되도록 배열에는 남겨 둡니다.
    toppings:=jsonb_set(toppings,array[free_index::text,'price'],'0'::jsonb);
    toppings:=jsonb_set(toppings,array[free_index::text,'free'],'true'::jsonb);
    amount:=amount-free_price;
   end if;
   snapshot:=jsonb_build_object('kind',item->>'kind','name',prod.name,'included',included,'excluded',excluded,'toppings',toppings,'amount',amount);
  end if;
  total_amount:=total_amount+amount; snapshots:=snapshots||jsonb_build_array(snapshot);
 end loop;
 if total_amount is distinct from (payload->>'expectedTotal')::integer then raise exception 'PRICE_CHANGED'; end if;
 return snapshots;
end $$;
revoke all on function private.order_snapshots(jsonb) from public,anon,authenticated;
grant execute on function private.order_snapshots(jsonb) to service_role;

-- 수량을 세지 않는 재료는 차감하지 않습니다. 다만 강제 품절은 그대로 막습니다.
create or replace function public.create_order(payload jsonb) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
 oid uuid; key uuid := (payload->>'idempotencyKey')::uuid; snapshots jsonb:='[]'; snapshot jsonb;
 total_amount integer:=0; needed record; counted boolean; bdate date; seq integer; idx integer:=0;
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
  select tracked into counted from public.ingredients where id=needed.id;
  if counted then
   update public.inventory set remaining=remaining-needed.qty where ingredient_id=needed.id and remaining>=needed.qty and not forced_sold_out;
   if not found then raise exception 'OUT_OF_STOCK:%',needed.id; end if;
  elsif exists(select 1 from public.inventory where ingredient_id=needed.id and forced_sold_out) then
   raise exception 'OUT_OF_STOCK:%',needed.id;
  end if;
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

create or replace function public.edit_order(p_order uuid,p_version integer,p_actor uuid,p_payload jsonb) returns public.orders language plpgsql security invoker set search_path='' as $$
declare o public.orders; d date; snapshots jsonb; old_items jsonb; item_snapshot jsonb; needed record; counted boolean; idx integer:=0; new_total integer;
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
  select tracked into counted from public.ingredients where id=needed.id;
  if not counted then
   if needed.qty>0 and exists(select 1 from public.inventory where ingredient_id=needed.id and forced_sold_out) then
    raise exception 'OUT_OF_STOCK:%',needed.id;
   end if;
  elsif needed.qty>0 then
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
