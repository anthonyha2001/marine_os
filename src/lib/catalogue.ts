// Catalogue item types and service units, shared by server and client code.

export type ItemType = "PRODUCT" | "SERVICE";

export const SERVICE_UNITS = {
  HOUR: "Per hour",
  FIXED: "Fixed price",
  DAY: "Per day",
  UNIT: "Per unit",
} as const;

export type ServiceUnit = keyof typeof SERVICE_UNITS;

export function isServiceUnit(value: string): value is ServiceUnit {
  return value in SERVICE_UNITS;
}
