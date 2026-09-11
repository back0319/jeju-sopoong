-- 기성품 토핑을 재고 화면에서 아예 내릴 수 있게 합니다.
-- 강제 품절은 "오늘 다 나감"이고, 비활성은 "당분간 팔지 않음"이라 고객 화면에서 사라집니다.
alter table public.ingredients
 add column if not exists active boolean not null default true;

-- 판매하지 않는 재료는 주문에 담기지 않습니다.
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
      exists(select 1 from jsonb_array_elements_text(item->'toppings') v where not exists(select 1 from public.ingredients i where i.id=v and i.kind in ('topping','ready') and i.active)) or
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
