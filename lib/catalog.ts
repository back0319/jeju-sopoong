import "server-only";
import { kstDate } from "./domain";
import { configured, serviceClient } from "./supabase/server";
import ingredientSeed from "@/config/ingredients.json";
import surveySeed from "@/config/survey.json";
import type { Catalog } from "./types";
export async function getCatalog(): Promise<Catalog> {
  const internalTest = process.env.INTERNAL_TEST_MODE === "true";
  if (!configured())
    return {
      businessDate: kstDate(),
      ingredients: ingredientSeed as Catalog["ingredients"],
      inventory: ingredientSeed
        .filter((i) => i.kind === "topping")
        .map((i) => ({
          ingredient_id: i.id,
          remaining: 0,
          forced_sold_out: false,
        })),
      products: [
        {
          id: "gimbap",
          name: "기본 김밥",
          kind: "base",
          price: 5000,
          active: true,
        },
        {
          id: "package",
          name: "라면 · 음료 · 굿즈 패키지",
          kind: "upgrade",
          price: 10000,
          active: true,
        },
      ],
      contents: [],
      survey: surveySeed as Catalog["survey"],
      internalTest,
      configured: false,
    };
  const db = serviceClient();
  const { error: resetError } = await db.rpc("ensure_inventory_day");
  if (resetError) throw new Error("DATABASE_UNAVAILABLE");
  const results = await Promise.all([
    db.from("ingredients").select("*").order("position"),
    db.from("inventory").select("*"),
    db.from("products").select("*").order("id"),
    db.from("contents").select("*"),
    db
      .from("survey_versions")
      .select("id,questions")
      .eq("active", true)
      .single(),
  ]);
  for (const r of results) if (r.error) throw new Error("DATABASE_UNAVAILABLE");
  return {
    businessDate: kstDate(),
    ingredients: results[0].data!,
    inventory: results[1].data!,
    products: results[2].data!,
    contents: results[3].data!,
    survey: results[4].data!,
    internalTest,
    configured: true,
  } as Catalog;
}
