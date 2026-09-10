import { requireAdmin, serviceClient } from "@/lib/supabase/server";
import { json, failure, readBody, sameOrigin } from "@/lib/http";
import { readOrder, validateOrderInput } from "@/lib/order-service";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const { user } = await requireAdmin();
    const body = await readBody(req);
    if (typeof body.id !== "string" || !Number.isInteger(body.version)) throw new Error("INVALID_INPUT");
    validateOrderInput(body);
    const { error } = await serviceClient().rpc("edit_order", {
      p_order: body.id, p_version: body.version, p_actor: user.id, p_payload: body,
    });
    if (error) throw new Error(error.message);
    return json(await readOrder(body.id));
  } catch (e) { return failure(e); }
}
