"use client";

import type { ReactNode } from "react";
import { DataProvider } from "@/lib/data-context";
import { ToastProvider } from "./toast";
import { AppShell } from "./app-shell";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <DataProvider>
        <AppShell>{children}</AppShell>
      </DataProvider>
    </ToastProvider>
  );
}
