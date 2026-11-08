sap.ui.define(["sap/ui/core/Control"], function (Control) {
  "use strict";
  return Control.extend("tracker.control.PerformanceChart", {
    metadata: {
      properties: {
        chartData: { type: "object" },
        yLabel: { type: "string", defaultValue: "%" },
      },
    },
    renderer: {
      apiVersion: 2,
      render(r, c) {
        r.openStart("div", c).class("performanceChart").openEnd();
        r.openStart("canvas")
          .attr("role", "img")
          .attr("aria-label", c.getTooltip_AsString() || "")
          .openEnd()
          .close("canvas");
        r.close("div");
      },
    },
    onBeforeRendering() {
      this.destroyChart();
    },
    onAfterRendering() {
      const d = this.getChartData();
      if (!d || !window.Chart) return;
      this._chart = new window.Chart(this.getDomRef().querySelector("canvas"), {
        type: "line",
        data: {
          labels: d.dates,
          datasets: d.series.map((s, i) => ({
            label: s.label,
            data: s.values,
            borderColor: [
              "#087e8b",
              "#7861c5",
              "#dd8b28",
              "#d45d79",
              "#4a8c47",
            ][i % 5],
            backgroundColor: "transparent",
            borderWidth: 2,
            pointRadius: 0,
            pointHitRadius: 12,
            tension: 0.15,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: "index" },
          plugins: { legend: { position: "bottom" } },
          scales: {
            x: { ticks: { maxTicksLimit: 7 }, grid: { display: false } },
            y: { title: { display: true, text: this.getYLabel() } },
          },
        },
      });
    },
    destroyChart() {
      if (this._chart) {
        this._chart.destroy();
        this._chart = null;
      }
    },
    exit() {
      this.destroyChart();
    },
  });
});
