import ko from "@/locales/ko.json";
export const t = ko;
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
