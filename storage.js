export const STORAGE_PREFIX = "gharkhata_";

// Active profile id (account). Defaults to "default" until auth sets it.
let ACTIVE_PROFILE_ID = "default";

export function setActiveProfileId(profileId) {
  ACTIVE_PROFILE_ID = profileId ? String(profileId) : "default";
}

export function getActiveProfileId() {
  return ACTIVE_PROFILE_ID;
}

function makeKey(key) {
  // Keys look like: gharkhata_<profile>_<logicalKey>
  return `${STORAGE_PREFIX}${ACTIVE_PROFILE_ID}_${key}`;
}

export function load(key, fallback) {
  try {
    const fullKey = makeKey(key);
    const raw = localStorage.getItem(fullKey);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error("Failed to load from localStorage", key, err);
    return fallback;
  }
}

export function save(key, value) {
  try {
    const fullKey = makeKey(key);
    localStorage.setItem(fullKey, JSON.stringify(value));
  } catch (err) {
    console.error("Failed to save to localStorage", key, err);
  }
}
