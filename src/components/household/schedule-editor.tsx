"use client";

import { useState } from "react";
import type { MealType, WeeklySchedule } from "@/lib/types";
import { useData } from "@/lib/data-context";
import { updateSettings } from "@/lib/db/actions";
import { Avatar } from "../bits";
import { Button, Sheet, cn } from "../ui";

const DAYS = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_SHORT: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

/** Recurring weekly attendance. An unset cell means everyone eats. */
export function ScheduleEditor() {
  const { settings, members } = useData();
  const [edit, setEdit] = useState<{ day: number; meal: MealType } | null>(null);
  const schedule = settings.schedule;
  const get = (day: number, meal: MealType) => schedule[day]?.[meal] ?? members.map((m) => m.id);

  async function setCell(days: number[], meal: MealType, ids: string[]) {
    const next: WeeklySchedule = { ...schedule };
    for (const d of days) next[d] = { ...(next[d] ?? {}), [meal]: ids };
    await updateSettings({ schedule: next });
  }

  const current = edit ? get(edit.day, edit.meal) : [];

  return (
    <div>
      <p className="mb-3 text-sm text-ink-600">Who usually eats each meal. Plans and shopping quantities follow this; you can still override any single meal in the plan.</p>
      <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-cream-100">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-bold tracking-wider text-ink-400 uppercase">
              <th className="p-3">Day</th>
              {MEALS.map((m) => <th key={m} className="p-3">{MEAL_SHORT[m]}</th>)}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => (
              <tr key={d} className="border-t border-ink/8">
                <td className="p-3 font-semibold">{DAY_LABEL[d]}</td>
                {MEALS.map((meal) => {
                  const ids = get(d, meal);
                  return (
                    <td key={meal} className="p-1.5">
                      <button onClick={() => setEdit({ day: d, meal })} className={cn("flex min-h-10 w-full items-center gap-0.5 rounded-xl px-2 py-1.5 transition hover:bg-cream-200", ids.length === 0 && "text-ink-300")}>
                        {ids.length === 0 ? <span className="text-xs">Nobody</span> : (
                          <span className="flex -space-x-1.5">
                            {members.map((m, i) => ids.includes(m.id) && <Avatar key={m.id} member={m} idx={i} size={24} ring />)}
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit ? `${DAY_LABEL[edit.day]} ${MEAL_SHORT[edit.meal].toLowerCase()}` : ""}>
        {edit && (
          <div className="space-y-2 pb-2">
            {members.map((m, i) => {
              const on = current.includes(m.id);
              return (
                <button key={m.id} onClick={() => setCell([edit.day], edit.meal, on ? current.filter((x) => x !== m.id) : [...current, m.id])} className={cn("flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition", on ? "border-forest bg-forest-50" : "border-ink/10")}>
                  <Avatar member={m} idx={i} size={32} />
                  <span className="flex-1 font-semibold">{m.name}</span>
                  <span className={cn("text-sm font-bold", on ? "text-forest" : "text-ink-300")}>{on ? "Eating" : "Away"}</span>
                </button>
              );
            })}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="soft" size="sm" onClick={() => setCell([1, 2, 3, 4, 5], edit.meal, current)}>Copy to weekdays</Button>
              <Button variant="soft" size="sm" onClick={() => setCell(DAYS, edit.meal, current)}>Copy to every day</Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
