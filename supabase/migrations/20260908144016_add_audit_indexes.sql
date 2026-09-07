-- 계정·설문 버전별 연결 조회와 외래 키 검사를 지원합니다.
create index order_status_events_actor on public.order_status_events(actor_id);
create index order_surveys_version on public.order_surveys(survey_version);
-- 카운터는 서버 전용입니다. 익명·로그인 역할에는 테이블 권한도 부여하지 않습니다.
revoke all on public.daily_order_counters from anon, authenticated;
