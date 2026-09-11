import ko from "@/locales/ko.json";
import en from "@/locales/en.json";
import zhHans from "@/locales/zh-Hans.json";
import zhHant from "@/locales/zh-Hant.json";
import ja from "@/locales/ja.json";
import id from "@/locales/id.json";
import ar from "@/locales/ar.json";
import ms from "@/locales/ms.json";
import languageConfig from "@/config/languages.json";
import type { Language } from "./types";
export const t = ko;
export const languages = languageConfig as {
  code: Language;
  label: string;
  dir: "ltr" | "rtl";
}[];
export const direction = (language: Language) =>
  languages.find((l) => l.code === language)?.dir ?? "ltr";
type Dictionary = typeof ko;
const dictionaries: Record<Language, Partial<Dictionary>> = {
  ko,
  en,
  "zh-Hans": zhHans,
  "zh-Hant": zhHant,
  ja,
  id,
  ar,
  ms,
};
// 번역이 비어 있는 항목은 한국어로 대체합니다. 언어 파일이 채워지는 대로 그대로 동작합니다.
export function dict(language: Language): Dictionary {
  if (language === "ko") return ko;
  const source = dictionaries[language] ?? {};
  const fill = (base: unknown, current: unknown): unknown => {
    if (base && typeof base === "object" && !Array.isArray(base))
      return Object.fromEntries(
        Object.entries(base).map(([key, value]) => [
          key,
          fill(value, (current as Record<string, unknown>)?.[key]),
        ]),
      );
    return typeof current === "string" && current.trim() ? current : base;
  };
  return fill(ko, source) as Dictionary;
}
export async function api<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "DATABASE_UNAVAILABLE");
  return data;
}
export function errorText(e: unknown) {
  const key = e instanceof Error ? e.message : "DATABASE_UNAVAILABLE";
  return (
    t.errors[key as keyof typeof t.errors] || t.errors.DATABASE_UNAVAILABLE
  );
}
export function stored<T>(
  kind: "localStorage" | "sessionStorage",
  key: string,
): T | null {
  try {
    return JSON.parse(window[kind].getItem(key) || "null") as T | null;
  } catch {
    return null;
  }
}
export function persist(
  kind: "localStorage" | "sessionStorage",
  key: string,
  value: unknown,
) {
  try {
    if (value === null) window[kind].removeItem(key);
    else window[kind].setItem(key, JSON.stringify(value));
  } catch {
    /* 저장소가 차단되어도 현재 주문은 메모리에서 계속 진행합니다. */
  }
}
