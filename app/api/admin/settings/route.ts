import { requireAdmin, serviceClient } from "@/lib/supabase/server";
import { json, failure, readBody, sameOrigin } from "@/lib/http";
import { isLanguage } from "@/lib/types";
const integer = (x: unknown) =>
  typeof x === "number" && Number.isSafeInteger(x) && x >= 0 && x <= 100000000;
const text = (x: unknown, n = 10000) => typeof x === "string" && x.length <= n;
function validUrl(value: unknown, video = false) {
  if (value === "") return true;
  if (typeof value !== "string" || value.length > 2000) return false;
  if (!video && value.startsWith("/brand/")) return !value.includes("..");
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      (!video ||
        [
          "youtube.com",
          "www.youtube.com",
          "youtu.be",
          "m.youtube.com",
        ].includes(u.hostname))
    );
  } catch {
    return false;
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const { client, user } = await requireAdmin();
    const b = await readBody(req);
    let error;
    if (b.type === "inventory") {
      if (
        !text(b.id, 80) ||
        !integer(b.remaining) ||
        !integer(b.previousRemaining) ||
        typeof b.previousDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.previousDate) ||
        typeof b.previousForced !== "boolean" ||
        typeof b.forced_sold_out !== "boolean"
      )
        throw new Error("INVALID_INPUT");
      const result = await serviceClient().rpc("set_inventory", {
        p_id: b.id, p_remaining: b.remaining, p_forced: b.forced_sold_out,
        p_previous: b.previousRemaining, p_previous_forced: b.previousForced,
        p_date: b.previousDate, p_actor: user.id,
      });
      error = result.error;
    } else if (b.type === "product") {
      if (
        !text(b.id, 80) ||
        !text(b.name, 100) ||
        !(b.name as string).trim() ||
        !(b.price === null || integer(b.price)) ||
        typeof b.active !== "boolean" ||
        (b.active && b.price === null)
      )
        throw new Error("INVALID_INPUT");
      if (b.create) {
        if (!/^[a-z][a-z0-9-]{1,60}$/.test(b.id as string))
          throw new Error("INVALID_INPUT");
        ({ error } = await client.from("products").insert({
          id: b.id,
          name: b.name,
          price: b.price,
          active: b.active,
          kind: "extra",
        }));
      } else
        ({ error } = await client
          .from("products")
          .update({ name: b.name, price: b.price, active: b.active })
          .eq("id", b.id));
    } else if (b.type === "topping-price") {
      if (!integer(b.price)) throw new Error("INVALID_INPUT");
      ({ error } = await client
        .from("ingredients")
        .update({ price: b.price })
        .eq("kind", "topping"));
    } else if (b.type === "ingredient-price") {
      // 기성품 토핑은 품목마다 가격이 달라 공통가와 따로 관리합니다.
      if (!text(b.id, 80) || !integer(b.price)) throw new Error("INVALID_INPUT");
      ({ error } = await client
        .from("ingredients")
        .update({ price: b.price })
        .eq("id", b.id)
        .eq("kind", "ready"));
    } else if (b.type === "ingredient-tracked") {
      // 기성품만 수량 관리를 끌 수 있습니다. 제주 원물은 매일 준비량을 셉니다.
      if (!text(b.id, 80) || typeof b.tracked !== "boolean")
        throw new Error("INVALID_INPUT");
      ({ error } = await client
        .from("ingredients")
        .update({ tracked: b.tracked })
        .eq("id", b.id)
        .eq("kind", "ready"));
    } else if (b.type === "content") {
      if (
        !text(b.id, 80) ||
        !isLanguage(b.language) ||
        !text(b.title, 200) ||
        !text(b.body) ||
        !validUrl(b.image_url) ||
        !validUrl(b.video_url, true) ||
        !integer(b.version)
      )
        throw new Error("INVALID_INPUT");
      const r = await client
        .from("contents")
        .update({
          title: b.title,
          body: b.body,
          image_url: b.image_url,
          video_url: b.video_url,
          version: Number(b.version) + 1,
        })
        .eq("id", b.id)
        .eq("language", b.language)
        .eq("version", b.version)
        .select("id");
      error = r.error;
      if (!r.data?.length && !error) throw new Error("STALE_ORDER");
    } else throw new Error("INVALID_INPUT");
    if (error) throw new Error("INVALID_INPUT");
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
