import assert from 'node:assert/strict';
import{randomUUID}from'node:crypto';
import{readFileSync}from'node:fs';
const base='http://localhost:3000',creds=JSON.parse(readFileSync('/tmp/jeju-local-admin.json','utf8'));let cookie='';
async function req(path,body,auth=false){return fetch(base+path,{method:body?'POST':'GET',headers:{Origin:base,...(body?{'Content-Type':'application/json'}:{}),...(auth?{cookie}:{})},body:body?JSON.stringify(body):undefined})}
async function login(c){const r=await req('/api/admin/auth',c);assert.equal(r.status,200);cookie=r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');}
await login(creds);
assert.equal((await req('/api/admin/account')).status,401);
assert.equal((await req('/api/admin/research')).status,401);
const c=await(await req('/api/catalog')).json();
const body={idempotencyKey:randomUUID(),language:'ko',items:[{kind:'package',excluded:[],toppings:[]}],expectedTotal:15000,surveySkipped:true,consent:true,consentAt:new Date().toISOString(),answers:{S1:['kr']}};
const r=await req('/api/orders',body);assert.equal(r.status,201);const o=await r.json();
const data=await(await req(`/api/admin/research?from=${o.business_date}&to=${o.business_date}&participation=skipped`,undefined,true)).json();const target=data.orders.find(v=>v.id===o.id);assert.equal(target.order_surveys.survey_completed,false);assert.equal(target.order_surveys.consent,false);assert.equal(target.order_surveys.survey_version,null);assert.deepEqual(target.order_surveys.answers,{});
for(const format of ['csv','items','json','codebook']){const exportResponse=await req(`/api/admin/export?from=${o.business_date}&to=${o.business_date}&format=${format}`,undefined,true);assert.equal(exportResponse.status,200);const text=await exportResponse.text();assert.ok(text.length>50);if(format==='json'){const parsed=JSON.parse(text);assert.equal('status' in parsed.orders[0],false);assert.ok(parsed.metadata.survey_versions.some(v=>v.id===c.survey.id));}}
const bad=await req('/api/admin/account',{username:creds.username,currentPassword:'incorrect',password:'test-change'},true);assert.equal(bad.status,401);
const next={username:'qa-'+randomUUID().slice(0,8),password:randomUUID()};let changed=false;
try{const updated=await req('/api/admin/account',{...next,currentPassword:creds.password},true);assert.equal(updated.status,200);changed=true;await login(next);const me=await(await req('/api/admin/account',undefined,true)).json();assert.equal(me.username,next.username);assert.equal((await req('/api/admin/auth',creds)).status,401);}finally{if(changed){await login(next);assert.equal((await req('/api/admin/account',{...creds,currentPassword:next.password},true)).status,200);await login(creds);}}
console.log('PASS v2 API: skip survey clears data, package15000, research exports and filters, account current-password check, change/new login/old rejection/restore');
