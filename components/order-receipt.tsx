import type { Order } from "@/lib/types";
import { money, koreanIngredientName } from "@/lib/domain";
import { t } from "@/lib/client";
export function OrderReceipt({ order }: { order: Order }) {
  return (
    <div className="stack receipt">
      {[...order.order_items]
        .sort((a, b) => a.position - b.position)
        .map(({ id, snapshot: s }, i) => (
          <section className="item-card stack" key={id}>
            <div className="row between">
              <h3>
                {i + 1}. {s.name}
              </h3>
              <strong>{money(s.amount)}</strong>
            </div>
            {s.included.length > 0 && (
              <div>
                <p className="muted">{t.included}</p>
                <div className="row wrap">
                  {s.included.map((v) => (
                    <span className="chip" key={v.id}>
                      {koreanIngredientName(v.name)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {s.excluded.length > 0 && (
              <div>
                <p className="muted">{t.excluded}</p>
                <div className="row wrap">
                  {s.excluded.map((v) => (
                    <span className="chip excluded" key={v.id}>
                      {koreanIngredientName(v.name)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {s.toppings.length > 0 && (
              <div className="row wrap">
                {s.toppings.map((v) => (
                  <span className="chip" key={v.id}>
                    + {koreanIngredientName(v.name)}
                  </span>
                ))}
              </div>
            )}
          </section>
        ))}
      <div className="row between">
        <strong>{t.total}</strong>
        <strong>{money(order.total)}</strong>
      </div>
    </div>
  );
}
