"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useData } from "@/lib/data-context";
import { Input, cn } from "./ui";

/** Searchable multi-select over the ingredient catalog. */
export function IngredientPicker({ selected, onChange, single, placeholder = "Search ingredients…" }: { selected: string[]; onChange: (ids: string[]) => void; single?: boolean; placeholder?: string }) {
  const { ingredients, ingredientMap } = useData();
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return ingredients.filter((i) => (i.name.toLowerCase().includes(s) || i.id.includes(s)) && !selected.includes(i.id)).slice(0, 8);
  }, [q, ingredients, selected]);
  return (
    <div>
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-forest-100 py-1 pr-1.5 pl-3 text-[13px] font-semibold text-forest">
              {ingredientMap.get(id)?.name ?? id}
              <button aria-label="Remove" onClick={() => onChange(selected.filter((x) => x !== id))} className="rounded-full p-0.5 hover:bg-forest/10">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      {(!single || selected.length === 0) && (
        <div className="relative">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
          {results.length > 0 && (
            <div className="absolute inset-x-0 top-12 z-10 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-[var(--shadow-pop)]">
              {results.map((i) => (
                <button
                  key={i.id}
                  className={cn("block w-full px-3 py-2.5 text-left text-[15px] hover:bg-cream-200")}
                  onClick={() => {
                    onChange(single ? [i.id] : [...selected, i.id]);
                    setQ("");
                  }}
                >
                  {i.name} <span className="text-xs text-ink-400">· {i.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
