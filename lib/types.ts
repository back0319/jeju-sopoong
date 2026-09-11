// config/languages.json과 DB의 language check 제약과 반드시 같은 목록을 유지합니다.
export const LANGUAGES = [
  "ko",
  "en",
  "zh-Hans",
  "zh-Hant",
  "ja",
  "id",
  "ar",
  "ms",
] as const;
export type Language = (typeof LANGUAGES)[number];
export const isLanguage = (value: unknown): value is Language =>
  typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
export type Ingredient = {
  id: string;
  name: string;
  label: string;
  kind: "fixed" | "base" | "topping" | "ready";
  position: number;
  image: string | null;
  price: number;
  // 판매하지 않는 재료는 고객 화면에서 빠집니다. 강제 품절과 달리 목록에도 나오지 않습니다.
  active?: boolean;
};
export type Stock = {
  business_date?: string;
  ingredient_id: string;
  remaining: number;
  forced_sold_out: boolean;
};
export type Product = {
  id: string;
  name: string;
  kind: "base" | "upgrade" | "extra";
  price: number | null;
  active: boolean;
};
export type Question = {
  id: string;
  title: string;
  type: "single" | "multiple" | "text";
  required: boolean;
  options: {
    id: string;
    label: string;
    linkedIngredientId?: string;
    exclusive?: boolean;
  }[];
};
export type Answers = Record<string, string[]>;
export type Content = {
  id: string;
  language: Language;
  title: string;
  body: string;
  image_url: string;
  video_url: string;
  version: number;
};
export type Catalog = {
  businessDate?: string;
  ingredients: Ingredient[];
  inventory: Stock[];
  products: Product[];
  contents: Content[];
  survey: { id: string; questions: Question[] };
  internalTest: boolean;
  configured: boolean;
};
export type CartItem = {
  kind: "gimbap" | "package" | "extra";
  excluded: string[];
  toppings: string[];
  productId?: string;
};
export type ItemSnapshot = {
  kind: CartItem["kind"];
  productId?: string;
  name: string;
  included: { id: string; name: string }[];
  excluded: { id: string; name: string }[];
  toppings: { id: string; name: string; price: number; free?: boolean }[];
  amount: number;
};
export type Order = {
  id: string;
  business_date: string;
  number: number;
  language: Language;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  total: number;
  created_at: string;
  updated_at: string;
  version: number;
  source: string;
  cancel_reason: string | null;
  order_items: { id: string; position: number; snapshot: ItemSnapshot }[];
  order_surveys?: {
    answers: Answers;
    survey_version: string | null;
    internal_test: boolean;
    consent: boolean;
    consent_at: string | null;
    survey_completed: boolean;
  } | null;
};
