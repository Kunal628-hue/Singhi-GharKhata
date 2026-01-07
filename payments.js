import { load, save } from "./storage.js";
import { getHelpers } from "./helpers.js";

const ATTENDANCE_KEY = "attendance";
const MILK_KEY = "milk";
const PAYMENTS_KEY = "payments";

function getPayments() {
  return load(PAYMENTS_KEY, []);
}

function savePayments(list) {
  save(PAYMENTS_KEY, list);
}

function deletePayment(id) {
  const list = getPayments().filter(p => p.id !== id);
  savePayments(list);
}

function addPayment({ type, helperId = null, month, amount, notes = "" }) {
  const payments = getPayments();
  const now = new Date();
  const entry = {
    id: "p_" + now.getTime().toString(36) + Math.random().toString(36).slice(2, 6),
    date: now.toISOString().slice(0, 10),
    type, // 'salary' | 'milk'
    helperId,
    month, // YYYY-MM
    amount: Number(amount) || 0,
    notes,
  };
  payments.push(entry);
  savePayments(payments);
}

function summarizeAttendanceForMonth(yearMonth) {
  const all = load(ATTENDANCE_KEY, {});
  const summary = {};

  for (const [date, helpersById] of Object.entries(all)) {
    if (!date.startsWith(yearMonth)) continue;

    for (const [helperId, status] of Object.entries(helpersById)) {
      if (!summary[helperId]) {
        summary[helperId] = { present: 0, recordedDays: 0 };
      }

      if (status === "P" || status === "A") {
        summary[helperId].recordedDays += 1;
        if (status === "P") summary[helperId].present += 1;
      }
    }
  }

  return summary;
}

function summarizeMilkForMonth(yearMonth) {
  const entries = load(MILK_KEY, []);
  let totalLiters = 0;
  let totalCost = 0;
  const byHelper = {};

  for (const entry of entries) {
    if (!entry.date || !entry.date.startsWith(yearMonth)) continue;
    const liters = Number(entry.liters) || 0;
    const pricePerLiter = Number(entry.pricePerLiter) || 0;
    const cost = liters * pricePerLiter;
    const key = entry.helperId || "__unassigned";

    totalLiters += liters;
    totalCost += cost;

    if (!byHelper[key]) {
      byHelper[key] = { liters: 0, cost: 0 };
    }
    byHelper[key].liters += liters;
    byHelper[key].cost += cost;
  }

  return { totalLiters, totalCost, byHelper };
}

