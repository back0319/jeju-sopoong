"use client";
import { useState } from "react";
import type { Catalog, CartItem } from "@/lib/types";
import { itemPrice, money } from "@/lib/domain";
import { t } from "@/lib/client";
import { Check } from "./icons";
export function ItemBuilder({
  catalog,
  item,
  onChange,
  onSave,
  onBack,
  editing = false,
}: {
  catalog: Catalog;
  item: CartItem;
  onChange: (item: CartItem) => void;
  onSave: () => void;
  onBack: () => void;
  editing?: boolean;
}) {
  const [step, setStep] = useState(0);
  const upgrade = catalog.products.find((p) => p.id === "package" && p.active);
  const maxStep = upgrade ? 2 : 1;
  function toggle(field: "excluded" | "toppings", id: string) {
    onChange({
      ...item,
      [field]: item[field].includes(id)
        ? item[field].filter((v) => v !== id)
        : [...item[field], id],
    });
  }
  return (
    <>
      <div className="stack builder">
        <div className="row between">
          <button
            className="quiet"
            onClick={() => (step ? setStep(step - 1) : onBack())}
          >
            {t.back}
          </button>
          <span className="muted">
            {step + 1} / {maxStep + 1}
          </span>
        </div>
        <h1>
          {step === 0
            ? t.baseTitle
            : step === 1
              ? t.toppingTitle
              : t.upgradeTitle}
        </h1>
        <p className="muted">
          {step === 0
            ? t.baseDescription
            : step === 1
              ? t.toppingDescription
              : t.upgradeDescription}
        </p>
        {step === 0 && (
          <>
            <div className="row wrap">
              {catalog.ingredients
                .filter((i) => i.kind === "fixed")
                .map((i) => (
                  <span className="chip" key={i.id}>
                    <Check />
                    {i.name}
                  </span>
                ))}
            </div>
            <div className="grid2">
              {catalog.ingredients
                .filter((i) => i.kind === "base")
                .map((i) => (
                  <button
                    key={i.id}
                    aria-pressed={!item.excluded.includes(i.id)}
                    className={!item.excluded.includes(i.id) ? "selected" : ""}
                    onClick={() => toggle("excluded", i.id)}
                  >
                    <div className="row between">
                      <span>{i.name}</span>
                      <span className="muted">
                        {item.excluded.includes(i.id) ? t.excluded : t.included}
                      </span>
                    </div>
                  </button>
                ))}
            </div>
          </>
        )}
        {step === 1 && (
          <div className="grid2">
            {catalog.ingredients
              .filter((i) => i.kind === "topping")
              .map((i) => {
                const stock = catalog.inventory.find(
                  (s) => s.ingredient_id === i.id,
                );
                const out =
                  !stock || stock.remaining === 0 || stock.forced_sold_out;
                const selected = item.toppings.includes(i.id);
                return (
                  <button
                    key={i.id}
                    className={`ingredient-card ${selected ? "selected" : ""}`}
                    aria-pressed={selected}
                    disabled={out && !selected}
                    onClick={() => toggle("toppings", i.id)}
                  >
                    <img src={i.image!} alt={i.label} />
                    {out && <span className="soldout">{t.soldOut}</span>}
                    <div className="caption">
                      <strong>{i.label}</strong>
                      <div className="row between">
                        <span>{money(i.price)}</span>
                        {selected ? <Check /> : <span>+</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
        )}
        {step === 2 && (
          <div className="stack">
            <button
              className={item.kind === "gimbap" ? "selected" : ""}
              onClick={() => onChange({ ...item, kind: "gimbap" })}
            >
              {t.keepGimbap}
            </button>
            <button
              className={item.kind === "package" ? "selected" : ""}
              onClick={() => onChange({ ...item, kind: "package" })}
            >
              <span>{t.package}</span> + {money(upgrade?.price ?? 0)}
            </button>
          </div>
        )}
      </div>
      <div
        className="customer-footer"
        style={{ margin: "24px -22px -22px", marginTop: "auto" }}
      >
        <div className="row between" style={{ marginBottom: 12 }}>
          <span>{t.total}</span>
          <strong>{money(itemPrice(item, catalog))}</strong>
        </div>
        <button
          className="primary"
          onClick={() => (step < maxStep ? setStep(step + 1) : onSave())}
        >
          {step < maxStep ? t.next : editing ? t.saveChanges : t.saveItem}
        </button>
      </div>
    </>
  );
}
