"use client";
import { useEffect, useMemo, useState } from "react";
import type { Catalog, Order } from "@/lib/types";
import type { ResearchData } from "@/lib/research";
import { api, errorText } from "@/lib/client";
import { kstDate, money } from "@/lib/domain";
import { OrderReceipt } from "./order-receipt";
export function AdminData({ catalog }: { catalog: Catalog }) {
  const [from, setFrom] = useState(catalog.businessDate ?? kstDate()),
    [to, setTo] = useState(catalog.businessDate ?? kstDate()),
    [participation, setParticipation] = useState(""),
    [ingredient, setIngredient] = useState(""),
    [data, setData] = useState<ResearchData | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<Order | null>(null),
    [revision, setRevision] = useState(0);
  const query = useMemo(
    () =>
      new URLSearchParams({ from, to, participation, ingredient }).toString(),
    [from, to, participation, ingredient],
  );
  useEffect(() => {
    let alive = true;
    // 필터 변경 시 외부 조회 결과를 동기화합니다. 지난 요청 결과는 표시하지 않습니다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(true);
    setError("");
    setData(null);
    setPage(0);
    api<ResearchData>("/api/admin/research?" + query)
      .then((v) => {
        if (alive) setData(v);
      })
      .catch((e) => {
        if (alive) setError(errorText(e));
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [query, revision]);
  const orders = data?.orders ?? [],
    completed = orders.filter((o) => o.order_surveys?.survey_completed).length;
  const preset = (days: number) => {
    const end = catalog.businessDate ?? kstDate();
    const start = new Date(end + "T12:00:00+09:00");
    start.setUTCDate(start.getUTCDate() - days + 1);
    setFrom(kstDate(start));
    setTo(end);
  };
  const answerText = (o: Order, id: string, values: string[]) => {
    const q = data?.versions
      .find((v) => v.id === o.order_surveys?.survey_version)
      ?.questions.find((q) => q.id === id);
    return values
      .map((v) => q?.options.find((x) => x.id === v)?.label ?? v)
      .join(", ");
  };
  return (
    <section className="stack" style={{ width: "100%" }}>
      <div className="row between wrap">
        <div>
          <h1>연구 데이터</h1>
          <p className="muted">
            주문 구성과 설문 응답을 연결해 살펴보고 분석용 파일로 저장하세요.
          </p>
        </div>
        <button onClick={() => setRevision((r) => r + 1)} disabled={busy}>
          새로고침
        </button>
      </div>
      <div className="row wrap">
        {[
          [1, "오늘 하루"],
          [7, "최근 일주일"],
          [30, "최근 한달"],
        ].map(([n, label]) => (
          <button key={n} onClick={() => preset(Number(n))}>
            {label}
          </button>
        ))}
      </div>
      <div className="row wrap data-toolbar">
        <label>
          시작일
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          종료일
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          설문 참여
          <select
            value={participation}
            onChange={(e) => setParticipation(e.target.value)}
          >
            <option value="">전체</option>
            <option value="completed">설문 응답</option>
            <option value="skipped">설문 미참여</option>
          </select>
        </label>
        <label>
          포함 재료
          <select
            value={ingredient}
            onChange={(e) => setIngredient(e.target.value)}
          >
            <option value="">전체 재료</option>
            {catalog.ingredients.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => {
            setParticipation("");
            setIngredient("");
            preset(1);
          }}
        >
          필터 초기화
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="data-metrics">
        <div className="panel">
          주문 기록<strong>{orders.length}건</strong>
        </div>
        <div className="panel">
          구성 항목
          <strong>
            {orders.reduce((n, o) => n + o.order_items.length, 0)}개
          </strong>
        </div>
        <div className="panel">
          설문 응답<strong>{completed}건</strong>
          <small>
            {orders.length ? Math.round((completed / orders.length) * 100) : 0}%
            참여
          </small>
        </div>
      </div>
      <div className="row wrap">
        {data &&
          [
            ["csv", "주문·설문 CSV"],
            ["items", "구성별 CSV"],
            ["json", "전체 JSON"],
            ["codebook", "문항 코드표"],
          ].map(([format, label]) => (
            <a
              className="chip"
              key={format}
              href={`/api/admin/export?${query}&format=${format}`}
            >
              {label}
            </a>
          ))}
      </div>
      <p className="muted">
        복수 응답은 선택지별 0·1로 저장하며 미응답은 빈 값으로 구분합니다.
        주문과 구성 파일은 기록 ID로 연결할 수 있습니다.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {[
                "기록 ID / 일시",
                "주문 구성",
                "금액",
                "설문",
                "응답 요약",
                "상세",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.slice(page * 25, page * 25 + 25).map((o) => (
              <tr key={o.id}>
                <td>
                  <code>{o.id.slice(0, 8)}</code>
                  <br />
                  {new Date(o.created_at).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </td>
                <td>
                  {o.order_items.map((i) => (
                    <p key={i.id}>
                      {i.snapshot.name}
                      {i.snapshot.toppings.length > 0 &&
                        ` · ${i.snapshot.toppings.map((v) => v.name).join(", ")}`}
                      {i.snapshot.excluded.length > 0 &&
                        ` · 제외: ${i.snapshot.excluded.map((v) => v.name).join(", ")}`}
                    </p>
                  ))}
                </td>
                <td>{money(o.total)}</td>
                <td>
                  {o.order_surveys?.survey_completed ? "응답 완료" : "미참여"}
                  <br />
                  <small>{o.order_surveys?.survey_version}</small>
                  {o.order_surveys?.internal_test && (
                    <small> · 내부 테스트</small>
                  )}
                </td>
                <td className="survey-cell">
                  {Object.entries(o.order_surveys?.answers ?? {})
                    .slice(0, 3)
                    .map(([id, a]) => (
                      <p key={id}>
                        {id} · {answerText(o, id, a)}
                      </p>
                    ))}
                </td>
                <td>
                  <button onClick={() => setSelected(o)}>상세 보기</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length && (
          <p className="empty">
            {busy
              ? "데이터를 불러오고 있어요"
              : "선택한 기간과 조건에 해당하는 기록이 없습니다."}
          </p>
        )}
      </div>
      <div className="row between">
        <span>
          {from} ~ {to} · 한국 시간
        </span>
        <div className="row">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            이전
          </button>
          <span>
            {page + 1} / {Math.max(1, Math.ceil(orders.length / 25))}
          </span>
          <button
            disabled={(page + 1) * 25 >= orders.length}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </button>
        </div>
      </div>
      {selected && (
        <div className="overlay">
          <section
            className="modal stack research-details"
            role="dialog"
            aria-modal="true"
            aria-label="연구 기록 상세"
          >
            <div className="row between">
              <h2>연구 기록 상세</h2>
              <button autoFocus onClick={() => setSelected(null)}>
                닫기
              </button>
            </div>
            <small style={{ overflowWrap: "anywhere" }}>
              기록 ID: {selected.id}
            </small>
            <OrderReceipt order={selected} />
            <h3>설문 응답</h3>
            {selected.order_surveys?.survey_completed ? (
              data?.versions
                .find((v) => v.id === selected.order_surveys?.survey_version)
                ?.questions.map((q) => (
                  <div key={q.id}>
                    <strong>
                      {q.id}. {q.title}
                    </strong>
                    <p>
                      {answerText(
                        selected,
                        q.id,
                        selected.order_surveys?.answers[q.id] ?? [],
                      ) || "미응답"}
                    </p>
                  </div>
                ))
            ) : (
              <p>설문에 참여하지 않은 주문입니다.</p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
