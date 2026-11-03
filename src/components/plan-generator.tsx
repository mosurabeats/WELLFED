"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Users } from "lucide-react";
import type { MealType, PlanRequest, Priority } from "@/lib/types";
import { Button, Chips, Field, Input, Segmented, Select, Sheet, Slider, Toggle, money, Notice } from "./ui";
import { useData } from "@/lib/data-context";
import { createPlan, updateSettings } from "@/lib/db/actions";
import { buildSlots } from "@/lib/engine/planner";
import { mealServings } from "@/lib/engine/shopping";
import { useToast } from "./toast";
import { addDays } from "@/lib/engine/planner";

export function nextMonday(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const diff = (8 - dt.getDay()) % 7;
  return addDays(today, diff === 0 ? 0 : diff);
}

export function defaultRequest(data: ReturnType<typeof useData>, over: Partial<PlanRequest> = {}): PlanRequest {
  const s = data.settings;
  const preferred = data.stores.find((x) => x.preferred);
  return {
    startDate: data.today,
    days: s.days,
    mealTypes: s.mealTypes,
    includeSnacks: s.includeSnacks,
    budget: s.weeklyBudget,
    priority: s.priority,
    includeStaples: s.includeStaples,
    maxCookMinutes: s.maxCookMinutes,
    storeId: s.oneStoreMode && preferred ? preferred.id : null,
    seed: Math.floor(Math.random() * 1e6),
    ...over,
  };
}

export function PlanGenerator({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Partial<PlanRequest> }) {
  const data = useData();
  const router = useRouter();
  const toast = useToast();
  const [req, setReq] = useState<PlanRequest>(() => defaultRequest(data, initial));
  const [busy, setBusy] = useState(false);
  const [keepLocked, setKeepLocked] = useState(true);

  // Reset the form each time the sheet opens (state adjustment during render).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setReq(defaultRequest(data, initial));
  }

  const set = <K extends keyof PlanRequest>(k: K, v: PlanRequest[K]) => setReq((r) => ({ ...r, [k]: v }));
  const slots = buildSlots(req, data.settings.schedule, data.members);
  const servings = slots.reduce((s, sl) => s + mealServings(sl, data.members), 0);
  const lockedCount = data.activePlan?.meals.filter((m) => m.locked).length ?? 0;

  async function go() {
    if (!data.members.length) {
      toast("Add your household first", "error");
      router.push("/household");
      onClose();
      return;
    }
    setBusy(true);
    try {
      // Yield so the spinner paints before the synchronous optimizer runs.
      await new Promise((r) => setTimeout(r, 30));
      const prev = keepLocked && lockedCount ? data.activePlan ?? undefined : undefined;
      const { result } = await createPlan({ ...req, seed: Math.floor(Math.random() * 1e6) }, data.ctx, data.settings.schedule, prev ? { ...prev, shopping: {} } : undefined);
      await updateSettings({ weeklyBudget: req.budget, days: req.days, mealTypes: req.mealTypes, includeSnacks: req.includeSnacks, priority: req.priority, includeStaples: req.includeStaples, maxCookMinutes: req.maxCookMinutes });
      if (!result.meals.length) toast(result.notes[0] ?? "Couldn't build a plan", "error");
      else if (!result.feasible) toast(`Plan is ${money(result.shortfall!.gap)} over budget — see details`, "error");
      else toast(`Planned ${result.meals.length} meals · est. ${money(result.estimatedCost)}`);
      onClose();
      router.push("/plan");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Planning failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Plan meals"
      footer={
        <Button size="lg" className="w-full" onClick={go} loading={busy} disabled={!req.mealTypes.length && !req.includeSnacks}>
          <Sparkles className="h-5 w-5" /> Generate {slots.length} meals
        </Button>
      }
    >
      <div className="space-y-5 pb-2">
        <div className="rounded-2xl bg-forest p-4 text-cream-100">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold opacity-80">Grocery budget</span>
            <span className="text-[12px] opacity-70">{servings > 0 ? `${money(req.budget / servings)} per serving` : ""}</span>
          </div>
          <div className="mt-1 flex items-center gap-1">
            <span className="font-display text-4xl font-semibold">$</span>
            <input
              inputMode="decimal"
              aria-label="Budget in dollars"
              className="font-display tnum w-full bg-transparent text-5xl font-semibold outline-none"
              value={req.budget}
              onChange={(e) => set("budget", Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0))}
            />
          </div>
          <div className="mt-3 [&_.slider]:bg-[linear-gradient(to_right,var(--color-gold)_var(--fill),rgba(255,255,255,.25)_var(--fill))]">
            <Slider label="Budget" value={Math.min(req.budget, 500)} min={20} max={500} step={5} onChange={(v) => set("budget", v)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <Input type="date" value={req.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </Field>
          <Field label="Days">
            <Select value={req.days} onChange={(e) => set("days", Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 10, 14].map((d) => (
                <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>
              ))}
            </Select>
          </Field>
        </div>
        <button type="button" className="-mt-3 text-[13px] font-semibold text-orange-700" onClick={() => set("startDate", nextMonday(data.today))}>
          Start next Monday
        </button>

        <Field label="Meals">
          <Chips<MealType>
            values={req.mealTypes}
            onChange={(v) => set("mealTypes", v)}
            options={[
              { value: "breakfast", label: "Breakfast" },
              { value: "lunch", label: "Lunch" },
              { value: "dinner", label: "Dinner" },
            ]}
          />
        </Field>
        <Toggle checked={req.includeSnacks} onChange={(v) => set("includeSnacks", v)} label="Include a daily snack" />

        <Field label="Optimize for">
          <Segmented<Priority>
            className="w-full"
            value={req.priority}
            onChange={(v) => set("priority", v)}
            options={[
              { value: "nutrition", label: "Nutrition" },
              { value: "balanced", label: "Balanced" },
              { value: "cost", label: "Lowest cost" },
            ]}
          />
        </Field>

        <Field label="Max cooking time">
          <Select value={req.maxCookMinutes ?? 0} onChange={(e) => set("maxCookMinutes", Number(e.target.value) || undefined)}>
            <option value={0}>No limit</option>
            <option value={20}>20 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>1 hour</option>
          </Select>
        </Field>

        <Field label="Where you'll shop">
          <Select value={req.storeId ?? ""} onChange={(e) => set("storeId", e.target.value || null)}>
            <option value="">Any store (cheapest known price)</option>
            {data.stores.map((s) => (
              <option key={s.id} value={s.id}>Only {s.name}</option>
            ))}
          </Select>
        </Field>

        <Toggle
          checked={req.includeStaples}
          onChange={(v) => set("includeStaples", v)}
          label="Budget includes pantry restocking"
          hint="Off: oil, salt, flour and spices are assumed on hand."
        />

        {lockedCount > 0 && <Toggle checked={keepLocked} onChange={setKeepLocked} label={`Keep ${lockedCount} locked meal${lockedCount > 1 ? "s" : ""}`} />}

        <div className="flex items-center gap-2 rounded-2xl bg-cream-200 px-3 py-2.5 text-[13px] text-ink-600">
          <Users className="h-4 w-4 shrink-0" />
          {data.members.length
            ? <span>{slots.length} meals for your household schedule · {Math.round(servings * 10) / 10} standard servings</span>
            : <span>No household members yet — add them under Household.</span>}
        </div>
        {slots.length === 0 && data.members.length > 0 && <Notice tone="tomato">Nobody is scheduled for these meals. Check the schedule under Household.</Notice>}
      </div>
    </Sheet>
  );
}
