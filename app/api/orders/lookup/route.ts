import { serviceClient } from "@/lib/supabase/server";
import { json, failure } from "@/lib/http";
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const date = q.get("date"),
      number = q.get("number");
    if (
      !date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !number ||
      !/^\d{1,9}$/.test(number)
    )
      throw new Error("INVALID_INPUT");
    const { data, error } = await serviceClient()
      .from("orders")
      .select(
        "id,business_date,number,status,total,created_at,order_items(id,position,snapshot)",
      )
      .eq("business_date", date)
      .eq("number", Number(number))
      .maybeSingle();
    if (error) throw new Error("DATABASE_UNAVAILABLE");
    if (!data) throw new Error("NOT_FOUND");
    return json(data);
  } catch (e) {
    return failure(e);
  }
}
