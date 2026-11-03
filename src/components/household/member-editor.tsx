"use client";

import { useState } from "react";
import type { ActivityLevel, AdultGoal, Allergen, Diet, Member } from "@/lib/types";
import { Button, Chips, Field, Input, Segmented, Select, Sheet, Notice } from "../ui";
import { ALLERGEN_LABEL, DIET_LABEL } from "@/lib/engine/allergens";
import { deleteMember, saveMember } from "@/lib/db/actions";
import { uid } from "@/lib/db/defaults";
import { memberTargets, portionFactor, goalLabel } from "@/lib/engine/targets";
import { IngredientPicker } from "../ingredient-picker";
import { useData } from "@/lib/data-context";
import { useToast } from "../toast";

export function blankMember(kind: Member["kind"] = "adult"): Member {
  return { id: uid("m"), name: "", kind, age: kind === "adult" ? 35 : 8, activity: "moderate", goal: "general", allergies: [], diets: [], dislikes: [], likes: [] };
}

export function MemberEditor({ member, open, onClose }: { member: Member | null; open: boolean; onClose: () => void }) {
  const [m, setM] = useState<Member>(member ?? blankMember());
  const [imperial, setImperial] = useState(true);
  const { ingredientMap, members } = useData();
  const toast = useToast();
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setM(member ?? blankMember());
  }
  const set = <K extends keyof Member>(k: K, v: Member[K]) => setM((x) => ({ ...x, [k]: v }));
  const isNew = !members.some((x) => x.id === m.id);
  const t = memberTargets(m);

  const ft = m.heightCm ? Math.floor(m.heightCm / 2.54 / 12) : "";
  const inch = m.heightCm ? Math.round((m.heightCm / 2.54) % 12) : "";
  const lb = m.weightKg ? Math.round(m.weightKg * 2.20462) : "";

  async function save() {
    if (!m.name.trim()) return toast("Give them a name", "error");
    if (m.kind === "child" && m.age >= 18) return toast("Children should be under 18", "error");
    const clean: Member = m.kind === "child" ? { ...m, goal: "general", targets: undefined } : m;
    await saveMember({ ...clean, name: clean.name.trim() });
    toast(isNew ? `Added ${clean.name}` : "Saved");
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isNew ? "Add family member" : `Edit ${member?.name}`}
      footer={
        <div className="flex gap-2">
          {!isNew && (
            <Button
              variant="danger"
              onClick={async () => {
                if (!confirm(`Remove ${m.name}?`)) return;
                await deleteMember(m.id);
                onClose();
              }}
            >
              Remove
            </Button>
          )}
          <Button className="flex-1" onClick={save}>Save</Button>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <Segmented
          className="w-full"
          value={m.kind}
          onChange={(v) => setM((x) => ({ ...x, kind: v, age: v === "child" && x.age >= 18 ? 8 : x.age }))}
          options={[{ value: "adult", label: "Adult" }, { value: "child", label: "Child" }]}
        />
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <Field label="Name"><Input value={m.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Sam" autoFocus={isNew} /></Field>
          <Field label="Age"><Input inputMode="numeric" value={m.age || ""} onChange={(e) => set("age", Number(e.target.value.replace(/\D/g, "")) || 0)} /></Field>
        </div>
        <Field label="Sex (optional, improves estimates)">
          <Segmented
            className="w-full"
            size="sm"
            value={m.sex ?? "unset"}
            onChange={(v) => set("sex", v === "unset" ? undefined : (v as Member["sex"]))}
            options={[{ value: "unset", label: "Not set" }, { value: "female", label: "Female" }, { value: "male", label: "Male" }]}
          />
        </Field>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink-600">Height & weight (optional)</span>
            <button className="text-xs font-semibold text-orange-700" onClick={() => setImperial(!imperial)}>{imperial ? "Use metric" : "Use ft/lb"}</button>
          </div>
          {imperial ? (
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="ft" inputMode="numeric" value={ft} onChange={(e) => set("heightCm", ((Number(e.target.value) || 0) * 12 + (Number(inch) || 0)) * 2.54 || undefined)} />
              <Input placeholder="in" inputMode="numeric" value={inch} onChange={(e) => set("heightCm", ((Number(ft) || 0) * 12 + (Number(e.target.value) || 0)) * 2.54 || undefined)} />
              <Input placeholder="lb" inputMode="numeric" value={lb} onChange={(e) => set("weightKg", (Number(e.target.value) || 0) / 2.20462 || undefined)} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="cm" inputMode="numeric" value={m.heightCm ? Math.round(m.heightCm) : ""} onChange={(e) => set("heightCm", Number(e.target.value) || undefined)} />
              <Input placeholder="kg" inputMode="decimal" value={m.weightKg ? Math.round(m.weightKg * 10) / 10 : ""} onChange={(e) => set("weightKg", Number(e.target.value) || undefined)} />
            </div>
          )}
        </div>

        <Field label="Activity level">
          <Select value={m.activity} onChange={(e) => set("activity", e.target.value as ActivityLevel)}>
            <option value="sedentary">Sedentary</option>
            <option value="light">Lightly active</option>
            <option value="moderate">Moderately active</option>
            <option value="active">Active</option>
            <option value="very-active">Very active / athlete</option>
          </Select>
        </Field>

        {m.kind === "adult" ? (
          <>
            <Field label="Nutrition goal">
              <Select value={m.goal} onChange={(e) => set("goal", e.target.value as AdultGoal)}>
                <option value="general">General healthy eating</option>
                <option value="maintain">Balanced maintenance</option>
                <option value="muscle">High-protein muscle building</option>
                <option value="lose">Gradual weight loss</option>
                <option value="lower-fat">Lower-fat</option>
                <option value="higher-fiber">Higher-fiber</option>
              </Select>
            </Field>
            <details className="rounded-2xl bg-cream-200/70 p-3">
              <summary className="cursor-pointer text-[13px] font-semibold text-ink-600">Custom daily targets (optional)</summary>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["kcal", "protein", "carbs", "fat", "fiber"] as const).map((k) => (
                  <Field key={k} label={k === "kcal" ? "Calories" : `${k[0].toUpperCase()}${k.slice(1)} (g)`}>
                    <Input
                      inputMode="numeric"
                      placeholder={String(Math.round(t[k]))}
                      value={m.targets?.[k] ?? ""}
                      onChange={(e) => set("targets", { ...(m.targets ?? {}), [k]: Number(e.target.value) || undefined })}
                    />
                  </Field>
                ))}
              </div>
            </details>
          </>
        ) : (
          <Notice tone="forest">Children get age-appropriate portions and balanced variety. WellFed never applies weight-loss or bodybuilding targets to kids.</Notice>
        )}

        <Field label="Allergies">
          <Chips<Allergen> values={m.allergies} onChange={(v) => set("allergies", v)} options={(Object.keys(ALLERGEN_LABEL) as Allergen[]).map((a) => ({ value: a, label: ALLERGEN_LABEL[a] }))} />
        </Field>
        <Field label="Diet">
          <Chips<Diet> values={m.diets} onChange={(v) => set("diets", v)} options={(Object.keys(DIET_LABEL) as Diet[]).map((d) => ({ value: d, label: DIET_LABEL[d] }))} />
        </Field>
        <Field label="Dislikes" hint="Meals with these are ranked lower; they aren't excluded.">
          <IngredientPicker selected={m.dislikes} onChange={(v) => set("dislikes", v)} />
        </Field>
        <Field label="Favorite foods">
          <IngredientPicker selected={m.likes.filter((l) => ingredientMap.has(l))} onChange={(v) => set("likes", v)} />
        </Field>

        <div className="rounded-2xl border border-ink/10 bg-cream-100 p-3 text-[13px]">
          <div className="mb-1 font-semibold text-forest">{goalLabel(m)} · estimated daily needs</div>
          <div className="tnum grid grid-cols-3 gap-y-1 text-ink-600">
            <span>{Math.round(t.kcal)} kcal</span>
            <span>{Math.round(t.protein)}g protein</span>
            <span>{Math.round(t.fiber)}g fiber</span>
            <span>{Math.round(t.carbs)}g carbs</span>
            <span>{Math.round(t.fat)}g fat</span>
            <span>≤{t.sodiumMax}mg sodium</span>
          </div>
          <div className="mt-1.5 text-xs text-ink-400">Portion: {portionFactor(m)}× a standard serving. Estimates use Mifflin–St Jeor (adults) or Dietary Guidelines energy levels (children); not medical advice.</div>
        </div>
      </div>
    </Sheet>
  );
}
