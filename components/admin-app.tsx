"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Catalog, Order } from "@/lib/types";
import { api, errorText, t } from "@/lib/client";
import { money, orderNumber } from "@/lib/domain";
import { browserClient } from "@/lib/supabase/browser";
import { KitchenReceipt } from "./kitchen-receipt";
import { AdminSettings } from "./admin-settings";
import { AdminAccount } from "./admin-account";
import { AdminData } from "./admin-data";
import { ManualOrder } from "./admin-manual";
type StatusFilter = "ALL" | "PENDING" | "COMPLETED" | "CANCELLED" | "CLOSED";
type Tab = "operations" | "settings" | "data" | "qr" | "account";
export default function AdminApp() {
  const [auth, setAuth] = useState(false),
    [checking, setChecking] = useState(true),
    [tab, setTab] = useState<Tab>("operations"),
    [catalog, setCatalog] = useState<Catalog | null>(null),
    [orders, setOrders] = useState<Order[]>([]),
    [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING"),
    [sortOrder, setSortOrder] = useState("oldest"),
    [selected, setSelected] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [digits, setDigits] = useState(""),
    [help, setHelp] = useState(false),
    [manual, setManual] = useState(false),
    [cancel, setCancel] = useState(false),
    [reason, setReason] = useState(""),
    [undo, setUndo] = useState<Order | null>(null),
    [undoDeadline, setUndoDeadline] = useState(0);
  const detailRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    detailRef.current?.scrollTo(0, 0);
    listRef.current?.querySelector(".selected")?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  const busyRef = useRef(false);
  const refreshId = useRef(0);
  const refreshCatalog = useCallback(async () => {
    setCatalog(await api<Catalog>("/api/catalog"));
  }, []);
  const refresh = useCallback(async () => {
    const requestId = ++refreshId.current;
    try {
      const [o, c] = await Promise.all([
        api<Order[]>("/api/admin/orders"),
        api<Catalog>("/api/catalog"),
      ]);
      if (requestId !== refreshId.current) return;
      setOrders(o);
      setCatalog(c);
    } catch (e) {
      if (requestId !== refreshId.current) return;
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
  // 주문 이벤트를 즉시 반영하고 연결이 끊기면 짧은 주기 조회로 보완합니다.
  useEffect(() => {
    if (!auth) return;
    let disposed = false;
    let connected = false;
    let timer: ReturnType<typeof setTimeout>;
    const invalidate = () => {
      ++refreshId.current;
    };
    const sync = () => {
      if (!disposed) void refresh();
    };
    const client = browserClient();
    const channel = client
      .channel("counter-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        sync,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory" },
        sync,
      );
    for (const table of ["products", "ingredients", "contents"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, sync);
    }
    async function subscribe() {
      try {
        // 서버 로그인으로 설정한 쿠키의 관리자 세션을 구독 시작 전에 적용합니다.
        const {
          data: { session },
        } = await client.auth.getSession();
        if (disposed) return;
        await client.realtime.setAuth(session?.access_token ?? null);
        if (disposed) return;
        channel.subscribe((status) => {
          if (disposed) return;
          connected = status === "SUBSCRIBED";
          clearTimeout(timer);
          poll();
          // 최초 연결과 재연결 사이에 놓친 주문도 즉시 조회합니다.
          sync();
        });
      } catch {
        // 구독 실패 중에도 아래 자동 조회는 계속 실행됩니다.
        connected = false;
      }
    }
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        // Auth 콜백 내부에서 다른 Auth 작업을 기다리지 않습니다.
        void Promise.resolve()
          .then(async () => {
            if (!disposed)
              await client.realtime.setAuth(session?.access_token ?? null);
          })
          .catch(() => {
            connected = false;
          });
      }
    });
    const poll = () => {
      timer = setTimeout(
        () => {
          sync();
          if (!disposed) poll();
        },
        connected ? 60000 : 2000,
      );
    };
    const visible = () => {
      if (document.visibilityState === "visible") sync();
    };
    sync();
    void subscribe();
    poll();
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", visible);
    return () => {
      disposed = true;
      invalidate();
      clearTimeout(timer);
      subscription.unsubscribe();
      window.removeEventListener("focus", sync);
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", visible);
      void client.removeChannel(channel);
    };
  }, [auth, refresh]);
  useEffect(() => {
    if (!undo) return;
    const delay = Math.max(0, undoDeadline - Date.now());
    const timer = setTimeout(() => setUndo(null), delay);
    return () => clearTimeout(timer);
  }, [undo, undoDeadline]);
  const sorted = orders.filter((order) =>
    statusFilter === "ALL" || (statusFilter === "CLOSED"
      ? order.status !== "PENDING" : order.status === statusFilter),
  ).sort((a, b) => sortOrder === "oldest"
    ? a.created_at.localeCompare(b.created_at) || a.number - b.number
    : b.created_at.localeCompare(a.created_at) || b.number - a.number);
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
        if (status === "COMPLETED") {
          setUndo(updated);
          setUndoDeadline(Date.now() + 5000);
        } else setUndo(null);
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
        if (!busy) {
          setManual(false);
          setCancel(false);
        }
        setDigits("");
        setSelected(null);
        return;
      }
      if (help || manual || cancel || busy) return;
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
            setStatusFilter("ALL");
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
                username: f.get("username"),
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
            <input
              type="text"
              name="username"
              autoComplete="username"
              required
            />
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
          {(["operations", "settings", "data", "qr", "account"] as Tab[]).map(
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
                  {t.orders} ({sorted.length}/{orders.length})
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
                        setStatusFilter("ALL");
                        setSelected(o.id);
                        setError("");
                      } else setError(t.numberNotFound);
                      setDigits("");
                    }
                  }}
                />
                <button onClick={() => setManual(true)}>{t.manual}</button>
              </div>
              <div className="order-filters">
                <label>주문 상태
                  <select aria-label="주문 상태" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setSelected(null); }}>
                    <option value="PENDING">접수만 · 완료/취소 숨김</option>
                    <option value="ALL">전체 주문</option>
                    <option value="COMPLETED">완료된 주문만</option>
                    <option value="CANCELLED">취소된 주문만</option>
                    <option value="CLOSED">완료·취소된 주문</option>
                  </select>
                </label>
                <label>정렬
                  <select aria-label="정렬" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                    <option value="oldest">오래된 주문순</option>
                    <option value="newest">최신 주문순</option>
                  </select>
                </label>
              </div>
              <div className="order-list" ref={listRef}>
                {sorted.map((o) => (
                  <button
                    className={`order-row ${o.id === selected ? "selected" : ""}`}
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
                {!sorted.length && <p className="empty">선택한 상태의 주문이 없습니다.</p>}
              </div>
            </section>
            <section className="order-detail stack" ref={detailRef}>
              {current ? (
                <>
                  <div className="row between order-detail-heading">
                    <strong className="admin-number">
                      {orderNumber(current.number)}
                    </strong>
                    <div className="row wrap">
                    <strong>{money(current.total)}</strong>
                    <span className="chip">
                      {current.status === "PENDING"
                        ? t.pending
                        : current.status === "COMPLETED"
                          ? t.completed
                          : t.cancel}
                    </span>
                    </div>
                  </div>
                  {current.status === "CANCELLED" && <p className="error">취소 사유: {current.cancel_reason || "사유 없음"}</p>}
                  <KitchenReceipt order={current} />
                  <div className="order-actions">
                  {current.status === "PENDING" && (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => void changeStatus(current, "COMPLETED")}
                    >
                      {t.completeAction}
                    </button>
                  )}
                  {current.status === "COMPLETED" && undo?.id === current.id && (
                    <button
                      className="undo-action"
                      disabled={busy}
                      onClick={() => void changeStatus(undo, "PENDING")}
                    >
                      완료 처리 되돌리기 · 5초 이내
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
                  </div>
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
        {tab === "account" && <AdminAccount />}
        {tab === "qr" && (
          <section className="stack" style={{ maxWidth: 520 }}>
            <h1>공통 QR</h1>
            <p>스캔하면 주세요 고객 주문 화면이 열립니다.</p>
            <img
              src="/api/admin/qr"
              alt="주세요 주문 QR"
              width={320}
              height={320}
              style={{ maxWidth: "100%" }}
            />
            <a href="/api/admin/qr" download="juseyo-qr.png">
              QR 이미지 내려받기
            </a>
            <a href="/" target="_blank" rel="noreferrer">
              고객 주문 화면 열기
            </a>
          </section>
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
                  {i.name}{" "}
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
          <span><strong>{orderNumber(undo.number)}번</strong> · {t.undoNotice}</span>
          <button
            disabled={busy}
            onClick={() => void changeStatus(undo, "PENDING")}
          >
            완료 처리 되돌리기 (Ctrl+Z)
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
