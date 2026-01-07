import { load, save } from "./storage.js";
import { getHelpers, upsertHelper, generateHelperId, findHelper } from "./helpers.js";

const MILK_KEY = "milk";

function getMilkEntries() {
  return load(MILK_KEY, []);
}

function saveMilkEntries(entries) {
  save(MILK_KEY, entries);
}

function addMilkEntry(entry) {
  const entries = getMilkEntries();
  entries.push(entry);
  saveMilkEntries(entries);
}

function updateMilkEntry(updatedEntry) {
  const entries = getMilkEntries();
  const index = entries.findIndex(e => e.id === updatedEntry.id);
  if (index !== -1) {
    entries[index] = updatedEntry;
    saveMilkEntries(entries);
  }
}

function deleteMilkEntry(id) {
  const entries = getMilkEntries().filter((e) => e.id !== id);
  saveMilkEntries(entries);
}

function renderMilkHelperOptions(selectedId = "") {
  const select = document.getElementById("milk-helper");
  if (!select) return;

  const helpers = getHelpers();
  const milkVendors = helpers.filter((h) => h.role === "Milkman");

  const current = selectedId || select.value || "";
  select.innerHTML = "";

  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "(No specific milkman)";
  select.appendChild(emptyOpt);

  milkVendors.forEach((h) => {
    const opt = document.createElement("option");
    opt.value = h.id;
    opt.textContent = h.name;
    select.appendChild(opt);
  });

  if (current) {
    select.value = current;
  }
}

function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return "₹0";
  return "₹" + Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function renderMilkSummary(month) {
  const card = document.getElementById("milk-summary-card");
  const tbody = document.getElementById("milk-summary-body");
  if (!card || !tbody) return;

  const entries = getMilkEntries().filter((e) => e.date && e.date.startsWith(month));
  if (entries.length === 0) {
    card.style.display = "none";
    return;
  }

  card.style.display = "block";
  tbody.innerHTML = "";

  const helpersById = Object.fromEntries(getHelpers().map((h) => [h.id, h]));
  const summary = {};

  entries.forEach(e => {
    const key = e.helperId || "__unassigned";
    if (!summary[key]) summary[key] = { liters: 0, cost: 0 };

    const l = Number(e.liters) || 0;
    const p = Number(e.pricePerLiter) || 0;
    summary[key].liters += l;
    summary[key].cost += (l * p);
  });

  Object.keys(summary).forEach(key => {
    const name = key === "__unassigned" ? "(No specific milkman)" : helpersById[key]?.name || "Unknown";
    const stats = summary[key];

    const row = document.createElement("tr");
    row.innerHTML = `
        <td>${name}</td>
        <td>${stats.liters.toFixed(1)}</td>
        <td>${formatMoney(stats.cost)}</td>
      `;
    tbody.appendChild(row);
  });
}

