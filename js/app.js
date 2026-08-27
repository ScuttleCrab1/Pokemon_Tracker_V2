import { loadCollection } from "./data-loader.js";
import { renderPeriodPicker } from "./period-picker.js";
import { renderValueChart } from "./charts.js";
import { createDataTable } from "./data-table.js";
import { startRotator } from "./rotator.js";
import {
  buildCombinedSeries,
  buildPeriods,
  collectionValueAt,
  itemDeltas,
  topMovers,
  computeAlerts,
  realGain,
  diversification,
  qualityPct,
  healthScore,
  predictOneYear,
  itemHistoryAcrossSnapshots,
  snapshotAtOrBefore,
  snapshotTotal,
  pct,
  formatEuro,
  formatPct,
  formatDate,
  parseTimestamp,
} from "./stats.js";

function badge(deltaEuro, deltaPct) {
  if (deltaEuro === 0 || !Number.isFinite(deltaPct)) {
    return `<span class="badge badge--neutral">${formatPct(deltaPct)}</span>`;
  }
  const cls = deltaEuro > 0 ? "badge--positive" : "badge--negative";
  const arrow = deltaEuro > 0 ? "↑" : "↓";
  return `<span class="badge ${cls}">${arrow} ${formatPct(deltaPct)}</span>`;
}

function stat(label, value, sub = "") {
  return `<div class="stat"><div class="stat__label">${label}</div><div class="stat__value">${value}</div>${sub ? `<div class="stat__sub">${sub}</div>` : ""}</div>`;
}

function renderTopbar({ endValue, deltaEuro, deltaPct, startLabel }) {
  const dateStr = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  document.getElementById("topbar-date").textContent = dateStr;
  document.getElementById("topbar-value").textContent = formatEuro(endValue);
  const sign = deltaEuro >= 0 ? "+" : "";
  document.getElementById("topbar-delta").innerHTML = `<span class="${deltaEuro >= 0 ? "text-positive" : "text-negative"}">${sign}${formatEuro(deltaEuro)}</span> vs ${startLabel}`;
}

function renderStatsMain(root, { cartesVal, cartesDelta, cartesDeltaPct, scellesVal, scellesDelta, scellesDeltaPct, gainNet, rendementPct }) {
  root.innerHTML = [
    stat("Cartes", formatEuro(cartesVal), badge(cartesDelta, cartesDeltaPct)),
    stat("Scellé", formatEuro(scellesVal), badge(scellesDelta, scellesDeltaPct)),
    stat("Gain net", `${gainNet >= 0 ? "+" : ""}${formatEuro(gainNet)}`, `Rendement ${formatPct(rendementPct)}`),
  ].join("");
}

function renderStatsComposite(root, { health, evolutionPct, scelleRendementPct, diversificationCount, qualityPctValue }) {
  root.innerHTML = [
    `<div class="stat"><div class="stat__label">Score de santé</div><div class="health-score"><span class="health-score__num">${health.score}</span><span class="health-score__label">${health.label}</span></div></div>`,
    stat("Évolution globale", formatPct(evolutionPct)),
    stat("Rendement scellé", formatPct(scelleRendementPct)),
    stat("Diversification", `${diversificationCount} blocs`),
    stat("Qualité cartes", `${qualityPctValue.toFixed(0)}% top état`),
  ].join("");
}

function renderAlerts(root, alerts) {
  if (alerts.length === 0) {
    root.innerHTML = `<li class="empty-state">Aucune variation de plus de 5% pour l'instant.</li>`;
    return;
  }
  root.innerHTML = alerts
    .map(
      (a) => `
    <li class="alert-row">
      <span class="alert-row__icon">${a.kind === "carte" ? "🃏" : "📦"}</span>
      <span class="alert-row__info">
        <div class="alert-row__name">${a.nom}</div>
        <div class="alert-row__meta">${a.serie || ""}</div>
      </span>
      ${badge(a.deltaEuro, a.deltaPct)}
    </li>`
    )
    .join("");
}

