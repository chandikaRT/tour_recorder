// Read + validate a Tour Recorder JSON export ({version:2, tours:[…]}) and
// normalize it into a shape the spec/manual generators consume.
import fs from "node:fs";
import path from "node:path";

/** Turn a tour name into a filesystem-safe slug used for file/dir names. */
const COMBINING_MARKS = /[̀-ͯ]/g;

export function slugify(name) {
  const base = (name || "")
    .toString()
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "") // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "tour";
}

/**
 * Load and validate the export file.
 * @param {string} file path to the exported .json
 * @returns {{version:number, tours:Array}} normalized tours
 */
export function loadTours(file) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) {
    throw new Error(`Export file not found: ${abs}`);
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (e) {
    throw new Error(`Not valid JSON (${abs}): ${e.message}`);
  }
  if (!data || typeof data !== "object" || !Array.isArray(data.tours)) {
    throw new Error(
      `Unexpected export shape in ${abs}. Expected {"version":2,"tours":[…]}. ` +
        `Export from Tour Recorder → Manage Tours → Action → Export Tours.`
    );
  }
  if (!data.tours.length) {
    throw new Error(`Export contains no tours: ${abs}`);
  }

  // Disambiguate duplicate slugs (two tours with the same name).
  const seen = new Map();
  const tours = data.tours.map((t) => normalizeTour(t, seen));
  return { version: data.version || 1, tours };
}

function normalizeTour(t, seen) {
  let slug = slugify(t.name);
  const count = seen.get(slug) || 0;
  seen.set(slug, count + 1);
  if (count > 0) slug = `${slug}-${count + 1}`;

  const steps = (t.steps || []).map((s, i) => normalizeStep(s, i));
  // Languages available for this tour = union of keys across all i18n maps,
  // always including "en_US" as the source/fallback language.
  const langs = collectLangs(t, steps);
  return {
    slug,
    name: t.name || "Untitled Tour",
    name_i18n: t.name_i18n || {},
    description: t.description || "",
    description_i18n: t.description_i18n || {},
    steps,
    langs,
  };
}

function normalizeStep(s, i) {
  return {
    index: i, // 0-based order
    number: i + 1, // 1-based, used in labels/filenames
    title: s.title || "",
    title_i18n: s.title_i18n || {},
    trigger: s.trigger || "",
    content: s.content || "",
    content_i18n: s.content_i18n || {},
    position: s.position || "bottom",
    run: s.run || "click",
    is_check: !!s.is_check,
    validation_type: s.validation_type || "none",
    validation_regex: s.validation_regex || "",
    validation_message: s.validation_message || "",
    validation_message_i18n: s.validation_message_i18n || {},
  };
}

function collectLangs(tour, steps) {
  const set = new Set(["en_US"]);
  const add = (obj) => obj && Object.keys(obj).forEach((k) => set.add(k));
  add(tour.name_i18n);
  add(tour.description_i18n);
  for (const s of steps) {
    add(s.title_i18n);
    add(s.content_i18n);
    add(s.validation_message_i18n);
  }
  return [...set];
}

/**
 * Resolve a translatable value for a given language, falling back to the
 * flat source value (which is the en_US text), then to empty string.
 */
export function tr(flat, i18n, lang) {
  if (lang && i18n && i18n[lang] != null && i18n[lang] !== "") return i18n[lang];
  return flat || "";
}
