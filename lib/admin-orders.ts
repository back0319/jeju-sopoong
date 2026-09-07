import type { SupabaseClient } from "@supabase/supabase-js";
import { kstDate } from "./domain";
import type { Order } from "./types";
export async function queryOrders(db: SupabaseClient, url: URL) {
  const from = url.searchParams.get("from") || kstDate(),
    to = url.searchParams.get("to") || from;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
    from > to
  )
    throw new Error("INVALID_INPUT");
  let query = db
    .from("orders")
    .select("*,order_items(*),order_surveys(*)")
    .gte("business_date", from)
    .lte("business_date", to)
    .order("created_at", { ascending: false });
  const status = url.searchParams.get("status"),
    language = url.searchParams.get("language");
  if (status) query = query.eq("status", status);
  if (language) query = query.eq("language", language);
  // PostgREST 페이지 한도를 넘는 기간도 누락 없이 조회합니다.
  const all: Order[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await query.range(page * 500, page * 500 + 499);
    if (error) throw new Error("DATABASE_UNAVAILABLE");
    all.push(...(data as Order[]));
    if (data.length < 500) break;
    page++;
  }
  const ingredient = url.searchParams.get("ingredient");
  return ingredient
    ? all.filter((o) =>
        o.order_items.some((i) =>
          [...i.snapshot.included, ...i.snapshot.toppings].some(
            (v) => v.id === ingredient,
          ),
        ),
      )
    : all;
}
