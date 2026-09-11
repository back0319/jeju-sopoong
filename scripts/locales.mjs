// 한국어 파일을 기준으로 나머지 언어 파일의 키를 맞춥니다. 이미 번역된 값은 보존합니다.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
const languages = JSON.parse(readFileSync("config/languages.json", "utf8"));
const korean = JSON.parse(readFileSync("locales/ko.json", "utf8"));
const merge = (base, current) =>
  Object.fromEntries(
    Object.entries(base).map(([key, value]) => [
      key,
      value && typeof value === "object" && !Array.isArray(value)
        ? merge(value, current?.[key] ?? {})
        : (current?.[key] ?? ""),
    ]),
  );
for (const { code } of languages) {
  if (code === "ko") continue;
  const path = `locales/${code}.json`;
  const current = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  writeFileSync(path, JSON.stringify(merge(korean, current), null, 2) + "\n");
}
