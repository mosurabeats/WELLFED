"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, ChevronRight, Baby, User } from "lucide-react";
import type { Member, MealType, Priority } from "@/lib/types";
import { useData } from "@/lib/data-context";
import { updateSettings, saveMember } from "@/lib/db/actions";
import { Badge, Button, Card, Chips, Empty, Field, PageHeader, Segmented, Slider, Toggle, money, Input } from "@/components/ui";
import { Avatar } from "@/components/bits";
import { MemberEditor, blankMember } from "@/components/household/member-editor";
import { ScheduleEditor } from "@/components/household/schedule-editor";
import { Pantry } from "@/components/household/pantry";
import { StoreSettings } from "@/components/household/stores";
import { DataSettings } from "@/components/household/data-settings";
import { goalLabel, portionFactor } from "@/lib/engine/targets";
import { ALLERGEN_LABEL, DIET_LABEL } from "@/lib/engine/allergens";
import { useToast } from "@/components/toast";

type Tab = "people" | "schedule" | "pantry" | "stores" | "budget" | "data";
const TABS: { value: Tab; label: string }[] = [
  { value: "people", label: "People" },
  { value: "schedule", label: "Schedule" },
  { value: "pantry", label: "Pantry" },
  { value: "stores", label: "Stores" },
  { value: "budget", label: "Budget" },
  { value: "data", label: "Data & privacy" },
];

export default function HouseholdPage() {
  return (
    <Suspense>
      <Household />
    </Suspense>
  );
}

