"use client";
import { useState } from "react";
import type { Catalog, Content, Product, Stock } from "@/lib/types";
import { api, errorText, languages, t } from "@/lib/client";
export function AdminSettings({
  catalog,
  onRefresh,
}: {
  catalog: Catalog;
  onRefresh: () => Promise<void>;
}) {
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(body: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("/api/admin/settings", "POST", body);
      await onRefresh();
      setMessage(t.saved);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="settings-grid">
        <section className="panel stack">
          <h2>{t.stock}</h2>
          <p className="muted">잔여 수량은 매일 자정(한국 시간)에 0으로 초기화됩니다. 영업 시작 전에 오늘 수량을 입력하세요.</p>
          {catalog.inventory
            // 수량을 세지 않는 품목은 입력할 값이 없어 아래 기성품 칸에서 다룹니다.
            .filter(
              (s) =>
                catalog.ingredients.find((i) => i.id === s.ingredient_id)
                  ?.tracked !== false,
            )
            .map((s) => (
              <StockForm
                key={`${s.ingredient_id}:${s.remaining}:${s.forced_sold_out}`}
                stock={s}
                name={
                  catalog.ingredients.find((i) => i.id === s.ingredient_id)!
                    .name
                }
                busy={busy}
                save={save}
              />
            ))}
          <PriceRow
            key={`topping:${catalog.ingredients.find((i) => i.kind === "topping")?.price}`}
            label={t.toppingPrice}
            price={
              catalog.ingredients.find((i) => i.kind === "topping")?.price ?? 0
            }
            busy={busy}
            onSave={(price) => save({ type: "topping-price", price })}
          />
          <h3>{t.readyToppings}</h3>
          <p className="muted">
            기성품은 품목마다 가격을 정합니다. 재고 관리를 끄면 기본 재료처럼
            수량을 세지 않고 늘 주문할 수 있습니다.
          </p>
          {catalog.ingredients
            .filter((i) => i.kind === "ready")
            .map((i) => (
              <div key={`${i.id}:${i.price}:${i.tracked}`} className="ready-row">
                <PriceRow
                  label={i.name}
                  price={i.price}
                  busy={busy}
                  onSave={(price) =>
                    save({ type: "ingredient-price", id: i.id, price })
                  }
                />
                <label className="row">
                  <input
                    type="checkbox"
                    checked={i.tracked !== false}
                    disabled={busy}
                    onChange={(e) =>
                      void save({
                        type: "ingredient-tracked",
                        id: i.id,
                        tracked: e.target.checked,
                      })
                    }
                  />
                  {t.trackStock}
                </label>
                {/* 수량을 세지 않아도 오늘만 품절인 경우는 여기서 막습니다. */}
                {i.tracked === false && (
                  <label className="row">
                    <input
                      type="checkbox"
                      checked={
                        catalog.inventory.find((v) => v.ingredient_id === i.id)
                          ?.forced_sold_out ?? false
                      }
                      disabled={busy}
                      onChange={(e) => {
                        const stock = catalog.inventory.find(
                          (v) => v.ingredient_id === i.id,
                        );
                        if (!stock) return;
                        void save({
                          type: "inventory",
                          id: i.id,
                          remaining: stock.remaining,
                          previousRemaining: stock.remaining,
                          previousForced: stock.forced_sold_out,
                          previousDate: stock.business_date,
                          forced_sold_out: e.target.checked,
                        });
                      }}
                    />
                    {t.forcedSoldOut}
                  </label>
                )}
              </div>
            ))}
        </section>
        <section className="panel stack">
          <h2>{t.settings}</h2>
          {catalog.products.map((p) => (
            <ProductForm
              key={`${p.id}:${p.price}:${p.active}:${p.name}`}
              product={p}
              busy={busy}
              save={save}
            />
          ))}
          <h3>{t.createProduct}</h3>
          <ProductForm key="new" busy={busy} save={save} />
        </section>
      </div>
    </div>
  );
}
// 이름과 가격 한 칸, 그리고 바꿨을 때만 켜지는 저장. 재고 줄과 같은 모양입니다.
function PriceRow({
  label,
  price,
  busy,
  onSave,
}: {
  label: string;
  price: number;
  busy: boolean;
  onSave: (price: number) => Promise<void> | void;
}) {
  const [value, setValue] = useState(String(price));
  const next = Number(value);
  const valid = value !== "" && Number.isSafeInteger(next) && next >= 0;
  const changed = valid && next !== price;
  return (
    <form
      className="price-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (changed) void onSave(next);
      }}
    >
      <strong>{label}</strong>
      <label className="price-input">
        <span className="won">₩</span>
        <input
          inputMode="numeric"
          aria-label={`${label} ${t.price}`}
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
        />
      </label>
      <button className={changed ? "primary" : ""} disabled={busy || !changed}>
        {t.save}
      </button>
    </form>
  );
}
function StockForm({
  stock,
  name,
  busy,
  save,
}: {
  stock: Stock;
  name: string;
  busy: boolean;
  save: (b: unknown) => Promise<void>;
}) {
  const [remaining, setRemaining] = useState(String(stock.remaining));
  const [forced, setForced] = useState(stock.forced_sold_out);
  const count = Number(remaining);
  // 빈 칸은 0이 아니라 "아직 안 적음"으로 봅니다. 실수로 0을 저장하지 않게 합니다.
  const valid = remaining !== "" && Number.isSafeInteger(count) && count >= 0;
  // 바꾼 게 있을 때만 저장을 열어 두면 눌러야 하는지 한눈에 보입니다.
  const changed = (valid && count !== stock.remaining) || forced !== stock.forced_sold_out;
  const step = (by: number) =>
    setRemaining(String(Math.max(0, (valid ? count : stock.remaining) + by)));
  return (
    <form
      className="stock-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        void save({
          type: "inventory",
          id: stock.ingredient_id,
          remaining: count,
          previousRemaining: stock.remaining,
          previousForced: stock.forced_sold_out,
          previousDate: stock.business_date,
          forced_sold_out: forced,
        });
      }}
    >
      <div className="stock-name">
        <strong>{name}</strong>
        <label className="row">
          <input
            type="checkbox"
            checked={forced}
            disabled={busy}
            onChange={(e) => setForced(e.target.checked)}
          />
          {t.forcedSoldOut}
        </label>
      </div>
      <div className="stepper" role="group" aria-label={`${name} ${t.remaining}`}>
        <button
          type="button"
          aria-label="1 줄이기"
          disabled={busy || (valid && count === 0)}
          onClick={() => step(-1)}
        >
          −
        </button>
        <input
          name="remaining"
          inputMode="numeric"
          aria-label={t.remaining}
          value={remaining}
          disabled={busy}
          onChange={(e) => setRemaining(e.target.value.replace(/[^0-9]/g, ""))}
        />
        <button
          type="button"
          aria-label="1 늘리기"
          disabled={busy}
          onClick={() => step(1)}
        >
          +
        </button>
      </div>
      <button className={changed ? "primary" : ""} disabled={busy || !changed || !valid}>
        {t.save}
      </button>
    </form>
  );
}
function ProductForm({
  product,
  busy,
  save,
}: {
  product?: Product;
  busy: boolean;
  save: (b: unknown) => Promise<void>;
}) {
  const [id, setId] = useState("");
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(
    product?.price === null || product?.price === undefined
      ? ""
      : String(product.price),
  );
  const [active, setActive] = useState(product?.active ?? false);
  const amount = price === "" ? null : Number(price);
  const validPrice =
    amount === null || (Number.isSafeInteger(amount) && amount >= 0);
  // 판매하려면 가격이 있어야 합니다. 서버도 같은 조건으로 막습니다.
  const ready =
    name.trim().length > 0 &&
    validPrice &&
    !(active && amount === null) &&
    (product ? true : /^[a-z][a-z0-9-]{1,60}$/.test(id));
  const changed = product
    ? name !== product.name ||
      amount !== (product.price ?? null) ||
      active !== product.active
    : Boolean(id || name || price || active);
  return (
    <form
      className="product-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || !changed) return;
        void save({
          type: "product",
          create: !product,
          id: product?.id ?? id,
          name: name.trim(),
          price: amount,
          active,
        });
      }}
    >
      {!product && (
        <label className="product-id">
          {t.productId}
          <input
            value={id}
            disabled={busy}
            placeholder="side-dish"
            onChange={(e) => setId(e.target.value)}
          />
        </label>
      )}
      <div className="product-fields">
        <label className="grow">
          {t.name}
          <input
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="price-input standalone">
          <span className="won">₩</span>
          <input
            inputMode="numeric"
            aria-label={t.price}
            value={price}
            disabled={busy}
            placeholder="미정"
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
          />
        </label>
      </div>
      <div className="row between">
        <label className="row">
          <input
            type="checkbox"
            checked={active}
            disabled={busy}
            onChange={(e) => setActive(e.target.checked)}
          />
          {t.active}
        </label>
        <button
          className={changed && ready ? "primary" : ""}
          disabled={busy || !changed || !ready}
        >
          {product ? t.save : t.createProduct}
        </button>
      </div>
    </form>
  );
}
export function ContentSettings({
  catalog,
  onRefresh,
}: {
  catalog: Catalog;
  onRefresh: () => Promise<void>;
}) {
  const [id, setId] = useState("usage"),
    [language, setLanguage] = useState("ko"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const value = catalog.contents.find(
    (c) => c.id === id && c.language === language,
  );
  async function save(body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      await api("/api/admin/settings", "POST", body);
      await onRefresh();
      setMessage(t.saved);
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const labels: Record<string, string> = {
    usage: t.usage,
    brand: t.brandStory,
    producer: t.producer,
    consent: t.consentContent,
    experience: t.experience,
    ...Object.fromEntries(catalog.ingredients.map((i) => [i.id, i.name])),
  };
  return (
    <section className="panel stack" style={{ maxWidth: 800, margin: "auto" }}>
      <h2>{t.contents}</h2>
      <div className="form-grid">
        <select
          aria-label={t.contents}
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          {[...new Set(catalog.contents.map((c) => c.id))].map((key) => (
            <option key={key} value={key}>
              {labels[key] || key}
            </option>
          ))}
        </select>
        <select
          aria-label={t.language}
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          {languages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label} ({l.code})
            </option>
          ))}
        </select>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {value && (
        <ContentForm
          key={`${id}:${language}:${value.version}`}
          value={value}
          busy={busy}
          save={save}
        />
      )}
    </section>
  );
}
function ContentForm({
  value,
  busy,
  save,
}: {
  value: Content;
  busy: boolean;
  save: (b: unknown) => Promise<void>;
}) {
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void save({
          type: "content",
          id: value.id,
          language: value.language,
          version: value.version,
          title: f.get("title"),
          body: f.get("body"),
          image_url: f.get("image_url"),
          video_url: f.get("video_url"),
        });
      }}
    >
      <label>
        {t.contentTitle}
        <input name="title" defaultValue={value.title} maxLength={200} />
      </label>
      <label>
        {t.body}
        <textarea name="body" defaultValue={value.body} maxLength={10000} />
      </label>
      <label>
        {t.imageUrl}
        <input name="image_url" defaultValue={value.image_url} />
      </label>
      <label>
        {t.videoUrl}
        <input name="video_url" defaultValue={value.video_url} />
      </label>
      <button className="primary" disabled={busy}>
        {t.save}
      </button>
    </form>
  );
}
