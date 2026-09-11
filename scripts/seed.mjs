import { readFileSync, writeFileSync } from "node:fs";
const survey = JSON.parse(readFileSync("config/survey.json", "utf8"));
const languages = JSON.parse(readFileSync("config/languages.json", "utf8")).map(
  (l) => l.code,
);
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
  // 기성품 토핑입니다. 제주 원물 4종과 달리 소개 페이지가 없고 가격이 제각각입니다.
  ["cheese", "치즈 1장", "치즈 1장", "ready", 10, null, 1000],
  ["gim", "김 1봉지", "김 1봉지", "ready", 11, null, 1000],
  ["kimchi", "배추김치", "배추김치", "ready", 12, null, 2000],
  ["stir-fried-kimchi", "볶음김치", "볶음김치", "ready", 13, null, 3000],
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
  `-- scripts/seed.mjs로 생성합니다. 기존 운영 데이터는 덮어쓰지 않습니다.\ninsert into public.ingredients values\n${values(ingredients)} on conflict do nothing;\ninsert into public.inventory(ingredient_id) select id from public.ingredients where kind in ('topping','ready') on conflict do nothing;\ninsert into public.products values\n${values(
    [
      ["gimbap", "기본 김밥", "base", 5000, true],
      ["package", "라면 · 음료 패키지", "upgrade", 10000, true],
      ["ramen", "라면", "extra", null, false],
      ["drink", "음료", "extra", null, false],
      ["goods", "굿즈", "extra", null, false],
    ],
  )} on conflict do nothing;\ninsert into public.survey_versions values (${esc(survey.id)},${esc(JSON.stringify(survey.questions))}::jsonb,not exists(select 1 from public.survey_versions where active)) on conflict do nothing;\ninsert into public.contents(id,language,title) values\n${values(languages.flatMap((lang) => ["usage", "brand", "producer", "consent", "experience", "pork", "turban-shell", "fernbrake", "carrot"].map((id) => [id, lang, ""])))} on conflict do nothing;\n`,
);
// 02 페이지와 토핑 카드에 쓰는 소개 문구입니다. DB가 아니라 앱에만 둡니다.
const details = {
  carrot: {
    tagline: "제주 당근을 새콤달콤하게 즐기는 아삭한 토핑.",
    taste: "새콤 · 달콤",
    texture: "아삭함",
    diet: "🌱 식물성",
    allergyRaw: "✓ 주요 알레르기 없음",
    allergySauce: "✓ 주요 알레르기 없음",
  },
  "turban-shell": {
    tagline: "제주 해녀가 채취한 뿔소라에 감칠맛을 더한 바다 토핑.",
    taste: "짭짤 · 감칠맛",
    texture: "쫄깃함",
    diet: "🐚 해산물",
    allergyRaw: "⚠️ 연체류",
    allergySauce: "⚠️ 대두 · 밀",
  },
  fernbrake: {
    tagline: "제주의 봄 고사리를 새콤하게 즐기는 제주 나물 토핑.",
    taste: "새콤 · 담백",
    texture: "부드럽고 쫄깃함",
    diet: "🌱 식물성",
    allergyRaw: "✓ 주요 알레르기 없음",
    allergySauce: "✓ 주요 알레르기 없음",
  },
  pork: {
    tagline: "잘게 다진 제주 돼지고기에 달콤짭짤한 BBQ 맛을 더한 토핑.",
    taste: "달콤 · 짭짤 · 고소",
    texture: "부드러움",
    diet: "🐷 돼지고기 포함 · 할랄 아님",
    allergyRaw: "⚠️ 돼지고기",
    allergySauce: "⚠️ 대두 · 밀",
  },
  cheese: { diet: "🥛 우유 포함", allergyRaw: "⚠️ 우유", allergySauce: "" },
  gim: { diet: "🌱 식물성", allergyRaw: "✓ 주요 알레르기 없음", allergySauce: "" },
  kimchi: { diet: "🌊 젓갈 포함", allergyRaw: "⚠️ 새우 · 생선", allergySauce: "" },
  "stir-fried-kimchi": { diet: "🌊 젓갈 포함", allergyRaw: "⚠️ 새우 · 생선", allergySauce: "" },
};
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
      ...(details[id] ? { detail: details[id] } : {}),
    })),
    null,
    2,
  ) + "\n",
);
