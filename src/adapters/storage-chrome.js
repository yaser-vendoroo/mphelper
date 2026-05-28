import { ALL_STORAGE_KEYS } from '../shared/storage-api.js';

export function createStorageChrome() {
    const cache = {};

    async function init() {
        const data = await chrome.storage.local.get(ALL_STORAGE_KEYS);
        Object.assign(cache, data);
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;
            for (const [key, change] of Object.entries(changes)) {
                cache[key] = change.newValue;
            }
        });
    }

    return {
        init,
        get(key, defaultValue) {
            if (!(key in cache)) return defaultValue;
            const value = cache[key];
            return value === undefined ? defaultValue : value;
        },
        set(key, value) {
            cache[key] = value;
            chrome.storage.local.set({ [key]: value });
        }
    };
}
