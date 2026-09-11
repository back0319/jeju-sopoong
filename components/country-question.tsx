"use client";
import { useState } from "react";
import type { Language, Question } from "@/lib/types";
import type { t } from "@/lib/client";
import { optionLabel, searchTerms } from "@/lib/survey-i18n";
import countries from "@/config/countries.json";
export function CountryQuestion({ question, language, copy, selected, onChange }: { question: Question; language: Language; copy: typeof t; selected?: string; onChange: (id: string) => void }) {
  const options = question.options;
  const [search,setSearch]=useState("");
  const term=search.trim().toLocaleLowerCase();
  const aliases: Record<string,string> = { kr: "한국 코리아 대한민국", "kr-jeju": "한국 제주 제주도민", au: "호주", tr: "터키", us: "USA 미국", gb: "UK 영국" };
  // 검색은 선택한 언어의 표기, 한국어 원문, ISO 코드, 영문명을 모두 훑습니다.
  const filtered=options.filter(o => `${searchTerms(question, o, language)} ${aliases[o.id] ?? ""} ${countries.countries.find(c=>c.id===o.id)?.english ?? ""}`.toLocaleLowerCase().includes(term));
  const choice=(o: Question["options"][number])=><button type="button" key={o.id} aria-pressed={selected===o.id} className={selected===o.id?"selected":""} onClick={()=>onChange(o.id)}>{optionLabel(question, o, language)}</button>;
  const chosen = selected ? options.find(o=>o.id===selected) : undefined;
  return <div className="country-question stack">
    <label>{copy.countrySearch}<input type="search" placeholder={copy.countrySearchHint} value={search} onChange={e=>setSearch(e.target.value)} /></label>
    <p role="status" className="muted">{chosen ? `${copy.countrySelected}: ${optionLabel(question, chosen, language)}` : copy.countryPrompt}</p>
    <div className="country-results">
      {!term && <><h3>{copy.countryQuick}</h3><div className="grid2">{countries.preferred.map(id=>options.find(o=>o.id===id)).filter((o): o is Question["options"][number]=>!!o).map(choice)}</div><h3>{copy.countryAll}</h3></>}
      <div className="grid2">{filtered.map(choice)}</div>
      {!filtered.length && <p>{copy.countryNoResult}</p>}
    </div>
  </div>;
}
