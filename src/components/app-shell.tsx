"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ShoppingBasket, Sun, BookOpen, Home, Sparkles } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "./ui";
import { useData } from "@/lib/data-context";

const NAV = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/plan", label: "Meal Plan", icon: CalendarDays },
  { href: "/groceries", label: "Groceries", icon: ShoppingBasket },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/household", label: "Household", icon: Home },
];

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden>
        <circle cx="20" cy="20" r="19" fill="var(--color-forest)" />
        <path d="M5 24a15 15 0 0 0 30 0" fill="var(--color-gold)" />
        <path d="M7.5 29a15 15 0 0 0 25 0" fill="var(--color-orange)" />
        <path d="M20 8c5 3 6 9 0 14-6-5-5-11 0-14Z" fill="var(--color-cream)" />
        <path d="M20 12v13" stroke="var(--color-forest)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="font-display text-[26px] leading-none font-semibold text-forest italic">WellFed</span>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { ready } = useData();
  const shopping = path.startsWith("/groceries/shop");

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-ink/10 bg-cream-100/60 px-4 py-6 md:flex">
        <div className="stripes-h mb-5 h-1.5 w-full rounded-full" />
        <Logo className="mb-8 px-2" />
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-semibold transition", isActive(href) ? "bg-forest text-cream-100" : "text-ink-600 hover:bg-ink/5")}>
              <Icon className="h-5 w-5" /> {label}
            </Link>
          ))}
        </nav>
        <Link href="/assistant" className={cn("mt-6 flex items-center gap-3 rounded-2xl border-2 border-dashed px-3 py-2.5 text-[15px] font-semibold transition", isActive("/assistant") ? "border-orange bg-orange-100 text-orange-700" : "border-orange/40 text-orange-700 hover:bg-orange-100/60")}>
          <Sparkles className="h-5 w-5" /> Ask WellFed
        </Link>
        <div className="mt-auto px-2 text-xs leading-relaxed text-ink-400">
          Private family app. Your data stays on this device.
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        {!shopping && (
          <div className="sticky top-0 z-30 bg-cream/85 pt-[var(--safe-top)] backdrop-blur-md md:hidden">
            <div className="stripes-h h-1" />
            <div className="flex items-center justify-between px-4 py-2">
              <Logo />
              <Link href="/assistant" aria-label="Ask WellFed" className={cn("flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold", isActive("/assistant") ? "bg-orange text-white" : "bg-orange-100 text-orange-700")}>
                <Sparkles className="h-4 w-4" /> Ask
              </Link>
            </div>
          </div>
        )}
        <main className={cn("mx-auto w-full max-w-5xl px-4 md:px-8 md:py-8", shopping ? "pb-10" : "pb-[calc(96px+var(--safe-bottom))] md:pb-10")}>
          {ready ? children : <Loading />}
        </main>
      </div>

      {/* Mobile tab bar */}
      {!shopping && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-cream-100/90 pb-[var(--safe-bottom)] backdrop-blur-xl md:hidden" aria-label="Primary">
          <div className="mx-auto flex max-w-lg">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={cn("flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10.5px] font-bold tracking-wide", isActive(href) ? "text-forest" : "text-ink-400")}>
                <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition", isActive(href) && "bg-forest-100")}>
                  <Icon className="h-[22px] w-[22px]" strokeWidth={isActive(href) ? 2.4 : 2} />
                </span>
                {label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex h-[60dvh] flex-col items-center justify-center gap-3 text-ink-400">
      <div className="stripes h-10 w-10 rounded-full spin" style={{ animationDuration: "1.6s" }} />
      <span className="text-sm">Opening the pantry…</span>
    </div>
  );
}
