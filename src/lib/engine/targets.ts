import type { ActivityLevel, DailyTargets, MealType, Member } from "../types";

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  "very-active": 1.9,
};

/** Share of the day's intake a meal represents, for comparing a meal to daily targets. */
export const MEAL_SHARE: Record<MealType, number> = {
  breakfast: 0.25,
  lunch: 0.3,
  dinner: 0.35,
  snack: 0.1,
};

/**
 * Children's estimated energy needs at moderate activity and RDAs, from the
 * Dietary Guidelines for Americans 2020–2025 (Appendix 2) and the DRIs.
 * Children never get weight-loss or bodybuilding adjustments.
 */
function childTargets(m: Member): DailyTargets {
  const age = m.age;
  let kcal: number;
  let protein: number;
  let sodiumMax: number;
  if (age < 2) {
    kcal = 900; protein = 13; sodiumMax = 1200;
  } else if (age <= 3) {
    kcal = 1100; protein = 13; sodiumMax = 1200;
  } else if (age <= 8) {
    kcal = m.sex === "male" ? 1500 : m.sex === "female" ? 1350 : 1400; protein = 19; sodiumMax = 1500;
  } else if (age <= 13) {
    kcal = m.sex === "male" ? 1900 : m.sex === "female" ? 1700 : 1800; protein = 34; sodiumMax = 1800;
  } else {
    kcal = m.sex === "male" ? 2400 : m.sex === "female" ? 2000 : 2200; protein = m.sex === "male" ? 52 : 46; sodiumMax = 2300;
  }
  if (m.activity === "active" || m.activity === "very-active") kcal += 200;
  if (m.activity === "sedentary") kcal -= 150;
  return {
    kcal,
    protein,
    fat: (kcal * 0.32) / 9,
    carbs: (kcal * 0.5) / 4,
    satFatMax: (kcal * 0.1) / 9,
    fiber: Math.round((kcal / 1000) * 14),
    sodiumMax,
    addedSugarMax: age < 2 ? 0 : (kcal * 0.1) / 4,
  };
}

/** Mifflin–St Jeor resting energy, or null when data is missing. */
export function restingEnergy(m: Member): number | null {
  if (!m.weightKg || !m.heightCm || !m.age) return null;
  const base = 10 * m.weightKg + 6.25 * m.heightCm - 5 * m.age;
  if (m.sex === "male") return base + 5;
  if (m.sex === "female") return base - 161;
  return base - 78; // midpoint when sex is unspecified
}

function adultTargets(m: Member): DailyTargets {
  const ree = restingEnergy(m);
  let kcal: number;
  if (ree) {
    kcal = ree * ACTIVITY_FACTOR[m.activity];
  } else {
    kcal = m.sex === "male" ? 2400 : m.sex === "female" ? 2000 : 2200;
    kcal += { sedentary: -200, light: -100, moderate: 0, active: 200, "very-active": 400 }[m.activity];
  }
  if (m.goal === "lose") kcal = Math.max(kcal * 0.85, m.sex === "male" ? 1500 : 1200);
  if (m.goal === "muscle") kcal *= 1.1;
  kcal = Math.round(kcal / 10) * 10;

  let protein: number;
  if (m.goal === "muscle") protein = m.weightKg ? 1.6 * m.weightKg : (kcal * 0.3) / 4;
  else if (m.goal === "lose") protein = m.weightKg ? 1.2 * m.weightKg : (kcal * 0.25) / 4;
  else protein = Math.max(m.weightKg ? 0.8 * m.weightKg : 0, (kcal * 0.18) / 4);

  const fatShare = m.goal === "lower-fat" ? 0.2 : 0.3;
  const fat = (kcal * fatShare) / 9;
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  const fiberPer1000 = m.goal === "higher-fiber" ? 18 : 14;

  const t: DailyTargets = {
    kcal,
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    satFatMax: Math.round((kcal * 0.1) / 9),
    fiber: Math.round((kcal / 1000) * fiberPer1000),
    sodiumMax: 2300,
    addedSugarMax: Math.round((kcal * 0.1) / 4),
  };
  if (m.targets) {
    for (const [k, v] of Object.entries(m.targets)) if (v) (t as unknown as Record<string, number>)[k] = v;
  }
  return t;
}

export function memberTargets(m: Member): DailyTargets {
  return m.kind === "child" ? childTargets(m) : adultTargets(m);
}

/**
 * How many "standard servings" this person eats. A recipe serving is sized for
 * an adult on ~2,000 kcal/day; a 6-year-old eats ~0.7 of it, an adult building
 * muscle ~1.35.
 */
export function portionFactor(m: Member): number {
  const f = memberTargets(m).kcal / 2000;
  return Math.min(1.6, Math.max(0.4, Math.round(f * 20) / 20));
}

export function goalLabel(m: Member): string {
  if (m.kind === "child") return "Balanced growth";
  return {
    general: "General healthy eating",
    maintain: "Balanced maintenance",
    lose: "Gradual weight loss",
    muscle: "High-protein muscle building",
    "lower-fat": "Lower-fat",
    "higher-fiber": "Higher-fiber",
  }[m.goal];
}
