"use client";
import { useState } from "react";
import type { Catalog, CartItem, Order } from "@/lib/types";
import { api, errorText, t } from "@/lib/client";
import { itemPrice, money, newItem } from "@/lib/domain";
import { ItemBuilder } from "./item-builder";
export function ManualOrder({
  catalog,
  onDone,
  onClose,
}: {
  catalog: Catalog;
  onDone: (o: Order) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<CartItem[]>([]),
    [item, setItem] = useState<CartItem | null>(newItem(catalog, {})),
    [key, setKey] = useState(() => crypto.randomUUID()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const total = items.reduce((sum, i) => sum + itemPrice(i, catalog), 0);
  return (
    <div className="overlay">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t.manual}
        className="modal stack"
      >
        <div className="row between">
          <h2>{t.manual}</h2>
          <button onClick={onClose} disabled={busy}>
            {t.dismiss}
          </button>
        </div>
        <p className="muted">{t.manualDescription}</p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {item ? (
          <div className="stack" style={{ padding: "0 22px 22px" }}>
            <ItemBuilder
              catalog={catalog}
              item={item}
              onChange={setItem}
              onBack={() => setItem(null)}
              onSave={() => {
                setItems([...items, item]);
                setItem(null);
                setKey(crypto.randomUUID());
              }}
            />
          </div>
        ) : (
          <>
            <div className="stack">
              {items.map((i, n) => (
                <div className="row between" key={n}>
                  <span>
                    {n + 1}.{" "}
                    {i.kind === "package"
                      ? t.package
                      : i.kind === "extra"
                        ? catalog.products.find((p) => p.id === i.productId)
                            ?.name
                        : t.gimbap}{" "}
                    {money(itemPrice(i, catalog))}
                  </span>
                  <button
                    onClick={() => {
                      setItems(items.filter((_, idx) => idx !== n));
                      setKey(crypto.randomUUID());
                    }}
                  >
                    {t.delete}
                  </button>
                </div>
              ))}
            </div>
            <button
              disabled={items.length >= 30}
              onClick={() => setItem(newItem(catalog, {}))}
            >
              {t.addItem}
            </button>
            {catalog.products
              .filter((p) => p.kind === "extra" && p.active)
              .map((p) => (
                <button
                  key={p.id}
                  disabled={items.length >= 30}
                  onClick={() => {
                    setItems([
                      ...items,
                      {
                        kind: "extra",
                        productId: p.id,
                        excluded: [],
                        toppings: [],
                      },
                    ]);
                    setKey(crypto.randomUUID());
                  }}
                >
                  {p.name} + {money(p.price!)}
                </button>
              ))}
            <strong>
              {t.total} {money(total)}
            </strong>
            <button
              className="primary"
              disabled={busy || !items.length}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const o = await api<Order>("/api/admin/orders", "POST", {
                    idempotencyKey: key,
                    language: "ko",
                    items,
                    expectedTotal: total,
                  });
                  onDone(o);
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? t.submitting : t.manualSubmit}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
