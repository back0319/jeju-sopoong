import { requireAdmin, serviceClient } from "@/lib/supabase/server";
import { json, failure, readBody, sameOrigin } from "@/lib/http";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const { user } = await requireAdmin();
    const b = await readBody(req);
    if (
      typeof b.id !== "string" ||
      typeof b.status !== "string" ||
      !Number.isInteger(b.version) ||
      (b.reason != null &&
        (typeof b.reason !== "string" || b.reason.length > 300))
    )
      throw new Error("INVALID_INPUT");
    const { data, error } = await serviceClient().rpc("change_order_status", {
      p_order: b.id,
      p_status: b.status,
      p_version: b.version,
      p_actor: user.id,
      p_reason: b.reason || null,
    });
    if (error) throw new Error(error.message);
    return json(data);
  } catch (e) {
    return failure(e);
  }
}
