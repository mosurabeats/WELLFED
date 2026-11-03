import { z } from "zod";
import { checkAccess } from "@/lib/server/guard";
import { aiErrorResponse, completeJSON, pickProvider } from "@/lib/server/ai";
import { RecipeDraftSchema } from "@/lib/assistant/schema";

const Body = z.object({
  provider: z.string().nullable().optional(),
  prompt: z.string().min(2).max(4000),
  constraints: z.string().max(4000),
  catalog: z.string().max(20000),
});

const SYSTEM = `You write practical family recipes for a meal-planning app.
Use precise quantities in US kitchen units for the stated servings. Prefer ingredients from the catalog and give their exact id; use ingredientId null only when nothing in the catalog fits.
Respect every allergy and diet listed in the constraints. Do not include nutrition numbers or prices — the app calculates them from USDA data and store prices.
Steps should be short, numbered actions a home cook can follow.`;

export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const body = Body.parse(await req.json());
    const provider = pickProvider(body.provider);
    if (!provider) return Response.json({ error: "AI recipe creation needs an ANTHROPIC_API_KEY or OPENAI_API_KEY on the server. You can still add recipes by hand.", offline: true }, { status: 503 });
    const result = await completeJSON({
      provider,
      name: "recipe",
      system: SYSTEM,
      schema: RecipeDraftSchema,
      content: [{ type: "text", text: `<constraints>\n${body.constraints}\n</constraints>\n<catalog>\n${body.catalog}\n</catalog>\n\nRequest: ${body.prompt}` }],
    });
    return Response.json({ recipe: result, provider });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
