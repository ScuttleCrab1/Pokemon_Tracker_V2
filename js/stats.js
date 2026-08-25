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
