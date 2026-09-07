"use client";
import { useState } from "react";
import type { Catalog, Order } from "@/lib/types";
import { api, errorText, t } from "@/lib/client";
import { kstDate, money, orderNumber } from "@/lib/domain";
export function AdminData({ catalog }: { catalog: Catalog }) {
  const [orders, setOrders] = useState<Order[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="stack">
      <h1>{t.data}</h1>
      <form
        className="row wrap"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          const q = new URLSearchParams();
          for (const [k, v] of f) if (v) q.set(k, String(v));
          try {
            setOrders(await api<Order[]>("/api/admin/orders?" + q));
            setQuery(q.toString());
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {t.from}
          <input name="from" type="date" required defaultValue={kstDate()} />
        </label>
        <label>
          {t.to}
          <input name="to" type="date" required defaultValue={kstDate()} />
        </label>
        <label>
          {t.status}
          <select name="status">
            <option value="">{t.all}</option>
            {(["PENDING", "COMPLETED", "CANCELLED"] as const).map((s, i) => (
              <option key={s} value={s}>
                {[t.pending, t.completed, t.cancel][i]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.language}
          <select name="language">
            <option value="">{t.all}</option>
            {["ko", "en", "ja", "zh"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label>
          {t.ingredient}
          <select name="ingredient">
            <option value="">{t.all}</option>
            {catalog.ingredients.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <button className="primary" disabled={busy}>
          {t.search}
        </button>
        {query && <a href={"/api/admin/export?" + query}>{t.csv}</a>}
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {[
                t.orderNumber,
                t.status,
                t.language,
                t.total,
                t.orderDetails,
                t.answers,
              ].map((v) => (
                <th key={v}>{v}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  {o.business_date}
                  <br />
                  <strong>{orderNumber(o.number)}</strong>
                </td>
                <td>{o.status}</td>
                <td>{o.language}</td>
                <td>{money(o.total)}</td>
                <td className="survey-cell">
                  {o.order_items.map((i) => (
                    <p key={i.id}>
                      {i.snapshot.name} ·{" "}
                      {i.snapshot.toppings.map((v) => v.name).join(", ")}{" "}
                      {i.snapshot.excluded.length > 0 && (
                        <span className="excluded">
                          {i.snapshot.excluded.map((v) => v.name).join(", ")}
                        </span>
                      )}
                    </p>
                  ))}
                </td>
                <td className="survey-cell">
                  {Object.entries(o.order_surveys?.answers || {}).map(
                    ([id, a]) => (
                      <p key={id}>
                        {id}:{" "}
                        {a
                          .map(
                            (v) =>
                              catalog.survey.questions
                                .find((q) => q.id === id)
                                ?.options.find((o) => o.id === v)?.label || v,
                          )
                          .join(", ")}
                      </p>
                    ),
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length && <p className="empty">{t.noOrders}</p>}
      </div>
    </div>
  );
}
