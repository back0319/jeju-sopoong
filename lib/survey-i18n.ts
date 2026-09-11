import table from "@/config/survey-i18n.json";
import type { Language, Question } from "./types";

// 설문 문항은 DB에 한국어로만 저장됩니다. 검증이 id 기준이라 표시만 언어별로 바꿉니다.
type Translations = Record<string, Partial<Record<string, string>>>;
const questions = table as Record<
  string,
  { title: Translations[string]; options: Translations }
>;

const pick = (map: Partial<Record<string, string>> | undefined, language: Language) =>
  map?.[language]?.trim() || "";

export function questionTitle(question: Question, language: Language) {
  if (language === "ko") return question.title;
  return pick(questions[question.id]?.title, language) || question.title;
}

// 국가·지역 251개는 ISO 코드라 플랫폼의 표시명을 씁니다. 손으로 옮기지 않습니다.
const regionNames = new Map<Language, Intl.DisplayNames>();
function region(language: Language, code: string) {
  if (!/^[a-z]{2}$/.test(code)) return "";
  try {
    let names = regionNames.get(language);
    if (!names) {
      names = new Intl.DisplayNames([language], { type: "region" });
      regionNames.set(language, names);
    }
    const value = names.of(code.toUpperCase());
    return value && value !== code.toUpperCase() ? value : "";
  } catch {
    return "";
  }
}

export function optionLabel(
  question: Question,
  option: Question["options"][number],
  language: Language,
) {
  if (language === "ko") return option.label;
  if (question.id === "S1") {
    const name = region(language, option.id);
    if (name) return name;
  }
  return (
    pick(questions[question.id]?.options?.[option.id], language) || option.label
  );
}

// 검색어는 어느 언어로 입력해도 걸리도록 여러 표기를 함께 담습니다.
export function searchTerms(
  question: Question,
  option: Question["options"][number],
  language: Language,
) {
  return [option.label, optionLabel(question, option, language), option.id]
    .join(" ")
    .toLocaleLowerCase();
}
