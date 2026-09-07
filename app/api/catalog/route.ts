import { getCatalog } from "@/lib/catalog";
import { json, failure } from "@/lib/http";
export async function GET() {
  try {
    return json(await getCatalog());
  } catch (e) {
    return failure(e);
  }
}