function renderMoverTable(root, rows) {
  if (rows.length === 0) {
    root.innerHTML = `<div class="empty-state">Pas assez de données communes.</div>`;
    return;
  }
  root.innerHTML = `
    <table class="mover-table">
      <thead><tr><th>#</th><th>Carte</th><th class="num">Début</th><th class="num">Actuel</th><th class="num">Δ €</th><th class="num">Δ %</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><div class="mover-table__name">${r.nom}</div><div class="mover-table__meta">${r.serie || ""}${r.etat ? " · " + r.etat : ""}</div></td>
            <td class="num">${formatEuro(r.startPrice)}</td>
            <td class="num">${formatEuro(r.endPrice)}</td>
            <td class="num ${r.deltaEuro >= 0 ? "text-positive" : "text-negative"}">${r.deltaEuro >= 0 ? "+" : ""}${formatEuro(r.deltaEuro)}</td>
            <td class="num ${r.deltaEuro >= 0 ? "text-positive" : "text-negative"}">${formatPct(r.deltaPct)}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderCompareToggle(root, rows, { title, limit }) {
  let mode = "euro";
  function draw() {
    const top = [...rows].sort((a, b) => Math.abs(b.deltaEuro) - Math.abs(a.deltaEuro)).slice(0, limit);
    root.innerHTML = `
      <h2 class="section__title">${title}</h2>
      <div class="toggle-group" style="margin-bottom:12px;">
        <button data-mode="euro" class="${mode === "euro" ? "is-active" : ""}">€</button>
        <button data-mode="pct" class="${mode === "pct" ? "is-active" : ""}">%</button>
      </div>
      <table class="mover-table">
        <tbody>
          ${top
            .map(
              (r) => `
            <tr>
              <td class="mover-table__name">${r.nom}</td>
              <td class="num">${formatEuro(r.startPrice)}</td>
              <td class="num">${formatEuro(r.endPrice)}</td>
              <td class="num ${r.deltaEuro >= 0 ? "text-positive" : "text-negative"}">${mode === "euro" ? `${r.deltaEuro >= 0 ? "+" : ""}${formatEuro(r.deltaEuro)}` : formatPct(r.deltaPct)}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    `;
    root.querySelectorAll(".toggle-group button").forEach((btn) => {
      btn.addEventListener("click", () => {
        mode = btn.dataset.mode;
        draw();
      });
    });
  }
  draw();
}

function renderComparaisonFull(root, cartesDeltas, scellesDeltas) {
  let type = "cartes";
  let mode = "euro";
  function draw() {
    const rows = [...(type === "cartes" ? cartesDeltas : scellesDeltas)].sort((a, b) => Math.abs(b.deltaEuro) - Math.abs(a.deltaEuro));
    root.innerHTML = `
      <div style="display:flex; gap:16px; align-items:center; margin-bottom:14px; flex-wrap:wrap;">
        <div class="toggle-group">
          <button data-type="cartes" class="${type === "cartes" ? "is-active" : ""}">Cartes</button>
          <button data-type="scelles" class="${type === "scelles" ? "is-active" : ""}">Scellés</button>
        </div>
        <div class="toggle-group">
          <button data-mode="euro" class="${mode === "euro" ? "is-active" : ""}">€</button>
          <button data-mode="pct" class="${mode === "pct" ? "is-active" : ""}">%</button>
        </div>
      </div>
      <div class="data-table__scroll">
        <table class="mover-table">
          <thead><tr><th>Nom</th><th class="num">Début</th><th class="num">Actuel</th><th class="num">Δ</th></tr></thead>
          <tbody>
            ${
              rows.length === 0
                ? `<tr><td colspan="4"><div class="empty-state">Pas de donnée commune sur cette période.</div></td></tr>`
                : rows
                    .map(
                      (r) => `
              <tr>
                <td class="mover-table__name">${r.nom}${r.etat ? `<div class="mover-table__meta">${r.serie || ""} · ${r.etat}</div>` : ""}</td>
                <td class="num">${formatEuro(r.startPrice)}</td>
                <td class="num">${formatEuro(r.endPrice)}</td>
                <td class="num ${r.deltaEuro >= 0 ? "text-positive" : "text-negative"}">${mode === "euro" ? `${r.deltaEuro >= 0 ? "+" : ""}${formatEuro(r.deltaEuro)}` : formatPct(r.deltaPct)}</td>
              </tr>`
                    )
                    .join("")
            }
          </tbody>
        </table>
      </div>
    `;
    root.querySelectorAll("[data-type]").forEach((btn) => btn.addEventListener("click", () => { type = btn.dataset.type; draw(); }));
    root.querySelectorAll("[data-mode]").forEach((btn) => btn.addEventListener("click", () => { mode = btn.dataset.mode; draw(); }));
  }
  draw();
}

function renderPrediction(root, prediction) {
  if (!prediction) {
    root.innerHTML = `<div class="empty-state">Pas assez d'historique pour projeter une tendance.</div>`;
    return;
  }
  root.innerHTML = `
    <div class="stat">
      <div class="stat__label">Valeur projetée dans 1 an</div>
      <div class="stat__value">${formatEuro(prediction.projected)}</div>
      <div class="stat__sub ${prediction.deltaEuro >= 0 ? "text-positive" : "text-negative"}">${prediction.deltaEuro >= 0 ? "+" : ""}${formatEuro(prediction.deltaEuro)} · ${formatPct(prediction.deltaPct)}</div>
      <div class="prediction-range">Fourchette : ${formatEuro(prediction.low)} — ${formatEuro(prediction.high)} · estimation basée sur la tendance historique, pas une garantie.</div>
    </div>
  `;
}

function renderTop5(root, items, mode0 = "euro") {
  let mode = mode0;
  function draw() {
    root.innerHTML = `
      <div class="toggle-group" style="margin-bottom:12px;">
        <button data-mode="euro" class="${mode === "euro" ? "is-active" : ""}">€</button>
        <button data-mode="pct" class="${mode === "pct" ? "is-active" : ""}">%</button>
      </div>
      <table class="mover-table">
        <tbody>
          ${items
            .map(
              (it, i) => `
            <tr>
              <td>${i + 1}</td>
              <td class="mover-table__name">${it.nom}</td>
              <td class="num">${formatEuro(it.value)}</td>
              <td class="num ${it.deltaEuro == null ? "" : it.deltaEuro >= 0 ? "text-positive" : "text-negative"}">${
                it.deltaEuro == null ? "—" : mode === "euro" ? `${it.deltaEuro >= 0 ? "+" : ""}${formatEuro(it.deltaEuro)}` : formatPct(it.deltaPct)
              }</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    `;
    root.querySelectorAll("[data-mode]").forEach((btn) => btn.addEventListener("click", () => { mode = btn.dataset.mode; draw(); }));
  }
  draw();
}

function renderImportsTable(root, cartesSnaps, scellesSnaps) {
  const rows = [
    ...cartesSnaps.map((s) => ({ ...s, type: "cartes" })),
    ...scellesSnaps.map((s) => ({ ...s, type: "scelles" })),
  ].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  if (rows.length === 0) {
    root.innerHTML = `<div class="empty-state">Aucun import pour le moment.</div>`;
    return;
  }

  root.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Date</th><th>Type</th><th>Items</th><th>Valeur</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            <td>${formatDate(r.timestamp)}</td>
            <td><span class="data-table__type-pill">${r.type === "cartes" ? "Cartes" : "Scellés"}</span></td>
            <td>${r.items.length}</td>
            <td>${formatEuro(snapshotTotal(r))}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function buildCartesTable(container, cartesEndSnap) {
  const rows = cartesEndSnap ? cartesEndSnap.items : [];
  const etats = Array.from(new Set(rows.map((r) => r.etat).filter(Boolean))).sort();
  const blocs = Array.from(new Set(rows.map((r) => r.bloc).filter(Boolean))).sort();

  createDataTable(container, {
    rows,
    searchText: (r) => r.nom,
    searchPlaceholder: "Rechercher une carte...",
    filters: [
      { key: "etat", label: "Tous les états", values: etats, getValue: (r) => r.etat },
      { key: "bloc", label: "Tous les blocs", values: blocs, getValue: (r) => r.bloc },
    ],
    columns: [
      {
        key: "nom",
        label: "Carte",
        sortValue: (r) => r.nom,
        format: (r) => `<div class="mover-table__name">${r.nom}</div><div class="mover-table__meta">${r.serie || ""} · ${r.numero || ""}</div>`,
      },
      { key: "etat", label: "État", sortValue: (r) => r.etat, format: (r) => r.etat || "" },
      { key: "version", label: "Ver.", sortValue: (r) => r.version, format: (r) => r.version || "" },
      { key: "langue", label: "Lang.", sortValue: (r) => r.langue, format: (r) => r.langue || "" },
      { key: "achat", label: "Achat", align: "right", sortValue: (r) => Number(r.prixAchat) || 0, format: (r) => (Number(r.prixAchat) ? formatEuro(r.prixAchat) : "—") },
      { key: "valeur", label: "Valeur", align: "right", sortValue: (r) => Number(r.prixActuel) || 0, format: (r) => formatEuro(r.prixActuel) },
      {
        key: "gain",
        label: "Gain",
        align: "right",
        sortValue: (r) => {
          const g = realGain(r);
          return g ? g.gain : 0;
        },
        format: (r) => {
          const g = realGain(r);
          if (!g) return "—";
          return `<span class="${g.gain >= 0 ? "text-positive" : "text-negative"}">${g.gain >= 0 ? "+" : ""}${formatEuro(g.gain)}</span>`;
        },
      },
    ],
  });
}

function buildScellesTable(container, scellesEndSnap) {
  const rows = scellesEndSnap ? scellesEndSnap.items : [];
  const types = Array.from(new Set(rows.map((r) => r.type).filter(Boolean))).sort();

  createDataTable(container, {
    rows,
    searchText: (r) => r.nom,
    searchPlaceholder: "Rechercher un item...",
    filters: [{ key: "type", label: "Tous les types", values: types, getValue: (r) => r.type }],
    columns: [
      { key: "nom", label: "Item", sortValue: (r) => r.nom, format: (r) => `<div class="mover-table__name">${r.nom}</div>` },
      { key: "type", label: "Type", sortValue: (r) => r.type, format: (r) => r.type || "" },
      { key: "quantite", label: "Qté", align: "right", sortValue: (r) => Number(r.quantite) || 0, format: (r) => r.quantite ?? "1" },
      { key: "achat", label: "Achat", align: "right", sortValue: (r) => Number(r.prixAchat) || 0, format: (r) => (Number(r.prixAchat) ? formatEuro(r.prixAchat) : "—") },
      { key: "valeur", label: "Valeur", align: "right", sortValue: (r) => Number(r.prixActuel) || 0, format: (r) => formatEuro(r.prixActuel) },
      {
        key: "gain",
        label: "Gain",
        align: "right",
        sortValue: (r) => {
          const g = realGain(r);
          return g ? g.gain : 0;
        },
        format: (r) => {
          const g = realGain(r);
          if (!g) return "—";
          return `<span class="${g.gain >= 0 ? "text-positive" : "text-negative"}">${g.gain >= 0 ? "+" : ""}${formatEuro(g.gain)}</span>`;
        },
      },
    ],
  });
}

function buildRotatorEntries(snapshot, allSnapshots, caption) {
  if (!snapshot) return [];
  return snapshot.items.map((it) => {
    const g = realGain(it);
    return {
      caption,
      name: it.nom,
      meta: [it.serie, it.numero, it.etat].filter(Boolean).join(" · "),
      currentValue: Number(it.prixActuel) || 0,
      achat: g ? g.achat : null,
      history: itemHistoryAcrossSnapshots(it.id, allSnapshots),
    };
  });
}

async function main() {
  const { cartes, scelles } = await loadCollection();

  const combinedSeries = buildCombinedSeries(cartes, scelles);
  const periods = buildPeriods(cartes, scelles);

  renderValueChart(document.getElementById("value-chart"), combinedSeries);
  renderImportsTable(document.getElementById("imports-table"), cartes, scelles);
  renderPrediction(document.getElementById("prediction"), predictOneYear(combinedSeries));

  // Rotators + tables use the LATEST snapshot regardless of the selected
  // comparison period (they're a live catalogue view, not period-scoped).
  const latestCartes = cartes[cartes.length - 1] || null;
  const latestScelles = scelles[scelles.length - 1] || null;
  startRotator(document.getElementById("rotator-cartes"), buildRotatorEntries(latestCartes, cartes, "Carte sélectionnée · défilement auto toutes les 30s"));
  startRotator(document.getElementById("rotator-scelles"), buildRotatorEntries(latestScelles, scelles, "Item scellé · défilement auto toutes les 30s"));
  buildCartesTable(document.getElementById("table-cartes"), latestCartes);
  buildScellesTable(document.getElementById("table-scelles"), latestScelles);

  // Top 5 by current value, delta = vs the previous snapshot of the same type.
  const prevCartes = cartes.length > 1 ? cartes[cartes.length - 2] : null;
  const prevScelles = scelles.length > 1 ? scelles[scelles.length - 2] : null;
  function top5(latestSnap, prevSnap) {
    if (!latestSnap) return [];
    const prevById = new Map((prevSnap ? prevSnap.items : []).map((it) => [it.id, it]));
    return [...latestSnap.items]
      .sort((a, b) => (Number(b.prixActuel) || 0) - (Number(a.prixActuel) || 0))
      .slice(0, 5)
      .map((it) => {
        const prev = prevById.get(it.id);
        const value = Number(it.prixActuel) || 0;
        const deltaEuro = prev ? value - (Number(prev.prixActuel) || 0) : null;
        return { nom: it.nom, value, deltaEuro, deltaPct: prev ? pct(deltaEuro, Number(prev.prixActuel) || 0) : null };
      });
  }
  renderTop5(document.getElementById("top5-cartes"), top5(latestCartes, prevCartes));
  renderTop5(document.getElementById("top5-scelles"), top5(latestScelles, prevScelles));

  function valueAtTimestamp(ts) {
    const v = collectionValueAt(cartes, scelles, ts);
    return v.cartes + v.scelles;
  }

  function renderForPeriod({ start, end, startLabel }) {
    const startVal = collectionValueAt(cartes, scelles, start);
    const endVal = collectionValueAt(cartes, scelles, end);
    const totalStart = startVal.cartes + startVal.scelles;
    const totalEnd = endVal.cartes + endVal.scelles;
    const deltaEuro = totalEnd - totalStart;
    const deltaPct = pct(deltaEuro, totalStart);

    renderTopbar({ endValue: totalEnd, deltaEuro, deltaPct, startLabel });

    const cartesDeltaEuro = endVal.cartes - startVal.cartes;
    const scellesDeltaEuro = endVal.scelles - startVal.scelles;
    renderStatsMain(document.getElementById("stats-main"), {
      cartesVal: endVal.cartes,
      cartesDelta: cartesDeltaEuro,
      cartesDeltaPct: pct(cartesDeltaEuro, startVal.cartes),
      scellesVal: endVal.scelles,
      scellesDelta: scellesDeltaEuro,
      scellesDeltaPct: pct(scellesDeltaEuro, startVal.scelles),
      gainNet: deltaEuro,
      rendementPct: deltaPct,
    });

    const cartesStartSnap = snapshotAtOrBefore(cartes, start);
    const cartesEndSnap = snapshotAtOrBefore(cartes, end);
    const scellesStartSnap = snapshotAtOrBefore(scelles, start);
    const scellesEndSnap = snapshotAtOrBefore(scelles, end);

    const cartesDeltas = itemDeltas(cartesStartSnap, cartesEndSnap);
    const scellesDeltas = itemDeltas(scellesStartSnap, scellesEndSnap);

    renderAlerts(document.getElementById("alerts-list"), computeAlerts(cartesStartSnap, cartesEndSnap, scellesStartSnap, scellesEndSnap));
    renderCompareToggle(document.getElementById("comparaison-mini"), scellesDeltas, { title: "Comparaison scellés " + startLabel + " → Actuel", limit: 6 });
    renderComparaisonFull(document.getElementById("comparaison-full"), cartesDeltas, scellesDeltas);

    const daysSinceLastImport = (() => {
      const last = periods[periods.length - 1];
      if (!last) return 0;
      return Math.max(0, (Date.now() - parseTimestamp(last.timestamp)) / 86400000);
    })();

    renderStatsComposite(document.getElementById("stats-composite"), {
      health: healthScore({
        evolutionPct: deltaPct,
        qualityPctValue: qualityPct(cartesEndSnap),
        diversificationCount: diversification(cartesEndSnap),
        daysSinceLastImport,
      }),
      evolutionPct: deltaPct,
      scelleRendementPct: pct(scellesDeltaEuro, startVal.scelles),
      diversificationCount: diversification(cartesEndSnap),
      qualityPctValue: qualityPct(cartesEndSnap),
    });

    renderMoverTable(document.getElementById("movers-cartes-up"), topMovers(cartesDeltas, 15, "gainers"));
    renderMoverTable(document.getElementById("movers-cartes-down"), topMovers(cartesDeltas, 15, "losers"));
  }

  renderPeriodPicker(document.getElementById("period-picker"), periods, valueAtTimestamp, renderForPeriod);
}

main().catch((err) => {
  console.error(err);
  document.getElementById("main-content").innerHTML = `
    <div class="empty-state">Erreur de chargement des données : ${err.message}</div>
  `;
});
