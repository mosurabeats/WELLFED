"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Plus, Trash2, ClipboardPaste, ArrowLeft } from "lucide-react";
import type { MealType, Recipe, RecipeIngredient, Unit } from "@/lib/types";
import { useData } from "@/lib/data-context";
import { saveRecipe } from "@/lib/db/actions";
import { uid } from "@/lib/db/defaults";
import { api } from "@/lib/api";
import { recipeNutrition, roundNutrients } from "@/lib/engine/nutrition";
import { findConflicts, ALLERGEN_LABEL, DIET_LABEL, recipeAllergens } from "@/lib/engine/allergens";
import { canConvert } from "@/lib/engine/units";
import { parseRecipeText } from "@/lib/recipe-import";
import type { RecipeDraft } from "@/lib/assistant/schema";
import { Button, Card, Chips, Field, Input, Notice, PageHeader, Segmented, Select, Textarea } from "@/components/ui";
import { IngredientPicker } from "@/components/ingredient-picker";
import { useToast } from "@/components/toast";

const UNITS: Unit[] = ["each", "cup", "tbsp", "tsp", "oz", "lb", "g", "kg", "ml", "l", "floz"];
const TAGS = ["kid-friendly", "high-protein", "high-fiber", "quick", "make-ahead", "batch", "freezer-friendly", "one-pan", "budget", "lower-fat", "slow-cooker", "meal-prep", "vegetarian", "vegan", "gluten-free", "dairy-free"];

function blank(): Recipe {
  return { id: uid("r"), name: "", description: "", servings: 4, prepMinutes: 15, cookMinutes: 20, difficulty: "easy", mealTypes: ["dinner"], ingredients: [], steps: [], tags: [], storage: "Refrigerate up to 3 days.", leftovers: "Reheat until hot.", source: "user" };
}

export default function NewRecipePage() {
  return (
    <Suspense>
      <Editor />
    </Suspense>
  );
}

