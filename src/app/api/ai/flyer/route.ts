import { z } from "zod";
import { checkAccess } from "@/lib/server/guard";
import { aiErrorResponse, completeJSON, pickProvider, type Block } from "@/lib/server/ai";
import { FlyerSchema } from "@/lib/assistant/schema";

const Body = z.object({
  provider: z.string().nullable().optional(),
  storeName: z.string().max(200),
  text: z.string().max(60000).optional(),
  file: z.object({ mime: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]), data: z.string().max(14_000_000) }).optional(),
  catalog: z.string().max(20000),
});

const SYSTEM = `You extract grocery deals from a store's weekly flyer for a family meal-planning app.
Return only items whose price is clearly printed. Never guess or invent a price. Skip non-food items.
For multi-buy offers ("2 for $5") give the per-item price and describe the offer in promoNotes.
For per-pound prices use packageQty 1 and packageUnit "lb". Mark loyaltyRequired for card/rewards prices and couponRequired for digital or paper coupons.
Map each item to the closest catalog ingredient id when it is clearly the same food; otherwise null.`;

export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const body = Body.parse(await req.json());
    if (!body.text && !body.file) return Response.json({ error: "Add a flyer image, PDF or text." }, { status: 400 });
    const provider = pickProvider(body.provider);
    if (!provider) return Response.json({ error: "Reading images and PDFs needs an AI key. Paste the flyer text instead — it's parsed offline.", offline: true }, { status: 503 });
    const content: Block[] = [];
    if (body.file) {
      content.push(body.file.mime === "application/pdf" ? { type: "pdf", data: body.file.data } : { type: "image", mime: body.file.mime, data: body.file.data });
    }
    content.push({ type: "text", text: `Store: ${body.storeName}\n<catalog>\n${body.catalog}\n</catalog>\n${body.text ? `<flyer_text>\n${body.text}\n</flyer_text>` : "Extract the deals from the attached flyer."}` });
    const result = await completeJSON({ provider, name: "flyer_deals", system: SYSTEM, schema: FlyerSchema, content });
    return Response.json({ ...result, provider });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
