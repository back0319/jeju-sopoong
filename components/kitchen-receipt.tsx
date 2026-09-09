import type { Order } from "@/lib/types";
import { koreanIngredientName } from "@/lib/domain";

export function KitchenReceipt({ order }: { order: Order }) {
  return (
    <div className="stack kitchen-receipt">
      {[...order.order_items].sort((a, b) => a.position - b.position).map(({ id, snapshot }, index) => (
        <section className="kitchen-item" key={id}>
          <header className="row between wrap">
            <h2>{index + 1}. {snapshot.name}</h2>
            <span className="chip">{index + 1} / {order.order_items.length}</span>
          </header>
          {snapshot.kind !== "extra" && (
            <>
              <div className={`kitchen-group omit ${snapshot.excluded.length ? "has-items" : ""}`}>
                <h3>빼는 재료</h3>
                <div className="row wrap">
                  {snapshot.excluded.length ? snapshot.excluded.map((ingredient) => (
                    <strong className="kitchen-ingredient" key={ingredient.id}>빼기 · {koreanIngredientName(ingredient.name)}</strong>
                  )) : <span className="muted">없음 · 기본 재료 모두 포함</span>}
                </div>
              </div>
              <div className={`kitchen-group topping ${snapshot.toppings.length ? "has-items" : ""}`}>
                <h3>추가 토핑</h3>
                <div className="row wrap">
                  {snapshot.toppings.length ? snapshot.toppings.map((ingredient) => (
                    <strong className="kitchen-ingredient" key={ingredient.id}>{koreanIngredientName(ingredient.name)}</strong>
                  )) : <span className="muted">없음</span>}
                </div>
              </div>
              <div className="kitchen-group base">
                <h3>넣는 기본 재료</h3>
                <div className="row wrap">
                  {snapshot.included.map((ingredient) => <span className="kitchen-ingredient" key={ingredient.id}>{koreanIngredientName(ingredient.name)}</span>)}
                </div>
              </div>
              {snapshot.kind === "package" && <p className="kitchen-package">패키지 포함 · 라면 + 음료 + 굿즈</p>}
            </>
          )}
        </section>
      ))}
    </div>
  );
}
