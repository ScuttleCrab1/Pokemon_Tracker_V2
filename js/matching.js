// Identity key logic for tracking an item across snapshots over time.
// Mirrors the algorithm in ingest/ingest.py and docs/CLAUDE_PROJECT_INSTRUCTIONS.md —
// keep all three in sync if this changes.

const COMBINING_MARKS = /[̀-ͯ]/g;

export function slugify(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Base identity: same physical card model + condition + version.
// Genuine duplicate copies (same card, same état, same version) still
// collide on this - callers must disambiguate within a snapshot (see
// disambiguateIds below), same as the seed data generator does.
export function baseItemId(item) {
  return [slugify(item.nom), slugify(item.numero), slugify(item.serie), slugify(item.etat), slugify(item.version)]
    .filter(Boolean)
    .join("-");
}

// Appends -2, -3... to duplicate baseIds within one snapshot's item list,
// in stable (array) order, so every item in the returned list has a unique id.
export function disambiguateIds(items) {
  const counts = new Map();
  return items.map((item) => {
    const base = item.id || baseItemId(item);
    const n = (counts.get(base) || 0) + 1;
    counts.set(base, n);
    return { ...item, id: n === 1 ? base : `${base}-${n}` };
  });
}
