import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  kstDate,
  koreanIngredientName,
  expiredOrder,
  itemPrice,
  newItem,
  validQuestion,
  toggleAnswer,
  csvCell,
} from "../lib/domain.ts";
import type { Catalog, Question } from "../lib/types.ts";
const survey = JSON.parse(
  readFileSync(new URL("../config/survey.json", import.meta.url), "utf8"),
);
const catalog = {
  ingredients: JSON.parse(
    readFileSync(
      new URL("../config/ingredients.json", import.meta.url),
      "utf8",
    ),
  ),
  inventory: [],
  contents: [],
  internalTest: true,
  configured: true,
  products: [
    {
      id: "gimbap",
      name: "기본 김밥",
      kind: "base",
      active: true,
      price: 5000,
    },
    {
      id: "package",
      name: "패키지",
      kind: "upgrade",
      active: true,
      price: 10000,
    },
  ],
  survey,
} as Catalog;
test("가격: 기본 재료를 빼도 5,000원, 패키지와 토핑은 18,000원", () => {
  assert.equal(
    itemPrice({ kind: "gimbap", excluded: ["egg"], toppings: [] }, catalog),
    5000,
  );
  assert.equal(
    itemPrice({ kind: "package", excluded: [], toppings: ["pork"] }, catalog),
    18000,
  );
});
test("S8: 배타 선택과 자동 제외, 기존 구성 불변", () => {
  const q = survey.questions.find((q: Question) => q.id === "S8");
  assert.deepEqual(toggleAnswer(q, ["egg"], "none"), ["none"]);
  assert.deepEqual(toggleAnswer(q, ["none"], "egg"), ["egg"]);
  const item = newItem(catalog, { S8: ["egg", "pork"] });
  assert.deepEqual(item.excluded, ["egg"]);
  assert.deepEqual(item.toppings, []);
  newItem(catalog, { S8: ["ham"] });
  assert.deepEqual(item.excluded, ["egg"]);
});
test("설문 필수·선택·미등록 값·배타 값·단답을 검증한다", () => {
  assert.equal(validQuestion(survey.questions[0], []), false);
  assert.equal(validQuestion(survey.questions[2], []), true);
  assert.equal(validQuestion(survey.questions[0], ["unknown"]), false);
  assert.equal(validQuestion(survey.questions[7], ["none", "egg"]), false);
  const q: Question = {
    id: "text",
    title: "",
    type: "text",
    required: true,
    options: [],
  };
  assert.equal(validQuestion(q, ["  "]), false);
  assert.equal(validQuestion(q, ["테스트"]), true);
});
test("KST 자정과 4시간 만료를 구분한다", () => {
  assert.equal(kstDate(new Date("2026-09-09T14:59:59Z")), "2026-09-09");
  assert.equal(kstDate(new Date("2026-09-09T15:00:00Z")), "2026-09-10");
  const now = new Date("2026-09-10T03:00:00Z");
  assert.equal(
    expiredOrder(
      { date: "2026-09-10", savedAt: now.getTime() - 4 * 3600000 },
      now,
    ),
    true,
  );
  assert.equal(
    expiredOrder({ date: "2026-09-10", savedAt: now.getTime() - 1000 }, now),
    false,
  );
  assert.equal(
    expiredOrder({ date: "2026-09-09", savedAt: now.getTime() - 1000 }, now),
    false,
  );
});
test("저장 기기의 KST 자정 변경으로 만료하고 DB 영업일 차이는 완료 화면을 지우지 않는다", () => {
  const savedAt = Date.parse("2026-09-09T14:59:59Z");
  assert.equal(expiredOrder({date:"2026-09-12",savedAt},new Date(savedAt+500)),false);
  assert.equal(expiredOrder({date:"2026-09-12",savedAt},new Date(savedAt+1000)),true);
});
test("CSV는 쉼표·줄바꿈·따옴표를 보존하며 수식 실행을 방지한다", () => {
  assert.equal(csvCell('a,"b"\nc'), '"a,""b""\nc"');
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell(" @SUM(A1)"), '"\' @SUM(A1)"');
});

test("기존 주문의 영문 재료만 한국어로 표시한다", () => {
  assert.equal(koreanIngredientName("PORK"), "제주 돼지고기");
  assert.equal(koreanIngredientName("TURBAN SHELL"), "뿔소라");
  assert.equal(koreanIngredientName("FERNBRAKE"), "고사리");
  assert.equal(koreanIngredientName("CARROT"), "당근");
  assert.equal(koreanIngredientName("별도 재료 이름"), "별도 재료 이름");
});
