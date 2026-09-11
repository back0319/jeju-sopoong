import ingredients from "@/config/ingredients.json";
import translations from "@/config/ingredient-detail-i18n.json";
import type { Language } from "./types";
// 원물 소개 문구는 DB에 열이 없어 앱 설정 파일에만 둡니다.
export type IngredientDetail = {
  tagline?: string;
  taste?: string;
  texture?: string;
  diet?: string;
  allergyRaw?: string;
  allergySauce?: string;
};
type Localized = Record<string, Partial<Record<string, string>>>;
const table = translations as Record<string, Localized>;

export function detailOf(
  id: string,
  language: Language = "ko",
): IngredientDetail | undefined {
  const found = ingredients.find((i) => i.id === id) as
    | { detail?: IngredientDetail }
    | undefined;
  const korean = found?.detail;
  if (!korean) return undefined;
  if (language === "ko") return korean;
  // 번역이 비어 있는 항목은 한국어 원문으로 대신합니다.
  const localized = table[id] ?? {};
  return Object.fromEntries(
    Object.entries(korean).map(([field, value]) => [
      field,
      localized[field]?.[language]?.trim() || value,
    ]),
  ) as IngredientDetail;
}

import names from "@/config/ingredient-name-i18n.json";
const nameTable = names as Record<string, Partial<Record<string, string>>>;
// 재료 이름은 DB에 한국어로만 있습니다. 주문에 저장되는 값은 그대로 두고 표시만 바꿉니다.
export function ingredientName(
  id: string,
  korean: string,
  language: Language = "ko",
) {
  if (language === "ko") return korean;
  return nameTable[id]?.[language]?.trim() || korean;
}
