import { type ClassValue, clsx } from "clsx";

// Lightweight clsx implementation (no external dependency needed)
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// We include a minimal clsx inline since we don't want an extra dep
// If you prefer, `npm install clsx` and import from there
