import type { Order, Question } from "./types.ts";
export type SurveyVersion = { id: string; questions: Question[] };
export type ResearchData = {
  orders: Order[];
  versions: SurveyVersion[];
  generatedAt: string;
};
export function researchDataset(
  orders: Order[],
  versions: SurveyVersion[],
  from: string,
  to: string,
  generatedAt = new Date().toISOString(),
) {
  const participants = orders.map((o) => ({
    record_id: o.id,
    business_date: o.business_date,
    ordered_at: o.created_at,
    language: o.language,
    source: o.source,
    total_krw: o.total,
    item_count: o.order_items.length,
    survey_completed: o.order_surveys?.survey_completed ?? false,
    survey_version: o.order_surveys?.survey_version ?? null,
    consent: o.order_surveys?.consent ?? false,
    internal_test: o.order_surveys?.internal_test ?? false,
    answers: o.order_surveys?.consent ? o.order_surveys.answers : {},
  }));
  const items = orders.flatMap((o) =>
    [...o.order_items]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({
        record_id: o.id,
        item_index: i.position + 1,
        kind: i.snapshot.kind,
        name: i.snapshot.name,
        amount_krw: i.snapshot.amount,
        included: i.snapshot.included,
        excluded: i.snapshot.excluded,
        toppings: i.snapshot.toppings,
      })),
  );
  const metadata = {
    schema_version: "juseyo-research-v1",
    generated_at: generatedAt,
    from,
    to,
    timezone: "Asia/Seoul",
    currency: "KRW",
    record_count: participants.length,
    item_count: items.length,
    missing_value:
      "null or empty: not answered; binary 0: answered but option not selected",
    survey_versions: versions,
  };
  return { metadata, orders: participants, items };
}
export function researchTable(data: ReturnType<typeof researchDataset>) {
  const columns = [
    "record_id",
    "business_date",
    "ordered_at",
    "language",
    "source",
    "total_krw",
    "item_count",
    "survey_completed",
    "survey_version",
    "consent",
    "internal_test",
  ] as const;
  const questions = data.metadata.survey_versions.flatMap((v) =>
    v.questions.map((q) => ({ version: v.id, q, key: `${v.id}__${q.id}` })),
  );
  const headers: string[] = [
    ...columns,
    ...questions.flatMap(({ key, q }) =>
      q.type === "multiple" ? q.options.map((o) => `${key}__${o.id}`) : [key],
    ),
    "items_json",
  ];
  const rows = data.orders.map((o) => [
    ...columns.map((k) => o[k]),
    ...questions.flatMap<string | number | null>(({ version, q }) => {
      const a = o.answers[q.id];
      const answered =
        o.consent && o.survey_version === version && a && a.length > 0;
      return q.type === "multiple"
        ? q.options.map((option) =>
            answered ? Number(a.includes(option.id)) : null,
          )
        : [answered ? a[0] : null];
    }),
    JSON.stringify(data.items.filter((i) => i.record_id === o.record_id)),
  ]);
  return { headers, rows };
}
export function researchCodebook(versions: SurveyVersion[]) {
  return versions.flatMap((v) =>
    v.questions.flatMap((q) =>
      q.options.length
        ? q.options.map((o) => ({
            survey_version: v.id,
            column:
              q.type === "multiple"
                ? `${v.id}__${q.id}__${o.id}`
                : `${v.id}__${q.id}`,
            question_id: q.id,
            question: q.title,
            type: q.type,
            required: q.required,
            value: o.id,
            label: o.label,
            linked_ingredient: o.linkedIngredientId ?? null,
          }))
        : [
            {
              survey_version: v.id,
              column: `${v.id}__${q.id}`,
              question_id: q.id,
              question: q.title,
              type: q.type,
              required: q.required,
              value: "text",
              label: "자유 응답",
              linked_ingredient: null,
            },
          ],
    ),
  );
}
