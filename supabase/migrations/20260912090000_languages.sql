-- 고객 화면 언어를 8개로 확장합니다.
-- 기존 제약이 'zh'만 허용하므로 제약을 먼저 떼고 데이터를 옮긴 뒤에 새 제약을 붙입니다.
-- (순서를 바꾸면 기존 zh 행이 있는 DB에서 check 위반으로 실패합니다.)
do $$ declare t text; c text; begin
 foreach t in array array['contents','orders'] loop
  for c in
   select con.conname from pg_constraint con
   join pg_class rel on rel.oid=con.conrelid
   join pg_namespace ns on ns.oid=rel.relnamespace
   where ns.nspname='public' and rel.relname=t and con.contype='c'
    and pg_get_constraintdef(con.oid) like '%language%'
  loop
   execute format('alter table public.%I drop constraint %I', t, c);
  end loop;
 end loop;
end $$;

update public.contents set language='zh-Hans' where language='zh';
update public.orders set language='zh-Hans' where language='zh';

do $$ declare t text; begin
 foreach t in array array['contents','orders'] loop
  execute format($f$alter table public.%I add constraint %I
   check(language in ('ko','en','zh-Hans','zh-Hant','ja','id','ar','ms'))$f$, t, t || '_language_check');
 end loop;
end $$;

-- 새 언어의 콘텐츠 행을 비어 있는 상태로 준비합니다.
insert into public.contents(id,language,title)
select i.id, l.code, ''
 from unnest(array['usage','brand','producer','consent','experience','pork','turban-shell','fernbrake','carrot']) as i(id)
 cross join unnest(array['ko','en','zh-Hans','zh-Hant','ja','id','ar','ms']) as l(code)
on conflict(id,language) do nothing;
