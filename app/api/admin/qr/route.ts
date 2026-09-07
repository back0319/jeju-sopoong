import QRCode from "qrcode";
import { requireAdmin } from "@/lib/supabase/server";
import { failure } from "@/lib/http";
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const png = await QRCode.toBuffer(new URL("/", req.url).toString(), {
      width: 480,
      margin: 3,
    });
    return new Response(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
