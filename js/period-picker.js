import { formatEuro, formatDateShort } from "./stats.js";

// Renders "Actuel — X€ | Comparer avec [Période N]" into `container`.
// Always compares the latest snapshot ("Actuel") against a selectable
// earlier period (defaults to Période 1). Calls onChange({ start, end })
// with raw timestamps whenever the selection changes.
export function renderPeriodPicker(container, periods, valueAtTimestamp, onChange) {
  if (periods.length === 0) {
    container.innerHTML = `<div class="empty-state">Aucun snapshot disponible</div>`;
    return;
  }

  const latest = periods[periods.length - 1];
  let selectedIndex = 0; // Période 1 by default

  const optionsHtml = periods
    .slice(0, -1)
    .map((p, i) => `<option value="${i}">${p.label} — ${formatEuro(valueAtTimestamp(p.timestamp))} (${formatDateShort(p.timestamp)})</option>`)
    .join("");

  container.innerHTML = `
    <div class="period-select">
      <button type="button" class="period-select__current">Actuel — ${formatEuro(valueAtTimestamp(latest.timestamp))}</button>
      <span class="period-select__label">Comparer avec</span>
      <select>${optionsHtml || `<option>Aucune autre période</option>`}</select>
    </div>
  `;

  const select = container.querySelector("select");
  if (select) {
    select.addEventListener("change", () => {
      selectedIndex = Number(select.value);
      emit();
    });
  }

  function emit() {
    const startPeriod = periods[selectedIndex] || periods[0];
    onChange({ start: startPeriod.timestamp, end: latest.timestamp, startLabel: startPeriod.label });
  }

  emit();
}
