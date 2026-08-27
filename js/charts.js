import { formatDate, formatEuro } from "./stats.js";

let chartInstance = null;

export function renderValueChart(canvas, combinedSeries) {
  const labels = combinedSeries.map((p) => formatDate(p.timestamp));

  const data = {
    labels,
    datasets: [
      {
        label: "Total",
        data: combinedSeries.map((p) => p.total),
        borderColor: "#3a4a5c",
        backgroundColor: "rgba(58, 74, 92, 0.08)",
        fill: true,
        tension: 0.3,
        pointRadius: 2.5,
        pointBackgroundColor: "#3a4a5c",
        borderWidth: 2,
      },
      {
        label: "Cartes",
        data: combinedSeries.map((p) => p.cartes),
        borderColor: "#8a8776",
        backgroundColor: "transparent",
        fill: false,
        tension: 0.3,
        pointRadius: 1.5,
        borderWidth: 1.5,
        borderDash: [3, 3],
      },
      {
        label: "Scellés",
        data: combinedSeries.map((p) => p.scelles),
        borderColor: "#a32d2d",
        backgroundColor: "transparent",
        fill: false,
        tension: 0.3,
        pointRadius: 1.5,
        borderWidth: 1.5,
        borderDash: [3, 3],
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatEuro(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#9c9a8f", font: { size: 11, family: "DM Sans" } } },
      y: {
        grid: { color: "#e2e0d8" },
        ticks: {
          color: "#9c9a8f",
          font: { size: 11, family: "DM Sans" },
          callback: (v) => formatEuro(v),
        },
      },
    },
  };

  if (chartInstance) {
    chartInstance.data = data;
    chartInstance.options = options;
    chartInstance.update();
    return chartInstance;
  }

  chartInstance = new Chart(canvas, { type: "line", data, options });
  return chartInstance;
}
