export type Language = "ko" | "en" | "ja" | "zh";
export type Ingredient = {
  id: string;
  name: string;
  label: string;
  kind: "fixed" | "base" | "topping";
  position: number;
  image: string | null;
  price: number;
};
export type Stock = {
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
  name: string;
  included: { id: string; name: string }[];
  excluded: { id: string; name: string }[];
  toppings: { id: string; name: string; price: number }[];
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
    survey_version: string;
    consent: boolean;
    consent_at: string | null;
    survey_completed: boolean;
  } | null;
};
