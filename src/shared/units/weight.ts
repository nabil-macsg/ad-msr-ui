/** Exact by definition (international pound, 1959). */
export const KG_PER_LB = 0.45359237;

export type WeightUnit = 'kg' | 'lb';

/** Weights are stored in kg to the gram (PROMPT §2.15). */
export const roundKg = (kg: number): number => Math.round(kg * 1000) / 1000;
export const lbToKg = (lb: number): number => roundKg(lb * KG_PER_LB);
export const kgToLb = (kg: number): number => Math.round((kg / KG_PER_LB) * 100) / 100;
export const toKg = (value: number, unit: WeightUnit): number =>
  unit === 'kg' ? roundKg(value) : lbToKg(value);
