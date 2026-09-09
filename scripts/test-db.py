"""로컬 컨테이너 안의 임시 DB만 생성하고 검증 후 삭제합니다."""
import concurrent.futures, json, pathlib, subprocess, uuid
container='supabase_db_jeju-sopoong'
db='jeju_test_'+uuid.uuid4().hex[:12]
def sql(query, database=db, fail=True):
    p=subprocess.run(['docker','exec','-i',container,'psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-At'],input=query,text=True,capture_output=True)
    if fail and p.returncode: raise AssertionError(p.stderr)
    return p

def value(q): return sql(q).stdout.strip().splitlines()[-1]
def payload(toppings=['pork'], count=1, key=None, kind='gimbap', total=None):
    return dict(idempotencyKey=key or str(uuid.uuid4()),language='ko',source='customer',items=[dict(kind=kind,excluded=['egg'],toppings=toppings) for _ in range(count)],expectedTotal=total if total is not None else (5000+len(toppings)*3000+(10000 if kind=='package' else 0))*count,surveyVersion='draft-v2',answers={},surveyCompleted=False,consent=True,consentVersion='internal-test-v1',internalTest=True)
def create(p): return sql("select public.create_order('"+json.dumps(p).replace("'","''")+"'::jsonb);",fail=False)
def expect(condition,label):
    if not condition: raise AssertionError(label)
    print('PASS '+label)
try:
    sql('create database '+db+';',database='postgres')
    sql("create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;")
    for file in sorted(pathlib.Path('supabase/migrations').glob('*.sql')): sql(file.read_text())
    sql(pathlib.Path('supabase/seed.sql').read_text())
    admin=str(uuid.uuid4());sql(f"insert into auth.users values('{admin}');insert into public.admin_users values('{admin}');update public.inventory set remaining=1;")
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool: results=list(pool.map(lambda _:create(payload()),range(8)))
    expect(sum(r.returncode==0 for r in results)==1,'마지막 재고 동시 주문 8개 중 1개만 성공')
    expect(value("select remaining from public.inventory where ingredient_id='pork'")=='0','재고 음수 방지')
    sql('update public.inventory set remaining=10;')
    same=payload()
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: results=list(pool.map(lambda _:create(same),range(6)))
    expect(all(r.returncode==0 for r in results) and len(set(r.stdout for r in results))==1,'동시 중복 제출 6개는 같은 주문 반환')
    expect(value("select remaining from public.inventory where ingredient_id='pork'")=='9','중복 제출 재고 차감 1회')
    oid=results[0].stdout.strip()
    cancelled=sql(f"select (public.change_order_status('{oid}','CANCELLED',1,'{admin}','테스트')).status;",fail=False)
    expect(cancelled.returncode==0,'취소 처리 성공')
    sql(f"select public.change_order_status('{oid}','CANCELLED',1,'{admin}','테스트');",fail=False)
    expect(value("select remaining from public.inventory where ingredient_id='pork'")=='10','중복 취소 재고 복구 1회')
    sql("update public.inventory set remaining=0 where ingredient_id='carrot';")
    before=value('select count(*) from public.orders');r=create(payload(['pork','carrot']))
    expect(r.returncode!=0 and value("select remaining from public.inventory where ingredient_id='pork'")=='10' and value('select count(*) from public.orders')==before,'일부 재고 부족 시 주문과 모든 차감 롤백')
    r=create(payload([],total=1));expect(r.returncode!=0 and 'PRICE_CHANGED' in r.stderr,'조작한 금액 거절')
    sql("update public.products set active=false where id='package';")
    r=create(payload([],kind='package'));expect(r.returncode!=0 and 'PRODUCT_UNAVAILABLE' in r.stderr,'비활성 패키지 거절')
    sql("update public.products set active=true where id='package';")
    r=create(payload(['pork'],kind='package'));expect(r.returncode==0,'패키지와 토핑 18,000원 주문 성공')
    oid=r.stdout.strip();expect(value(f"select total from public.orders where id='{oid}'")=='18000','DB 계산 18,000원 확인')
    expect(value(f"select snapshot->'toppings'->0->>'name' from public.order_items where order_id='{oid}' limit 1")=='제주 돼지고기','추가 재료 한국어 이름 저장')
    sql("update public.products set price=6000 where id='gimbap';")
    expect(value(f"select total from public.orders where id='{oid}'")=='18000','메뉴 변경 후 과거 가격 스냅샷 유지')
    sql(f"select public.change_order_status('{oid}','COMPLETED',1,'{admin}');select public.change_order_status('{oid}','PENDING',2,'{admin}');")
    expect(value(f"select status from public.orders where id='{oid}'")=='PENDING','완료 처리 실행 취소')
    sql(f"select public.change_order_status('{oid}','COMPLETED',3,'{admin}');update public.orders set updated_at=now()-interval '6 seconds' where id='{oid}';")
    r=sql(f"select public.change_order_status('{oid}','PENDING',4,'{admin}');",fail=False)
    expect(r.returncode!=0 and 'UNDO_EXPIRED' in r.stderr,'5초 지난 실행 취소 거절')
    r=sql(f"select public.change_order_status('{oid}','CANCELLED',1,'{admin}','오래된 요청');",fail=False)
    expect(r.returncode!=0 and 'STALE_ORDER' in r.stderr,'다른 화면의 오래된 상태 변경 거절')
    expect(sql('set role anon; select * from public.orders;',fail=False).returncode!=0,'익명 주문 직접 조회 거절')
    expect(sql("set role anon;select public.create_order('{}');",fail=False).returncode!=0,'익명 주문 함수 직접 실행 거절')
    expect(value("set role authenticated;select count(*) from public.orders;")=='0','관리자 아닌 로그인 계정의 주문 조회 차단')
    expect(int(value(f"set role authenticated;set request.jwt.claim.sub='{admin}';select count(*) from public.orders;"))>0,'관리자 RLS 조회 허용')
    expect(value("select ('2026-09-09 15:00:00+00'::timestamptz at time zone 'Asia/Seoul')::date;")=='2026-09-10','KST 자정 날짜 전환')
    expect(value('select count(*)=count(distinct (business_date,number)) from public.orders;')=='t','주문번호 유일성')
finally:
    sql('drop database if exists '+db+';',database='postgres',fail=False)