function Household() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) || "people";
  const setTab = (t: Tab) => router.replace(`/household?tab=${t}`, { scroll: false });
  return (
    <div className="rise">
      <PageHeader eyebrow="Section 5" title="Household" subtitle="Who you feed, what you have, where you shop." />
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
        {TABS.map((t) => (
          <button key={t.value} onClick={() => setTab(t.value)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${tab === t.value ? "bg-ink text-cream-100" : "bg-cream-200 text-ink-600"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "people" && <People setup={params.get("setup") === "1"} />}
      {tab === "schedule" && <ScheduleEditor />}
      {tab === "pantry" && <Pantry />}
      {tab === "stores" && <StoreSettings />}
      {tab === "budget" && <BudgetPrefs />}
      {tab === "data" && <DataSettings />}
    </div>
  );
}

function People({ setup }: { setup: boolean }) {
  const { members } = useData();
  const [editing, setEditing] = useState<Member | null>(null);
  const [open, setOpen] = useState(false);
  const edit = (m: Member | null) => {
    setEditing(m);
    setOpen(true);
  };
  if (!members.length) return <QuickSetup onCustom={() => edit(blankMember())} highlight={setup} editor={<MemberEditor member={editing} open={open} onClose={() => setOpen(false)} />} />;
  return (
    <div className="space-y-3">
      {members.map((m, i) => (
        <button key={m.id} onClick={() => edit(m)} className="flex w-full items-center gap-3 rounded-2xl border border-ink/10 bg-cream-100 p-3.5 text-left shadow-[var(--shadow-card)] transition hover:border-ink/25">
          <Avatar member={m} idx={i} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-semibold">{m.name}</span>
              <span className="text-sm text-ink-400">{m.kind === "child" ? `Child, ${m.age}` : `Adult, ${m.age}`}</span>
            </div>
            <div className="text-[13px] text-ink-600">{goalLabel(m)} · {portionFactor(m)}× portion</div>
            {(m.allergies.length > 0 || m.diets.length > 0) && (
              <div className="mt-1 flex flex-wrap gap-1">
                {m.allergies.map((a) => <Badge key={a} tone="tomato">{ALLERGEN_LABEL[a]} allergy</Badge>)}
                {m.diets.map((d) => <Badge key={d} tone="forest">{DIET_LABEL[d]}</Badge>)}
              </div>
            )}
          </div>
          <ChevronRight className="h-5 w-5 text-ink-300" />
        </button>
      ))}
      <Button variant="outline" className="w-full" onClick={() => edit(null)}><Plus className="h-4 w-4" /> Add family member</Button>
      <MemberEditor member={editing} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

/** Fast first-run: pick counts and ages, refine profiles later. */
function QuickSetup({ onCustom, highlight, editor }: { onCustom: () => void; highlight: boolean; editor: React.ReactNode }) {
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState<number[]>([8]);
  const toast = useToast();
  const router = useRouter();
  async function create() {
    for (let i = 0; i < adults; i++) await saveMember({ ...blankMember("adult"), name: `Adult ${i + 1}` });
    for (const [i, age] of kids.entries()) await saveMember({ ...blankMember("child"), name: `Child ${i + 1}`, age });
    await updateSettings({ onboarded: true });
    toast("Household created — tap anyone to add names, allergies and goals");
    router.replace("/household?tab=people");
  }
  return (
    <div className="space-y-4">
      <Card className={`space-y-4 p-5 ${highlight ? "ring-2 ring-orange/40" : ""}`}>
        <div>
          <div className="font-display text-xl font-semibold text-forest">Quick setup</div>
          <p className="text-sm text-ink-600">How many people are you feeding? You can add names, allergies and goals right after.</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-semibold"><User className="h-5 w-5 text-forest" /> Adults</span>
          <Stepper value={adults} onChange={setAdults} min={1} max={8} />
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-semibold"><Baby className="h-5 w-5 text-orange" /> Children</span>
          <Stepper value={kids.length} onChange={(n) => setKids(n > kids.length ? [...kids, 8] : kids.slice(0, n))} min={0} max={8} />
        </div>
        {kids.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {kids.map((age, i) => (
              <Field key={i} label={`Child ${i + 1} age`}>
                <Input inputMode="numeric" value={age || ""} onChange={(e) => setKids(kids.map((k, j) => (j === i ? Math.min(17, Number(e.target.value.replace(/\D/g, "")) || 0) : k)))} />
              </Field>
            ))}
          </div>
        )}
        <Button size="lg" className="w-full" onClick={create}>Create household</Button>
      </Card>
      <Empty title="Prefer to start one by one?" action={<Button variant="soft" onClick={onCustom}><Plus className="h-4 w-4" /> Add a person</Button>} />
      {editor}
    </div>
  );
}

function Stepper({ value, onChange, min, max }: { value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <Button size="icon" variant="soft" aria-label="Fewer" onClick={() => onChange(Math.max(min, value - 1))}>−</Button>
      <span className="font-display tnum w-6 text-center text-2xl font-semibold">{value}</span>
      <Button size="icon" variant="soft" aria-label="More" onClick={() => onChange(Math.min(max, value + 1))}>+</Button>
    </div>
  );
}

function BudgetPrefs() {
  const { settings: s } = useData();
  const [budget, setBudget] = useState(s.weeklyBudget);
  const [saved, setSaved] = useState(s.weeklyBudget);
  if (saved !== s.weeklyBudget) {
    setSaved(s.weeklyBudget);
    setBudget(s.weeklyBudget);
  }
  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-5">
        <div className="eyebrow">Weekly grocery budget</div>
        <div className="flex items-baseline gap-1">
          <span className="font-display text-3xl font-semibold text-forest">$</span>
          <input inputMode="decimal" aria-label="Weekly budget" className="font-display tnum w-full bg-transparent text-5xl font-semibold text-forest outline-none" value={budget} onChange={(e) => setBudget(Number(e.target.value.replace(/[^0-9.]/g, "")) || 0)} onBlur={() => updateSettings({ weeklyBudget: budget })} />
        </div>
        <Slider label="Weekly budget" value={Math.min(budget, 500)} min={20} max={500} step={5} onChange={(v) => { setBudget(v); updateSettings({ weeklyBudget: v }); }} />
        <div className="flex justify-between text-xs text-ink-400"><span>{money(20, { cents: false })}</span><span>{money(500, { cents: false })}+</span></div>
      </Card>
      <Card className="space-y-4 p-5">
        <Field label="Default priority">
          <Segmented<Priority> className="w-full" value={s.priority} onChange={(v) => updateSettings({ priority: v })} options={[{ value: "nutrition", label: "Nutrition" }, { value: "balanced", label: "Balanced" }, { value: "cost", label: "Lowest cost" }]} />
        </Field>
        <Field label="Meals to plan by default">
          <Chips<MealType> values={s.mealTypes} onChange={(v) => updateSettings({ mealTypes: v })} options={[{ value: "breakfast", label: "Breakfast" }, { value: "lunch", label: "Lunch" }, { value: "dinner", label: "Dinner" }]} />
        </Field>
        <Field label="Days per plan">
          <Segmented className="w-full" size="sm" value={String(s.days)} onChange={(v) => updateSettings({ days: Number(v) })} options={["3", "5", "7"].map((d) => ({ value: d, label: `${d} days` }))} />
        </Field>
        <Toggle checked={s.includeSnacks} onChange={(v) => updateSettings({ includeSnacks: v })} label="Include snacks" />
        <Toggle checked={s.includeStaples} onChange={(v) => updateSettings({ includeStaples: v })} label="Budget includes pantry restocking" hint="Price oil, flour, salt and spices instead of assuming you have them." />
      </Card>
    </div>
  );
}
