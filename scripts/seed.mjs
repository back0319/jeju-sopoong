import { readFileSync, writeFileSync } from "node:fs";
const survey = JSON.parse(readFileSync("config/survey.json", "utf8"));
const esc = (s) => "'" + s.replaceAll("'", "''") + "'";
const ingredients = [
  ["seaweed", "김", "김", "fixed", 0, null, 0],
  ["rice", "밥", "밥", "fixed", 1, null, 0],
  ["egg", "계란", "EGG", "base", 2, null, 0],
  ["ham", "햄", "HAM", "base", 3, null, 0],
  ["radish", "단무지", "단무지", "base", 4, null, 0],
  ["crab", "맛살", "CRAB STICK", "base", 5, null, 0],
  [
    "pork",
    "제주 돼지고기",
    "PORK",
    "topping",
    6,
    "/brand/ingredients/pork.svg",
    3000,
  ],
  [
    "turban-shell",
    "뿔소라",
    "TURBAN SHELL",
    "topping",
    7,
    "/brand/ingredients/turban-shell.svg",
    3000,
  ],
  [
    "fernbrake",
    "고사리",
    "FERNBRAKE",
    "topping",
    8,
    "/brand/ingredients/fernbrake.svg",
    3000,
  ],
  [
    "carrot",
    "당근",
    "CARROT",
    "topping",
    9,
    "/brand/ingredients/carrot.svg",
    3000,
  ],
];
const values = (rows) =>
  rows
    .map(
      (r) =>
        "(" +
        r
          .map((v) =>
            v === null ? "null" : typeof v === "string" ? esc(v) : v,
          )
          .join(",") +
        ")",
    )
    .join(",\n");
writeFileSync(
  "supabase/seed.sql",
  `-- scripts/seed.mjs로 생성합니다. 기존 운영 데이터는 덮어쓰지 않습니다.\ninsert into public.ingredients values\n${values(ingredients)} on conflict do nothing;\ninsert into public.inventory(ingredient_id) select id from public.ingredients where kind='topping' on conflict do nothing;\ninsert into public.products values\n${values(
    [
      ["gimbap", "기본 김밥", "base", 5000, true],
      ["package", "라면 · 음료 · 굿즈 패키지", "upgrade", 10000, true],
      ["ramen", "라면", "extra", null, false],
      ["drink", "음료", "extra", null, false],
      ["goods", "굿즈", "extra", null, false],
    ],
  )} on conflict do nothing;\ninsert into public.survey_versions values (${esc(survey.id)},${esc(JSON.stringify(survey.questions))}::jsonb,not exists(select 1 from public.survey_versions where active)) on conflict do nothing;\ninsert into public.contents(id,language,title) values\n${values(["ko", "en", "ja", "zh"].flatMap((lang) => ["usage", "brand", "producer", "consent", "experience", "pork", "turban-shell", "fernbrake", "carrot"].map((id) => [id, lang, ""])))} on conflict do nothing;\n`,
);
writeFileSync(
  "config/ingredients.json",
  JSON.stringify(
    ingredients.map(([id, name, label, kind, position, image, price]) => ({
      id,
      name,
      label,
      kind,
      position,
      image,
      price,
    })),
    null,
    2,
  ) + "\n",
);
