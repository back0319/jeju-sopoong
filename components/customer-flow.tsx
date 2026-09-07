"use client";
import { useEffect, useState } from "react";
import type { Answers, CartItem, Catalog, Order } from "@/lib/types";
import {
  expiredOrder,
  itemPrice,
  money,
  newItem,
  orderNumber,
  toggleAnswer,
  validQuestion,
} from "@/lib/domain";
import { api, errorText, persist, stored, t } from "@/lib/client";
import { Arrow, Check } from "./icons";
import { ItemBuilder } from "./item-builder";
import { OrderReceipt } from "./order-receipt";
type Step =
  | "language"
  | "intro"
  | "consent"
  | "survey"
  | "ingredients"
  | "build"
  | "cart"
  | "review"
  | "complete";
type Draft = {
  surveyReturn?: boolean;
  surveySkipped?: boolean;
  originIndex?: number;
  step: Step;
  question: number;
  answers: Answers;
  consent: boolean;
  consentAt: string | null;
  items: CartItem[];
  item: CartItem | null;
  editing: number | null;
  key: string;
  surveyVersion: string;
  consentVersion: string;
  sessionId: string;
};
type Saved = { date: string; number: number; savedAt: number };
const fresh = (c: Catalog): Draft => ({
  step: "language",
  question: 0,
  answers: {},
  consent: false,
  consentAt: null,
  items: [],
  item: null,
  editing: null,
  key: crypto.randomUUID(),
  surveyVersion: c.survey.id,
  consentVersion: c.internalTest
    ? "internal-test-v1"
    : String(
        c.contents.find((v) => v.id === "consent" && v.language === "ko")
          ?.version ?? "",
      ),
  sessionId: crypto.randomUUID(),
});
const sequence: Step[] = [
  "language",
  "intro",
  "ingredients",
  "consent",
  "survey",
  "build",
  "cart",
  "review",
  "complete",
];
export default function CustomerFlow({
  initialCatalog,
}: {
  initialCatalog: Catalog;
}) {
  const [catalog, setCatalog] = useState(initialCatalog),
    [draft, setDraft] = useState<Draft | null>(null),
    [saved, setSaved] = useState<Saved | null>(null),
    [order, setOrder] = useState<Order | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [originIndex, setOriginIndex] = useState(0);
  useEffect(() => {
    const fallback = fresh(initialCatalog);
    const previous = stored<Draft>("sessionStorage", "juseyo-draft");
    const valid =
      previous &&
      sequence.includes(previous.step) &&
      Array.isArray(previous.items) &&
      previous.answers &&
      typeof previous.key === "string";
    const state = valid ? previous : fallback;
    if (
      state.surveyVersion !== initialCatalog.survey.id &&
      !state.surveySkipped &&
      !["language", "complete"].includes(state.step)
    ) {
      state.answers = {};
      state.question = 0;
      state.surveyVersion = initialCatalog.survey.id;
      if (state.step !== "language") state.step = "survey";
    }
    if (state.question >= initialCatalog.survey.questions.length)
      state.question = 0;
    if (state.step === "build" && !state.item) state.step = "cart";
    // 브라우저 저장소 복원은 서버 렌더 이후 한 번만 수행합니다.
    const last = stored<Saved>("localStorage", "juseyo-order");
    if (last && !expiredOrder(last) && Number.isInteger(last.number))
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSaved(last);
    else {
      persist("localStorage", "juseyo-order", null);
      if (state.step === "complete") state.step = "language";
    }
    setOriginIndex(state.originIndex ?? 0);
    if (last && !expiredOrder(last) && state.step === "language")
      state.step = "complete";
    setDraft(state);
  }, [initialCatalog]);
  useEffect(() => {
    if (draft)
      persist("sessionStorage", "juseyo-draft", { ...draft, originIndex });
  }, [draft, originIndex]);
  useEffect(() => {
    if (draft?.step !== "complete" || !saved) return;
    let alive = true;
    async function load() {
      if (expiredOrder(saved!)) {
        persist("localStorage", "juseyo-order", null);
        if (alive) {
          setSaved(null);
          setOrder(null);
          setDraft(fresh(catalog));
        }
        return;
      }
      try {
        const result = await api<Order>(
          `/api/orders/lookup?date=${saved!.date}&number=${saved!.number}`,
        );
        if (!alive) return;
        setOrder(result);
        if (result.status === "CANCELLED") {
          persist("localStorage", "juseyo-order", null);
        }
      } catch (e) {
        if (alive) setError(errorText(e));
      }
    }
    void load();
    const timer = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [draft?.step, saved, catalog]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [draft?.step, draft?.question, originIndex]);
  if (!draft)
    return (
      <main className="customer">
        <div className="customer-main">
          <p>{t.loading}</p>
        </div>
      </main>
    );
  const d = draft;
  const change = (values: Partial<Draft>) =>
    setDraft((prev) => (prev ? { ...prev, ...values } : prev));
  const go = (step: Step) => {
    setError("");
    change({ step });
  };
  const content = (id: string) =>
    catalog.contents.find((c) => c.id === id && c.language === "ko");
  const back = () => {
    if (d.step === "survey" && d.question > 0)
      change({ question: d.question - 1 });
    else if (d.step === "ingredients" && originIndex > 0)
      setOriginIndex(originIndex - 1);
    else if (d.step === "build") go(d.items.length ? "cart" : "consent");
    else go(sequence[Math.max(0, sequence.indexOf(d.step) - 1)]);
  };
  const total = d.items.reduce(
    (sum, item) => sum + itemPrice(item, catalog),
    0,
  );
  const startItem = () => {
    if (d.items.length >= 30) {
      setError(t.itemLimit);
      return;
    }
    change({ item: newItem(catalog, d.answers), editing: null, step: "build" });
  };
  const invalidate = () => crypto.randomUUID();
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<Order>("/api/orders", "POST", {
        idempotencyKey: d.key,
        language: "ko",
        items: d.items,
        expectedTotal: total,
        answers: d.answers,
        surveySkipped: d.surveySkipped === true,
        surveyVersion: d.surveyVersion,
        consent: d.consent,
        consentAt: d.consentAt,
        consentVersion: d.consentVersion,
      });
      // 주문 확정 이벤트가 성공한 시각이며 렌더 중에는 실행하지 않습니다.
      const last = {
        date: result.business_date,
        number: result.number,
        // eslint-disable-next-line react-hooks/purity
        savedAt: Date.now(),
      };
      persist("localStorage", "juseyo-order", last);
      setSaved(last);
      setOrder(result);
      change({ step: "complete" });
    } catch (e) {
      setError(errorText(e));
      try {
        const latest = await api<Catalog>("/api/catalog");
        setCatalog(latest);
        if (e instanceof Error && e.message === "INVALID_SURVEY") {
          change({
            step: "survey",
            question: 0,
            answers: {},
            surveyVersion: latest.survey.id,
            surveyReturn: true,
          });
        }
        if (e instanceof Error && e.message === "CONSENT_REQUIRED") {
          change({ step: "consent", consent: false, consentAt: null });
        }
      } catch {
        /* 마지막으로 확인한 구성은 보존합니다. */
      }
    } finally {
      setBusy(false);
    }
  }
  const footer = (label: string, action: () => void, disabled = false) => (
    <div className="customer-footer">
      <button className="primary" disabled={disabled || busy} onClick={action}>
        {busy ? t.submitting : label}
      </button>
    </div>
  );
  const q = catalog.survey.questions[d.question];
  const origin = catalog.ingredients.filter((i) => i.kind === "topping")[
    originIndex
  ];
  return (
    <main className="customer">
      <header className="customer-header">
        <div className="row between">
          {!["language", "complete", "build"].includes(d.step) ? (
            <button className="back" aria-label={t.back} onClick={back}>
              <Arrow back />
            </button>
          ) : (
            <span style={{ width: 48 }} />
          )}
          <img
            className="brand-logo"
            src="/brand/logo-wordmark.svg"
            alt={t.brand}
          />
          <span
            className="question-count"
            style={{ width: 48, textAlign: "right" }}
          >
            {d.step === "survey"
              ? `${d.question + 1}/${catalog.survey.questions.length}`
              : ""}
          </span>
        </div>
        {!["language", "complete"].includes(d.step) && (
          <div
            className="progress"
            role="progressbar"
            aria-label={t.next}
            aria-valuemin={0}
            aria-valuemax={8}
            aria-valuenow={sequence.indexOf(d.step)}
          >
            <span
              style={{ width: `${(sequence.indexOf(d.step) / 8) * 100}%` }}
            />
          </div>
        )}
      </header>
      {error && (
        <div className="error" role="alert" style={{ margin: "0 22px 12px" }}>
          {error}
        </div>
      )}
      <div
        className={`customer-main ${d.step === "language" ? "welcome" : ""}`}
      >
        {d.step === "language" && (
          <>
            <div className="welcome-art">
              <img src="/brand/juseyo-badge.svg" alt="주세요" />
            </div>
            <div className="stack">
              <h1>{t.languageTitle}</h1>
              <p className="muted">{t.languageDescription}</p>
            </div>
            <div className="stack">
              <button className="primary" onClick={() => go("intro")}>
                {t.start}
              </button>
              <div className="grid2 language-grid">
                {["한국어", "English", "日本語", "中文"].map((l, i) => (
                  <button
                    key={l}
                    className={i === 0 ? "selected" : ""}
                    aria-pressed={i === 0}
                    disabled={i !== 0}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {saved && (
                <button onClick={() => go("complete")}>
                  {t.resume} · {orderNumber(saved.number)}
                </button>
              )}
            </div>
          </>
        )}
        {d.step === "intro" && (
          <>
            <h1>제주의 생산자</h1>
            <ProducerVideo
              url={
                content("producer")?.video_url || "https://youtu.be/dQw4w9WgXcQ"
              }
            />
            <button
              className="quiet"
              onClick={() => {
                setOriginIndex(0);
                go("ingredients");
              }}
            >
              {t.skip}
            </button>
          </>
        )}
        {d.step === "consent" && (
          <>
            <h1>{t.consentTitle}</h1>
            {catalog.internalTest && <p className="notice">{t.internalTest}</p>}
            <div
              className="panel"
              style={{ minHeight: 150, whiteSpace: "pre-wrap" }}
            >
              {content("consent")?.body ||
                (!catalog.internalTest ? t.consentMissing : "")}
            </div>
            <label className="row">
              <input
                type="checkbox"
                checked={d.consent}
                onChange={(e) =>
                  change({
                    surveySkipped: false,
                    consent: e.target.checked,
                    consentAt: e.target.checked
                      ? new Date().toISOString()
                      : null,
                    consentVersion: catalog.internalTest
                      ? "internal-test-v1"
                      : String(content("consent")?.version ?? ""),
                    key: invalidate(),
                  })
                }
              />
              <span>{t.consent}</span>
            </label>
            <button
              onClick={() =>
                change({
                  surveySkipped: true,
                  consent: false,
                  consentAt: null,
                  answers: {},
                  item: newItem(catalog, {}),
                  editing: null,
                  step: "build",
                  key: invalidate(),
                })
              }
            >
              설문 하지 않기
            </button>
          </>
        )}
        {d.step === "survey" && q && (
          <>
            <div className="stack">
              <span className="question-count">
                {q.required ? t.required : t.optional} ·{" "}
                {q.type === "multiple" ? t.multiple : t.single}
              </span>
              <h1>{q.title}</h1>
            </div>
            {q.type === "text" ? (
              <label>
                {t.textAnswer}
                <input
                  maxLength={200}
                  value={d.answers[q.id]?.[0] || ""}
                  onChange={(e) =>
                    change({
                      answers: {
                        ...d.answers,
                        [q.id]: e.target.value ? [e.target.value] : [],
                      },
                      key: invalidate(),
                    })
                  }
                />
              </label>
            ) : (
              <div
                className={`${q.options.length > 4 ? "grid2" : "stack"} question-options`}
              >
                {q.options.map((option) => (
                  <button
                    key={option.id}
                    aria-pressed={(d.answers[q.id] || []).includes(option.id)}
                    className={
                      (d.answers[q.id] || []).includes(option.id)
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      change({
                        answers: {
                          ...d.answers,
                          [q.id]: toggleAnswer(
                            q,
                            d.answers[q.id] || [],
                            option.id,
                          ),
                        },
                        key: invalidate(),
                      })
                    }
                  >
                    <span>{option.label}</span>
                    <span className="dot" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {d.step === "ingredients" && origin && (
          <>
            <h1>{t.ingredientTitle}</h1>
            <p className="muted">{t.ingredientDescription}</p>
            <article className="ingredient-feature">
              <img src={origin.image!} alt={origin.name} />
              <div className="stack">
                <h2>{origin.name}</h2>
                <ContentBody value={content(origin.id)} />
              </div>
            </article>
            <div className="row between">
              <span className="muted">{originIndex + 1} / 4</span>
              <button className="quiet" onClick={() => go("consent")}>
                {t.skip}
              </button>
            </div>
          </>
        )}
        {d.step === "build" && d.item && (
          <ItemBuilder
            key={d.editing ?? "new"}
            catalog={catalog}
            item={d.item}
            onChange={(item) => change({ item })}
            onBack={() => go(d.items.length ? "cart" : "consent")}
            editing={d.editing !== null}
            onSave={() => {
              const items = [...d.items];
              const item =
                d.item!.kind === "package" &&
                !catalog.products.some((p) => p.id === "package" && p.active)
                  ? { ...d.item!, kind: "gimbap" as const }
                  : d.item!;
              if (d.editing === null) items.push(item);
              else items[d.editing] = item;
              change({
                items,
                step: "cart",
                item: null,
                editing: null,
                key: invalidate(),
              });
            }}
          />
        )}
        {(d.step === "cart" || d.step === "review") && (
          <>
            <h1>{d.step === "cart" ? t.cartTitle : t.reviewTitle}</h1>
            {d.step === "cart" && <p className="muted">{t.cartDescription}</p>}
            {!d.items.length && <p>{t.emptyCart}</p>}
            {d.items.map((item, i) => (
              <section key={i} className="item-card stack">
                <div className="row between">
                  <h3>
                    {i + 1}.{" "}
                    {item.kind === "extra"
                      ? catalog.products.find((p) => p.id === item.productId)
                          ?.name
                      : item.kind === "package"
                        ? t.package
                        : t.gimbap}
                  </h3>
                  <strong>{money(itemPrice(item, catalog))}</strong>
                </div>
                {item.kind !== "extra" && (
                  <>
                    <div className="row wrap">
                      {catalog.ingredients
                        .filter((v) => v.kind !== "topping")
                        .map((v) => (
                          <span
                            className={`chip ${item.excluded.includes(v.id) ? "excluded" : ""}`}
                            key={v.id}
                          >
                            {v.name}
                          </span>
                        ))}
                    </div>
                    <div className="row wrap">
                      {item.toppings.map((id) => (
                        <span className="chip" key={id}>
                          + {catalog.ingredients.find((v) => v.id === id)?.name}
                        </span>
                      ))}
                    </div>
                  </>
                )}
                <div className="row">
                  {item.kind !== "extra" && (
                    <button
                      onClick={() =>
                        change({
                          item: {
                            ...item,
                            excluded: [...item.excluded],
                            toppings: [...item.toppings],
                          },
                          editing: i,
                          step: "build",
                        })
                      }
                    >
                      {t.edit}
                    </button>
                  )}
                  <button
                    className="quiet"
                    onClick={() =>
                      change({
                        items: d.items.filter((_, idx) => idx !== i),
                        key: invalidate(),
                      })
                    }
                  >
                    {t.delete}
                  </button>
                </div>
              </section>
            ))}
            {d.step === "cart" && (
              <>
                <button onClick={startItem}>{t.addItem}</button>
                {catalog.products
                  .filter((p) => p.kind === "extra" && p.active)
                  .map((p) => (
                    <button
                      key={p.id}
                      disabled={d.items.length >= 30}
                      onClick={() =>
                        change({
                          items: [
                            ...d.items,
                            {
                              kind: "extra",
                              productId: p.id,
                              excluded: [],
                              toppings: [],
                            },
                          ],
                          key: invalidate(),
                        })
                      }
                    >
                      {p.name} + {money(p.price!)}
                    </button>
                  ))}
              </>
            )}
            <div className="row between">
              <strong>{t.total}</strong>
              <h2>{money(total)}</h2>
            </div>
          </>
        )}
        {d.step === "complete" && (
          <div className="stack complete">
            {order ? (
              <>
                <div className="complete-icon">
                  <Check />
                </div>
                <h2>
                  {order.status === "CANCELLED" ? t.cancelled : t.completeTitle}
                </h2>
                <div className="order-number">{orderNumber(order.number)}</div>
                <h3>{t.counter}</h3>
                <p className="price">{money(order.total)}</p>
                <p className="muted">{t.offlinePayment}</p>
                <div className="receipt">
                  <details>
                    <summary>{t.orderDetails}</summary>
                    <OrderReceipt order={order} />
                  </details>
                </div>
                {content("experience")?.video_url && (
                  <ContentBody value={content("experience")} />
                )}
              </>
            ) : (
              <p>{t.loading}</p>
            )}
            <button
              className="quiet"
              onClick={() => {
                persist("localStorage", "juseyo-order", null);
                setSaved(null);
                setOrder(null);
                setDraft(fresh(catalog));
                setError("");
              }}
            >
              {t.newOrder}
            </button>
          </div>
        )}
      </div>
      {d.step === "intro" &&
        footer(t.next, () => {
          setOriginIndex(0);
          go("ingredients");
        })}
      {d.step === "consent" &&
        footer(
          t.next,
          () => change({ step: "survey", surveySkipped: false }),
          !d.consent ||
            (!catalog.internalTest && !content("consent")?.body.trim()),
        )}
      {d.step === "survey" &&
        q &&
        footer(
          t.next,
          () =>
            d.question < catalog.survey.questions.length - 1
              ? change({ question: d.question + 1 })
              : d.surveyReturn
                ? change({ step: "cart", surveyReturn: false })
                : startItem(),
          !validQuestion(q, d.answers[q.id]),
        )}
      {d.step === "ingredients" &&
        footer(originIndex < 3 ? t.next : t.next, () =>
          originIndex < 3 ? setOriginIndex(originIndex + 1) : go("consent"),
        )}
      {d.step === "cart" &&
        footer(t.review, () => go("review"), !d.items.length)}
      {d.step === "review" &&
        footer(
          t.confirm,
          () => void submit(),
          !d.items.length || !catalog.configured,
        )}
    </main>
  );
}
export function ContentBody({
  value,
}: {
  value?: Catalog["contents"][number];
}) {
  return (
    <div className="stack">
      {value?.title && <h3>{value.title}</h3>}
      {value?.image_url && (
        <img
          src={value.image_url}
          alt={value.title}
          style={{ maxWidth: "100%", borderRadius: 12 }}
        />
      )}
      <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
        {value?.body || ""}
      </p>
      {value?.video_url && (
        <a
          className="video-link"
          href={value.video_url}
          target="_blank"
          rel="noreferrer"
        >
          {t.watch}
          <Arrow />
        </a>
      )}
    </div>
  );
}

function ProducerVideo({ url }: { url: string }) {
  let id = "";
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") id = u.pathname.slice(1);
    else if (
      ["youtube.com", "www.youtube.com", "www.youtube-nocookie.com"].includes(
        u.hostname,
      )
    )
      id = u.searchParams.get("v") || u.pathname.split("/").pop() || "";
  } catch {}
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  return (
    <iframe
      className="producer-video"
      src={`https://www.youtube-nocookie.com/embed/${id}`}
      title="제주의 생산자 소개 영상"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
