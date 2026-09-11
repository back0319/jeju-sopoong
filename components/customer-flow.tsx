"use client";
import { CountryQuestion } from "./country-question";
import { useEffect, useRef, useState } from "react";
import { isLanguage } from "@/lib/types";
import type {
  Answers,
  CartItem,
  Catalog,
  Language,
  Order,
} from "@/lib/types";
import {
  expiredOrder,
  itemPrice,
  money,
  newItem,
  orderNumber,
  toggleAnswer,
  validQuestion,
} from "@/lib/domain";
import {
  api,
  dict,
  direction,
  errorText,
  languages,
  persist,
  stored,
  t,
} from "@/lib/client";
import { Arrow, Check } from "./icons";
import { ItemBuilder } from "./item-builder";
import { OrderReceipt } from "./order-receipt";
import { liveRefresh } from "@/lib/live-refresh";
import { detailOf, ingredientName } from "@/lib/ingredient-detail";
import { optionLabel, questionTitle } from "@/lib/survey-i18n";
type Step =
  | "language"
  | "usage"
  | "intro"
  | "consent"
  | "survey"
  | "testDone"
  | "ingredients"
  | "build"
  | "cart"
  | "review"
  | "complete";
type Draft = {
  surveySkipped?: boolean;
  originIndex?: number;
  language: Language;
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
  language: "ko",
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
// 가격은 build 단계에서 처음 드러납니다. 테스트(consent~survey)는 그 앞에서 testDone으로 끝나야 합니다.
const sequence: Step[] = [
  "language",
  "usage",
  "intro",
  "ingredients",
  "consent",
  "survey",
  "testDone",
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
  const mainRef = useRef<HTMLDivElement>(null);
  const [catalog, setCatalog] = useState(initialCatalog),
    [draft, setDraft] = useState<Draft | null>(null),
    [saved, setSaved] = useState<Saved | null>(null),
    [order, setOrder] = useState<Order | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [originIndex, setOriginIndex] = useState(0),
    // 이용 안내는 단락이 여섯이라 한 화면에 담기지 않아 두 장으로 넘깁니다.
    [usagePage, setUsagePage] = useState(0),
    // 김밥 마는 법은 주문 번호 화면을 밀어내지 않도록 한 장 넘겨서 봅니다.
    [rolling, setRolling] = useState(false);
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
    // 지원 목록에서 빠진 언어 코드가 저장되어 있으면 한국어로 되돌립니다.
    if (!isLanguage(state.language)) state.language = "ko";
    // 시작 화면에 남아 있던 이전 버전 초안은 최신 설문으로 시작합니다.
    if (state.step === "language" || state.surveySkipped) state.surveyVersion = initialCatalog.survey.id;
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
        if (alive) setError(errorText(e, draft?.language ?? "ko"));
      }
    }
    const stop = liveRefresh({
      topic: order?.id ? `order:${order.id}` : "order-lookup",
      broadcast: Boolean(order?.id),
      refresh: load,
    });
    return () => { alive = false; stop(); };
  }, [draft?.step, draft?.language, saved, catalog, order?.id]);
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [draft?.step, draft?.question, originIndex, usagePage, rolling]);
  // 담은 재료 없이 만들기 화면에 서면 아무것도 그리지 못해 빠져나갈 수 없습니다.
  useEffect(() => {
    if (draft?.step === "build" && !draft.item)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft((prev) => (prev ? { ...prev, step: "cart" } : prev));
  }, [draft?.step, draft?.item]);
  // 아랍어는 문서 전체를 오른쪽 정렬로 전환해야 화면 구성이 뒤집힙니다.
  useEffect(() => {
    const language = draft?.language ?? "ko";
    const root = document.documentElement;
    root.lang = language;
    root.dir = direction(language);
    return () => {
      root.lang = "ko";
      root.dir = "ltr";
    };
  }, [draft?.language]);
  useEffect(() => {
    if (!draft?.step || draft.step === "complete") return;
    let alive = true;
    const stop = liveRefresh({
      topic: "customer-catalog",
      tables: ["inventory", "products", "ingredients", "contents"],
      refresh: async () => {
        const latest = await api<Catalog>("/api/catalog");
        if (alive) setCatalog((current) => ({
          ...current, inventory: latest.inventory, products: latest.products,
          ingredients: latest.ingredients, contents: latest.contents,
        }));
      },
    });
    return () => { alive = false; stop(); };
  }, [draft?.step]);
  if (!draft)
    return (
      <main className="customer">
        <div className="customer-main">
          <p>{t.loading}</p>
        </div>
      </main>
    );
  const d = draft;
  const copy = dict(d.language);
  const checkedItems = d.step === "build" && d.item
    ? [...d.items.filter((_, index) => index !== d.editing), d.item]
    : d.items;
  const shortages = catalog.ingredients.filter((ingredient) => {
    const needed = checkedItems.filter((item) => item.toppings.includes(ingredient.id)).length;
    const stock = catalog.inventory.find((entry) => entry.ingredient_id === ingredient.id);
    if (needed === 0) return false;
    // 수량을 세지 않는 재료는 강제 품절만 부족으로 봅니다.
    if (ingredient.tracked === false) return Boolean(stock?.forced_sold_out);
    return !stock || stock.forced_sold_out || stock.remaining < needed;
  });
  const change = (values: Partial<Draft>) =>
    setDraft((prev) => (prev ? { ...prev, ...values } : prev));
  const go = (step: Step) => {
    setError("");
    change({ step });
  };
  const koContent = (id: string) =>
    catalog.contents.find((c) => c.id === id && c.language === "ko");
  // 번역이 아직 비어 있는 콘텐츠는 한국어 원문을 보여줍니다.
  const content = (id: string) => {
    const translated = catalog.contents.find(
      (c) => c.id === id && c.language === d.language,
    );
    return translated?.body.trim() || translated?.title.trim()
      ? translated
      : koContent(id);
  };
  const usageBlocks = (content("usage")?.body ?? "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  const usagePageSize = 3;
  const usagePages = Math.max(1, Math.ceil(usageBlocks.length / usagePageSize));
  const back = () => {
    if (d.step === "complete" && rolling) setRolling(false);
    else if (d.step === "usage" && usagePage > 0) setUsagePage(usagePage - 1);
    else if (d.step === "survey" && d.question > 0)
      change({ question: d.question - 1 });
    else if (d.step === "ingredients" && originIndex > 0)
      setOriginIndex(originIndex - 1);
    else if (d.step === "build") go(d.items.length ? "cart" : "testDone");
    else go(sequence[Math.max(0, sequence.indexOf(d.step) - 1)]);
  };
  const total = d.items.reduce(
    (sum, item) => sum + itemPrice(item, catalog),
    0,
  );
  const startItem = () => {
    if (d.items.length >= 30) {
      setError(copy.itemLimit);
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
        language: d.language,
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
      setError(errorText(e, d.language));
      try {
        const latest = await api<Catalog>("/api/catalog");
        setCatalog(latest);
        if (e instanceof Error && e.message === "INVALID_SURVEY") {
          // 가격을 본 뒤에 다시 받은 답은 연구 자료로 쓸 수 없습니다.
          // 테스트 문항이 도중에 바뀌었다면 이 응답을 버리고 주문만 이어갑니다.
          setError(copy.testDiscarded);
          change({
            answers: {},
            question: 0,
            surveySkipped: true,
            consent: false,
            consentAt: null,
            surveyVersion: latest.survey.id,
            key: invalidate(),
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
        {busy ? copy.submitting : label}
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
          {!["language", "complete", "build", "cart", "testDone"].includes(
            d.step,
          ) || (d.step === "complete" && rolling) ? (
            <button className="back" aria-label={copy.back} onClick={back}>
              <Arrow back />
            </button>
          ) : (
            <span style={{ width: 48 }} />
          )}
          <img
            className="brand-logo"
            src="/brand/logo-wordmark.svg"
            alt={copy.brand}
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
            aria-label={copy.next}
            aria-valuemin={0}
            aria-valuemax={sequence.length - 1}
            aria-valuenow={sequence.indexOf(d.step)}
          >
            <span
              style={{
                width: `${(sequence.indexOf(d.step) / (sequence.length - 1)) * 100}%`,
              }}
            />
          </div>
        )}
      </header>
      {error && (
        <div className="error" role="alert" style={{ margin: "0 22px 12px" }}>
          {error}
        </div>
      )}
      {["build", "cart", "review"].includes(d.step) && shortages.length > 0 && (
        <div className="notice" role="alert" style={{ margin: "0 22px 12px" }}>
          {shortages.map((i) => ingredientName(i.id, i.name, d.language)).join(", ")} {copy.errors.OUT_OF_STOCK}
          {d.step === "review" && <button onClick={() => go("cart")}>주문 수정</button>}
        </div>
      )}
      <div
        ref={mainRef}
        className={`customer-main ${d.step === "language" ? "welcome" : ""} ${d.step === "ingredients" ? "tight" : ""}`}
      >
        {d.step === "language" && (
          <>
            <div className="welcome-art">
              <img src="/brand/juseyo-badge.svg" alt="주세요" />
            </div>
            <div className="stack">
              <h1>{copy.languageTitle}</h1>
              <p className="muted">{copy.languageDescription}</p>
            </div>
            <div className="stack">
              <button className="primary" onClick={() => go("usage")}>
                {copy.start}
              </button>
              <div className="grid2 language-grid">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    lang={l.code}
                    className={l.code === d.language ? "selected" : ""}
                    aria-pressed={l.code === d.language}
                    onClick={() => change({ language: l.code })}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              {saved && (
                <button onClick={() => go("complete")}>
                  {copy.resume} · {orderNumber(saved.number)}
                </button>
              )}
            </div>
          </>
        )}
        {d.step === "usage" && (
          <>
            <h1>{copy.usageTitle}</h1>
            <p className="muted">{copy.usageDescription}</p>
            {/* 단락을 절반씩 나눠 한 화면에 담습니다. */}
            <div className="stack usage-steps">
              {usageBlocks
                .slice(usagePage * usagePageSize, (usagePage + 1) * usagePageSize)
                .map((block, index) => (
                  <p key={index} className="muted">
                    {block}
                  </p>
                ))}
            </div>
            {usagePages > 1 && (
              <span className="muted question-count">
                {usagePage + 1} / {usagePages}
              </span>
            )}
            {usagePage === usagePages - 1 && (
              <div className="brand-line">
                <strong>{copy.brandLine}</strong>
                <span className="muted">{copy.brandLineEn}</span>
              </div>
            )}
          </>
        )}
        {d.step === "intro" && (
          <>
            <div className="stack">
              <span className="eyebrow">{copy.introEyebrow}</span>
              <h1>{copy.introTitle}</h1>
            </div>
            {/* 첫 단락은 인사, 나머지는 영상을 본 뒤 다음 장으로 넘기는 말입니다. */}
            {(() => {
              const blocks = (content("producer")?.body ?? "")
                .split(/\n\s*\n/)
                .map((block) => block.trim())
                .filter(Boolean);
              const [greeting, ...outro] = blocks;
              return (
                <>
                  {greeting && (
                    <p className="muted" style={{ whiteSpace: "pre-line" }}>
                      {greeting}
                    </p>
                  )}
                  <ProducerVideo
                    url={
                      content("producer")?.video_url ||
                      "https://youtu.be/dQw4w9WgXcQ"
                    }
                  />
                  {outro.length > 0 && (
                    <div className="stack producer-outro">
                      {outro.map((block, index) => (
                        <p key={index} style={{ whiteSpace: "pre-line" }}>
                          {block}
                        </p>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}
        {d.step === "consent" && (
          <>
            <div className="stack">
              <span className="eyebrow">{copy.aboutYouEyebrow}</span>
              <h1>{copy.aboutYouTitle}</h1>
              <p className="muted">{copy.aboutYouDescription}</p>
              <span className="question-count">{copy.duration}</span>
            </div>
            <h2>{copy.testNotice}</h2>
            <div
              className="panel"
              style={{ minHeight: 150, whiteSpace: "pre-wrap" }}
            >
              {content("consent")?.body ||
                (!catalog.internalTest ? copy.consentMissing : "")}
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
                      : String(koContent("consent")?.version ?? ""),
                    key: invalidate(),
                  })
                }
              />
              <span>{copy.consent}</span>
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
              {copy.skipTest}
            </button>
          </>
        )}
        {d.step === "survey" && q && (
          <>
            <div className="stack">
              <span className="question-count">
                {q.required ? copy.required : copy.optional} ·{" "}
                {q.type === "multiple" ? copy.multiple : copy.single}
              </span>
              <h1>{questionTitle(q, d.language)}</h1>
            </div>
            {q.id === "S1" && q.options.length > 30 ? <CountryQuestion question={q} language={d.language} copy={copy} selected={d.answers[q.id]?.[0]} onChange={id => change({ answers: { ...d.answers, [q.id]: [id] }, key: invalidate() })} /> : q.type === "text" ? (
              <label>
                {copy.textAnswer}
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
                    <span>{optionLabel(q, option, d.language)}</span>
                    <span className="dot" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {d.step === "ingredients" && origin && (
          <>
            <div className="stack">
              <span className="eyebrow">{copy.ingredientEyebrow}</span>
              <h1>{copy.ingredientTitle}</h1>
              {/* 부제는 첫 장에서만. 네 장 내내 되풀이하면 스크롤만 늘어납니다. */}
              {originIndex === 0 && (
                <p className="muted">{copy.ingredientDescription}</p>
              )}
            </div>
            <article className="ingredient-feature">
              <img src={origin.image!} alt={ingredientName(origin.id, origin.name, d.language)} />
              <div className="stack">
                <h2>{detailOf(origin.id, d.language)?.menu || ingredientName(origin.id, origin.name, d.language)}</h2>
                <IngredientDetail id={origin.id} language={d.language} copy={copy} />
                {(() => {
                  const value = content(origin.id);
                  const has =
                    value &&
                    (value.body.trim() ||
                      value.title.trim() ||
                      value.image_url ||
                      value.video_url);
                  return has ? <ContentBody value={value} copy={copy} /> : null;
                })()}
              </div>
            </article>
            <div className="row between">
              <span className="muted">{originIndex + 1} / 4</span>
              {/* 마지막 장에서는 아래 버튼과 가는 곳이 같아 건너뛰기를 두지 않습니다. */}
              {originIndex < 3 && (
                <button className="quiet" onClick={() => go("consent")}>
                  {copy.skip}
                </button>
              )}
            </div>
            {/* 다음 장으로 넘기는 말이라 버튼 바로 위에 둡니다. */}
            {originIndex === 3 && (
              <p className="taste-cta">{copy.tasteCta}</p>
            )}
          </>
        )}
        {d.step === "testDone" && (
          <div className="stack test-done">
            <h1>{copy.testDoneTitle}</h1>
            <p className="muted">{copy.testDoneDescription}</p>
          </div>
        )}
        {d.step === "build" && d.item && (
          <ItemBuilder
            key={d.editing ?? "new"}
            catalog={catalog}
            item={d.item}
            language={d.language}
            copy={copy}
            onChange={(item) => change({ item })}
            onBack={() => go(d.items.length ? "cart" : "testDone")}
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
            <h1>{d.step === "cart" ? copy.cartTitle : copy.reviewTitle}</h1>
            {d.step === "cart" && <p className="muted">{copy.cartDescription}</p>}
            {!d.items.length && <p>{copy.emptyCart}</p>}
            {d.items.map((item, i) => (
              <section key={i} className="item-card stack">
                <div className="row between">
                  <h3>
                    {i + 1}.{" "}
                    {item.kind === "extra"
                      ? catalog.products.find((p) => p.id === item.productId)
                          ?.name
                      : item.kind === "package"
                        ? copy.setTitle
                        : copy.gimbap}
                  </h3>
                  <strong>{money(itemPrice(item, catalog))}</strong>
                </div>
                {item.kind !== "extra" && (
                  <>
                    <div className="row wrap">
                      {catalog.ingredients
                        .filter((v) => v.kind === "fixed" || v.kind === "base")
                        .map((v) => (
                          <span
                            className={`chip ${item.excluded.includes(v.id) ? "excluded" : ""}`}
                            key={v.id}
                          >
                            {ingredientName(v.id, v.name, d.language)}
                          </span>
                        ))}
                    </div>
                    <div className="row wrap">
                      {item.toppings.map((id) => (
                        <span className="chip" key={id}>
                          + {(() => { const v = catalog.ingredients.find((x) => x.id === id); return v ? ingredientName(v.id, v.name, d.language) : id; })()}
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
                      {copy.edit}
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
                    {copy.delete}
                  </button>
                </div>
              </section>
            ))}
            {d.step === "cart" && (
              <>
                <button onClick={startItem}>{copy.addItem}</button>
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
              <strong>{copy.total}</strong>
              <h2>{money(total)}</h2>
            </div>
          </>
        )}
        {d.step === "complete" && rolling && (
          <section className="stack rolling">
            <h1>{copy.experience}</h1>
            {content("experience")?.body?.trim() && (
              <p className="muted" style={{ whiteSpace: "pre-line" }}>
                {content("experience")!.body}
              </p>
            )}
            <ProducerVideo url={content("experience")!.video_url} />
            <a
              className="video-link"
              href={content("experience")!.video_url}
              target="_blank"
              rel="noreferrer"
            >
              {copy.watch}
              <Arrow />
            </a>
          </section>
        )}
        {d.step === "complete" && !rolling && (
          <div className="stack complete">
            {order ? (
              <>
                <div className={`order-state ${order.status.toLowerCase()}`} role="status" aria-live="polite">
                  <div className="complete-icon" aria-hidden="true">
                    {order.status === "CANCELLED" ? "×" : <Check />}
                  </div>
                  <h2>
                    {order.status === "CANCELLED"
                      ? copy.orderCancelled
                      : order.status === "COMPLETED"
                        ? copy.orderCompleted
                        : copy.completeTitle}
                  </h2>
                  {order.status === "COMPLETED" && <p>{copy.orderCompletedNote}</p>}
                  {order.status === "CANCELLED" && (
                    <p className="cancel-reason">{copy.cancelReasonLabel}: {order.cancel_reason || copy.cancelReasonUnknown}</p>
                  )}
                </div>
                <div className="order-number">{orderNumber(order.number)}</div>
                {order.status === "PENDING" && <h3>{copy.counter}</h3>}
                <p className="price">{money(order.total)}</p>
                {order.status === "PENDING" && <p className="muted">{copy.offlinePayment}</p>}
                <div className="receipt">
                  <details>
                    <summary>{copy.orderDetails}</summary>
                    <OrderReceipt order={order} language={d.language} copy={copy} />
                  </details>
                </div>

              </>
            ) : (
              <p>{copy.loading}</p>
            )}
            <button
              className="quiet"
              onClick={() => {
                persist("localStorage", "juseyo-order", null);
                setSaved(null);
                setOrder(null);
                setDraft(fresh(catalog));
                setError("");
                setRolling(false);
              }}
            >
              {copy.newOrder}
            </button>
          </div>
        )}
      </div>
      {d.step === "complete" &&
        !rolling &&
        Boolean(content("experience")?.video_url) &&
        footer(copy.rollCta, () => setRolling(true))}
      {d.step === "complete" &&
        rolling &&
        footer(copy.orderNumber, () => setRolling(false))}
      {d.step === "usage" &&
        footer(copy.next, () =>
          usagePage < usagePages - 1
            ? setUsagePage(usagePage + 1)
            : go("intro"),
        )}
      {d.step === "intro" &&
        footer(copy.next, () => {
          setOriginIndex(0);
          go("ingredients");
        })}
      {d.step === "consent" &&
        footer(
          copy.next,
          () => change({ step: "survey", surveySkipped: false }),
          !d.consent ||
            (!catalog.internalTest && !koContent("consent")?.body.trim()),
        )}
      {d.step === "survey" &&
        q &&
        footer(
          copy.next,
          () =>
            d.question < catalog.survey.questions.length - 1
              ? change({ question: d.question + 1 })
              : go("testDone"),
          !validQuestion(q, d.answers[q.id]),
        )}
      {d.step === "ingredients" &&
        footer(originIndex < 3 ? copy.next : copy.findMyJeju, () =>
          originIndex < 3 ? setOriginIndex(originIndex + 1) : go("consent"),
        )}
      {d.step === "testDone" && footer(copy.startBuilding, startItem)}
      {d.step === "cart" &&
        footer(copy.review, () => go("review"), !d.items.length)}
      {d.step === "review" &&
        footer(
          copy.confirm,
          () => void submit(),
          !d.items.length || !catalog.configured || shortages.length > 0,
        )}
    </main>
  );
}
function IngredientDetail({ id, language, copy }: { id: string; language: Language; copy: typeof t }) {
  const detail = detailOf(id, language);
  if (!detail) return null;
  const rows = [
    [copy.detailTaste, detail.taste],
    [copy.detailTexture, detail.texture],
    [copy.detailDiet, detail.diet],
  ].filter(([, value]) => value);
  return (
    <div className="stack ingredient-detail">
      {detail.tagline && <p>{detail.tagline}</p>}
      <dl>
        {rows.map(([label, value]) => (
          <div className="row" key={label}>
            <dt className="muted">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        {(detail.allergyRaw || detail.allergySauce) && (
          <>
            <div className="row">
              <dt className="muted">{copy.detailAllergy}</dt>
              <dd />
            </div>
            {detail.allergyRaw && (
              <div className="row indent">
                <dt className="muted">{copy.detailAllergyRaw}</dt>
                <dd>{detail.allergyRaw}</dd>
              </div>
            )}
            {detail.allergySauce && (
              <div className="row indent">
                <dt className="muted">{copy.detailAllergySauce}</dt>
                <dd>{detail.allergySauce}*</dd>
              </div>
            )}
          </>
        )}
      </dl>
      {detail.allergySauce && (
        <p className="footnote muted">{copy.detailFootnote}</p>
      )}
    </div>
  );
}
export function ContentBody({
  value,
  copy = t,
}: {
  value?: Catalog["contents"][number];
  copy?: typeof t;
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
          {copy.watch}
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
