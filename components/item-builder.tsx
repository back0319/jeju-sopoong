"use client";
import { useEffect, useRef, useState } from "react";
import type { Catalog, CartItem } from "@/lib/types";
import { itemPrice, money } from "@/lib/domain";
import { t } from "@/lib/client";
import { detailOf, ingredientName } from "@/lib/ingredient-detail";
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
  const sellable = (kind: string) =>
    catalog.ingredients.filter((i) => i.kind === kind && i.active !== false);
  // 기성품은 기본 재료와 함께 고르고, 제주 원물은 사진이 커서 따로 봅니다.
  const steps = [
    "base" as const,
    ...(sellable("topping").length ? (["topping"] as const) : []),
    ...(upgrade ? (["package"] as const) : []),
  ];
  const current = steps[Math.min(step, steps.length - 1)];
  const maxStep = steps.length - 1;
  function toppingCard(i: Catalog["ingredients"][number]) {
    const stock = catalog.inventory.find((s) => s.ingredient_id === i.id);
    const out = !stock || stock.remaining === 0 || stock.forced_sold_out;
    const selected = item.toppings.includes(i.id);
    // 고객에게는 메뉴 이름으로 보여 주고, 없는 재료는 재료명을 씁니다.
    const name =
      detailOf(i.id, language)?.menu || ingredientName(i.id, i.name, language);
    return (
      <button
        key={i.id}
        // 기성품에는 그림이 없어 이름과 가격만 담은 낮은 카드로 둡니다.
        className={`ingredient-card ${i.image ? "" : "plain"} ${selected ? "selected" : ""}`}
        aria-pressed={selected}
        disabled={out && !selected}
        onClick={() => toggle("toppings", i.id)}
      >
        {i.image && <img src={i.image} alt={name} />}
        {out && <span className="soldout">{copy.soldOut}</span>}
        <div className="caption">
          <strong>{name}</strong>
          <div className="row between">
            <span>{money(i.price)}</span>
            {selected ? <Check /> : <span>+</span>}
          </div>
        </div>
      </button>
    );
  }
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
            {step + 1} / {steps.length}
          </span>
        </div>
        <h1>
          {current === "base"
            ? copy.baseTitle
            : current === "topping"
              ? copy.toppingTitle
              : copy.upgradeTitle}
        </h1>
        <p className="muted">
          {current === "base"
            ? copy.baseDescription
            : current === "topping"
              ? copy.toppingDescription
              : copy.upgradeDescription}
        </p>
        {current === "base" && (
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
            {sellable("ready").length > 0 && (
              <section className="stack">
                <h3>{copy.readyToppingTitle}</h3>
                <div className="grid2">
                  {sellable("ready").map((i) => toppingCard(i))}
                </div>
              </section>
            )}
          </>
        )}
        {current === "topping" &&
          (() => {
            const options = sellable("topping");
            return (
              <section className="stack" key="topping">
                <div className="grid2">
                  {options.map((i) => toppingCard(i))}
                </div>
              </section>
            );
          })()}
        {current === "package" && (
          <div className="stack">
            {/* 권하는 세트를 먼저 보여 주고, 그대로 두는 선택지를 아래에 둡니다. */}
            <button
              className={`choice ${item.kind === "package" ? "selected" : ""}`}
              aria-pressed={item.kind === "package"}
              onClick={() => onChange({ ...item, kind: "package" })}
            >
              <span>
                {copy.setTitle} + {money(upgrade?.price ?? 0)}
              </span>
              <small className="muted">{copy.packageHint}</small>
            </button>
            <button
              className={`choice ${item.kind === "gimbap" ? "selected" : ""}`}
              aria-pressed={item.kind === "gimbap"}
              onClick={() => onChange({ ...item, kind: "gimbap" })}
            >
              <span>{copy.keepGimbap}</span>
              <small className="muted">{copy.keepGimbapHint}</small>
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
