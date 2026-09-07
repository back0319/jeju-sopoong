import { requireAdmin } from "@/lib/supabase/server";
import { failure } from "@/lib/http";
import { queryOrders } from "@/lib/admin-orders";
import { csvCell, kstDate } from "@/lib/domain";
import {
  researchDataset,
  researchTable,
  researchCodebook,
} from "@/lib/research";
export async function GET(req: Request) {
  try {
    const { client } = await requireAdmin();
    const url = new URL(req.url);
    const [orders, versions] = await Promise.all([
      queryOrders(client, url),
      client.from("survey_versions").select("id,questions").order("id"),
    ]);
    if (versions.error) throw new Error("DATABASE_UNAVAILABLE");
    const from = url.searchParams.get("from") || kstDate(),
      to = url.searchParams.get("to") || from;
    const dataset = researchDataset(orders, versions.data, from, to);
    const format = url.searchParams.get("format") || "csv";
    let body: string, type: string, extension: string;
    if (format === "json") {
      body = JSON.stringify(dataset, null, 2);
      type = "application/json";
      extension = "json";
    } else {
      let headers: string[], rows: unknown[][];
      if (format === "codebook") {
        const codes = researchCodebook(versions.data);
        headers = [
          "survey_version",
          "column",
          "question_id",
          "question",
          "type",
          "required",
          "value",
          "label",
          "linked_ingredient",
        ];
        rows = codes.map((c) => headers.map((h) => c[h as keyof typeof c]));
      } else if (format === "items") {
        headers = [
          "record_id",
          "item_index",
          "kind",
          "name",
          "amount_krw",
          "included",
          "excluded",
          "toppings",
        ];
        rows = dataset.items.map((i) =>
          headers.map((h) => i[h as keyof typeof i]),
        );
      } else if (format === "csv") {
        ({ headers, rows } = researchTable(dataset));
      } else throw new Error("INVALID_INPUT");
      // 분석 도구가 바로 읽을 수 있도록 첫 행은 고정 헤더, 모든 행은 같은 열 수를 사용합니다.
      headers.push("exported_at", "range_from", "range_to");
      rows = rows.map((r) => [...r, dataset.metadata.generated_at, from, to]);
      body =
        "\uFEFF" +
        [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
      type = "text/csv; charset=utf-8";
      extension = "csv";
    }
    return new Response(body, {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `attachment; filename="juseyo-${format}-${from}-${to}.${extension}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
