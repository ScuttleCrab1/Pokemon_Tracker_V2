import { formatDate } from "./stats.js";

// Renders the period selector (preset "Période 1 -> Actuel" + custom two-date
// comparison) into `container`, and calls onChange({ start, end }) whenever
// the selection changes. `timestamps` is the sorted list of all available
// snapshot timestamps (cartes + scelles combined).
export function renderPeriodPicker(container, timestamps, onChange) {
  if (timestamps.length === 0) {
    container.innerHTML = `<div class="period-picker"><span class="empty-state">Aucun snapshot disponible</span></div>`;
    return;
  }

  const first = timestamps[0];
  const last = timestamps[timestamps.length - 1];

  const state = { mode: "full", start: first, end: last };

  container.innerHTML = `
    <div class="period-picker">
      <div class="period-picker__presets">
        <button type="button" class="period-picker__preset is-active" data-mode="full">Période 1 → Actuel</button>
        <button type="button" class="period-picker__preset" data-mode="custom">Comparer 2 dates</button>
      </div>
      <div class="period-picker__custom" hidden>
        <select data-role="start"></select>
        <span class="period-picker__arrow">→</span>
        <select data-role="end"></select>
      </div>
    </div>
  `;

  const startSelect = container.querySelector('[data-role="start"]');
  const endSelect = container.querySelector('[data-role="end"]');
  const customWrap = container.querySelector(".period-picker__custom");
  const presetButtons = [...container.querySelectorAll(".period-picker__preset")];

  const optionsHtml = timestamps.map((ts) => `<option value="${ts}">${formatDate(ts)}</option>`).join("");
  startSelect.innerHTML = optionsHtml;
  endSelect.innerHTML = optionsHtml;
  startSelect.value = first;
  endSelect.value = last;

  function emit() {
    onChange({ start: state.start, end: state.end });
  }

  presetButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      presetButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const mode = btn.dataset.mode;
      state.mode = mode;
      customWrap.hidden = mode !== "custom";
      if (mode === "full") {
        state.start = first;
        state.end = last;
      } else {
        state.start = startSelect.value;
        state.end = endSelect.value;
      }
      emit();
    });
  });

  startSelect.addEventListener("change", () => {
    state.start = startSelect.value;
    emit();
  });
  endSelect.addEventListener("change", () => {
    state.end = endSelect.value;
    emit();
  });

  emit();
}
