"use client";

import { ExternalLink } from "lucide-react";
import { useData } from "@/lib/data-context";
import { offerStatus } from "@/lib/engine/pricing";
import { flyerLink } from "@/lib/stores-osm";
import { Button, Card, cn } from "../ui";

/** This week's flyer status for each real store, with one-tap open and import. */
export function FlyerStatus({ onImport, compact }: { onImport: (storeId: string) => void; compact?: boolean }) {
  const data = useData();
  const stores = data.stores.filter((s) => !s.id.startsWith("demo-"));
  if (!stores.length) return null;
  return (
    <Card className="p-4">
      <div className="eyebrow mb-2">This week&apos;s flyers</div>
      <div className="divide-y divide-ink/8">
        {stores.map((s) => {
          const active = data.dbPrices.filter((p) => p.storeId === s.id && p.source === "flyer" && offerStatus(p, data.today) === "active");
          const through = active.reduce((m, p) => (p.endDate && p.endDate > m ? p.endDate : m), "");
          const link = flyerLink(s);
          return (
            <div key={s.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{s.name}</div>
                <div className={cn("text-xs", active.length ? "text-forest" : "text-orange-700")}>
                  {active.length ? `${active.length} deals${through ? ` through ${new Date(through + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}` : "No current flyer"}
                </div>
              </div>
              {link && !compact && (
                <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${s.name} flyer`} className="inline-flex h-8 items-center gap-1 rounded-full bg-forest-50 px-3 text-sm font-semibold text-forest">
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </a>
              )}
              <Button size="sm" variant={active.length ? "ghost" : "primary"} onClick={() => onImport(s.id)}>{active.length ? "Update" : "Import"}</Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

