import { json, failure, readBody, sameOrigin } from "@/lib/http";
import { submitOrder } from "@/lib/order-service";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    return json(await submitOrder(await readBody(req)), 201);
  } catch (e) {
    return failure(e);
  }
}