function Editor() {
  const data = useData();
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const editId = params.get("edit");
  const [r, setR] = useState<Recipe>(blank);
  const [stepsText, setStepsText] = useState("");
  const [mode, setMode] = useState<"manual" | "ai" | "paste">("manual");
  const [prompt, setPrompt] = useState("");
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [unmatched, setUnmatched] = useState<string[]>([]);

  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (editId && editId !== loadedId) {
    const ex = data.recipeMap.get(editId);
    if (ex && ex.source !== "builtin") {
      setLoadedId(editId);
      setR(ex);
      setStepsText(ex.steps.join("\n"));
      setUnmatched(ex.unmatchedIngredients ?? []);
    }
  }

  const set = <K extends keyof Recipe>(k: K, v: Recipe[K]) => setR((x) => ({ ...x, [k]: v }));
  const setLine = (i: number, patch: Partial<RecipeIngredient>) => set("ingredients", r.ingredients.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const preview = useMemo(() => {
    const valid = r.ingredients.filter((l) => l.ingredientId);
    return {
      n: roundNutrients(recipeNutrition({ ...r, ingredients: valid }, data.ctx.lookup).perServing),
      incomplete: recipeNutrition({ ...r, ingredients: valid }, data.ctx.lookup).incomplete,
      allergens: recipeAllergens({ ingredients: valid }, data.ctx.lookup),
      conflicts: findConflicts({ ingredients: valid, unmatchedIngredients: unmatched }, data.members, data.ctx.lookup).filter((c) => c.kind !== "dislike"),
    };
  }, [r, data, unmatched]);

  function applyDraft(d: RecipeDraft) {
    const valid = new Set(data.ingredients.map((i) => i.id));
    const lines: RecipeIngredient[] = [];
    const um: string[] = [];
    for (const x of d.ingredients) {
      const ing = x.ingredientId && valid.has(x.ingredientId) ? data.ingredientMap.get(x.ingredientId)! : null;
      if (ing && canConvert(x.unit, ing)) lines.push({ ingredientId: ing.id, qty: x.qty, unit: x.unit, ...(x.note ? { note: x.note } : {}) });
      else um.push(`${x.qty} ${x.unit} ${x.name}`);
    }
    setR((cur) => ({ ...cur, name: d.name, description: d.description, servings: d.servings, prepMinutes: d.prepMinutes, cookMinutes: d.cookMinutes, mealTypes: d.mealTypes.length ? d.mealTypes : cur.mealTypes, ingredients: lines, tags: d.tags.filter((t) => TAGS.includes(t)), storage: d.storage, leftovers: d.leftovers, source: "ai" }));
    setStepsText(d.steps.join("\n"));
    setUnmatched(um);
    setMode("manual");
  }

  async function aiDraft() {
    setBusy(true);
    try {
      const constraints = [
        ...data.members.map((m, i) => `Person ${i + 1} (${m.kind}, age ${m.age})${m.allergies.length ? ` allergies: ${m.allergies.join(", ")}` : ""}${m.diets.length ? ` diets: ${m.diets.join(", ")}` : ""}`),
      ].join("\n");
      const res = await api<{ recipe: RecipeDraft }>("/api/ai/recipe", { method: "POST", body: JSON.stringify({ prompt, constraints, provider: data.settings.aiProvider, catalog: data.ingredients.map((i) => `${i.id}=${i.name}`).join("; ") }) });
      applyDraft(res.recipe);
      toast("Draft ready — review before saving");
    } catch (e) {
      toast(e instanceof Error ? e.message : "AI unavailable", "error");
    } finally {
      setBusy(false);
    }
  }

  function importPaste() {
    const p = parseRecipeText(paste, data.ingredients);
    setR((cur) => ({ ...cur, name: p.name || cur.name, ingredients: p.ingredients.map(({ raw: _raw, ...l }) => { void _raw; return l; }) }));
    setStepsText(p.steps.join("\n"));
    setUnmatched(p.unmatched);
    setMode("manual");
    toast(`Matched ${p.ingredients.length} ingredients${p.unmatched.length ? `, ${p.unmatched.length} need attention` : ""}`);
  }

  async function save() {
    if (!r.name.trim()) return toast("Name the recipe", "error");
    const lines = r.ingredients.filter((l) => l.ingredientId && l.qty > 0);
    if (!lines.length) return toast("Add at least one ingredient", "error");
    for (const l of lines) {
      const ing = data.ingredientMap.get(l.ingredientId);
      if (!ing || !canConvert(l.unit, ing)) return toast(`Can't measure ${ing?.name ?? l.ingredientId} in ${l.unit}`, "error");
    }
    const recipe: Recipe = { ...r, name: r.name.trim(), ingredients: lines, steps: stepsText.split("\n").map((s) => s.trim()).filter(Boolean), unmatchedIngredients: unmatched.length ? unmatched : undefined };
    await saveRecipe(recipe);
    toast("Recipe saved");
    router.replace(`/recipes/view?id=${recipe.id}`);
  }

  return (
    <div className="rise pb-8">
      <button onClick={() => router.back()} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-600"><ArrowLeft className="h-4 w-4" /> Back</button>
      <PageHeader eyebrow="Recipes" title={editId ? "Edit recipe" : "New recipe"} />
      {!editId && (
        <Segmented className="mb-4 w-full" value={mode} onChange={setMode} options={[{ value: "manual", label: "Write" }, { value: "ai", label: <span className="inline-flex items-center gap-1"><Sparkles className="h-4 w-4" /> AI draft</span> }, { value: "paste", label: <span className="inline-flex items-center gap-1"><ClipboardPaste className="h-4 w-4" /> Import</span> }]} />
      )}

      {mode === "ai" && (
        <Card className="mb-5 space-y-3 p-4">
          <Field label="Describe the recipe" hint="Household allergies and diets are sent anonymously. Nutrition is calculated from USDA data, not by the AI.">
            <Textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="A kid-friendly chicken and rice skillet under 30 minutes, no dairy" />
          </Field>
          <Button className="w-full" onClick={aiDraft} loading={busy} disabled={prompt.trim().length < 3}><Sparkles className="h-4 w-4" /> Draft recipe</Button>
        </Card>
      )}
      {mode === "paste" && (
        <Card className="mb-5 space-y-3 p-4">
          <Field label="Paste a recipe" hint="Title first, then ingredient lines like “1½ cups rice”, then steps. Parsed on this device.">
            <Textarea rows={10} value={paste} onChange={(e) => setPaste(e.target.value)} />
          </Field>
          <Button className="w-full" onClick={importPaste} disabled={!paste.trim()}>Import</Button>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <Field label="Name"><Input value={r.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Description"><Textarea rows={2} value={r.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Servings"><Input inputMode="numeric" value={r.servings} onChange={(e) => set("servings", Math.max(1, Number(e.target.value) || 1))} /></Field>
            <Field label="Prep min"><Input inputMode="numeric" value={r.prepMinutes} onChange={(e) => set("prepMinutes", Number(e.target.value) || 0)} /></Field>
            <Field label="Cook min"><Input inputMode="numeric" value={r.cookMinutes} onChange={(e) => set("cookMinutes", Number(e.target.value) || 0)} /></Field>
          </div>
          <Field label="Meal">
            <Chips<MealType> values={r.mealTypes} onChange={(v) => set("mealTypes", v)} options={[{ value: "breakfast", label: "Breakfast" }, { value: "lunch", label: "Lunch" }, { value: "dinner", label: "Dinner" }, { value: "snack", label: "Snack" }]} />
          </Field>
          <Field label="Difficulty">
            <Segmented className="w-full" size="sm" value={r.difficulty} onChange={(v) => set("difficulty", v)} options={[{ value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" }]} />
          </Field>

          <div>
            <div className="mb-2 text-[13px] font-semibold text-ink-600">Ingredients (quantities for {r.servings} servings)</div>
            <div className="space-y-2">
              {r.ingredients.map((l, i) => {
                const ing = data.ingredientMap.get(l.ingredientId);
                return (
                  <div key={i} className="rounded-2xl border border-ink/10 bg-cream-100 p-2.5">
                    <IngredientPicker single selected={l.ingredientId ? [l.ingredientId] : []} onChange={(v) => setLine(i, { ingredientId: v[0] ?? "" })} />
                    <div className="mt-2 grid grid-cols-[70px_1fr_1fr_auto] gap-2">
                      <Input inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) || 0 })} aria-label="Quantity" />
                      <Select value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value as Unit })} aria-label="Unit">
                        {UNITS.filter((u) => !ing || canConvert(u, ing)).map((u) => <option key={u} value={u}>{u === "each" ? ing?.eachLabel ?? "each" : u}</option>)}
                      </Select>
                      <Input placeholder="note" value={l.note ?? ""} onChange={(e) => setLine(i, { note: e.target.value || undefined })} />
                      <button aria-label="Remove ingredient" onClick={() => set("ingredients", r.ingredients.filter((_, j) => j !== i))} className="rounded-full p-2 text-ink-300 hover:text-tomato"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <label className="mt-1.5 flex items-center gap-2 text-xs text-ink-600"><input type="checkbox" checked={!!l.optional} onChange={(e) => setLine(i, { optional: e.target.checked || undefined })} /> Optional / garnish</label>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" onClick={() => set("ingredients", [...r.ingredients, { ingredientId: "", qty: 1, unit: "each" }])}><Plus className="h-4 w-4" /> Add ingredient</Button>
            </div>
            {unmatched.length > 0 && (
              <Notice className="mt-3">
                <b>Not in the catalog:</b> {unmatched.join("; ")}. Map them to a catalog ingredient above, or they&apos;ll be saved as unverified — excluded from nutrition, and the recipe will be kept out of plans for anyone with allergies.
                <button className="mt-1 block text-xs font-semibold underline" onClick={() => setUnmatched([])}>Dismiss (drop these lines)</button>
              </Notice>
            )}
          </div>

          <Field label="Steps" hint="One step per line."><Textarea rows={7} value={stepsText} onChange={(e) => setStepsText(e.target.value)} /></Field>
          <Field label="Tags"><Chips values={r.tags} onChange={(v) => set("tags", v)} options={TAGS.map((t) => ({ value: t, label: t }))} /></Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Storage"><Input value={r.storage} onChange={(e) => set("storage", e.target.value)} /></Field>
            <Field label="Leftovers"><Input value={r.leftovers} onChange={(e) => set("leftovers", e.target.value)} /></Field>
          </div>
          <Button size="lg" className="w-full" onClick={save}>Save recipe</Button>
        </div>

        <aside className="space-y-3 md:sticky md:top-6 md:self-start">
          <Card className="p-4">
            <div className="eyebrow mb-2">Per serving (live)</div>
            <div className="tnum grid grid-cols-2 gap-y-1 text-sm">
              <span>Calories</span><b className="text-right">{preview.n.kcal}</b>
              <span>Protein</span><b className="text-right">{preview.n.protein}g</b>
              <span>Carbs</span><b className="text-right">{preview.n.carbs}g</b>
              <span>Fat</span><b className="text-right">{preview.n.fat}g</b>
              <span>Fiber</span><b className="text-right">{preview.n.fiber}g</b>
              <span>Sodium</span><b className="text-right">{preview.n.sodium}mg</b>
            </div>
            <p className="mt-2 text-[11px] text-ink-400">Calculated from USDA FoodData Central.</p>
          </Card>
          {preview.allergens.length > 0 && <div className="text-xs"><b>Contains:</b> {preview.allergens.map((a) => ALLERGEN_LABEL[a]).join(", ")}</div>}
          {preview.conflicts.length > 0 && <Notice tone="tomato">{preview.conflicts.map((c, i) => <div key={i}>{c.memberName}: {c.ingredientName} ({c.detail})</div>)}</Notice>}
          {data.members.some((m) => m.diets.length) && <p className="text-[11px] text-ink-400">Household diets: {[...new Set(data.members.flatMap((m) => m.diets))].map((d) => DIET_LABEL[d]).join(", ")}</p>}
        </aside>
      </div>
    </div>
  );
}
