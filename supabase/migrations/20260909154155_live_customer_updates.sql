create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create or replace function private.notify_order_changed()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  -- 테스트 DB에는 Realtime 확장이 없을 수 있습니다.
  if exists(select 1 from pg_namespace where nspname='realtime') then
    if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
      perform realtime.send('{}'::jsonb, 'changed', 'order:' || new.id::text, false);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.notify_order_changed() from public, anon, authenticated;
create trigger notify_customer_order_changed after update on public.orders
for each row when (old.status is distinct from new.status or old.cancel_reason is distinct from new.cancel_reason)
execute function private.notify_order_changed();
do $$
declare t text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['products','ingredients','contents'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end $$;
