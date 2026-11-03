"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { X, Loader2, Check } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Button ────────────────────────────────────────────────────────
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange select-none",
  {
    variants: {
      variant: {
        primary: "bg-forest text-cream-100 hover:bg-forest-700 shadow-[0_2px_0_var(--color-forest-700)]",
        accent: "bg-orange text-white hover:bg-orange-700 shadow-[0_2px_0_var(--color-orange-700)]",
        outline: "border-2 border-ink/80 text-ink bg-transparent hover:bg-ink/5",
        soft: "bg-forest-50 text-forest hover:bg-forest-100",
        ghost: "text-ink-600 hover:bg-ink/5",
        danger: "bg-tomato-100 text-tomato hover:bg-tomato hover:text-white",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-11 px-5 text-[15px]",
        lg: "h-14 px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export function Button({ className, variant, size, loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="h-4 w-4 spin" aria-hidden />}
      {children}
    </button>
  );
}

// ── Card ──────────────────────────────────────────────────────────
export function Card({ className, children, ...p }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-[var(--radius-card)] border border-ink/10 bg-cream-100 shadow-[var(--shadow-card)]", className)} {...p}>
      {children}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, action, className }: { eyebrow?: string; title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <div>
        {eyebrow && <div className="eyebrow mb-0.5">{eyebrow}</div>}
        <h2 className="font-display text-[22px] leading-tight font-semibold text-forest">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-4 pt-2">
      <div className="min-w-0">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="font-display text-[34px] leading-[1.05] font-semibold text-forest md:text-[42px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-ink-600">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

// ── Badge ─────────────────────────────────────────────────────────
const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide whitespace-nowrap", {
  variants: {
    tone: {
      forest: "bg-forest-100 text-forest",
      orange: "bg-orange-100 text-orange-700",
      gold: "bg-gold-100 text-[#8a6416]",
      ink: "bg-ink/8 text-ink-600",
      tomato: "bg-tomato-100 text-tomato",
      outline: "border border-ink/25 text-ink-600",
    },
  },
  defaultVariants: { tone: "ink" },
});
export function Badge({ tone, className, children, title }: VariantProps<typeof badgeVariants> & { className?: string; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cn(badgeVariants({ tone }), className)}>
      {children}
    </span>
  );
}

// ── Form controls ─────────────────────────────────────────────────
export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[13px] font-semibold text-ink-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
    </label>
  );
}

const inputCls = "h-11 w-full rounded-xl border border-ink/15 bg-white/70 px-3 text-[16px] text-ink placeholder:text-ink-300 focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/15";

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputCls, className)} {...p} />;
}
export function Textarea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputCls, "h-auto min-h-24 py-2", className)} {...p} />;
}
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputCls, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23282B26%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_12px_center] bg-no-repeat pr-8", className)} {...p}>
      {children}
    </select>
  );
}

