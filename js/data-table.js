// Reusable searchable / filterable / sortable table.
//
// columns: [{ key, label, align, format(row) -> string, sortValue(row) -> number|string }]
// filters: [{ key, label, values: string[], getValue(row) -> string }]
// searchText(row) -> string used for the free-text search box

export function createDataTable(container, { rows, columns, filters = [], searchText, searchPlaceholder = "Rechercher..." }) {
  let query = "";
  const activeFilters = {};
  let sortKey = null;
  let sortDir = 1;

  const controlsHtml = `
    <div class="table-controls">
      ${searchText ? `<input type="text" data-role="search" placeholder="${searchPlaceholder}" />` : ""}
      ${filters
        .map(
          (f) => `
        <select data-role="filter" data-key="${f.key}">
          <option value="">${f.label}</option>
          ${f.values.map((v) => `<option value="${v}">${v}</option>`).join("")}
        </select>`
        )
        .join("")}
    </div>
    <div class="data-table__scroll">
      <table class="data-table">
        <thead>
          <tr>
            ${columns
              .map(
                (c) =>
                  `<th class="${c.sortValue ? "is-sortable" : ""} ${c.align === "right" ? "num" : ""}" data-role="sort" data-key="${c.key}">${c.label}</th>`
              )
              .join("")}
          </tr>
        </thead>
        <tbody data-role="tbody"></tbody>
      </table>
    </div>
  `;
  container.innerHTML = controlsHtml;

  const tbody = container.querySelector('[data-role="tbody"]');
  const searchInput = container.querySelector('[data-role="search"]');
  const filterSelects = container.querySelectorAll('[data-role="filter"]');
  const headers = container.querySelectorAll('th[data-role="sort"]');

  function applyAndRender() {
    let result = rows;
    if (query) {
      const q = query.toLowerCase();
      result = result.filter((r) => searchText(r).toLowerCase().includes(q));
    }
    for (const [key, value] of Object.entries(activeFilters)) {
      if (!value) continue;
      const filter = filters.find((f) => f.key === key);
      result = result.filter((r) => filter.getValue(r) === value);
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      result = [...result].sort((a, b) => {
        const va = col.sortValue(a);
        const vb = col.sortValue(b);
        if (va < vb) return -1 * sortDir;
        if (va > vb) return 1 * sortDir;
        return 0;
      });
    }

    if (result.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${columns.length}"><div class="empty-state">Aucun résultat.</div></td></tr>`;
      return;
    }

    tbody.innerHTML = result
      .map(
        (r) => `
      <tr>
        ${columns.map((c) => `<td class="${c.align === "right" ? "num" : ""}">${c.format(r)}</td>`).join("")}
      </tr>`
      )
      .join("");
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      query = searchInput.value;
      applyAndRender();
    });
  }
  filterSelects.forEach((sel) => {
    sel.addEventListener("change", () => {
      activeFilters[sel.dataset.key] = sel.value;
      applyAndRender();
    });
  });
  headers.forEach((th) => {
    const col = columns.find((c) => c.key === th.dataset.key);
    if (!col || !col.sortValue) return;
    th.addEventListener("click", () => {
      if (sortKey === col.key) sortDir *= -1;
      else {
        sortKey = col.key;
        sortDir = 1;
      }
      applyAndRender();
    });
  });

  applyAndRender();
}
