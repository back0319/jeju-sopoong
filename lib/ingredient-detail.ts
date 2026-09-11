import ingredients from "@/config/ingredients.json";
// 원물 소개 문구는 DB에 열이 없어 앱 설정 파일에만 둡니다.
export type IngredientDetail = {
  tagline?: string;
  taste?: string;
  texture?: string;
  diet?: string;
  allergyRaw?: string;
  allergySauce?: string;
};
export function detailOf(id: string): IngredientDetail | undefined {
  const found = ingredients.find((i) => i.id === id) as
    | { detail?: IngredientDetail }
    | undefined;
  return found?.detail;
}
