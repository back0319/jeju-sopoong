"use client";
import { browserClient } from "./supabase/browser";

// 알림은 갱신 신호로만 사용하고 실제 데이터는 권한을 검사하는 API에서 조회합니다.
export function liveRefresh({ topic, tables = [], broadcast = false, refresh }: {
  topic: string;
  tables?: string[];
  broadcast?: boolean;
  refresh: () => Promise<void>;
}) {
  let disposed = false;
  let connected = false;
  let running = false;
  let queued = false;
  let timer: ReturnType<typeof setTimeout>;
  async function sync() {
    if (disposed) return;
    if (running) { queued = true; return; }
    running = true;
    try { await refresh(); } catch { /* 다음 알림 또는 복구 조회에서 재시도합니다. */ }
    finally {
      running = false;
      if (queued && !disposed) { queued = false; void sync(); }
    }
  }
  const poll = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { void sync(); poll(); }, connected ? 60000 : 5000);
  };
  const visible = () => { if (document.visibilityState === "visible") void sync(); };
  void sync();
  poll();
  window.addEventListener("focus", visible);
  window.addEventListener("online", visible);
  document.addEventListener("visibilitychange", visible);
  if ((!tables.length && !broadcast) || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener("focus", visible);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }
  const client = browserClient();
  const channel = client.channel(topic);
  for (const table of tables) channel.on("postgres_changes", { event: "*", schema: "public", table }, () => void sync());
  if (broadcast) channel.on("broadcast", { event: "changed" }, () => void sync());
  const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
      void Promise.resolve().then(async () => {
        if (!disposed) await client.realtime.setAuth(session?.access_token ?? null);
      }).catch(() => { if (!disposed) { connected = false; poll(); } });
    }
  });
  void (async () => {
    try {
      const { data: { session } } = await client.auth.getSession();
      if (disposed) return;
      await client.realtime.setAuth(session?.access_token ?? null);
      if (disposed) return;
      channel.subscribe((status) => {
        if (disposed) return;
        connected = status === "SUBSCRIBED";
        poll();
        void sync();
      });
    } catch { if (!disposed) { connected = false; poll(); } }
  })();
  return () => {
    disposed = true;
    clearTimeout(timer);
    subscription.unsubscribe();
    window.removeEventListener("focus", visible);
    window.removeEventListener("online", visible);
    document.removeEventListener("visibilitychange", visible);
    void client.removeChannel(channel);
  };
}
