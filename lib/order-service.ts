import "server-only";
import { serviceClient } from "./supabase/server";
import { getCatalog } from "./catalog";
import { validQuestion } from "./domain";
import type { Answers, Order } from "./types";
export async function readOrder(id: string): Promise<Order> {
  const { data, error } = await serviceClient()
    .from("orders")
    .select("*,order_items(*)")
    .eq("id", id)
    .single();
  if (error) throw new Error("NOT_FOUND");
  return data as Order;
}
export async function submitOrder(
  body: Record<string, unknown>,
  manual = false,
) {
  const db = serviceClient();
  if (
    typeof body.idempotencyKey !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.idempotencyKey,
    )
  )
    throw new Error("INVALID_ORDER");
  // 가격이나 설문 버전이 변경되어도 이미 성공한 제출은 복원할 수 있습니다.
  const { data: existing } = await db
    .from("orders")
    .select("id")
    .eq("idempotency_key", body.idempotencyKey)
    .maybeSingle();
  if (existing) return readOrder(existing.id);
  const catalog = await getCatalog();
  if (
    body.language !== "ko" ||
    !Array.isArray(body.items) ||
    body.items.length < 1 ||
    body.items.length > 30 ||
    !Number.isSafeInteger(body.expectedTotal)
  )
    throw new Error("INVALID_ORDER");
  for (const i of body.items) {
    if (
      !i ||
      !["gimbap", "package", "extra"].includes(i.kind) ||
      !Array.isArray(i.excluded) ||
      !Array.isArray(i.toppings) ||
      !i.excluded.every((v: unknown) => typeof v === "string") ||
      !i.toppings.every((v: unknown) => typeof v === "string") ||
      new Set(i.excluded).size !== i.excluded.length ||
      new Set(i.toppings).size !== i.toppings.length
    )
      throw new Error("INVALID_ORDER");
    if (
      i.kind === "extra" &&
      (i.excluded.length ||
        i.toppings.length ||
        typeof i.productId !== "string")
    )
      throw new Error("INVALID_ORDER");
  }
  let consentAt: string | null = null;
  const participating = !manual && body.surveySkipped !== true;
  if (participating) {
    if (body.consent !== true || typeof body.consentAt !== "string")
      throw new Error("CONSENT_REQUIRED");
    const time = Date.parse(body.consentAt);
    if (!Number.isFinite(time) || time > Date.now() + 60000)
      throw new Error("CONSENT_REQUIRED");
    consentAt = new Date(time).toISOString();
    const consent = catalog.contents.find(
      (c) => c.id === "consent" && c.language === "ko",
    );
    if (!catalog.internalTest && !consent?.body.trim())
      throw new Error("CONSENT_REQUIRED");
    const consentVersion = catalog.internalTest
      ? "internal-test-v1"
      : String(consent?.version);
    if (body.consentVersion !== consentVersion)
      throw new Error("CONSENT_REQUIRED");
    const answers = body.answers as Answers;
    if (
      body.surveyVersion !== catalog.survey.id ||
      !answers ||
      typeof answers !== "object" ||
      Array.isArray(answers) ||
      Object.keys(answers).some(
        (id) => !catalog.survey.questions.some((q) => q.id === id),
      ) ||
      !Object.values(answers).every(
        (a) => Array.isArray(a) && a.every((v) => typeof v === "string"),
      ) ||
      !catalog.survey.questions.every((q) => validQuestion(q, answers[q.id]))
    )
      throw new Error("INVALID_SURVEY");
  }
  const payload = {
    ...body,
    source: manual ? "manual" : "customer",
    surveyVersion: participating ? catalog.survey.id : null,
    answers: participating ? body.answers : {},
    surveyCompleted: participating,
    consent: participating,
    consentAt,
    consentVersion: participating ? body.consentVersion : null,
    internalTest: catalog.internalTest,
  };
  const { data, error } = await db.rpc("create_order", { payload });
  if (error) throw new Error(error.message);
  return readOrder(data);
}
