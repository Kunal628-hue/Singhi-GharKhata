import { load, save } from "./storage.js";
import { getHelpers } from "./helpers.js";

const ATTENDANCE_KEY = "attendance";

function getAllAttendance() {
  return load(ATTENDANCE_KEY, {});
}

function saveAllAttendance(all) {
  save(ATTENDANCE_KEY, all);
}

function setAttendance(date, helperId, status) {
  const all = getAllAttendance();
  if (!all[date]) all[date] = {};
  all[date][helperId] = status; // 'P' or 'A'
  saveAllAttendance(all);
}

function getAttendanceForDate(date) {
  const all = getAllAttendance();
  return all[date] || {};
}

function summarizeAttendanceForMonth(yearMonth) {
  const all = getAllAttendance();
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

function renderAttendanceForDate(date) {
  const tbody = document.getElementById("attendance-table-body");
  const summaryEl = document.getElementById("attendance-summary-text");
  if (!tbody || !date) return;

  const helpers = getHelpers().filter(h => h.role !== 'Milkman');
  const map = getAttendanceForDate(date);

  tbody.innerHTML = "";

  if (!helpers.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "No helpers added yet.";
    row.appendChild(cell);
    tbody.appendChild(row);
    if (summaryEl) summaryEl.textContent = "";
    return;
  }

  let presentCount = 0;

  helpers.forEach((helper) => {
    const status = map[helper.id] || "";
    if (status === "P") presentCount += 1;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${helper.name}</td>
      <td>${helper.role}</td>
      <td class="attendance-toggle">
        <button type="button" class="btn-attendance ${status === 'P' ? 'status-present' : status === 'A' ? 'status-absent' : ''}" 
                data-id="${helper.id}" 
                data-status="${status || ''}">
           ${status === 'P' ? 'Present' : status === 'A' ? 'Absent' : 'Mark'}
        </button>
      </td>
    `;

    tbody.appendChild(row);
  });

  if (summaryEl) {
    summaryEl.textContent = `${presentCount} present out of ${helpers.length} helpers on this day.`;
  }
}

function renderMonthlyAttendanceSummary(month) {
  const tbody = document.getElementById("attendance-month-summary-body");
  const label = document.getElementById("attendance-month-label");
  if (!tbody) return;

  if (label) label.textContent = month || "-";

  const helpers = getHelpers().filter((h) => h.role !== "Milkman");
  const summary = summarizeAttendanceForMonth(month);

  tbody.innerHTML = "";

  if (!helpers.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "No helpers added yet.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  helpers.forEach((helper) => {
    const stats = summary[helper.id] || { present: 0, recordedDays: 0 };
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${helper.name}</td>
      <td>${helper.role}</td>
      <td>${stats.present}/${stats.recordedDays || "-"}</td>
    `;
    tbody.appendChild(row);
  });
}

function renderDateStrip(selectedDate) {
  const strip = document.getElementById("attendance-date-strip");
  if (!strip) return;

  strip.innerHTML = "";

  // Determine month from selectedDate
  const dateObj = new Date(selectedDate);
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth(); // 0-indexed

  // Get days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const currentHook = new Date(year, month, day);
    const dayStr = currentHook.toISOString().slice(0, 10);

    // Format: MON\n24
    const dayName = currentHook.toLocaleDateString('en-US', { weekday: 'short' });

    const btn = document.createElement("button");
    btn.type = "button"; // prevent form submit
    btn.className = `date-item ${dayStr === selectedDate ? 'active' : ''}`;
    btn.dataset.date = dayStr;
    btn.innerHTML = `
            <span class="day-name">${dayName}</span>
            <span class="day-number">${day}</span>
        `;

    btn.addEventListener("click", () => {
      const dateInput = document.getElementById("attendance-date");
      dateInput.value = dayStr;
      renderDateStrip(dayStr);
      renderAttendanceForDate(dayStr);

      // Dispatch event for other listeners if needed (though we handle render directly)
      window.dispatchEvent(
        new CustomEvent("gharkhata:datechange", {
          detail: { date: dayStr },
        })
      );
    });

    strip.appendChild(btn);

    // Auto scroll to active
    if (dayStr === selectedDate) {
      setTimeout(() => btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }), 100);
    }
  }
}

export function initAttendanceUI() {
  const dateInput = document.getElementById("attendance-date");
  const tbody = document.getElementById("attendance-table-body");
  if (!dateInput || !tbody) return;

  // Set default date based on selected month
  const monthInput = document.getElementById("month-selector");
  const today = new Date();
  const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const baseMonth = monthInput?.value || todayMonth;

  let defaultDate = today.toISOString().slice(0, 10);
  if (!defaultDate.startsWith(baseMonth)) {
    defaultDate = `${baseMonth}-01`;
  }
  dateInput.value = defaultDate;

  renderDateStrip(defaultDate);
  renderAttendanceForDate(defaultDate);
  renderMonthlyAttendanceSummary(baseMonth);

  // We don't need 'change' event on hidden input if we update programmatically via renderDateStrip
  // But if dateInput changes externally:
  // dateInput.addEventListener("change", ... ); 
  // We'll stick to our strip logic controlling it.


  tbody.addEventListener("click", (event) => {
    const target = event.target;
    // Check if clicked element is our toggle button
    const btn = target.closest("button.btn-attendance");
    if (!btn) return;

    const helperId = btn.dataset.id;
    let currentStatus = btn.dataset.status; // '' | 'P' | 'A'

    // Cycle: '' -> 'P' -> 'A' -> ''
    let newStatus = 'P';
    if (currentStatus === 'P') newStatus = 'A';
    else if (currentStatus === 'A') newStatus = '';

    // Allow direct clear if needed? For now, cycle is fine.
    // Or maybe simpler: P -> A -> P (if they want to clear, maybe long press? or just cycle to empty)
    // Let's stick to P -> A -> Clear

    const date = dateInput.value;
    if (!helperId || !date) return;

    setAttendance(date, helperId, newStatus);

    // Dispatch update for payments
    const month = date.slice(0, 7);
    window.dispatchEvent(
      new CustomEvent("gharkhata:monthchange", {
        detail: { month },
      })
    );

    renderAttendanceForDate(date);
  });

  // When month changes, shift the date input to that month if needed
  window.addEventListener("gharkhata:monthchange", (event) => {
    const month = event.detail?.month;
    if (!month) return;

    // If current selected date is outside this month, snap to 1st of month
    if (!dateInput.value || !dateInput.value.startsWith(month)) {
      dateInput.value = `${month}-01`;
      renderDateStrip(dateInput.value);
      renderAttendanceForDate(dateInput.value);
    }

    // Always refresh monthly summary when month changes
    renderMonthlyAttendanceSummary(month);
  });
}
