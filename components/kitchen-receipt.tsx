import type { Order } from "@/lib/types";
import { koreanIngredientName } from "@/lib/domain";

export function KitchenReceipt({ order }: { order: Order }) {
  return (
    <div className="kitchen-receipt">
      {[...order.order_items].sort((a, b) => a.position - b.position).map(({ id, snapshot }, index) => (
        <section className="kitchen-item" key={id}>
          <header className="row between wrap">
            <h2>{index + 1}. {snapshot.kind === "package" ? "김밥 + 패키지" : snapshot.name}</h2>
          </header>
          {snapshot.kind !== "extra" && (
            <>
              <div className={`kitchen-group omit ${snapshot.excluded.length ? "has-items" : ""}`}>
                <h3>빼는 재료</h3>
                <div className="kitchen-slots">
                  {snapshot.excluded.length ? snapshot.excluded.map((ingredient) => (
                    <strong className="kitchen-ingredient" key={ingredient.id}>{koreanIngredientName(ingredient.name)}</strong>
                  )) : <span className="muted">없음</span>}
                </div>
              </div>
              <div className={`kitchen-group topping ${snapshot.toppings.length ? "has-items" : ""}`}>
                <h3>추가 토핑</h3>
                <div className="kitchen-slots">
                  {snapshot.toppings.length ? snapshot.toppings.map((ingredient) => (
                    <strong className="kitchen-ingredient" key={ingredient.id}>{koreanIngredientName(ingredient.name)}</strong>
                  )) : <span className="muted">없음</span>}
                </div>
              </div>
              <div className="kitchen-group base">
                <h3>넣는 기본 재료</h3>
                <p>{snapshot.included.map((ingredient) => koreanIngredientName(ingredient.name)).join(" · ")}</p>
              </div>
              {snapshot.kind === "package" && <p className="kitchen-package">라면 + 음료 + 굿즈</p>}
            </>
          )}
        </section>
      ))}
    </div>
  );
}
