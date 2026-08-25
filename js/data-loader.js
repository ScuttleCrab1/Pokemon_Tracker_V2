// Loads data/index.json and the snapshot files it references.

export async function loadIndex() {
  const res = await fetch("data/index.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Impossible de charger data/index.json (${res.status})`);
  return res.json();
}

export async function loadSnapshot(entry) {
  const res = await fetch(entry.path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Impossible de charger ${entry.path} (${res.status})`);
  const data = await res.json();
  return { ...entry, items: data.items || [] };
}

export async function loadCollection() {
  const index = await loadIndex();
  const [cartes, scelles] = await Promise.all([
    Promise.all((index.cartes || []).map(loadSnapshot)),
    Promise.all((index.scelles || []).map(loadSnapshot)),
  ]);
  const byTimestamp = (a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0);
  cartes.sort(byTimestamp);
  scelles.sort(byTimestamp);
  return { cartes, scelles };
}
