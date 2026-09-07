import { requireAdmin, sessionClient } from "@/lib/supabase/server";
import { loginAddress, authPassword } from "@/lib/admin-credentials";
import { json, failure, readBody, sameOrigin } from "@/lib/http";
export async function GET() {
  try {
    await requireAdmin();
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const b = await readBody(req);
    const username = b.username ?? b.email;
    if (typeof username !== "string" || typeof b.password !== "string")
      throw new Error("INVALID_INPUT");
    const db = await sessionClient();
    const { error } = await db.auth.signInWithPassword({
      email: username.includes("@") ? username : loginAddress(username),
      password: username.includes("@") ? b.password : authPassword(b.password),
    });
    if (error) throw new Error("UNAUTHORIZED");
    try {
      await requireAdmin();
    } catch (e) {
      await db.auth.signOut();
      throw e;
    }
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const db = await sessionClient();
    await db.auth.signOut();
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
