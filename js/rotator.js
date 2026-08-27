import { formatEuro, formatPct } from "./stats.js";

function sparklineSvg(values) {
  const points = values.filter((v) => v != null);
  if (points.length < 2) return "";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 240;
  const h = 48;
  const step = w / (points.length - 1);
  const coords = points.map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(" ");
  return `
    <svg class="rotator__sparkline" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <polyline points="${coords}" fill="none" stroke="var(--accent)" stroke-width="1.75" />
    </svg>
  `;
}

// entries: [{ caption, name, meta, currentValue, achat (nullable), history: number|null[] }]
export function startRotator(container, entries, intervalMs = 30000) {
  if (entries.length === 0) {
    container.innerHTML = `<div class="empty-state">Rien à afficher pour l'instant.</div>`;
    return () => {};
  }

  let index = 0;

  function render() {
    const e = entries[index];
    const gain = e.achat ? e.currentValue - e.achat : null;
    const gainPct = e.achat ? (gain / e.achat) * 100 : null;

    container.innerHTML = `
      <div class="rotator__caption">${e.caption}</div>
      <div class="rotator__name">${e.name}</div>
      <div class="rotator__meta">${e.meta}</div>
      <div class="rotator__stats">
        <div><div class="rotator__stat-label">Valeur actuelle</div><div class="rotator__stat-value">${formatEuro(e.currentValue)}</div></div>
        <div><div class="rotator__stat-label">Gain total</div><div class="rotator__stat-value ${gain == null ? "" : gain >= 0 ? "text-positive" : "text-negative"}">${gain == null ? "—" : formatEuro(gain)}</div></div>
        <div><div class="rotator__stat-label">Prix achat</div><div class="rotator__stat-value">${e.achat ? formatEuro(e.achat) : "—"}</div></div>
        <div><div class="rotator__stat-label">Rendement</div><div class="rotator__stat-value ${gainPct == null ? "" : gainPct >= 0 ? "text-positive" : "text-negative"}">${gainPct == null ? "—" : formatPct(gainPct)}</div></div>
      </div>
      ${sparklineSvg(e.history)}
    `;
  }

  render();
  const timer = setInterval(() => {
    index = (index + 1) % entries.length;
    render();
  }, intervalMs);

  return () => clearInterval(timer);
}
