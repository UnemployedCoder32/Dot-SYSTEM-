/**
 * DOT System | Premium Dashboard Charts Engine
 * Built with Chart.js — Dark Nova Theme
 */

(function () {
  'use strict';

  /* ── Chart Colour Tokens ─────────────────────────────────────────────── */
  const C = {
    cyan:   '#06b6d4',
    blue:   '#3b82f6',
    purple: '#8b5cf6',
    green:  '#10b981',
    orange: '#f59e0b',
    red:    '#ef4444',
    pink:   '#ec4899',
    text:   '#f8fafc',
    muted:  '#94a3b8',
    border: 'rgba(255,255,255,0.08)',
    grid:   'rgba(255,255,255,0.04)',
  };

  const FONT = "'Outfit', sans-serif";

  /* ── Shared Chart.js Defaults ────────────────────────────────────────── */
  Chart.defaults.font.family = FONT;
  Chart.defaults.color = C.muted;

  /* ── Registry to destroy/recreate charts ────────────────────────────── */
  const registry = {};
  function mount(id, cfg) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (registry[id]) registry[id].destroy();
    registry[id] = new Chart(canvas, cfg);
  }

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function getLast6Months() {
    const labels = [], dates = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      labels.push(d.toLocaleString('default', { month: 'short' }));
      dates.push({ month: d.getMonth(), year: d.getFullYear() });
    }
    return { labels, dates };
  }

  function getLast7Days() {
    const labels = [], dateStrings = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleString('default', { weekday: 'short' }));
      dateStrings.push(d.toLocaleDateString('en-IN'));
    }
    return { labels, dateStrings };
  }

  function rgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function gradientFill(ctx, color, fromAlpha = 0.45, toAlpha = 0.02) {
    try {
      const g = ctx.createLinearGradient(0, 0, 0, 300);
      g.addColorStop(0, rgba(color, fromAlpha));
      g.addColorStop(1, rgba(color, toAlpha));
      return g;
    } catch { return rgba(color, 0.2); }
  }

  /* ── 1. Revenue Trends (6M) — Area Chart ────────────────────────────── */
  function renderRevenueChart() {
    const canvas = document.getElementById('revenueChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const transactions = (window.DataController?.getTransactions() || []);
    const { labels, dates } = getLast6Months();

    const revenueData = dates.map(({ month, year }) =>
      transactions
        .filter(t => {
          if (t.type !== 'Sale') return false;
          const d = new Date(t.timestamp || t.date);
          return d.getMonth() === month && d.getFullYear() === year;
        })
        .reduce((s, t) => s + (parseFloat(t.totalValue) || 0), 0)
    );

    const profitData = dates.map(({ month, year }) =>
      transactions
        .filter(t => {
          if (t.type !== 'Sale') return false;
          const d = new Date(t.timestamp || t.date);
          return d.getMonth() === month && d.getFullYear() === year;
        })
        .reduce((s, t) => s + ((parseFloat(t.rate) - parseFloat(t.buyRate || 0)) * parseFloat(t.qty || 1)), 0)
    );

    mount('revenueChart', {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Revenue',
            data: revenueData,
            borderColor: C.cyan,
            borderWidth: 2.5,
            backgroundColor: gradientFill(ctx, C.cyan),
            pointRadius: 4,
            pointBackgroundColor: C.cyan,
            pointBorderColor: '#0f172a',
            pointBorderWidth: 2,
            tension: 0.45,
            fill: true,
          },
          {
            label: 'Profit',
            data: profitData,
            borderColor: C.green,
            borderWidth: 2,
            backgroundColor: gradientFill(ctx, C.green, 0.25, 0.01),
            pointRadius: 3,
            pointBackgroundColor: C.green,
            pointBorderColor: '#0f172a',
            pointBorderWidth: 2,
            tension: 0.45,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: C.muted,
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 8,
              font: { size: 11, family: FONT },
            },
          },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.92)',
            borderColor: C.border,
            borderWidth: 1,
            padding: 12,
            titleColor: C.text,
            bodyColor: C.muted,
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: C.grid },
            ticks: { color: C.muted, font: { size: 11 } },
            border: { color: C.border },
          },
          y: {
            grid: { color: C.grid },
            ticks: {
              color: C.muted,
              font: { size: 11 },
              callback: v => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v),
            },
            border: { dash: [4, 4], color: 'transparent' },
          },
        },
      },
    });
  }

  /* ── 2. Volume — Purchases vs Sales (Bar Chart) ──────────────────────── */
  function renderVolumeChart() {
    const canvas = document.getElementById('volumeChart');
    if (!canvas) return;
    const transactions = (window.DataController?.getTransactions() || []);
    const { labels, dates } = getLast6Months();

    const salesQty = dates.map(({ month, year }) =>
      transactions
        .filter(t => {
          const d = new Date(t.timestamp || t.date);
          return t.type === 'Sale' && d.getMonth() === month && d.getFullYear() === year;
        })
        .reduce((s, t) => s + (parseFloat(t.qty) || 0), 0)
    );

    const purchQty = dates.map(({ month, year }) =>
      transactions
        .filter(t => {
          const d = new Date(t.timestamp || t.date);
          return t.type === 'Purchase' && d.getMonth() === month && d.getFullYear() === year;
        })
        .reduce((s, t) => s + (parseFloat(t.qty) || 0), 0)
    );

    mount('volumeChart', {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Sales',
            data: salesQty,
            backgroundColor: rgba(C.blue, 0.75),
            hoverBackgroundColor: C.blue,
            borderRadius: 6,
            borderSkipped: false,
          },
          {
            label: 'Purchases',
            data: purchQty,
            backgroundColor: rgba(C.purple, 0.55),
            hoverBackgroundColor: C.purple,
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: C.muted,
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 8,
              font: { size: 11, family: FONT },
            },
          },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.92)',
            borderColor: C.border,
            borderWidth: 1,
            padding: 12,
            titleColor: C.text,
            bodyColor: C.muted,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: C.muted, font: { size: 11 } },
            border: { color: C.border },
          },
          y: {
            grid: { color: C.grid },
            ticks: { color: C.muted, font: { size: 11 } },
            border: { dash: [4, 4], color: 'transparent' },
          },
        },
      },
    });
  }

  /* ── 3. Stock Health — Doughnut ──────────────────────────────────────── */
  function renderHealthChart() {
    const canvas = document.getElementById('healthChart');
    if (!canvas) return;
    const inventory = (window.DataController?.getInventory() || []);
    const healthy  = inventory.filter(i => i.qty > (i.minStock || 0)).length;
    const low      = inventory.filter(i => i.qty > 0 && i.qty <= (i.minStock || 0)).length;
    const critical = inventory.filter(i => i.qty === 0).length;
    const total = healthy + low + critical || 1;

    mount('healthChart', {
      type: 'doughnut',
      data: {
        labels: ['Healthy', 'Low Stock', 'Critical'],
        datasets: [{
          data: [healthy, low, critical],
          backgroundColor: [rgba(C.green, 0.85), rgba(C.orange, 0.85), rgba(C.red, 0.85)],
          hoverBackgroundColor: [C.green, C.orange, C.red],
          borderWidth: 3,
          borderColor: '#0f172a',
          hoverBorderColor: '#1e293b',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: C.muted,
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 8,
              padding: 16,
              font: { size: 11, family: FONT },
            },
          },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.92)',
            borderColor: C.border,
            borderWidth: 1,
            padding: 12,
            titleColor: C.text,
            bodyColor: C.muted,
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.parsed} items (${((ctx.parsed / total) * 100).toFixed(0)}%)`,
            },
          },
        },
      },
      plugins: [{
        id: 'centerText',
        afterDraw(chart) {
          const { ctx, chartArea: { width, height, left, top } } = chart;
          const pct = total > 0 ? Math.round((healthy / total) * 100) : 100;
          const cx = left + width / 2, cy = top + height / 2;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = pct >= 70 ? C.green : pct >= 30 ? C.orange : C.red;
          ctx.font = `700 28px ${FONT}`;
          ctx.fillText(pct + '%', cx, cy - 8);
          ctx.fillStyle = C.muted;
          ctx.font = `500 11px ${FONT}`;
          ctx.fillText('Health', cx, cy + 16);
          ctx.restore();
        },
      }],
    });
  }

  /* ── 4. Daily Activity Heatmap Bars (7-Day) ──────────────────────────── */
  function renderDailyActivity() {
    const canvas = document.getElementById('dailyActivityChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const transactions = (window.DataController?.getTransactions() || []);
    const repairs = (window.DataController?.getRepairs() || []);
    const { labels, dateStrings } = getLast7Days();

    const salesPerDay = dateStrings.map(ds =>
      transactions.filter(t => t.type === 'Sale' && (t.date === ds || new Date(t.timestamp).toLocaleDateString('en-IN') === ds))
                  .reduce((s, t) => s + (parseFloat(t.totalValue) || 0), 0)
    );
    const repairsPerDay = dateStrings.map(ds =>
      repairs.filter(r => {
        const d = new Date(r.createdAt).toLocaleDateString('en-IN');
        return d === ds;
      }).length
    );

    mount('dailyActivityChart', {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Sales (₹)',
            data: salesPerDay,
            yAxisID: 'y',
            backgroundColor: rgba(C.cyan, 0.7),
            hoverBackgroundColor: C.cyan,
            borderRadius: 6,
            borderSkipped: false,
            order: 2,
          },
          {
            label: 'Repairs',
            data: repairsPerDay,
            yAxisID: 'y1',
            type: 'line',
            borderColor: C.pink,
            backgroundColor: gradientFill(ctx, C.pink, 0.2, 0),
            pointBackgroundColor: C.pink,
            pointRadius: 4,
            pointBorderColor: '#0f172a',
            pointBorderWidth: 2,
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: { color: C.muted, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, font: { size: 11, family: FONT } },
          },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.92)',
            borderColor: C.border,
            borderWidth: 1,
            padding: 12,
            titleColor: C.text,
            bodyColor: C.muted,
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: C.muted }, border: { color: C.border } },
          y: {
            grid: { color: C.grid },
            ticks: { color: C.muted, callback: v => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v) },
            border: { dash: [4, 4], color: 'transparent' },
          },
          y1: {
            position: 'right',
            grid: { display: false },
            ticks: { color: C.pink, stepSize: 1 },
            border: { color: 'transparent' },
          },
        },
      },
    });
  }

  /* ── 5. Category Breakdown — Horizontal Bar ──────────────────────────── */
  function renderCategoryChart() {
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;
    const inventory = (window.DataController?.getInventory() || []);
    const transactions = (window.DataController?.getTransactions() || []);

    // Group by supplier (proxy for category)
    const groups = {};
    transactions.filter(t => t.type === 'Sale').forEach(t => {
      const inv = inventory.find(i => i.id === t.itemId || i.name === t.itemName);
      const cat = inv?.supplier || 'Uncategorised';
      groups[cat] = (groups[cat] || 0) + (parseFloat(t.totalValue) || 0);
    });
    const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const colors = [C.cyan, C.blue, C.purple, C.green, C.orange, C.pink];

    mount('categoryChart', {
      type: 'bar',
      data: {
        labels: sorted.map(s => s[0]),
        datasets: [{
          label: 'Revenue',
          data: sorted.map(s => s[1]),
          backgroundColor: sorted.map((_, i) => rgba(colors[i % colors.length], 0.75)),
          hoverBackgroundColor: sorted.map((_, i) => colors[i % colors.length]),
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.92)',
            borderColor: C.border,
            borderWidth: 1,
            padding: 12,
            titleColor: C.text,
            bodyColor: C.muted,
            callbacks: {
              label: ctx => ` ₹${ctx.parsed.x.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: C.grid },
            ticks: { color: C.muted, font: { size: 11 }, callback: v => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v) },
          },
          y: { grid: { display: false }, ticks: { color: C.text, font: { size: 11 } }, border: { color: C.border } },
        },
      },
    });
  }

  /* ── 6. Expense Breakdown Donut ──────────────────────────────────────── */
  function renderExpenseChart() {
    const canvas = document.getElementById('expenseChart');
    if (!canvas) return;
    const expenses = (window.DataController?.getExpenses() || []);
    const payroll = (window.DataController?.getPayrollExpense?.('all') || 0);
    const repairs = (window.DataController?.getRepairs() || []).filter(r => r.status === 'Completed').reduce((s, r) => s + (r.price || 0), 0);
    const misc = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

    mount('expenseChart', {
      type: 'doughnut',
      data: {
        labels: ['Payroll', 'Misc Expenses', 'Repair Revenue'],
        datasets: [{
          data: [payroll, misc, repairs],
          backgroundColor: [rgba(C.purple, 0.8), rgba(C.orange, 0.8), rgba(C.green, 0.8)],
          hoverBackgroundColor: [C.purple, C.orange, C.green],
          borderWidth: 3,
          borderColor: '#0f172a',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: C.muted, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 14, font: { size: 11, family: FONT } },
          },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.92)',
            borderColor: C.border,
            borderWidth: 1,
            padding: 12,
            titleColor: C.text,
            bodyColor: C.muted,
            callbacks: {
              label: ctx => ` ${ctx.label}: ₹${ctx.parsed.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            },
          },
        },
      },
    });
  }

  /* ── Miniature Sparkline for inventory rows ──────────────────────────── */
  window.renderSparkline = function (container, data, color = C.cyan) {
    if (!container) return;
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = 60;
    canvas.height = 24;
    canvas.style.cssText = 'width:60px;height:24px;display:block;';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map((_, i) => i),
        datasets: [{
          data,
          borderColor: color,
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
          backgroundColor: rgba(color.startsWith('#') ? color : '#3b82f6', 0.12),
        }],
      },
      options: {
        responsive: false,
        animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
        elements: { line: { borderCapStyle: 'round' } },
      },
    });
  };

  /* ── Public Init ─────────────────────────────────────────────────────── */
  window.DashboardCharts = {
    init() {
      renderRevenueChart();
      renderVolumeChart();
      renderHealthChart();
      renderDailyActivity();
      renderCategoryChart();
      renderExpenseChart();
    },
    refresh() {
      this.init();
    },
  };

  /* ── Auto‑boot after data is ready ──────────────────────────────────── */
  const boot = () => window.DashboardCharts.init();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.addEventListener('dataUpdate', boot, { once: true });
      window.addEventListener('syncComplete', boot, { once: true });
      setTimeout(boot, 1500); // fallback
    });
  } else {
    setTimeout(boot, 800);
  }

  window.addEventListener('dataUpdate', () => {
    setTimeout(() => window.DashboardCharts.refresh(), 200);
  });
  window.addEventListener('themeChanged', () => {
    setTimeout(() => window.DashboardCharts.refresh(), 200);
  });

})();
