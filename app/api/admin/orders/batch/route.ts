import { requireAdmin, serviceClient } from "@/lib/supabase/server";
import { json, failure, readBody, sameOrigin } from "@/lib/http";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const { user } = await requireAdmin();
    const body = await readBody(req);
    if (!Array.isArray(body.orders) || !body.orders.length || body.orders.length > 30 ||
      !["COMPLETED", "PENDING"].includes(String(body.status)) ||
      !body.orders.every((o) => o && typeof o.id === "string" && Number.isInteger(o.version))) throw new Error("INVALID_INPUT");
    const { data, error } = await serviceClient().rpc("batch_order_status", {
      p_orders: body.orders, p_status: body.status, p_actor: user.id,
    });
    if (error) throw new Error(error.message);
    return json(data);
  } catch (e) { return failure(e); }
}
