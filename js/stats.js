// Pure calculation helpers over snapshot data. No DOM here.

export function snapshotTotal(snapshot) {
  if (!snapshot) return 0;
  return snapshot.items.reduce((sum, it) => sum + (Number(it.prixActuel) || 0), 0);
}

// Builds one point per snapshot of a given type: [{timestamp, total}]
export function buildSeries(snapshots) {
  return snapshots.map((s) => ({ timestamp: s.timestamp, total: snapshotTotal(s) }));
}

// Merges cartes + scelles series into one timeline, forward-filling the
// value of whichever type didn't update at a given timestamp (each type is
// re-exported as a full snapshot, so "no update" just means "unchanged").
export function buildCombinedSeries(cartesSnapshots, scellesSnapshots) {
  const cartesSeries = buildSeries(cartesSnapshots);
  const scellesSeries = buildSeries(scellesSnapshots);
  const timestamps = Array.from(new Set([...cartesSeries.map((p) => p.timestamp), ...scellesSeries.map((p) => p.timestamp)])).sort();

  let lastCartes = 0;
  let lastScelles = 0;
  let ci = 0;
  let si = 0;
  return timestamps.map((ts) => {
    while (ci < cartesSeries.length && cartesSeries[ci].timestamp <= ts) {
      lastCartes = cartesSeries[ci].total;
      ci++;
    }
    while (si < scellesSeries.length && scellesSeries[si].timestamp <= ts) {
      lastScelles = scellesSeries[si].total;
      si++;
    }
    return { timestamp: ts, cartes: lastCartes, scelles: lastScelles, total: lastCartes + lastScelles };
  });
}

// Latest snapshot of a type at or before a given timestamp (used to align
// cartes/scelles snapshots that aren't taken at exactly the same time).
export function snapshotAtOrBefore(snapshots, timestamp) {
  let result = null;
  for (const s of snapshots) {
    if (s.timestamp <= timestamp) result = s;
    else break;
  }
  return result;
}

export function pct(delta, base) {
  if (!base) return delta > 0 ? Infinity : delta < 0 ? -Infinity : 0;
  return (delta / base) * 100;
}

// Value + P&L of the collection (cartes + scelles) between two points in
// time. `atTimestamp` picks the latest snapshot at or before the given date
// for each type independently.
export function collectionValueAt(cartesSnapshots, scellesSnapshots, timestamp) {
  const cartesSnap = snapshotAtOrBefore(cartesSnapshots, timestamp);
  const scellesSnap = snapshotAtOrBefore(scellesSnapshots, timestamp);
  return {
    cartes: snapshotTotal(cartesSnap),
    scelles: snapshotTotal(scellesSnap),
    cartesCount: cartesSnap ? cartesSnap.items.length : 0,
    scellesCount: scellesSnap ? scellesSnap.items.length : 0,
  };
}

// Per-item deltas between two snapshots of the SAME type, matched by id.
// Only items present in both are included (new/sold items are excluded from
// top movers by design - there's no meaningful "performance" for them yet).
export function itemDeltas(startSnapshot, endSnapshot) {
  if (!startSnapshot || !endSnapshot) return [];
  const startById = new Map(startSnapshot.items.map((it) => [it.id, it]));
  const rows = [];
  for (const end of endSnapshot.items) {
    const start = startById.get(end.id);
    if (!start) continue;
    const deltaEuro = (Number(end.prixActuel) || 0) - (Number(start.prixActuel) || 0);
    rows.push({
      id: end.id,
      nom: end.nom,
      numero: end.numero,
      serie: end.serie,
      etat: end.etat,
      startPrice: Number(start.prixActuel) || 0,
      endPrice: Number(end.prixActuel) || 0,
      deltaEuro,
      deltaPct: pct(deltaEuro, Number(start.prixActuel) || 0),
    });
  }
  return rows;
}

export function topMovers(deltas, count, direction = "gainers") {
  const sorted = [...deltas].sort((a, b) => (direction === "gainers" ? b.deltaPct - a.deltaPct : a.deltaPct - b.deltaPct));
  return sorted.filter((d) => (direction === "gainers" ? d.deltaEuro > 0 : d.deltaEuro < 0)).slice(0, count);
}

// ---- Alerts: items (cartes + scelles) whose value moved more than
// `thresholdPct` between two snapshots, mixed +/- and sorted by magnitude. ----
export function computeAlerts(cartesStart, cartesEnd, scellesStart, scellesEnd, thresholdPct = 5, limit = 8) {
  const all = [
    ...itemDeltas(cartesStart, cartesEnd).map((d) => ({ ...d, kind: "carte" })),
    ...itemDeltas(scellesStart, scellesEnd).map((d) => ({ ...d, kind: "scelle" })),
  ];
  return all
    .filter((d) => Number.isFinite(d.deltaPct) && Math.abs(d.deltaPct) > thresholdPct)
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
    .slice(0, limit);
}

// ---- Per-item real gain vs actual purchase price. Returns null when the
// purchase price isn't known (0/missing) rather than pretending it's a real
// gain against a 0€ cost - most exports don't have a real prixAchat. ----
export function realGain(item) {
  const achat = Number(item.prixAchat) || 0;
  if (!achat) return null;
  const actuel = Number(item.prixActuel) || 0;
  return { achat, actuel, gain: actuel - achat, pct: pct(actuel - achat, achat) };
}

// ---- Portfolio composition metrics (latest cartes snapshot) ----
export function diversification(cartesSnapshot) {
  if (!cartesSnapshot) return 0;
  return new Set(cartesSnapshot.items.map((it) => it.bloc).filter(Boolean)).size;
}

