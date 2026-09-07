import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(
  readFileSync(".env.development.local", "utf8")
    .trim()
    .split("\n")
    .map((l) => {
      const at = l.indexOf("=");
      return [l.slice(0, at), l.slice(at + 1)];
    }),
);
if (
  !["127.0.0.1", "localhost"].includes(
    new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,
  )
)
  throw new Error("로컬 DB에서만 실행할 수 있습니다.");
const client = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const email = `test-${randomBytes(6).toString("hex")}@example.invalid`,
  password = randomBytes(24).toString("base64url");
const { data, error } = await client.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (error) throw error;
const result = await client
  .from("admin_users")
  .insert({ user_id: data.user.id });
if (result.error) throw result.error;
const stock = await client
  .from("inventory")
  .update({ remaining: 20, forced_sold_out: false })
  .neq("ingredient_id", "");
if (stock.error) throw stock.error;
writeFileSync(
  "/tmp/jeju-local-admin.json",
  JSON.stringify({ email, password }),
  { mode: 0o600 },
);
console.log(
  "로컬 테스트 계정 및 재고 준비 완료. 자격 증명은 비공개 임시 파일에 저장했습니다.",
);
