"use client";

import { useRef, useState } from "react";
import { Download, Upload, ShieldCheck, KeyRound, Trash2 } from "lucide-react";
import { useData } from "@/lib/data-context";
import { exportBackup, importBackup, updateSettings, wipeAll, purgeExpiredPrices, type Backup } from "@/lib/db/actions";
import { Button, Card, Field, Input, Notice, Select } from "../ui";
import { useToast } from "../toast";
import { NUTRITION_SOURCE } from "@/data/ingredients";

export function DataSettings() {
  const { settings, members, plans, recipes, pantry, dbPrices } = useData();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState(settings.accessCode ?? "");

  async function doExport() {
    const b = await exportBackup();
    const blob = new Blob([JSON.stringify(b, null, 1)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wellfed-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("Backup downloaded");
  }

  async function doImport(f: File) {
    try {
      const b = JSON.parse(await f.text()) as Backup;
      if (!confirm("Replace everything on this device with this backup?")) return;
      await importBackup(b, "replace");
      toast("Backup restored");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Import failed", "error");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2 font-display text-lg font-semibold text-forest"><ShieldCheck className="h-5 w-5" /> Privacy</div>
        <ul className="space-y-1.5 text-[13.5px] leading-snug text-ink-600">
          <li>• All household data is stored in this browser&apos;s private database (IndexedDB). There are no accounts, ads or trackers.</li>
          <li>• The AI assistant sends your request plus an <b>anonymized</b> summary (roles and ages like &ldquo;Adult 1, Child age 7&rdquo;, never names) to your chosen AI provider — only when you use it.</li>
          <li>• Store search sends only your ZIP code. Flyer import sends only the flyer image/text.</li>
          <li>• Nutrition data: {NUTRITION_SOURCE.name} — bundled, no network needed.</li>
        </ul>
        <p className="text-xs text-ink-400">On this device: {members.length} people · {plans.length} plans · {recipes.filter((r) => r.source !== "builtin").length} custom recipes · {pantry.length} pantry items · {dbPrices.length} prices.</p>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="font-display text-lg font-semibold text-forest">Backup & restore</div>
        <p className="text-[13px] text-ink-600">Data lives only on this device. Export a backup regularly, or to move to another phone.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="soft" onClick={doExport}><Download className="h-4 w-4" /> Export</Button>
          <Button variant="soft" onClick={() => file.current?.click()}><Upload className="h-4 w-4" /> Import</Button>
        </div>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
        <Button variant="ghost" size="sm" onClick={async () => toast(`Removed ${await purgeExpiredPrices()} expired deals`)}>Clean up expired deals</Button>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2 font-display text-lg font-semibold text-forest"><KeyRound className="h-5 w-5" /> AI & server access</div>
        <Field label="AI provider" hint="API keys live on the server (environment variables), never in the browser.">
          <Select value={settings.aiProvider ?? "anthropic"} onChange={(e) => updateSettings({ aiProvider: e.target.value as "anthropic" | "openai" | "none" })}>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI</option>
            <option value="none">Off — use the built-in offline parser</option>
          </Select>
        </Field>
        <Field label="Access code" hint="Only needed if your deployment sets APP_ACCESS_CODE.">
          <div className="flex gap-2">
            <Input type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
            <Button variant="soft" onClick={async () => { await updateSettings({ accessCode: code || undefined }); toast("Saved"); }}>Save</Button>
          </div>
        </Field>
      </Card>

      <Card className="space-y-2 p-4">
        <div className="font-display text-lg font-semibold text-tomato">Erase everything</div>
        <Notice tone="tomato">Deletes all people, plans, recipes, prices and pantry items from this device. Export a backup first.</Notice>
        <Button variant="danger" onClick={async () => { if (confirm("Erase all WellFed data on this device?") && confirm("Really erase? This can't be undone.")) { await wipeAll(); toast("All data erased"); } }}>
          <Trash2 className="h-4 w-4" /> Erase all data
        </Button>
      </Card>
    </div>
  );
}
