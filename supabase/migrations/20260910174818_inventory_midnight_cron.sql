-- Supabase의 기본 UTC 스케줄: 15:00 UTC = 다음 날 00:00 KST.
-- 임시 통합 테스트 DB에서는 스케줄러 설치를 생략합니다.
do $$
begin
 if current_database() = coalesce(current_setting('cron.database_name',true),'postgres') then
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('juseyo-inventory-midnight','0 15 * * *','select public.ensure_inventory_day()');
 end if;
end $$;
