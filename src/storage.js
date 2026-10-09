// Safe wrappers: localStorage can throw (private mode, storage full), so never trust it blindly
export function loadNumber(key, fallback = 0) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        const value = Number(raw);
        return Number.isFinite(value) ? value : fallback;
    } catch {
        return fallback;
    }
}

export function saveNumber(key, value) {
    try {
        localStorage.setItem(key, String(value));
    } catch {
        // ignore: the game still works, it just won't remember
    }
}