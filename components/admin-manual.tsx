"use client";
import { useState } from "react";
import type { Catalog, CartItem, Order } from "@/lib/types";
import { api, errorText } from "@/lib/client";
import { itemPrice, money, newItem, orderNumber } from "@/lib/domain";

export function ManualOrder({ catalog, order, onDone, onClose }: {
  catalog: Catalog; order?: Order; onDone: (o: Order) => void; onClose: () => void;
}) {
  const [items, setItems] = useState<CartItem[]>(() => order
    ? order.order_items.map(({ snapshot: s }) => ({ kind: s.kind,
      excluded: s.excluded.map(i => i.id), toppings: s.toppings.map(i => i.id),
      productId: s.productId ?? (s.kind === "extra" ? catalog.products.find(p => p.name === s.name)?.id : undefined) }))
    : [newItem(catalog, {})]);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const upgrade = catalog.products.find(p => p.id === "package");
  const total = items.reduce((sum, i) => sum + itemPrice(i, catalog), 0);
  function update(next: CartItem[]) { setItems(next); setKey(crypto.randomUUID()); }
  function replace(n: number, item: CartItem) { update(items.map((v, idx) => idx === n ? item : v)); }
  function toggle(n: number, field: "excluded" | "toppings", id: string) {
    const item = items[n];
    replace(n, { ...item, [field]: item[field].includes(id) ? item[field].filter(v => v !== id) : [...item[field], id] });
  }
  return <div className="overlay"><section role="dialog" aria-modal="true"
    aria-label={order ? "주문 구성 수정" : "수기 주문"} className="modal admin-order-editor">
    <header className="row between"><div><h2>{order ? `${orderNumber(order.number)}번 · 주문 구성 수정` : "수기 주문"}</h2>
      <p className="muted">빼는 재료와 추가 토핑을 선택하세요. {order ? "현재 메뉴 가격으로 다시 계산합니다." : "연결된 상태에서 바로 등록합니다."}</p></div>
      <button disabled={busy} onClick={onClose}>닫기</button></header>
    {error && <p role="alert" className="error">{error}</p>}
    {/* 스크롤은 div가 맡습니다. fieldset은 flex 항목으로서 높이를 줄이지 못해 모달이 넘쳤습니다. */}
    <div className="editor-body"><fieldset disabled={busy} className="editor-fieldset"><div className="editor-items">
      {items.map((item, n) => <article className="editor-item" key={n}>
        <div className="row between"><strong>{n + 1}. {item.kind === "extra" ? catalog.products.find(p => p.id === item.productId)?.name ?? "추가 상품" : "김밥"}</strong>
          <div className="row"><b>{money(itemPrice(item, catalog))}</b><button aria-label={`${n + 1}번 메뉴 삭제`} onClick={() => update(items.filter((_, idx) => idx !== n))}>삭제</button></div></div>
        {item.kind !== "extra" && <>
          <div><h3>빼는 재료</h3><div className="editor-choices">{catalog.ingredients.filter(i => i.kind === "base").map(i =>
            <button key={i.id} aria-pressed={item.excluded.includes(i.id)} className={item.excluded.includes(i.id) ? "selected exclude-choice" : ""} onClick={() => toggle(n, "excluded", i.id)}>{i.name}</button>)}</div></div>
          <div><h3>추가 토핑</h3><div className="editor-choices">{catalog.ingredients.filter(i => (i.kind === "topping" || i.kind === "ready") && i.active !== false).map(i => {
            const stock = catalog.inventory.find(s => s.ingredient_id === i.id);
            const reserved = order?.order_items.filter(v => v.snapshot.toppings.some(t => t.id === i.id)).length ?? 0;
            const count = items.filter(v => v.toppings.includes(i.id)).length;
            const selected = item.toppings.includes(i.id);
            const unavailable = !stock || stock.forced_sold_out || stock.remaining + reserved <= count;
            return <button key={i.id} aria-pressed={selected} className={selected ? "selected" : ""} disabled={!selected && unavailable}
              onClick={() => toggle(n, "toppings", i.id)}>{i.name}<small>{money(i.price)} · {stock?.forced_sold_out ? "품절" : `잔여 ${stock?.remaining ?? 0}`}</small></button>;
          })}</div></div>
          {upgrade && <label className="editor-package"><input type="checkbox" checked={item.kind === "package"} disabled={!upgrade.active && item.kind !== "package"}
            onChange={e => replace(n, { ...item, kind: e.target.checked ? "package" : "gimbap" })} />{upgrade.name} <b>+{money(upgrade.price ?? 0)}</b></label>}
        </>}
      </article>)}
    </div><div className="row wrap editor-add"><button disabled={items.length >= 30} onClick={() => update([...items, newItem(catalog, {})])}>+ 김밥 추가</button>
      {catalog.products.filter(p => p.kind === "extra" && p.active).map(p => <button key={p.id} disabled={items.length >= 30} onClick={() => update([...items, { kind: "extra", productId: p.id, excluded: [], toppings: [] }])}>+ {p.name} {money(p.price ?? 0)}</button>)}
    </div></fieldset></div>
    <footer className="row between"><strong>{items.length}개 · 합계 {money(total)}</strong><button className="primary" disabled={busy || !items.length} onClick={async () => {
      setBusy(true); setError("");
      try { const result = await api<Order>(order ? "/api/admin/orders/edit" : "/api/admin/orders", "POST", {
        ...(order ? { id: order.id, version: order.version } : { idempotencyKey: key }), language: order?.language ?? "ko", items, expectedTotal: total,
      }); onDone(result); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
    }}>{busy ? "저장 중…" : order ? "수정 저장" : "주문 등록"}</button></footer>
  </section></div>;
}
