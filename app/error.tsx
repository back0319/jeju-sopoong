"use client";
import { t } from "@/lib/client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="customer">
      <div className="customer-main stack">
        <h1>{t.brand}</h1>
        <p role="alert">{t.errors.DATABASE_UNAVAILABLE}</p>
        <button onClick={reset}>{t.retry}</button>
      </div>
    </main>
  );
}
