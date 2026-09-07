import test from "node:test";
import assert from "node:assert/strict";
import {
  researchDataset,
  researchTable,
  researchCodebook,
} from "../lib/research.ts";
import type { Order } from "../lib/types.ts";
const versions = [
  {
    id: "v1",
    questions: [
      {
        id: "S8",
        title: "제외 재료",
        type: "multiple" as const,
        required: true,
        options: [
          { id: "egg", label: "계란" },
          { id: "none", label: "해당 없음" },
        ],
      },
    ],
  },
];
const base = {
  number: 1,
  updated_at: "2026-09-07T00:00:00Z",
  version: 0,
  cancel_reason: null,
  id: "record",
  business_date: "2026-09-07",
  created_at: "2026-09-07T00:00:00Z",
  language: "ko",
  source: "customer",
  status: "COMPLETED",
  total: 5000,
  order_items: [
    {
      id: "item",
      position: 0,
      snapshot: {
        kind: "gimbap",
        name: "기본 김밥",
        amount: 5000,
        included: [],
        excluded: [],
        toppings: [],
      },
    },
  ],
} as Order;
test("연구 파일은 미참여와 비선택을 구분하고 처리 상태를 제외한다", () => {
  const orders = [
    {
      ...base,
      order_surveys: {
        answers: { S8: ["egg"] },
        survey_version: "v1",
        survey_completed: true,
        consent: true,
        consent_at: null,
        internal_test: true,
      },
    },
    {
      ...base,
      id: "skipped",
      order_surveys: {
        answers: { S8: ["egg"] },
        survey_version: null,
        survey_completed: false,
        consent: false,
        consent_at: null,
        internal_test: true,
      },
    },
  ];
  const data = researchDataset(orders, versions, "2026-09-07", "2026-09-07");
  assert.deepEqual(data.orders[1].answers, {});
  assert.equal("status" in data.orders[0], false);
  const table = researchTable(data),
    egg = table.headers.indexOf("v1__S8__egg"),
    none = table.headers.indexOf("v1__S8__none");
  assert.equal(table.rows[0][egg], 1);
  assert.equal(table.rows[0][none], 0);
  assert.equal(table.rows[1][egg], null);
  assert.ok(table.rows.every((r) => r.length === table.headers.length));
  assert.equal(data.items[1].record_id, "skipped");
  assert.equal(researchCodebook(versions)[0].label, "계란");
});