export function qualityPct(cartesSnapshot, topState = "Mint") {
  if (!cartesSnapshot || cartesSnapshot.items.length === 0) return 0;
  const top = cartesSnapshot.items.filter((it) => it.etat === topState).length;
  return (top / cartesSnapshot.items.length) * 100;
}

// ---- Labeled periods: every distinct snapshot timestamp (cartes U scelles),
// chronological, shown to the user as "Période 1..N" instead of raw dates. ----
export function buildPeriods(cartesSnapshots, scellesSnapshots) {
  const timestamps = Array.from(new Set([...cartesSnapshots.map((s) => s.timestamp), ...scellesSnapshots.map((s) => s.timestamp)])).sort();
  return timestamps.map((timestamp, i) => ({
    index: i + 1,
    label: `Période ${i + 1}`,
    timestamp,
    isLatest: i === timestamps.length - 1,
  }));
}

// ---- Health score: a single 0-100 signal blending growth, card quality,
// diversification and data freshness. Weights are documented here (and
// surfaced in the UI tooltip) so the number is never a black box. ----
const HEALTH_WEIGHTS = { evolution: 0.4, quality: 0.2, diversification: 0.2, freshness: 0.2 };
const DIVERSIFICATION_CAP = 20; // blocs at/above this count score full marks

export function healthScore({ evolutionPct, qualityPctValue, diversificationCount, daysSinceLastImport }) {
  const evolutionScore = clamp01((evolutionPct + 20) / 40) * 100; // -20%..+20% mapped to 0..100
  const qualityScore = clamp01(qualityPctValue / 100) * 100;
  const diversificationScore = clamp01(diversificationCount / DIVERSIFICATION_CAP) * 100;
  const freshnessScore = clamp01(1 - daysSinceLastImport / 14) * 100; // full marks if imported today, 0 after 14j

  const score = Math.round(
    evolutionScore * HEALTH_WEIGHTS.evolution +
      qualityScore * HEALTH_WEIGHTS.quality +
      diversificationScore * HEALTH_WEIGHTS.diversification +
      freshnessScore * HEALTH_WEIGHTS.freshness
  );

  let label = "Faible";
  if (score >= 80) label = "Excellente";
  else if (score >= 60) label = "Bonne";
  else if (score >= 40) label = "Correcte";

  return { score, label };
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

// ---- 1-year projection from the combined value series, using the actual
// elapsed calendar time between snapshots (not the number of periods) so an
// uneven import cadence doesn't distort the growth rate. Range = same
// projection applied with the slowest and fastest daily growth rate observed
// between any two consecutive snapshots. Always label this as an estimate. ----
export function parseTimestamp(ts) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})$/.exec(ts);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
}

export function predictOneYear(combinedSeries) {
  if (combinedSeries.length < 2) return null;
  const first = combinedSeries[0];
  const last = combinedSeries[combinedSeries.length - 1];
  const firstDate = parseTimestamp(first.timestamp);
  const lastDate = parseTimestamp(last.timestamp);
  const totalDays = (lastDate - firstDate) / 86400000;
  if (totalDays <= 0 || first.total <= 0) return null;

  const dailyRate = Math.pow(last.total / first.total, 1 / totalDays) - 1;

  // A rate measured over a short window (a few days) is noise, not a trend -
  // compounded over 365 days it explodes into meaningless territory even
  // though the underlying 2-3 day observation was perfectly real. Only use
  // pairs at least a week apart so the range reflects sustained movement.
  const MIN_GAP_DAYS = 7;
  const stepRates = [];
  for (let i = 1; i < combinedSeries.length; i++) {
    const a = combinedSeries[i - 1];
    const b = combinedSeries[i];
    const days = (parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp)) / 86400000;
    if (days >= MIN_GAP_DAYS && a.total > 0) {
      stepRates.push(Math.pow(b.total / a.total, 1 / days) - 1);
    }
  }
  // Absolute last-resort safety net (~38x/year) so a future anomalous data
  // point still can't render a nonsensical projection.
  const clampRate = (r) => Math.max(-0.01, Math.min(0.01, r));
  const minRate = clampRate(stepRates.length ? Math.min(...stepRates) : dailyRate);
  const maxRate = clampRate(stepRates.length ? Math.max(...stepRates) : dailyRate);

  const project = (rate) => last.total * Math.pow(1 + clampRate(rate), 365);

  return {
    projected: project(dailyRate),
    low: project(minRate),
    high: project(maxRate),
    deltaEuro: project(dailyRate) - last.total,
    deltaPct: pct(project(dailyRate) - last.total, last.total),
  };
}

// Price of one item (by id) across a list of snapshots (e.g. one per
// period), null where the item isn't present in that snapshot yet.
export function itemHistoryAcrossSnapshots(itemId, snapshots) {
  return snapshots.map((s) => {
    const item = s.items.find((it) => it.id === itemId);
    return item ? Number(item.prixActuel) || 0 : null;
  });
}

export function formatEuro(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value || 0);
}

export function formatPct(value) {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function formatDate(timestamp) {
  // timestamps are "YYYY-MM-DDThhmm"
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})$/.exec(timestamp);
  if (!m) return timestamp;
  const [, y, mo, d, h, mi] = m;
  return `${d}/${mo}/${y} ${h}h${mi}`;
}

export function formatDateShort(timestamp) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T/.exec(timestamp);
  if (!m) return timestamp;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}
