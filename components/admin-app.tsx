"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Catalog, Order } from "@/lib/types";
import { api, errorText, t } from "@/lib/client";
import { kstDate, money, orderNumber } from "@/lib/domain";
import { browserClient } from "@/lib/supabase/browser";
import { OrderReceipt } from "./order-receipt";
import { AdminSettings, ContentSettings } from "./admin-settings";
import { AdminData } from "./admin-data";
import { ManualOrder } from "./admin-manual";
type Tab = "operations" | "settings" | "contents" | "data";
export default function AdminApp() {
  const [auth, setAuth] = useState(false),
    [checking, setChecking] = useState(true),
    [tab, setTab] = useState<Tab>("operations"),
    [catalog, setCatalog] = useState<Catalog | null>(null),
    [orders, setOrders] = useState<Order[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [digits, setDigits] = useState(""),
    [help, setHelp] = useState(false),
    [manual, setManual] = useState(false),
    [cancel, setCancel] = useState(false),
    [reason, setReason] = useState(""),
    [undo, setUndo] = useState<Order | null>(null),
    [live, setLive] = useState(false),
    [qr, setQr] = useState(false);
  const busyRef = useRef(false);
  const refreshCatalog = useCallback(async () => {
    setCatalog(await api<Catalog>("/api/catalog"));
  }, []);
  const refresh = useCallback(async () => {
    try {
      const [o, c] = await Promise.all([
        api<Order[]>("/api/admin/orders?from=" + kstDate()),
        api<Catalog>("/api/catalog"),
      ]);
      setOrders(o);
      setCatalog(c);
    } catch (e) {
      setError(errorText(e));
      if (
        e instanceof Error &&
        ["UNAUTHORIZED", "FORBIDDEN"].includes(e.message)
      )
        setAuth(false);
    }
  }, []);
  useEffect(() => {
    api("/api/admin/auth")
      .then(() => setAuth(true))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);
  // 로그인 완료 후 외부 API의 최신 상태를 동기화합니다.
  useEffect(() => {
    if (!auth) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const client = browserClient();
    const channel = client
      .channel("counter-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory" },
        () => void refresh(),
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    // 자정 전환과 일시적인 이벤트 누락도 주기 조회로 보정합니다.
    const timer = setInterval(() => void refresh(), 10000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      void client.removeChannel(channel);
    };
  }, [auth, refresh]);
  useEffect(() => {
    if (!undo) return;
    const delay = Math.max(0, Date.parse(undo.updated_at) + 5000 - Date.now());
    const timer = setTimeout(() => setUndo(null), delay);
    return () => clearTimeout(timer);
  }, [undo]);
  const sorted = [...orders].sort(
    (a, b) =>
      Number(b.status === "PENDING") - Number(a.status === "PENDING") ||
      b.created_at.localeCompare(a.created_at),
  );
  const current = orders.find((o) => o.id === selected);
  const changeStatus = useCallback(
    async (o: Order, status: Order["status"], why?: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError("");
      try {
        const updated = await api<Order>("/api/admin/status", "POST", {
          id: o.id,
          version: o.version,
          status,
          reason: why,
        });
        setOrders((prev) =>
          prev.map((v) => (v.id === o.id ? { ...v, ...updated } : v)),
        );
        if (status === "COMPLETED") setUndo(updated);
        else setUndo(null);
        setCancel(false);
        setReason("");
        await refresh();
      } catch (e) {
        setError(errorText(e));
        await refresh();
      } finally {
        setBusy(false);
        busyRef.current = false;
      }
    },
    [refresh],
  );
  useEffect(() => {
    if (!auth || tab !== "operations") return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('input,textarea,select,[contenteditable="true"]') ||
        e.isComposing
      )
        return;
      if (e.key === "Escape") {
        e.preventDefault();
        setHelp(false);
        setQr(false);
        if (!busy) {
          setManual(false);
          setCancel(false);
        }
        setDigits("");
        setSelected(null);
        return;
      }
      if (help || manual || cancel || qr || busy) return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          if (undo) void changeStatus(undo, "PENDING");
        }
        return;
      }
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        setDigits((v) => (v + e.key).slice(-9));
        return;
      }
      if (e.key === "Backspace" && digits) {
        e.preventDefault();
        setDigits((v) => v.slice(0, -1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (digits) {
          const match = orders.find((o) => o.number === Number(digits));
          if (match) {
            setSelected(match.id);
            setError("");
          } else setError(t.numberNotFound);
          setDigits("");
        } else if (current?.status === "PENDING")
          void changeStatus(current, "COMPLETED");
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = sorted.findIndex((o) => o.id === selected);
        const next =
          e.key === "ArrowDown"
            ? Math.min(sorted.length - 1, idx + 1)
            : Math.max(0, idx - 1);
        setSelected(sorted[next]?.id || null);
      }
      if (e.key.toLowerCase() === "n") setManual(true);
      if (
        e.key.toLowerCase() === "c" &&
        current &&
        current.status !== "CANCELLED"
      )
        setCancel(true);
      if (e.key === "?") setHelp(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    auth,
    tab,
    help,
    manual,
    cancel,
    qr,
    busy,
    digits,
    orders,
    current,
    sorted,
    selected,
    undo,
    changeStatus,
  ]);
  if (checking)
    return (
      <main className="login">
        <p>{t.loading}</p>
      </main>
    );
  if (!auth)
    return (
      <main className="login stack">
        <img
          className="brand-logo"
          src="/brand/logo-wordmark.svg"
          alt={t.brand}
        />
        <h1>{t.adminTitle}</h1>
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              await api("/api/admin/auth", "POST", {
                email: f.get("email"),
                password: f.get("password"),
              });
              setAuth(true);
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {t.email}
            <input type="email" name="email" autoComplete="username" required />
          </label>
          <label>
            {t.password}
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {t.login}
          </button>
        </form>
      </main>
    );
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <img
          src="/brand/logo-wordmark.svg"
          className="brand-logo"
          alt={t.brand}
        />
        <nav>
          {(["operations", "settings", "contents", "data"] as Tab[]).map(
            (key) => (
              <button
                key={key}
                className={tab === key ? "selected" : ""}
                onClick={() => {
                  setTab(key);
                  setError("");
                }}
              >
                {t[key]}
              </button>
            ),
          )}
        </nav>
        <span className="muted">
          {kstDate()} · {live ? t.live : t.polling}
        </span>
        <button
          className="quiet"
          onClick={async () => {
            await api("/api/admin/auth", "DELETE");
            setAuth(false);
            setOrders([]);
            setSelected(null);
            setUndo(null);
          }}
        >
          {t.logout}
        </button>
      </header>
      <div className="admin-main stack">
        {error && (
          <p className="error" role="alert">
            {error}
            <button
              className="quiet"
              onClick={() => {
                setError("");
                void refresh();
              }}
            >
              {t.retry}
            </button>
          </p>
        )}
        {tab === "operations" && (
          <div className="operations">
            <section className="stack">
              <div className="row between">
                <h2>
                  {t.orders} ({orders.length})
                </h2>
                <button className="quiet" onClick={() => setHelp(true)}>
                  ?
                </button>
              </div>
              <div className="row">
                <input
                  aria-label={t.orderNumber}
                  inputMode="numeric"
                  placeholder={t.orderNumber}
                  value={digits}
                  onChange={(e) =>
                    setDigits(e.target.value.replace(/\D/g, "").slice(0, 9))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const o = orders.find((o) => o.number === Number(digits));
                      if (o) {
                        setSelected(o.id);
                        setError("");
                      } else setError(t.numberNotFound);
                      setDigits("");
                    }
                  }}
                />
                <button onClick={() => setManual(true)}>{t.manual}</button>
              </div>
              <div className="order-list">
                {sorted.map((o) => (
                  <button
                    className={`order-row ${o.id === selected ? "selected" : ""}`}
                    style={{ opacity: o.status === "PENDING" ? 1 : 0.6 }}
                    key={o.id}
                    onClick={() => setSelected(o.id)}
                  >
                    <div className="row between">
                      <strong>{orderNumber(o.number)}</strong>
                      <span className="chip">
                        {o.status === "PENDING"
                          ? t.pending
                          : o.status === "COMPLETED"
                            ? t.completed
                            : t.cancel}
                      </span>
                    </div>
                    <div className="row between">
                      <span className="muted">
                        {new Date(o.created_at).toLocaleTimeString("ko-KR", {
                          timeZone: "Asia/Seoul",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {o.order_items.length}
                        {t.items}
                      </span>
                      <b>{money(o.total)}</b>
                    </div>
                  </button>
                ))}
                {!sorted.length && <p className="empty">{t.noOrders}</p>}
              </div>
              <button className="quiet" onClick={() => setQr(true)}>
                {t.qr}
              </button>
            </section>
            <section className="order-detail stack">
              {current ? (
                <>
                  <p className="muted">{t.orderNumber}</p>
                  <div className="row between">
                    <strong className="admin-number">
                      {orderNumber(current.number)}
                    </strong>
                    <span className="chip">
                      {current.status === "PENDING"
                        ? t.pending
                        : current.status === "COMPLETED"
                          ? t.completed
                          : t.cancel}
                    </span>
                  </div>
                  <div className="divider" />
                  <OrderReceipt order={current} />
                  {current.status === "PENDING" && (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => void changeStatus(current, "COMPLETED")}
                    >
                      {t.completeAction}
                    </button>
                  )}
                  {current.status !== "CANCELLED" && (
                    <button
                      className="quiet danger"
                      disabled={busy}
                      onClick={() => setCancel(true)}
                    >
                      {t.cancelAction}
                    </button>
                  )}
                </>
              ) : (
                <p className="empty">{t.selectOrder}</p>
              )}
            </section>
          </div>
        )}
        {catalog && tab === "settings" && (
          <AdminSettings catalog={catalog} onRefresh={refreshCatalog} />
        )}
        {catalog && tab === "contents" && (
          <ContentSettings catalog={catalog} onRefresh={refreshCatalog} />
        )}
        {catalog && tab === "data" && <AdminData catalog={catalog} />}
      </div>
      {tab === "operations" && catalog && (
        <footer className="stockbar">
          <span className="muted">{t.stock}</span>
          {catalog.ingredients
            .filter((i) => i.kind === "topping")
            .map((i) => {
              const s = catalog.inventory.find((v) => v.ingredient_id === i.id);
              return (
                <span key={i.id}>
                  {i.label}{" "}
                  <strong
                    style={{
                      color: s?.remaining === 0 ? "#9b372b" : undefined,
                    }}
                  >
                    {s?.forced_sold_out ? t.soldOut : (s?.remaining ?? 0)}
                  </strong>
                </span>
              );
            })}
        </footer>
      )}
      {digits && (
        <div className="number-overlay">
          <p>{t.numberInput}</p>
          <strong>{digits}</strong>
          <p>
            {orders.find((o) => o.number === Number(digits))
              ? money(orders.find((o) => o.number === Number(digits))!.total)
              : t.numberNotFound}
          </p>
        </div>
      )}
      {undo && (
        <div role="status" className="toast row">
          <span>{t.undoNotice}</span>
          <button
            disabled={busy}
            onClick={() => void changeStatus(undo, "PENDING")}
          >
            {t.undo}
          </button>
        </div>
      )}
      {help && (
        <div className="overlay">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={t.shortcuts}
            className="modal stack"
          >
            <h2>{t.shortcuts}</h2>
            <p>{t.shortcutDescription}</p>
            <button autoFocus onClick={() => setHelp(false)}>
              {t.dismiss}
            </button>
          </section>
        </div>
      )}
      {qr && (
        <div className="overlay">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={t.qr}
            className="modal stack"
          >
            <h2>{t.qr}</h2>
            <p>{t.qrHint}</p>
            <img
              src="/api/admin/qr"
              alt={t.qr}
              width={320}
              height={320}
              style={{ maxWidth: "100%", alignSelf: "center" }}
            />
            <a href="/" target="_blank">
              {typeof window !== "undefined" ? window.location.origin : ""}
            </a>
            <button autoFocus onClick={() => setQr(false)}>
              {t.dismiss}
            </button>
          </section>
        </div>
      )}
      {cancel && current && (
        <div className="overlay">
          <form
            role="dialog"
            aria-modal="true"
            aria-label={t.cancelAction}
            className="modal stack"
            onSubmit={(e) => {
              e.preventDefault();
              void changeStatus(current, "CANCELLED", reason);
            }}
          >
            <h2>
              {orderNumber(current.number)} · {t.cancelAction}
            </h2>
            <label>
              {t.cancelReason}
              <input
                autoFocus
                required
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <button className="danger" disabled={busy || !reason.trim()}>
              {t.cancelConfirm}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setCancel(false)}
            >
              {t.dismiss}
            </button>
          </form>
        </div>
      )}
      {manual && catalog && (
        <ManualOrder
          catalog={catalog}
          onClose={() => setManual(false)}
          onDone={(o) => {
            setManual(false);
            setSelected(o.id);
            void refresh();
          }}
        />
      )}
    </main>
  );
}
