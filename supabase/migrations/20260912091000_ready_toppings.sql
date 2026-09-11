-- 기성품 토핑 4종을 추가하고, 패키지 선택 시 토핑 하나를 무료로 제공합니다.

-- 제주 원물(topping)과 달리 소개 페이지가 없고 가격이 제각각이라 별도 kind로 둡니다.
do $$ declare c text; begin
 for c in
  select con.conname from pg_constraint con
  join pg_class rel on rel.oid=con.conrelid
  join pg_namespace ns on ns.oid=rel.relnamespace
  where ns.nspname='public' and rel.relname='ingredients' and con.contype='c'
   and pg_get_constraintdef(con.oid) like '%kind%'
 loop
  execute format('alter table public.ingredients drop constraint %I', c);
 end loop;
end $$;
alter table public.ingredients add constraint ingredients_kind_check
 check(kind in ('fixed','base','topping','ready'));

insert into public.ingredients(id,name,label,kind,position,image,price) values
 ('cheese','치즈 1장','치즈 1장','ready',10,null,1000),
 ('gim','김 1봉지','김 1봉지','ready',11,null,1000),
 ('kimchi','배추김치','배추김치','ready',12,null,2000),
 ('stir-fried-kimchi','볶음김치','볶음김치','ready',13,null,3000)
on conflict(id) do nothing;
insert into public.inventory(ingredient_id)
 select id from public.ingredients where kind in ('topping','ready')
on conflict(ingredient_id) do nothing;

-- 토핑 검증을 두 kind로 넓히고, 패키지의 무료 토핑 규칙을 더합니다.
-- 무료 대상은 "선택한 토핑 중 가장 비싼 하나"이며 lib/domain.ts의 itemPrice와 같은 규칙입니다.
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
