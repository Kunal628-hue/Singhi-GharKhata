import { getHelpers, upsertHelper, deleteHelper, findHelper, generateHelperId } from "./helpers.js";
import { initAttendanceUI } from "./attendance.js";
import { initMilkUI, refreshMilkHelperOptions } from "./milk.js";
import { initPaymentsUI } from "./payments.js";
import { initDashboardUI, renderDashboard } from "./dashboard.js";
import { initSettingsUI } from "./settings.js";
import { initAuth, getCurrentUser, logout } from "./auth.js";

const SETTINGS_KEY = "settings";
let currentMonth = null;

function loadSettings() {
  try {
    const raw = localStorage.getItem("gharkhata_" + SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  localStorage.setItem("gharkhata_" + SETTINGS_KEY, JSON.stringify(settings));
}

function applyTheme(theme) {
  const finalTheme = theme || "light";
  document.documentElement.setAttribute("data-theme", finalTheme);
}

function initTheme() {
  const settings = loadSettings();
  let theme = settings.theme;

  if (!theme) {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    theme = prefersDark ? "dark" : "light";
  }

  applyTheme(theme);

  const toggleBtn = document.getElementById("theme-toggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const next = current === "light" ? "dark" : "light";
      applyTheme(next);
      saveSettings({ ...settings, theme: next });
    });
  }
}

function initNavigation() {
  const buttons = Array.from(document.querySelectorAll(".nav-btn"));
  const views = Array.from(document.querySelectorAll(".view"));

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.view;

      buttons.forEach((b) => b.classList.toggle("active", b === btn));
      views.forEach((v) => v.classList.toggle("active-view", v.id === `view-${target}`));

      // Update Top Bar Title
      const pageTitle = document.getElementById("page-title-display");
      if (pageTitle) {
        pageTitle.textContent = btn.innerText.trim();
      }

      if (target === "milk") {
        refreshMilkHelperOptions();
      } else if (target === "payments") {
        // Force refresh payments view
        window.dispatchEvent(new CustomEvent("gharkhata:monthchange", { detail: { month: currentMonth } }));
      } else if (target === "dashboard") {
        renderDashboard(currentMonth);
      }
    });
  });
}

function emitMonthChange() {
  if (!currentMonth) return;
  window.dispatchEvent(
    new CustomEvent("gharkhata:monthchange", {
      detail: { month: currentMonth },
    })
  );
}

function initMonthSelector() {
  const input = document.getElementById("month-selector");
  if (!input) return;

  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  if (!input.value) {
    input.value = defaultMonth;
  }

  currentMonth = input.value;
  emitMonthChange();

  input.addEventListener("change", () => {
    if (!input.value) return;
    currentMonth = input.value;
    emitMonthChange();
  });
}

function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return "₹" + Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function renderHelpersTable() {
  const tbody = document.getElementById("helpers-table-body");
  if (!tbody) return;

  const helpers = getHelpers();
  tbody.innerHTML = "";

  if (!helpers.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "No helpers added yet.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  helpers.forEach((helper) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${helper.name}</td>
      <td>${helper.role}</td>
      <td>${formatMoney(helper.monthlySalary)}</td>
      <td>${helper.paymentType}</td>
      <td>${helper.startDate || "-"}</td>
      <td>
        <div class="table-actions">
          <button type="button" data-action="edit" data-id="${helper.id}">Edit</button>
          <button type="button" data-action="delete" data-id="${helper.id}">Delete</button>
        </div>
      </td>
    `;

    tbody.appendChild(row);
  });
}

function initUserBadge() {
  const badge = document.getElementById("user-badge");
  const nameLabel = document.getElementById("user-name-label");
  const logoutBtn = document.getElementById("logout-btn");

  if (!badge || !nameLabel || !logoutBtn) return;

  const user = getCurrentUser();
  if (!user || !user.name) {
    badge.style.display = "none";
    return;
  }

  nameLabel.textContent = user.name;
  badge.style.display = "inline-flex";

  logoutBtn.addEventListener("click", () => {
    logout();
  });
}

function initHelpersUI() {
  const form = document.getElementById("helper-form");
  const idInput = document.getElementById("helper-id");
  const nameInput = document.getElementById("helper-name");
  const roleInput = document.getElementById("helper-role");
  const salaryInput = document.getElementById("helper-salary");
  const salaryRow = document.getElementById("helper-salary-row");
  const pplRow = document.getElementById("helper-ppl-row");
  const pplInput = document.getElementById("helper-ppl");
  const paymentTypeInput = document.getElementById("helper-payment-type");
  const startDateInput = document.getElementById("helper-start-date");
  const resetBtn = document.getElementById("helper-form-reset");
  const tbody = document.getElementById("helpers-table-body");

  if (!form || !tbody) return;

  // Toggle fields based on role
  roleInput.addEventListener("change", () => {
    if (roleInput.value === "Milkman") {
      pplRow.style.display = "block";
      salaryRow.style.display = "none";
      salaryInput.required = false;
    } else {
      pplRow.style.display = "none";
      salaryRow.style.display = "block";
      salaryInput.required = true;
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const id = idInput.value || generateHelperId();
    const helper = {
      id,
      name: nameInput.value.trim(),
      role: roleInput.value,
      monthlySalary: Number(salaryInput.value) || 0,
      defaultPricePerLiter: Number(pplInput.value) || 0,
      paymentType: paymentTypeInput.value,
      startDate: startDateInput.value,
    };

    if (!helper.name || !helper.role) {
      alert("Please enter name and role.");
      return;
    }

    upsertHelper(helper);
    form.reset();
    idInput.value = "";
    renderHelpersTable();
  });

  resetBtn?.addEventListener("click", () => {
    idInput.value = "";
  });

  tbody.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const actionBtn = target.closest("button[data-action]");
    if (!actionBtn) return;

    const action = actionBtn.dataset.action;
    const id = actionBtn.dataset.id;
    if (!id) return;

    if (action === "edit") {
      const helper = findHelper(id);
      if (!helper) return;

      idInput.value = helper.id;
      nameInput.value = helper.name;
      roleInput.value = helper.role;
      salaryInput.value = helper.monthlySalary;
      paymentTypeInput.value = helper.paymentType;
      startDateInput.value = helper.startDate || "";

      // Update PPL field state
      pplInput.value = helper.defaultPricePerLiter || "";

      if (helper.role === "Milkman") {
        pplRow.style.display = "block";
        salaryRow.style.display = "none";
        salaryInput.required = false;
      } else {
        pplRow.style.display = "none";
        salaryRow.style.display = "block";
        salaryInput.required = true;
      }

      nameInput.focus();
    } else if (action === "delete") {
      if (confirm("Delete this helper?")) {
        deleteHelper(id);
        renderHelpersTable();
      }
    }
  });

  renderHelpersTable();
}

function initApp() {
  initTheme();
  initNavigation();
  initMonthSelector();
  initUserBadge();
  initHelpersUI();
  initAttendanceUI();
  initMilkUI();
  initPaymentsUI();
  initDashboardUI();
  initSettingsUI();
}

document.addEventListener("DOMContentLoaded", () => {
  initAuth(() => {
    initApp();
  });
});
