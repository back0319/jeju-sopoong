-- 요청된 패키지 선택과 생산자 소개 영상 기본값을 반영합니다.
update public.products set active=true, price=10000, name='라면 · 음료 · 굿즈 패키지' where id='package';
insert into public.contents(id,language,title,video_url) values('producer','ko','제주의 생산자','https://youtu.be/dQw4w9WgXcQ')
on conflict(id,language) do update set title=excluded.title,video_url=excluded.video_url,version=contents.version+1;
-- 익명 설문 건너뛰기는 서버에서 답변·동의를 비워 저장합니다. 기존 응답은 보존합니다.
