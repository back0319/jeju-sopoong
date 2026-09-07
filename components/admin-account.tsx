"use client";
import { useEffect, useState } from "react";
import { api, errorText } from "@/lib/client";
export function AdminAccount() {
  const [username, setUsername] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ username: string }>("/api/admin/account")
      .then((v) => setUsername(v.username))
      .catch((e) => setError(errorText(e)));
  }, []);
  return (
    <section className="stack" style={{ maxWidth: 520, width: "100%" }}>
      <h1>계정 관리</h1>
      <p className="muted">관리자 아이디와 비밀번호를 변경합니다.</p>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget,
            f = new FormData(form);
          setError("");
          setMessage("");
          if (f.get("password") !== f.get("confirm")) {
            setError("새 비밀번호가 서로 다릅니다.");
            return;
          }
          setBusy(true);
          try {
            await api("/api/admin/account", "POST", {
              username,
              currentPassword: f.get("current"),
              password: f.get("password"),
            });
            setMessage(
              "계정을 변경했습니다. 다음 로그인부터 새 아이디와 비밀번호를 사용해 주세요.",
            );
            form.reset();
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          아이디
          <input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={40}
          />
          <small>영문·숫자·점·밑줄·하이픈, 3~40자</small>
        </label>
        <label>
          현재 비밀번호
          <input
            name="current"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          새 비밀번호
          <input
            name="password"
            type="password"
            minLength={5}
            maxLength={200}
            autoComplete="new-password"
            required
          />
        </label>
        <label>
          새 비밀번호 확인
          <input
            name="confirm"
            type="password"
            minLength={5}
            maxLength={200}
            autoComplete="new-password"
            required
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        <button className="primary" disabled={busy}>
          계정 변경
        </button>
      </form>
    </section>
  );
}