function renderMilkTableForMonth(month) {
  renderMilkSummary(month); // Update summary whenever table updates

  const tbody = document.getElementById("milk-table-body");
  const monthLabel = document.getElementById("milk-month-label");
  if (!tbody) return;

  if (monthLabel) monthLabel.textContent = month || "-";

  const helpersById = Object.fromEntries(getHelpers().map((h) => [h.id, h]));
  const entries = getMilkEntries()
    .filter((e) => e.date && e.date.startsWith(month))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  tbody.innerHTML = "";

  if (!entries.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No milk entries for this month.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  entries.forEach((e) => {
    const row = document.createElement("tr");
    const helperName = helpersById[e.helperId]?.name || "-";
    const liters = Number(e.liters) || 0;
    const pricePerLiter = Number(e.pricePerLiter) || 0;
    const cost = liters * pricePerLiter;

    row.innerHTML = `
      <td>${e.date}</td>
      <td>${helperName}</td>
      <td>${liters.toFixed(1)}</td>
      <td>${formatMoney(pricePerLiter)}</td>
      <td>${formatMoney(cost)}</td>
      <td>
      <td>
        <button type="button" class="btn-secondary" data-action="milk-edit" data-id="${e.id}">Edit</button>
        <button type="button" class="btn-secondary" data-action="milk-delete" data-id="${e.id}">Delete</button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

function quickAddMilkman(name) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const helper = {
    id: generateHelperId(),
    name: trimmed,
    role: "Milkman",
    monthlySalary: 0,
    paymentType: "Monthly",
    startDate: new Date().toISOString().slice(0, 10),
  };

  upsertHelper(helper);
  return helper.id;
}

export function initMilkUI() {
  const form = document.getElementById("milk-form");
  const dateInput = document.getElementById("milk-date");
  const helperSelect = document.getElementById("milk-helper");
  const litersInput = document.getElementById("milk-liters");
  const priceInput = document.getElementById("milk-price");
  const tbody = document.getElementById("milk-table-body");
  const monthInput = document.getElementById("month-selector");
  const newHelperInput = document.getElementById("milk-new-helper-name");
  const addHelperBtn = document.getElementById("milk-add-helper-btn");

  let editingId = null;
  const submitBtn = form.querySelector("button[type='submit']");

  if (!form || !dateInput || !litersInput || !priceInput || !tbody || !monthInput) return;

  // Default date: today, but snapped into selected month if different
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const baseMonth = monthInput.value || todayStr.slice(0, 7);
  let defaultDate = todayStr;
  if (!defaultDate.startsWith(baseMonth)) {
    defaultDate = `${baseMonth}-01`;
  }
  dateInput.value = defaultDate;

  renderMilkHelperOptions();

  // Auto-fill price when helper changes
  helperSelect.addEventListener("change", () => {
    const helperId = helperSelect.value;
    if (!helperId) return;

    const helper = findHelper(helperId);
    if (helper && helper.defaultPricePerLiter) {
      priceInput.value = helper.defaultPricePerLiter;
    }
  });

  if (addHelperBtn && newHelperInput) {
    addHelperBtn.addEventListener("click", () => {
      const id = quickAddMilkman(newHelperInput.value || "");
      if (!id) return;
      newHelperInput.value = "";
      renderMilkHelperOptions(id);
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const date = dateInput.value;
    const liters = Number(litersInput.value);
    const pricePerLiter = Number(priceInput.value);
    const helperId = helperSelect?.value || "";

    if (!date) {
      alert("Please select a date.");
      return;
    }
    if (!liters || liters <= 0) {
      alert("Please enter liters.");
      return;
    }

    const entry = {
      id: editingId || "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date,
      helperId: helperId || null,
      liters,
      pricePerLiter: pricePerLiter || 0,
    };

    if (editingId) {
      updateMilkEntry(entry);
      editingId = null;
      submitBtn.textContent = "Save Entry";
    } else {
      addMilkEntry(entry);
    }

    form.reset();
    dateInput.value = date; // keep date
    helperSelect.value = ""; // reset helper
    editingId = null;
    submitBtn.textContent = "Save Entry";

    const month = date.slice(0, 7);
    renderMilkTableForMonth(month);

    window.dispatchEvent(
      new CustomEvent("gharkhata:monthchange", {
        detail: { month },
      })
    );
  });

  tbody.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    // Handle Edit
    const editBtn = target.closest("button[data-action='milk-edit']");
    if (editBtn) {
      const id = editBtn.dataset.id;
      const entries = getMilkEntries();
      const entry = entries.find(e => e.id === id);
      if (entry) {
        dateInput.value = entry.date;
        litersInput.value = entry.liters;
        priceInput.value = entry.pricePerLiter;

        // Ensure helper options are fresh
        renderMilkHelperOptions();
        helperSelect.value = entry.helperId || ""; // Set selected

        editingId = id;
        submitBtn.textContent = "Update Entry";

        // Scroll to form
        form.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    // Handle Delete
    const btn = target.closest("button[data-action='milk-delete']");
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) return;

    if (!window.confirm("Delete this milk entry?")) return;
    deleteMilkEntry(id);

    const month = monthInput.value;
    if (month) {
      renderMilkTableForMonth(month);
      window.dispatchEvent(
        new CustomEvent("gharkhata:monthchange", {
          detail: { month },
        })
      );
    }
  });

  window.addEventListener("gharkhata:monthchange", (event) => {
    const month = event.detail?.month;
    if (!month) return;
    renderMilkTableForMonth(month);
  });

  if (monthInput.value) {
    renderMilkTableForMonth(monthInput.value);
  }
}

export function refreshMilkHelperOptions() {
  renderMilkHelperOptions();
}