/** Segmented control — iOS style. */
export function Segmented<T extends string>({ value, onChange, options, className, size = "md" }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string; size?: "sm" | "md" }) {
  return (
    <div role="radiogroup" className={cn("inline-flex rounded-full bg-cream-200 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-full font-semibold whitespace-nowrap transition",
            size === "sm" ? "px-3 py-1 text-[13px]" : "px-4 py-1.5 text-sm",
            value === o.value ? "bg-cream-100 text-forest shadow-sm" : "text-ink-400 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Multi-select chips. */
export function Chips<T extends string>({ values, onChange, options, className }: { values: T[]; onChange: (v: T[]) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => {
        const on = values.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? values.filter((v) => v !== o.value) : [...values, o.value])}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[13px] font-semibold transition",
              on ? "border-forest bg-forest text-cream-100" : "border-ink/15 bg-white/60 text-ink-600 hover:border-ink/30",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="min-w-0">
        <div className="text-[15px] font-semibold text-ink">{label}</div>
        {hint && <div className="text-xs text-ink-400">{hint}</div>}
      </label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative h-[31px] w-[51px] shrink-0 rounded-full transition", checked ? "bg-forest" : "bg-cream-300")}
      >
        <span className={cn("absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-[2px]")} />
      </button>
    </div>
  );
}

/** Large tappable checkbox for shopping mode. */
export function BigCheck({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 transition",
        checked ? "border-forest bg-forest text-cream-100" : "border-ink/30 bg-white",
      )}
    >
      {checked && <Check className="h-5 w-5" strokeWidth={3} />}
    </button>
  );
}

export function Slider({ value, min, max, step, onChange, label }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; label: string }) {
  const fill = `${((value - min) / (max - min)) * 100}%`;
  return (
    <input
      type="range"
      aria-label={label}
      className="slider w-full"
      style={{ ["--fill" as string]: fill }}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

// ── Progress ──────────────────────────────────────────────────────
export function Bar({ value, max, tone = "forest", className }: { value: number; max: number; tone?: "forest" | "orange" | "gold" | "tomato"; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(max, 0.0001)) * 100));
  const color = { forest: "bg-forest", orange: "bg-orange", gold: "bg-gold", tomato: "bg-tomato" }[tone];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-cream-300/70", className)}>
      <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({ value, max, size = 120, stroke = 12, children, tone = "forest" }: { value: number; max: number; size?: number; stroke?: number; children?: ReactNode; tone?: "forest" | "orange" | "tomato" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / Math.max(max, 0.0001)));
  const color = { forest: "var(--color-forest)", orange: "var(--color-orange)", tomato: "var(--color-tomato)" }[tone];
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-cream-300)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

// ── Sheet (bottom sheet on mobile, dialog on desktop) ─────────────
export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true">
      <div className="fade absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn("sheet-up relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-cream shadow-[var(--shadow-pop)] md:rounded-[28px]", wide ? "md:max-w-3xl" : "md:max-w-lg")}>
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-ink/15 md:hidden" />
        <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-2">
          <h3 className="font-display text-xl font-semibold text-forest">{title}</h3>
          <button onClick={onClose} className="rounded-full p-2 text-ink-400 hover:bg-ink/5" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-ink/10 px-5 pt-3 pb-[calc(12px+var(--safe-bottom))]">{footer}</div>}
        {!footer && <div className="pb-[var(--safe-bottom)]" />}
      </div>
    </div>,
    document.body,
  );
}

// ── Misc ─────────────────────────────────────────────────────────
export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border-2 border-dashed border-ink/15 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-orange">{icon}</div>}
      <div className="font-display text-xl font-semibold text-forest">{title}</div>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-600">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "orange" | "tomato" | "forest" }) {
  return (
    <div>
      <div className="text-[11px] font-bold tracking-[0.12em] text-ink-400 uppercase">{label}</div>
      <div className={cn("font-display tnum text-2xl font-semibold", tone === "tomato" ? "text-tomato" : tone === "orange" ? "text-orange-700" : "text-ink")}>{value}</div>
      {sub && <div className="text-xs text-ink-400">{sub}</div>}
    </div>
  );
}

export function Notice({ tone = "gold", icon, children, className }: { tone?: "gold" | "tomato" | "forest"; icon?: ReactNode; children: ReactNode; className?: string }) {
  const cls = { gold: "bg-gold-100 border-gold/50 text-[#6f5113]", tomato: "bg-tomato-100 border-tomato/30 text-tomato", forest: "bg-forest-50 border-forest/20 text-forest" }[tone];
  return (
    <div className={cn("flex gap-2.5 rounded-2xl border px-3.5 py-3 text-[13px] leading-snug", cls, className)}>
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function money(n: number, opts: { cents?: boolean } = {}) {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: opts.cents === false ? 0 : 2, maximumFractionDigits: opts.cents === false ? 0 : 2 });
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 spin text-forest", className)} />;
}
