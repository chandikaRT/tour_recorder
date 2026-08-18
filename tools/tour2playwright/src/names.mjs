// Shared naming helpers so the spec generator and the manual generator agree
// on screenshot paths.
import path from "node:path";

export const GENERATED_DIR = "generated";
export const SPECS_DIR = path.join(GENERATED_DIR, "specs");
export const SCREENSHOTS_DIR = path.join(GENERATED_DIR, "screenshots");
export const MANUALS_DIR = path.join(GENERATED_DIR, "manuals");

/** Zero-padded step number (width scales with the step count). */
export function pad(n, total) {
  const width = Math.max(2, String(total || 0).length);
  return String(n).padStart(width, "0");
}

/** Screenshot file name for a step, e.g. "step-03.png". */
export function shotFile(number, total) {
  return `step-${pad(number, total)}.png`;
}

/** Screenshot directory for a tour, relative to the tool root. */
export function shotDir(slug) {
  return path.posix.join(SCREENSHOTS_DIR.replace(/\\/g, "/"), slug);
}
