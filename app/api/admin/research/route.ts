import { requireAdmin } from "@/lib/supabase/server";
import { queryOrders } from "@/lib/admin-orders";
import { failure, json } from "@/lib/http";
export async function GET(req: Request) {
  try {
    const { client } = await requireAdmin();
    const [orders, versions] = await Promise.all([
      queryOrders(client, new URL(req.url)),
      client.from("survey_versions").select("id,questions").order("id"),
    ]);
    if (versions.error) throw new Error("DATABASE_UNAVAILABLE");
    return json({
      orders,
      versions: versions.data,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return failure(e);
  }
}
