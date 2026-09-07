// 계정 값은 환경변수로만 받으며 코드·시드·로그에 기록하지 않습니다.
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const {
  NEXT_PUBLIC_SUPABASE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: key,
  ADMIN_EMAIL: originalEmail,
  ADMIN_USERNAME: username,
  ADMIN_PASSWORD: password,
} = process.env;
const email=username?`${username.toLowerCase()}@login.juseyo.invalid`:originalEmail;
if (!url || !key || !email || !password || password.length < 5 || (username && !/^[a-z0-9][a-z0-9._-]{2,39}$/i.test(username)))
  throw new Error(
    "Supabase 환경변수와 관리자 아이디·5자 이상의 비밀번호가 필요합니다.",
  );
const db = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await db.auth.admin.createUser({
  email,
  password: username?createHash("sha256").update(`juseyo-login-v1:${password}`).digest("hex"):password,
  user_metadata: username?{login_id:username.toLowerCase()}:{},
  email_confirm: true,
});
if (error) throw new Error("관리자 생성 실패: " + error.code);
const grant = await db.from("admin_users").insert({ user_id: data.user.id });
if (grant.error)
  throw new Error(
    "계정은 생성됐지만 관리자 권한 등록에 실패했습니다. admin_users를 확인해 주세요.",
  );
console.log("관리자 계정 및 권한 등록 완료");
