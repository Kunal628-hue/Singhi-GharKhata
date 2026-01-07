import { getHelpers } from "./helpers.js";
import { load } from "./storage.js";

function getMonthlyStats(month) {
    // 1. Calculate Helpers/Salaries
    const helpers = getHelpers();
    const attendance = load("attendance", {});
    const payments = load("payments", []);

    let totalSalaries = 0;
    let paidSalaries = 0;

    helpers.forEach(h => {
        // Calculate expected salary
        // Simplified: For now just assume full salary if monthly, or estimate.
        // Better: use same logic as payments.js
        // For dashboard, maybe just "Last Month's" or "Current Month's" outstanding is enough.
        // Let's reuse the logic from payments if possible, but for now we'll duplicate simplified version or move logic to a shared utility.

        // To match payments.js exactly, we really should refactor calculation logic to a shared file.
        // For now, let's just show "Active Helpers" and "Milk Summary".
    });

    // Milk Summary
    const milkEntries = load("milk", []);
    let milkLiters = 0;
    let milkCost = 0;

    milkEntries.forEach(e => {
        if (e.date && e.date.startsWith(month)) {
            milkLiters += Number(e.liters) || 0;
            milkCost += (Number(e.liters) || 0) * (Number(e.pricePerLiter) || 0);
        }
    });

    return {
        activeHelpers: helpers.length,
        milkLiters,
        milkCost
    };
}

export function renderDashboard(month) {
    const container = document.getElementById("view-dashboard");
    if (!container) return;

    const stats = getMonthlyStats(month);

    // Clear generic content if strictly dashboard
    // container.innerHTML = ... (But we need to keep the header structure if it's static HTML)
    // The HTML has `<h1>Dashboard</h1> <p>...</p>`

    // Let's replace the content properly
    container.innerHTML = `
    <!-- Stats Grid -->
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-label">Active Helpers</div>
        <div class="summary-value">${stats.activeHelpers}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Milk (Liters)</div>
        <div class="summary-value">${stats.milkLiters.toFixed(1)} <small>L</small></div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Milk Cost</div>
        <div class="summary-value">₹${stats.milkCost.toFixed(0)}</div>
      </div>
    </div>

    <!-- Charts -->
    <div class="card">
       <h2>Monthly Trends</h2>
       <div style="height: 300px; position: relative; width: 100%;">
         <canvas id="dashboard-chart"></canvas>
       </div>
    </div>
  `;

    // Render Chart
    setTimeout(() => {
        renderChart(month);
    }, 0);
}

function renderChart(month) {
    const ctx = document.getElementById('dashboard-chart');
    if (!ctx || !window.Chart) return;

    // Simple mock data or real daily milk data
    const milkEntries = load("milk", []);
    const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const data = new Array(daysInMonth).fill(0);

    milkEntries.forEach(e => {
        if (e.date && e.date.startsWith(month)) {
            const day = Number(e.date.split('-')[2]);
            if (day) data[day - 1] += Number(e.liters) || 0;
        }
    });

    new window.Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Milk (Liters)',
                data: data,
                borderColor: '#4d5bf9',
                backgroundColor: 'rgba(77, 91, 249, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

export function initDashboardUI() {
    const monthInput = document.getElementById("month-selector");

    if (monthInput && monthInput.value) {
        renderDashboard(monthInput.value);
    }

    window.addEventListener("gharkhata:monthchange", (e) => {
        if (e.detail?.month) renderDashboard(e.detail.month);
    });
}
