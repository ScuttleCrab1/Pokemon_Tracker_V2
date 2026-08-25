import { loadCollection } from "./data-loader.js";
import { renderPeriodPicker } from "./period-picker.js";
import { renderValueChart } from "./charts.js";
import {
  buildCombinedSeries,
  collectionValueAt,
  itemDeltas,
  topMovers,
  formatEuro,
  formatPct,
  formatDate,
  snapshotTotal,
} from "./stats.js";

function badge(deltaEuro, deltaPct) {
  if (deltaEuro === 0 || !Number.isFinite(deltaPct)) {
    return `<span class="badge badge--neutral">${formatPct(deltaPct)}</span>`;
  }
  const cls = deltaEuro > 0 ? "badge--positive" : "badge--negative";
  const arrow = deltaEuro > 0 ? "↑" : "↓";
  return `<span class="badge ${cls}">${arrow} ${formatPct(deltaPct)}</span>`;
}

function renderKpis(root, { startValue, endValue, cartes, scelles, cartesCount, scellesCount }) {
  const deltaEuro = endValue - startValue;
  const deltaPct = startValue ? (deltaEuro / startValue) * 100 : 0;
  const pnlClass = deltaEuro >= 0 ? "green" : "orange";

  root.innerHTML = `
    <div class="kpi-tile kpi-tile--violet">
      <div class="kpi-tile__icon">💰</div>
      <div class="kpi-tile__label">Valeur totale de la collection</div>
      <div class="kpi-tile__value">${formatEuro(endValue)}</div>
      <div class="kpi-tile__sub">${badge(deltaEuro, deltaPct)} sur la période</div>
    </div>

    <div class="kpi-tile kpi-tile--blue">
      <div class="kpi-tile__icon">🗂️</div>
      <div class="kpi-tile__label">Cartes vs Scellés</div>
      <div class="kpi-tile__value">${formatEuro(cartes)} <span style="font-size:13px;color:var(--text-faint);font-weight:600;">cartes</span></div>
      <div class="split-bar">
        <div class="split-bar__seg--cartes" style="width:${splitPct(cartes, scelles)}%"></div>
        <div class="split-bar__seg--scelles" style="width:${100 - splitPct(cartes, scelles)}%"></div>
      </div>
      <div class="split-legend"><span>Cartes <strong>${formatEuro(cartes)}</strong></span><span>Scellés <strong>${formatEuro(scelles)}</strong></span></div>
    </div>

    <div class="kpi-tile kpi-tile--${pnlClass}">
      <div class="kpi-tile__icon">${deltaEuro >= 0 ? "📈" : "📉"}</div>
      <div class="kpi-tile__label">Bénéfice / perte sur la période</div>
      <div class="kpi-tile__value">${deltaEuro >= 0 ? "+" : ""}${formatEuro(deltaEuro)}</div>
      <div class="kpi-tile__sub">${badge(deltaEuro, deltaPct)} · depuis ${formatEuro(startValue)}</div>
    </div>

    <div class="kpi-tile kpi-tile--orange">
      <div class="kpi-tile__icon">🃏</div>
      <div class="kpi-tile__label">Items suivis</div>
      <div class="kpi-tile__value">${cartesCount + scellesCount}</div>
      <div class="kpi-tile__sub">${cartesCount} cartes · ${scellesCount} scellés</div>
    </div>
  `;
}

function splitPct(cartes, scelles) {
  const total = cartes + scelles;
  if (!total) return 50;
  return Math.round((cartes / total) * 1000) / 10;
}

function renderTopList(root, rows, direction) {
  if (rows.length === 0) {
    root.innerHTML = `<div class="empty-state">Pas assez de données communes entre les deux dates sélectionnées.</div>`;
    return;
  }
  root.innerHTML = `
    <ul class="top-list">
      ${rows
        .map(
          (r, i) => `
        <li class="top-list__row">
          <span class="top-list__rank">${i + 1}</span>
          <span class="top-list__info">
            <div class="top-list__name">${r.nom}</div>
            <div class="top-list__meta">${r.numero || ""} · ${r.serie || ""}${r.etat ? " · " + r.etat : ""}</div>
          </span>
          <span class="top-list__values">
            <div class="top-list__price">${formatEuro(r.endPrice)}</div>
            ${badge(r.deltaEuro, r.deltaPct)}
          </span>
        </li>`
        )
        .join("")}
    </ul>
  `;
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
      <thead>
        <tr><th>Date</th><th>Type</th><th>Items</th><th>Valeur</th></tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            <td>${formatDate(r.timestamp)}</td>
            <td><span class="data-table__type-pill data-table__type-pill--${r.type}">${r.type === "cartes" ? "Cartes" : "Scellés"}</span></td>
            <td>${r.items.length}</td>
            <td>${formatEuro(snapshotTotal(r))}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

async function main() {
  const { cartes, scelles } = await loadCollection();

  const combinedSeries = buildCombinedSeries(cartes, scelles);
  const allTimestamps = combinedSeries.map((p) => p.timestamp);

  renderValueChart(document.getElementById("value-chart"), combinedSeries);
  renderImportsTable(document.getElementById("imports-table"), cartes, scelles);

  function renderForPeriod({ start, end }) {
    const startVal = collectionValueAt(cartes, scelles, start);
    const endVal = collectionValueAt(cartes, scelles, end);

    renderKpis(document.getElementById("kpi-grid"), {
      startValue: startVal.cartes + startVal.scelles,
      endValue: endVal.cartes + endVal.scelles,
      cartes: endVal.cartes,
      scelles: endVal.scelles,
      cartesCount: endVal.cartesCount,
      scellesCount: endVal.scellesCount,
    });

    const startCartesSnap = cartes.filter((s) => s.timestamp <= start).pop();
    const endCartesSnap = cartes.filter((s) => s.timestamp <= end).pop();
    const startScellesSnap = scelles.filter((s) => s.timestamp <= start).pop();
    const endScellesSnap = scelles.filter((s) => s.timestamp <= end).pop();

    const deltas = [...itemDeltas(startCartesSnap, endCartesSnap), ...itemDeltas(startScellesSnap, endScellesSnap)];

    renderTopList(document.getElementById("top-gainers"), topMovers(deltas, 10, "gainers"), "gainers");
    renderTopList(document.getElementById("top-losers"), topMovers(deltas, 10, "losers"), "losers");
  }

  renderPeriodPicker(document.getElementById("period-picker"), allTimestamps, renderForPeriod);
}

main().catch((err) => {
  console.error(err);
  document.getElementById("main-content").innerHTML = `
    <div class="card"><div class="empty-state">Erreur de chargement des données : ${err.message}</div></div>
  `;
});
