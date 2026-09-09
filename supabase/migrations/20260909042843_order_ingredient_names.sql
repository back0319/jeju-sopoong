-- 신규 주문 스냅샷의 추가 재료 이름을 한국어 name으로 저장합니다.
create or replace function public.create_order(payload jsonb) returns uuid language plpgsql security invoker set search_path = '' as $$
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
     toppings:=toppings||jsonb_build_array(jsonb_build_object('id',ing.id,'name',ing.name,'price',ing.price)); amount:=amount+ing.price;
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

