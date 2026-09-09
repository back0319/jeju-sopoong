"use client";
import { useState } from "react";
import type { Catalog, Content, Product, Stock } from "@/lib/types";
import { api, errorText, t } from "@/lib/client";
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
          {catalog.inventory.map((s) => (
            <StockForm
              key={`${s.ingredient_id}:${s.remaining}:${s.forced_sold_out}`}
              stock={s}
              name={
                catalog.ingredients.find((i) => i.id === s.ingredient_id)!.name
              }
              busy={busy}
              save={save}
            />
          ))}
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void save({
                type: "topping-price",
                price: Number(f.get("price")),
              });
            }}
          >
            <label>
              {t.toppingPrice}
              <input
                name="price"
                type="number"
                min="0"
                step="1"
                required
                defaultValue={
                  catalog.ingredients.find((i) => i.kind === "topping")?.price
                }
              />
            </label>
            <button disabled={busy}>{t.save}</button>
          </form>
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
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void save({
          type: "inventory",
          id: stock.ingredient_id,
          remaining: Number(f.get("remaining")),
          previousRemaining: stock.remaining,
          previousForced: stock.forced_sold_out,
          forced_sold_out: f.get("forced") === "on",
        });
      }}
    >
      <h3>{name}</h3>
      <div className="row">
        <label className="grow">
          {t.remaining}
          <input
            name="remaining"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={stock.remaining}
          />
        </label>
        <button disabled={busy} style={{ alignSelf: "end" }}>
          {t.save}
        </button>
      </div>
      <label className="row">
        <input
          name="forced"
          type="checkbox"
          defaultChecked={stock.forced_sold_out}
        />
        {t.forcedSoldOut}
      </label>
      <div className="divider" />
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
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void save({
          type: "product",
          create: !product,
          id: product?.id || f.get("id"),
          name: f.get("name"),
          price: f.get("price") === "" ? null : Number(f.get("price")),
          active: f.get("active") === "on",
        });
      }}
    >
      {!product && (
        <label>
          {t.productId}
          <input name="id" required pattern="[a-z][a-z0-9-]{1,60}" />
        </label>
      )}
      <div className="form-grid">
        <label>
          {t.name}
          <input name="name" required defaultValue={product?.name} />
        </label>
        <label>
          {t.price}
          <input
            name="price"
            type="number"
            min="0"
            step="1"
            defaultValue={product?.price ?? ""}
          />
        </label>
      </div>
      <div className="row between">
        <label className="row">
          <input
            name="active"
            type="checkbox"
            defaultChecked={product?.active ?? false}
          />
          {t.active}
        </label>
        <button disabled={busy}>{t.save}</button>
      </div>
      <div className="divider" />
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
          {["ko", "en", "ja", "zh"].map((l) => (
            <option key={l}>{l}</option>
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
