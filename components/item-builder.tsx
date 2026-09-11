"use client";
import { useEffect, useRef, useState } from "react";
import type { Catalog, CartItem } from "@/lib/types";
import { itemPrice, money } from "@/lib/domain";
import { t } from "@/lib/client";
import { ingredientName } from "@/lib/ingredient-detail";
import type { Language } from "@/lib/types";
import { Check } from "./icons";
export function ItemBuilder({
  catalog,
  item,
  language,
  copy,
  onChange,
  onSave,
  onBack,
  editing = false,
}: {
  catalog: Catalog;
  item: CartItem;
  language: Language;
  copy: typeof t;
  onChange: (item: CartItem) => void;
  onSave: () => void;
  onBack: () => void;
  editing?: boolean;
}) {
  const [step, setStep] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [step]);
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
      <div className="stack builder" ref={scrollRef}>
        <div className="row between">
          <button
            className="quiet"
            onClick={() => (step ? setStep(step - 1) : onBack())}
          >
            {copy.back}
          </button>
          <span className="muted">
            {step + 1} / {maxStep + 1}
          </span>
        </div>
        <h1>
          {step === 0
            ? copy.baseTitle
            : step === 1
              ? copy.toppingTitle
              : copy.upgradeTitle}
        </h1>
        <p className="muted">
          {step === 0
            ? copy.baseDescription
            : step === 1
              ? copy.toppingDescription
              : copy.upgradeDescription}
        </p>
        {step === 0 && (
          <>
            <div className="row wrap">
              {catalog.ingredients
                .filter((i) => i.kind === "fixed")
                .map((i) => (
                  <span className="chip" key={i.id}>
                    <Check />
                    {ingredientName(i.id, i.name, language)}
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
                      <span>{ingredientName(i.id, i.name, language)}</span>
                      <span className="muted">
                        {item.excluded.includes(i.id) ? copy.excluded : copy.included}
                      </span>
                    </div>
                  </button>
                ))}
            </div>
          </>
        )}
        {step === 1 &&
          (["topping", "ready"] as const).map((kind) => {
            const options = catalog.ingredients.filter((i) => i.kind === kind);
            if (!options.length) return null;
            return (
              <section className="stack" key={kind}>
                <h3>{kind === "topping" ? copy.jejuToppings : copy.readyToppings}</h3>
                <div className="grid2">
                  {options.map((i) => {
                    const stock = catalog.inventory.find(
                      (s) => s.ingredient_id === i.id,
                    );
                    const out =
                      !stock || stock.remaining === 0 || stock.forced_sold_out;
                    const selected = item.toppings.includes(i.id);
                    return (
                      <button
                        key={i.id}
                        // 기성품에는 그림이 없어 이름과 가격만 담은 낮은 카드로 둡니다.
                        className={`ingredient-card ${i.image ? "" : "plain"} ${selected ? "selected" : ""}`}
                        aria-pressed={selected}
                        disabled={out && !selected}
                        onClick={() => toggle("toppings", i.id)}
                      >
                        {i.image && <img src={i.image} alt={ingredientName(i.id, i.name, language)} />}
                        {out && <span className="soldout">{copy.soldOut}</span>}
                        <div className="caption">
                          <strong>{ingredientName(i.id, i.name, language)}</strong>
                          <div className="row between">
                            <span>{money(i.price)}</span>
                            {selected ? <Check /> : <span>+</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        {step === 2 && (
          <div className="stack">
            <section className="panel stack set-summary">
              <div className="row between">
                <h3>{copy.setTitle}</h3>
                <strong>
                  {money(
                    (catalog.products.find((p) => p.id === "gimbap")?.price ??
                      0) + (upgrade?.price ?? 0),
                  )}
                </strong>
              </div>
              <p className="muted" style={{ whiteSpace: "pre-line" }}>
                {copy.setItems}
              </p>
            </section>
            <button
              className={`choice ${item.kind === "gimbap" ? "selected" : ""}`}
              aria-pressed={item.kind === "gimbap"}
              onClick={() => onChange({ ...item, kind: "gimbap" })}
            >
              <span>{copy.keepGimbap}</span>
              <small className="muted">{copy.keepGimbapHint}</small>
            </button>
            <button
              className={`choice ${item.kind === "package" ? "selected" : ""}`}
              aria-pressed={item.kind === "package"}
              onClick={() => onChange({ ...item, kind: "package" })}
            >
              <span>
                {language === "ko" ? (upgrade?.name ?? copy.package) : copy.package} + {money(upgrade?.price ?? 0)}
              </span>
              <small className="muted">{copy.packageHint}</small>
            </button>
          </div>
        )}
      </div>
      <div
        className="customer-footer"
        style={{ margin: "24px -22px -22px", marginTop: "auto" }}
      >
        <div className="row between" style={{ marginBottom: 12 }}>
          <span>{copy.total}</span>
          <strong>{money(itemPrice(item, catalog))}</strong>
        </div>
        <button
          className="primary"
          onClick={() => (step < maxStep ? setStep(step + 1) : onSave())}
        >
          {step < maxStep ? copy.next : editing ? copy.saveChanges : copy.saveItem}
        </button>
      </div>
    </>
  );
}
