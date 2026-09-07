import { requireAdmin } from "@/lib/supabase/server";
import { json, failure, readBody, sameOrigin } from "@/lib/http";
import { submitOrder } from "@/lib/order-service";
import { queryOrders } from "@/lib/admin-orders";
export async function GET(req: Request) {
  try {
    const { client } = await requireAdmin();
    return json(await queryOrders(client, new URL(req.url)));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await requireAdmin();
    return json(await submitOrder(await readBody(req), true), 201);
  } catch (e) {
    return failure(e);
  }
}