function getPaidAmount({ type, helperId = null, month }) {
  return getPayments()
    .filter((p) => p.type === type && p.month === month && (helperId ? p.helperId === helperId : true))
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return "₹0";
  return "₹" + Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function renderSalaryTable(month) {
  const tbody = document.getElementById("salary-table-body");
  const label = document.getElementById("payments-month-label");
  const maidsSummaryEl = document.getElementById("maids-summary-text");
  if (!tbody) return;

  if (label) label.textContent = month || "-";

  const helpers = getHelpers().filter(h => h.role !== 'Milkman');
  const attendanceSummary = summarizeAttendanceForMonth(month);

  tbody.innerHTML = "";
  if (maidsSummaryEl) maidsSummaryEl.textContent = "";

  if (!helpers.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent = "No helpers added yet.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  let maidsCount = 0;
  let maidsPresent = 0;
  let maidsRecorded = 0;
  let maidsCalculated = 0;
  let maidsPaid = 0;

  helpers.forEach((helper) => {
    const stats = attendanceSummary[helper.id] || { present: 0, recordedDays: 0 };
    const { present, recordedDays } = stats;

    let calculated = 0;
    if (helper.paymentType === "Monthly") {
      if (recordedDays > 0) {
        calculated = (Number(helper.monthlySalary) || 0) * (present / recordedDays);
      }
    } else {
      // Treat monthlySalary as per-day rate for daily payment type
      calculated = (Number(helper.monthlySalary) || 0) * present;
    }

    const paid = getPaidAmount({ type: "salary", helperId: helper.id, month });
    const outstanding = Math.max(0, calculated - paid);
    const status = outstanding <= 1 ? "Paid" : "Due";
    const statusClass = outstanding <= 1 ? "status-pill paid" : "status-pill due";

    if (helper.role === "Maid") {
      maidsCount += 1;
      maidsPresent += present;
      maidsRecorded += recordedDays;
      maidsCalculated += calculated;
      maidsPaid += paid;
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${helper.name}</td>
      <td>${helper.role}</td>
      <td>${present}/${recordedDays}</td>
      <td>${formatMoney(calculated)}</td>
      <td>${formatMoney(paid)}</td>
      <td>
        <span class="${statusClass}">${status}</span>
        <div class="small-muted">Outstanding: ${formatMoney(outstanding)}</div>
      </td>
      <td>
        <button type="button" class="btn-secondary" data-action="salary-pay" data-id="${helper.id}">
          Add Payment
        </button>
      </td>
    `;

    // Store outstanding on the row for quick access when paying
    row.dataset.helperId = helper.id;
    row.dataset.outstanding = String(outstanding);

    tbody.appendChild(row);
  });

  if (maidsSummaryEl && maidsCount > 0) {
    const outstanding = Math.max(0, maidsCalculated - maidsPaid);
    maidsSummaryEl.textContent = `Maids: ${maidsPresent}/${maidsRecorded || "-"} present-days across ${maidsCount} maid(s). Salary: ${formatMoney(
      maidsCalculated
    )}, Paid: ${formatMoney(maidsPaid)}, Outstanding: ${formatMoney(outstanding)}.`;
  }
}

function renderMilkSummary(month) {
  const { totalLiters, totalCost, byHelper } = summarizeMilkForMonth(month);
  const paid = getPaidAmount({ type: "milk", month });
  const outstanding = Math.max(0, totalCost - paid);

  const litersEl = document.getElementById("milk-total-liters");
  const amountEl = document.getElementById("milk-total-amount");
  const outstandingEl = document.getElementById("milk-outstanding-amount");
  const breakdownBody = document.getElementById("milk-by-helper-body");

  if (litersEl) litersEl.textContent = totalLiters.toFixed(1);
  if (amountEl) amountEl.textContent = formatMoney(totalCost);
  if (outstandingEl) outstandingEl.textContent = formatMoney(outstanding);

  // Render breakdown with individual payment controls
  if (breakdownBody) {
    breakdownBody.innerHTML = "";

    // Header for the table (if not already set in HTML, but we'll append rows)
    // We assume the HTML <thead> has: Milkman, Liters, Amount. We need to add: Paid, Status, Action.
    // Ideally we should update the HTML <thead> too.

    const helpersById = Object.fromEntries(getHelpers().map((h) => [h.id, h]));
    const keys = Object.keys(byHelper);

    if (!keys.length) {
      breakdownBody.innerHTML = `<tr><td colspan="6">No milk entries for this month.</td></tr>`;
    } else {
      keys.forEach((key) => {
        const stats = byHelper[key];
        const name = key === "__unassigned" ? "Unassigned / General" : helpersById[key]?.name || "Unknown";

        // Calculate status per milkman
        const paidForHelper = getPaidAmount({ type: "milk", helperId: key === "__unassigned" ? null : key, month });
        const outstandingForHelper = Math.max(0, stats.cost - paidForHelper);
        const isPaid = outstandingForHelper <= 1;

        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${name}</td>
          <td>${stats.liters.toFixed(1)}</td>
          <td>${formatMoney(stats.cost)}</td>
          <td>${formatMoney(paidForHelper)}</td>
          <td>
             <span class="status-pill ${isPaid ? 'paid' : 'due'}">${isPaid ? 'Paid' : 'Due'}</span>
             <div class="small-muted">Outstanding: ${formatMoney(outstandingForHelper)}</div>
          </td>
          <td>
            <button type="button" class="btn-secondary" data-action="milk-pay" data-id="${key}" ${isPaid ? 'disabled' : ''}>
              Pay Bill
            </button>
          </td>
        `;
        breakdownBody.appendChild(row);
      });
    }
  }

  // Hide global pay button if it exists
  const payBtn = document.getElementById("milk-pay-btn");
  if (payBtn) payBtn.style.display = 'none';
}

function renderPaymentsHistory(month) {
  const tbody = document.getElementById("payments-history-body");
  if (!tbody) return;

  const helpersById = Object.fromEntries(getHelpers().map((h) => [h.id, h]));
  const items = getPayments()
    .filter((p) => (month ? p.month === month : true))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  tbody.innerHTML = "";

  if (!items.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No payments recorded for this month.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  items.forEach((p) => {
    const row = document.createElement("tr");
    const who =
      p.type === "milk"
        ? "Milk bill"
        : helpersById[p.helperId]?.name || "Unknown";

    row.innerHTML = `
      <td>${p.date}</td>
      <td>${p.type === "salary" ? "Salary" : "Milk"}</td>
      <td>${who}</td>
      <td>${p.month}</td>
      <td>${formatMoney(p.amount)}</td>
      <td>
        <button type="button" class="btn-secondary" data-action="payment-delete" data-id="${p.id}">Delete</button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

function renderPaymentsForMonth(month) {
  renderSalaryTable(month);
  renderMilkSummary(month);
  renderPaymentsHistory(month);
}

// --- PDF Export ---

function buildPaymentsPdfHtml(month) {
  const helpers = getHelpers();
  const attendanceSummary = summarizeAttendanceForMonth(month);
  const { totalLiters, totalCost, byHelper } = summarizeMilkForMonth(month);
  const payments = getPayments()
    .filter((p) => (month ? p.month === month : true))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const helpersById = Object.fromEntries(helpers.map((h) => [h.id, h]));

  // Salary rows
  const salaryRows = helpers
    .filter((h) => h.role !== "Milkman")
    .map((helper) => {
      const stats = attendanceSummary[helper.id] || { present: 0, recordedDays: 0 };
      const { present, recordedDays } = stats;

      let calculated = 0;
      if (helper.paymentType === "Monthly") {
        if (recordedDays > 0) {
          calculated = (Number(helper.monthlySalary) || 0) * (present / recordedDays);
        }
      } else {
        calculated = (Number(helper.monthlySalary) || 0) * present;
      }

      const paid = getPaidAmount({ type: "salary", helperId: helper.id, month });
      const outstanding = Math.max(0, calculated - paid);

      return `
        <tr>
          <td>${helper.name}</td>
          <td>${helper.role}</td>
          <td>${present}/${recordedDays}</td>
          <td>${formatMoney(calculated)}</td>
          <td>${formatMoney(paid)}</td>
          <td>${formatMoney(outstanding)}</td>
        </tr>
      `;
    })
    .join("") || `<tr><td colspan="6">No helpers for this month.</td></tr>`;

  // Milk by helper rows
  const milkRows = Object.keys(byHelper || {}).map((key) => {
    const stats = byHelper[key];
    const name = key === "__unassigned" ? "Unassigned / General" : helpersById[key]?.name || "Unknown";
    const paidForHelper = getPaidAmount({ type: "milk", helperId: key === "__unassigned" ? null : key, month });
    const outstandingForHelper = Math.max(0, stats.cost - paidForHelper);

    return `
      <tr>
        <td>${name}</td>
        <td>${stats.liters.toFixed(1)}</td>
        <td>${formatMoney(stats.cost)}</td>
        <td>${formatMoney(paidForHelper)}</td>
        <td>${formatMoney(outstandingForHelper)}</td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="5">No milk entries for this month.</td></tr>`;

  // Payments history rows
  const paymentRows = payments
    .map((p) => {
      const who =
        p.type === "milk"
          ? "Milk bill"
          : helpersById[p.helperId]?.name || "Unknown";
      return `
        <tr>
          <td>${p.date}</td>
          <td>${p.type === "salary" ? "Salary" : "Milk"}</td>
          <td>${who}</td>
          <td>${p.month}</td>
          <td>${formatMoney(p.amount)}</td>
        </tr>
      `;
    })
    .join("") || `<tr><td colspan="5">No payments recorded for this month.</td></tr>`;

  const paidMilk = getPaidAmount({ type: "milk", month });
  const outstandingMilk = Math.max(0, totalCost - paidMilk);

  const prettyMonth = month || "-";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Singhi GharKhata Statement - ${prettyMonth}</title>
  <link rel="stylesheet" href="styles/main.css" />
  <style>
    body { padding: 2rem; background: #fff; }
    h1, h2 { margin-top: 0; }
    .section { margin-bottom: 2rem; }
    .section h2 { margin-bottom: 0.5rem; }
    .muted { font-size: 0.85rem; color: #64748b; }
    @media print {
      body { padding: 0.5in; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <h1>Singhi GharKhata Monthly Statement</h1>
  <p class="muted">Month: <strong>${prettyMonth}</strong></p>

  <div class="section">
    <h2>Salary Overview</h2>
    <table class="table" aria-label="Salary overview PDF">
      <thead>
        <tr>
          <th>Helper</th>
          <th>Role</th>
          <th>Present / Days</th>
          <th>Calculated Salary</th>
          <th>Paid</th>
          <th>Outstanding</th>
        </tr>
      </thead>
      <tbody>
        ${salaryRows}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Milk Bill</h2>
    <p class="muted">Total liters: ${totalLiters.toFixed(1)} • Total amount: ${formatMoney(totalCost)} • Outstanding: ${formatMoney(outstandingMilk)}</p>
    <table class="table" aria-label="Milk overview PDF">
      <thead>
        <tr>
          <th>Milkman</th>
          <th>Total Liters</th>
          <th>Total Amount</th>
          <th>Paid</th>
          <th>Outstanding</th>
        </tr>
      </thead>
      <tbody>
        ${milkRows}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Payment History</h2>
    <table class="table" aria-label="Payment history PDF">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>To / For</th>
          <th>Month</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${paymentRows}
      </tbody>
    </table>
  </div>
</body>
</html>
  `;
}

function openPaymentsPdf(month) {
  const html = buildPaymentsPdfHtml(month);
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 500);
}

export function initPaymentsUI() {
  const salaryTbody = document.getElementById("salary-table-body");
  const milkPayBtn = document.getElementById("milk-pay-btn");
  const monthInput = document.getElementById("month-selector");
  const exportPdfBtn = document.getElementById("payments-export-pdf-btn");

  if (!salaryTbody || !monthInput) return;

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener("click", () => {
      const month = monthInput.value;
      openPaymentsPdf(month);
    });
  }

  // Salary table payment handling
  salaryTbody.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const btn = target.closest("button[data-action=\"salary-pay\"]");
    if (!btn) return;

    const helperId = btn.dataset.id;
    if (!helperId) return;

    const currentMonth = monthInput.value;
    const row = btn.closest("tr");
    const outstanding = row ? Number(row.dataset.outstanding || "0") : 0;

    const defaultAmount = outstanding > 0 ? outstanding.toFixed(2) : "";
    const input = window.prompt("Enter salary payment amount", defaultAmount);
    if (!input) return;

    const amount = Number(input);
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    addPayment({ type: "salary", helperId, month: currentMonth, amount });
    renderPaymentsForMonth(currentMonth);
  });

  // Milk bill payment handling (Individual)
  const milkTableBody = document.getElementById("milk-by-helper-body");
  if (milkTableBody) {
    milkTableBody.addEventListener("click", (event) => {
      const target = event.target;
      const btn = target.closest("button[data-action='milk-pay']");
      if (!btn) return;

      const helperId = btn.dataset.id === "__unassigned" ? null : btn.dataset.id;
      // In the new UI, we don't store "outstanding" on the button easily accessible as dataset (it's in the row but let's recalculate or just prompt)
      // Actually we can just prompt cleanly.

      const row = btn.closest("tr");
      // We can parse the outstanding from the cell or just prompt default
      // Let's just prompt "Enter amount"

      const input = window.prompt("Enter payment amount for this milkman:");
      if (!input) return;

      const amount = Number(input);
      if (!amount || Number.isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount.");
        return;
      }

      const currentMonth = monthInput.value;
      addPayment({ type: "milk", helperId, month: currentMonth, amount });
      renderPaymentsForMonth(currentMonth);
    });
  }

  // React to global month changes
  window.addEventListener("gharkhata:monthchange", (event) => {
    const month = event.detail?.month;
    if (!month) return;
    renderPaymentsForMonth(month);
  });

  renderPaymentsForMonth(monthInput.value);

  // Handle Payment History Delete
  const historyBody = document.getElementById("payments-history-body");
  if (historyBody) {
    historyBody.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action='payment-delete']");
      if (!btn) return;

      if (confirm("Are you sure you want to delete this payment record?")) {
        deletePayment(btn.dataset.id);
        renderPaymentsForMonth(monthInput.value);
      }
    });
  }
}
