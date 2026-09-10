"use client";
import { useState } from "react";
import type { Question } from "@/lib/types";
import countries from "@/config/countries.json";
export function CountryQuestion({ options, selected, onChange }: { options: Question["options"]; selected?: string; onChange: (id: string) => void }) {
  const [search,setSearch]=useState("");
  const term=search.trim().toLocaleLowerCase();
  const aliases: Record<string,string> = { kr: "한국 코리아 대한민국", "kr-jeju": "한국 제주 제주도민", au: "호주", tr: "터키", us: "USA 미국", gb: "UK 영국" };
  const filtered=options.filter(o => `${o.label} ${o.id} ${aliases[o.id] ?? ""} ${countries.countries.find(c=>c.id===o.id)?.english ?? ""}`.toLocaleLowerCase().includes(term));
  const choice=(o: Question["options"][number])=><button type="button" key={o.id} aria-pressed={selected===o.id} className={selected===o.id?"selected":""} onClick={()=>onChange(o.id)}>{o.label}</button>;
  return <div className="country-question stack">
    <label>국가·지역 검색<input type="search" placeholder="국가명 검색 (한국어 / English)" value={search} onChange={e=>setSearch(e.target.value)} /></label>
    <p role="status" className="muted">{selected ? `선택: ${options.find(o=>o.id===selected)?.label}` : "국가·지역을 선택해 주세요"}</p>
    <div className="country-results">
      {!term && <><h3>빠른 선택</h3><div className="grid2">{countries.preferred.map(id=>options.find(o=>o.id===id)).filter((o): o is Question["options"][number]=>!!o).map(choice)}</div><h3>전체 국가·지역</h3></>}
      <div className="grid2">{filtered.map(choice)}</div>
      {!filtered.length && <p>검색 결과가 없습니다. 다른 이름으로 검색해 주세요.</p>}
    </div>
  </div>;
}
