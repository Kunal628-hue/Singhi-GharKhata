import { load, save, STORAGE_PREFIX } from "./storage.js";

const SETTINGS_KEY = "settings";

function getAllAppData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const fullKey = localStorage.key(i);
    if (!fullKey || !fullKey.startsWith(STORAGE_PREFIX)) continue;
    const shortKey = fullKey.slice(STORAGE_PREFIX.length);
    try {
      const raw = localStorage.getItem(fullKey);
      data[shortKey] = raw ? JSON.parse(raw) : null;
    } catch {
      data[shortKey] = null;
    }
  }
  return data;
}

function restoreAppData(data) {
  if (!data || typeof data !== "object") return;

  Object.entries(data).forEach(([shortKey, value]) => {
    try {
      // use shared save helper where possible
      if (shortKey === SETTINGS_KEY) {
        save(SETTINGS_KEY, value ?? {});
      } else {
        localStorage.setItem(STORAGE_PREFIX + shortKey, JSON.stringify(value ?? null));
      }
    } catch (err) {
      console.error("Failed to restore key", shortKey, err);
    }
  });
}

function setStatus(message, isError = false) {
  const el = document.getElementById("settings-status-text");
  if (!el) return;
  el.textContent = message || "";
  el.style.color = isError ? "#b91c1c" : "";
}

export function initSettingsUI() {
  const exportBtn = document.getElementById("settings-export-btn");
  const importBtn = document.getElementById("settings-import-btn");
  const importInput = document.getElementById("settings-import-file");
  const clearBtn = document.getElementById("settings-clear-btn");

  if (!exportBtn && !importBtn && !clearBtn) return; // settings view not present

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      try {
        const data = getAllAppData();
        const payload = {
          app: "Singhi GharKhata",
          version: 1,
          exportedAt: new Date().toISOString(),
          data,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const today = new Date().toISOString().slice(0, 10);
        a.download = `singhi-gharkhata-backup-${today}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setStatus("Backup downloaded.");
      } catch (err) {
        console.error("Export failed", err);
        setStatus("Could not create backup.", true);
      }
    });
  }

  if (importBtn && importInput instanceof HTMLInputElement) {
    importBtn.addEventListener("click", () => {
      importInput.value = "";
      importInput.click();
    });

    importInput.addEventListener("change", () => {
      const file = importInput.files && importInput.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result || "");
          const parsed = JSON.parse(text);
          const data = parsed && typeof parsed === "object" && parsed.data ? parsed.data : parsed;
          restoreAppData(data);
          setStatus("Backup restored. Reloading…");
          setTimeout(() => window.location.reload(), 600);
        } catch (err) {
          console.error("Import failed", err);
          setStatus("Invalid backup file.", true);
        }
      };
      reader.readAsText(file);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const ok = window.confirm(
        "This will delete all GharKhata data stored in this browser (helpers, attendance, milk, payments). Continue?"
      );
      if (!ok) return;

      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(STORAGE_PREFIX)) keysToRemove.push(key);
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        setStatus("All data cleared. Reloading…");
        setTimeout(() => window.location.reload(), 600);
      } catch (err) {
        console.error("Clear failed", err);
        setStatus("Could not clear data.", true);
      }
    });
  }
}
