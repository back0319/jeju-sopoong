import type { Answers, CartItem, Catalog, Question } from "./types.ts";
export const kstDate = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export const money = (amount: number) =>
  new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount);
export const orderNumber = (n: number) => String(n).padStart(3, "0");
export function validQuestion(q: Question, value: string[] = []) {
  if (!value.length) return !q.required;
  if (new Set(value).size !== value.length) return false;
  if (q.type === "text")
    return (
      value.length === 1 && value[0].trim().length > 0 && value[0].length <= 200
    );
  if (q.type === "single" && value.length !== 1) return false;
  return (
    value.every((v) => q.options.some((o) => o.id === v)) &&
    !(
      value.length > 1 &&
      q.options.some((o) => o.exclusive && value.includes(o.id))
    )
  );
}
export function toggleAnswer(
  q: Question,
  previous: string[],
  selected: string,
) {
  const option = q.options.find((o) => o.id === selected);
  if (q.type === "single" || option?.exclusive) return [selected];
  return previous.includes(selected)
    ? previous.filter((v) => v !== selected)
    : [
        ...previous.filter(
          (v) => !q.options.find((o) => o.id === v)?.exclusive,
        ),
        selected,
      ];
}
export function newItem(catalog: Catalog, answers: Answers): CartItem {
  const avoid = catalog.survey.questions.flatMap((q) =>
    q.options
      .filter((o) => (answers[q.id] || []).includes(o.id))
      .map((o) => o.linkedIngredientId),
  );
  return {
    kind: "gimbap",
    excluded: catalog.ingredients
      .filter((i) => i.kind === "base" && avoid.includes(i.id))
      .map((i) => i.id),
    toppings: [],
  };
}
export function itemPrice(item: CartItem, catalog: Catalog) {
  if (item.kind === "extra")
    return catalog.products.find((p) => p.id === item.productId)?.price ?? 0;
  return (
    (catalog.products.find((p) => p.id === "gimbap")?.price ?? 0) +
    (item.kind === "package"
      ? (catalog.products.find((p) => p.id === "package")?.price ?? 0)
      : 0) +
    item.toppings.reduce(
      (sum, id) =>
        sum + (catalog.ingredients.find((i) => i.id === id)?.price ?? 0),
      0,
    )
  );
}
export function expiredOrder(
  saved: { savedAt: number; date: string },
  now = new Date(),
) {
  return (
    !Number.isFinite(saved.savedAt) ||
    now.getTime() - saved.savedAt >= 4 * 60 * 60 * 1000 ||
    saved.savedAt > now.getTime() ||
    saved.date !== kstDate(now)
  );
}
export function csvCell(value: unknown) {
  let s =
    typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
