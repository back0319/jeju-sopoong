import { requireAdmin, serviceClient } from "@/lib/supabase/server";
import { loginAddress, authPassword } from "@/lib/admin-credentials";
import { failure, json, readBody, sameOrigin } from "@/lib/http";
export async function GET() {
  try {
    const { user } = await requireAdmin();
    return json({ username: user.user_metadata.login_id || user.email });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const { user } = await requireAdmin();
    const b = await readBody(req);
    if (
      typeof b.username !== "string" ||
      typeof b.currentPassword !== "string" ||
      typeof b.password !== "string"
    )
      throw new Error("INVALID_INPUT");
    const email = loginAddress(b.username),
      password = authPassword(b.password);
    // 현재 비밀번호 재확인 후 Auth의 단일 업데이트로 아이디와 비밀번호를 함께 변경합니다.
    const verifier = serviceClient();
    const check = await verifier.auth.signInWithPassword({
      email: user.email!,
      password: user.user_metadata.login_id
        ? authPassword(b.currentPassword)
        : b.currentPassword,
    });
    if (check.error) throw new Error("UNAUTHORIZED");
    const result = await serviceClient().auth.admin.updateUserById(user.id, {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        ...user.user_metadata,
        login_id: b.username.trim().toLowerCase(),
      },
    });
    if (result.error) throw new Error("INVALID_INPUT");
    return json({ ok: true, username: b.username.trim().toLowerCase() });
  } catch (e) {
    return failure(e);
  }
}
