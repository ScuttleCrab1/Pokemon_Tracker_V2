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
        borderColor: "#6c5ce7",
        backgroundColor: "rgba(108, 92, 231, 0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: "#6c5ce7",
        borderWidth: 2.5,
      },
      {
        label: "Cartes",
        data: combinedSeries.map((p) => p.cartes),
        borderColor: "#7c6ef6",
        backgroundColor: "rgba(124, 110, 246, 0.06)",
        fill: false,
        tension: 0.35,
        pointRadius: 2,
        borderWidth: 1.75,
        borderDash: [4, 4],
      },
      {
        label: "Scellés",
        data: combinedSeries.map((p) => p.scelles),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.06)",
        fill: false,
        tension: 0.35,
        pointRadius: 2,
        borderWidth: 1.75,
        borderDash: [4, 4],
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
      x: { grid: { display: false }, ticks: { color: "#9aa0b1", font: { size: 11 } } },
      y: {
        grid: { color: "#eaecf2" },
        ticks: {
          color: "#9aa0b1",
          font: { size: 11 },
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
