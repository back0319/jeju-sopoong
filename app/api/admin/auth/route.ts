import { requireAdmin, sessionClient } from "@/lib/supabase/server";
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
    if (typeof b.email !== "string" || typeof b.password !== "string")
      throw new Error("INVALID_INPUT");
    const db = await sessionClient();
    const { error } = await db.auth.signInWithPassword({
      email: b.email,
      password: b.password,
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
