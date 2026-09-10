import type { Order } from "@/lib/types";
import { koreanIngredientName, orderNumber } from "@/lib/domain";
import ingredients from "@/config/ingredients.json";

function IngredientSlots({ items, kind }: { items: { id: string; name: string }[]; kind: "base" | "topping" }) {
  const ids = ingredients.filter((ingredient) => ingredient.kind === kind).map((ingredient) => ingredient.id);
  const slots = [...ids, ...items.filter((item) => !ids.includes(item.id)).map((item) => item.id)];
  return (
    <div className="kitchen-slots">
      {slots.map((id) => {
        const ingredient = items.find((item) => item.id === id);
        return ingredient
          ? <strong className="kitchen-ingredient" key={id}>{koreanIngredientName(ingredient.name)}</strong>
          : <span className="kitchen-slot-empty" key={id} aria-hidden="true" />;
      })}
      {!items.length && <span className="kitchen-none muted">없음</span>}
    </div>
  );
}

export function KitchenReceipt({ order, sourceOrders }: { order: Order; sourceOrders?: Order[] }) {
  return (
    <div className="kitchen-receipt">
      {(sourceOrders ?? [order]).flatMap(source => [...source.order_items].sort((a, b) => a.position - b.position).map((item, index) => ({ ...item, index, source }))).map(({ id, snapshot, index, source }) => (
        <section className="kitchen-item" key={id}>
          <header className="row between wrap">
            <h2>{index + 1}. {snapshot.name}</h2>
            {sourceOrders && <span className="chip">{orderNumber(source.number)}번</span>}
          </header>
          {snapshot.kind !== "extra" && (
            <>
              <div className={`kitchen-group omit ${snapshot.excluded.length ? "has-items" : ""}`}>
                <h3>빼는 재료</h3>
                <IngredientSlots items={snapshot.excluded} kind="base" />
              </div>
              <div className={`kitchen-group topping ${snapshot.toppings.length ? "has-items" : ""}`}>
                <h3>추가 토핑</h3>
                <IngredientSlots items={snapshot.toppings} kind="topping" />
              </div>
              <div className="kitchen-group base">
                <h3>넣는 기본 재료</h3>
                <p>{snapshot.included.map((ingredient) => koreanIngredientName(ingredient.name)).join(" · ")}</p>
              </div>
              <p className={`kitchen-package ${snapshot.kind === "package" ? "" : "no-package"}`} aria-hidden={snapshot.kind !== "package"}>
                {snapshot.kind === "package" ? snapshot.name : null}
              </p>
            </>
          )}
        </section>
      ))}
    </div>
  );
}
