export const CYLINDER_TYPES = [
  "carbon fiber",
  "aluminum",
  "steel",
  "composite",
] as const;

export const DELIVERY_TYPES = ["cylinder_swap", "home_refill"] as const;

export const MIN_QUANTITY: Record<string, number> = {
  gas: 3, // 3kg minimum
  diesel: 5, // 5L minimum
  petrol: 5, // 5L minimum
};

export type CylinderType = (typeof CYLINDER_TYPES)[number];
export type DeliveryType = (typeof DELIVERY_TYPES)[number];
export type MIN_QUANTITY = (typeof MIN_QUANTITY)[number];