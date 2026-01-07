const AUTH_KEY = "auth";
const STORAGE_PREFIX = "gharkhata_";

function loadAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAuth(value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + AUTH_KEY, JSON.stringify(value));
  } catch (err) {
    console.error("Failed to save auth state", err);
  }
}

export function getCurrentUser() {
  const auth = loadAuth();
  return auth && auth.user ? auth.user : null;
}

export function logout() {
  try {
    const existing = loadAuth() || {};
    // Keep user, just mark as logged out so they see login screen again
    saveAuth({ ...existing, loggedIn: false });
  } catch (err) {
    console.error("Failed to clear auth state", err);
  }
  // Reload so UI resets to login shell
  window.location.reload();
}

function completeLogin(user, onAuthenticated) {
  const shell = document.getElementById("auth-shell");
  const appRoot = document.getElementById("app-root");

  if (shell) shell.style.display = "none";
  if (appRoot) appRoot.style.display = "flex"; // matches .app layout

  const previous = loadAuth() || {};
  saveAuth({ ...previous, user, loggedIn: true, loggedInAt: new Date().toISOString() });

  if (typeof onAuthenticated === "function") {
    onAuthenticated();
  }
}

export function initAuth(onAuthenticated) {
  const existing = loadAuth();
  const shell = document.getElementById("auth-shell");
  const appRoot = document.getElementById("app-root");

  // If already logged in, skip auth UI
  if (existing && existing.user && existing.loggedIn) {
    if (shell) shell.style.display = "none";
    if (appRoot) appRoot.style.display = "flex";
    if (typeof onAuthenticated === "function") {
      onAuthenticated();
    }
    return;
  }

  if (!shell || !appRoot) {
    // Fallback: no auth shell present, just start app
    if (typeof onAuthenticated === "function") {
      onAuthenticated();
    }
    return;
  }

  const tabs = Array.from(document.querySelectorAll(".auth-tab"));
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");

  // If we have a stored user but loggedIn is false, prefill login name
  if (existing && existing.user && existing.user.name) {
    const loginNameInput = document.getElementById("login-name");
    if (loginNameInput && !loginNameInput.value) {
      loginNameInput.value = existing.user.name;
    }
  }

  function switchMode(mode) {
    tabs.forEach((tab) => {
      const isActive = tab.dataset.mode === mode;
      tab.classList.toggle("auth-tab-active", isActive);
    });

    if (loginForm && signupForm) {
      loginForm.classList.toggle("auth-form-active", mode === "login");
      signupForm.classList.toggle("auth-form-active", mode === "signup");
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const mode = tab.dataset.mode || "login";
      switchMode(mode);
    });
  });

  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const nameInput = document.getElementById("login-name");
      const passwordInput = document.getElementById("login-password");

      const name = nameInput?.value.trim();
      const password = passwordInput?.value || "";

      if (!name || !password) {
        alert("Please enter name and password.");
        return;
      }

      const stored = loadAuth();
      if (!stored || !stored.user || !stored.user.name) {
        alert("No account found. Please sign up first.");
        switchMode("signup");
        return;
      }

      if (stored.user.name !== name || stored.user.password !== password) {
        alert("Incorrect name or password.");
        return;
      }

      // Mark as logged in again but keep same stored user details
      const updated = { ...stored, loggedIn: true, loggedInAt: new Date().toISOString() };
      saveAuth(updated);

      completeLogin({ name, password }, onAuthenticated);
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const nameInput = document.getElementById("signup-name");
      const passwordInput = document.getElementById("signup-password");

      const name = nameInput?.value.trim();
      const password = passwordInput?.value || "";

      if (!name || !password) {
        alert("Please fill in all fields.");
        return;
      }

      if (password.length < 4) {
        alert("Password should be at least 4 characters (for local login).");
        return;
      }

      const user = { name, password };

      // Save user and mark as logged in; keep for future logins
      const existingAuth = loadAuth() || {};
      saveAuth({ ...existingAuth, user, loggedIn: true, loggedInAt: new Date().toISOString() });

      completeLogin(user, onAuthenticated);
    });
  }
}
