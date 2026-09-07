import { NextResponse } from "next/server";
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  const known = [
    "UNAUTHORIZED",
    "FORBIDDEN",
    "NOT_CONFIGURED",
    "INVALID_ORDER",
    "INVALID_SURVEY",
    "CONSENT_REQUIRED",
    "OUT_OF_STOCK",
    "PRICE_CHANGED",
    "PRODUCT_UNAVAILABLE",
    "STALE_ORDER",
    "FINAL_STATE",
    "UNDO_EXPIRED",
    "REASON_REQUIRED",
    "INVALID_STATE",
    "NOT_FOUND",
    "INVALID_INPUT",
    "DATABASE_UNAVAILABLE",
  ];
  const code =
    known.find((c) => message.startsWith(c)) || "DATABASE_UNAVAILABLE";
  return json(
    { error: code },
    code === "UNAUTHORIZED"
      ? 401
      : code === "FORBIDDEN"
        ? 403
        : code === "NOT_FOUND"
          ? 404
          : ["NOT_CONFIGURED", "DATABASE_UNAVAILABLE"].includes(code)
            ? 503
            : 409,
  );
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new Error("FORBIDDEN");
}
export async function readBody(req: Request): Promise<Record<string, unknown>> {
  if (Number(req.headers.get("content-length") || 0) > 100000)
    throw new Error("INVALID_INPUT");
  const text = await req.text();
  if (text.length > 100000) throw new Error("INVALID_INPUT");
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw 0;
    return value;
  } catch {
    throw new Error("INVALID_INPUT");
  }
}
