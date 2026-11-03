import { z } from "zod";
import { checkAccess } from "@/lib/server/guard";
import { aiErrorResponse, completeJSON, pickProvider } from "@/lib/server/ai";
import { AssistantSchema } from "@/lib/assistant/schema";

const Body = z.object({
  message: z.string().min(1).max(2000),
  provider: z.string().nullable().optional(),
  /** Anonymized: roles/ages/diets only, never names. Built client-side. */
  context: z.string().max(20000),
});

const SYSTEM = `You are the planning assistant inside WellFed, a private family meal-planning app.
Translate the user's request into actions for the app's deterministic planner. You cannot see prices or nutrition values and must never state or estimate them; the app calculates those.

Actions:
- generate_plan: build a new plan. Fill only what the user said (budget, days, mealTypes, priority, maxCookMinutes, preferIngredients for "use the X in my fridge", storeChain for "around this week's <store> specials"). Leave everything else null so the app uses saved settings.
- swap_meal: replace one meal in the current plan. Set weekday (0=Sunday) or relativeDay, mealType, and filters (kidFriendly for "something the kids will like", maxMinutes→maxCookMinutes, highProtein, cheaper).
- adjust_plan: modify the whole current plan. goal "higher-protein", "cheaper" (keepProtein true if they want to keep protein), "faster" (set maxCookMinutes), or "use-pantry" (preferIngredients).
- none: questions you can answer without changing anything, or unclear requests (ask a short clarifying question in reply).

Map food words to catalog ingredient ids from the context. Use only ids that appear there.
"Two meals per day" with no detail means lunch and dinner. Keep the reply to one or two sentences.`;

export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const body = Body.parse(await req.json());
    const provider = pickProvider(body.provider);
    if (!provider) return Response.json({ error: "No AI provider configured", offline: true }, { status: 503 });
    const result = await completeJSON({
      provider,
      name: "assistant_actions",
      system: SYSTEM,
      schema: AssistantSchema,
      content: [{ type: "text", text: `<app_context>\n${body.context}\n</app_context>\n\nUser request: ${body.message}` }],
    });
    return Response.json({ ...result, provider });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
