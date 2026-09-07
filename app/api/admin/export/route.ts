import { requireAdmin } from "@/lib/supabase/server";
import { failure } from "@/lib/http";
import { queryOrders } from "@/lib/admin-orders";
import { csvCell, kstDate } from "@/lib/domain";
export async function GET(req: Request) {
  try {
    const { client } = await requireAdmin();
    const url = new URL(req.url);
    const orders = await queryOrders(client, url);
    const from = url.searchParams.get("from") || kstDate(),
      to = url.searchParams.get("to") || from;
    const rows: unknown[][] = [
      ["생성일시", new Date().toISOString(), "조회시작", from, "조회종료", to],
      [
        "영업일",
        "주문번호",
        "주문시각",
        "언어",
        "상태",
        "주문출처",
        "총액",
        "항목구성",
        "설문버전",
        "설문응답",
        "동의",
        "동의시각",
      ],
    ];
    for (const o of orders) {
      const s = o.order_surveys;
      rows.push([
        o.business_date,
        o.number,
        o.created_at,
        o.language,
        o.status,
        o.source,
        o.total,
        o.order_items
          .sort((a, b) => a.position - b.position)
          .map((i) => i.snapshot),
        s?.survey_version,
        s?.answers,
        s?.consent,
        s?.consent_at,
      ]);
    }
    return new Response(
      "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="juseyo-${from}-${to}-${Date.now()}.csv"`,
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
