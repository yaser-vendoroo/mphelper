import {
    API_ORIGIN_PROD,
    API_ORIGIN_TESTING,
    DEFAULT_SHORTCUT,
    DEFAULT_TIMELINE_TZ_MODE,
    getEnvConfig,
    IMAGE_ANALYSIS_COPY_STORAGE_KEY,
    SHORTCUT_STORAGE_KEY,
    STORAGE_KEY_PROD,
    STORAGE_KEY_TESTING,
    TIMELINE_TIMESTAMPS_ENABLED_KEY,
    TIMELINE_TZ_MODE_KEY,
    TIMELINE_TZ_MODES
} from './constants.js';

export function createStorageApi(storage) {
    function getStoredJwt() {
        return storage.get(getEnvConfig().jwtKey, '');
    }

    function setStoredJwtForOrigin(apiOrigin, jwt) {
        const key = apiOrigin === API_ORIGIN_PROD ? STORAGE_KEY_PROD : STORAGE_KEY_TESTING;
        storage.set(key, jwt);
    }

    function getStoredShortcut() {
        return storage.get(SHORTCUT_STORAGE_KEY, DEFAULT_SHORTCUT);
    }

    function setStoredShortcut(combo) {
        storage.set(SHORTCUT_STORAGE_KEY, combo);
    }

    function getImageAnalysisCopyEnabled() {
        return storage.get(IMAGE_ANALYSIS_COPY_STORAGE_KEY, false) === true;
    }

    function setImageAnalysisCopyEnabled(enabled) {
        storage.set(IMAGE_ANALYSIS_COPY_STORAGE_KEY, !!enabled);
    }

    function getTimelineTimestampsEnabled() {
        return storage.get(TIMELINE_TIMESTAMPS_ENABLED_KEY, false) === true;
    }

    function setTimelineTimestampsEnabled(enabled) {
        storage.set(TIMELINE_TIMESTAMPS_ENABLED_KEY, !!enabled);
    }

    function getTimelineTzMode() {
        const mode = storage.get(TIMELINE_TZ_MODE_KEY, DEFAULT_TIMELINE_TZ_MODE);
        return TIMELINE_TZ_MODES.includes(mode) ? mode : DEFAULT_TIMELINE_TZ_MODE;
    }

    function setTimelineTzMode(mode) {
        const value = TIMELINE_TZ_MODES.includes(mode) ? mode : DEFAULT_TIMELINE_TZ_MODE;
        storage.set(TIMELINE_TZ_MODE_KEY, value);
    }

    return {
        getStoredJwt,
        setStoredJwtForOrigin,
        getStoredShortcut,
        setStoredShortcut,
        getImageAnalysisCopyEnabled,
        setImageAnalysisCopyEnabled,
        getTimelineTimestampsEnabled,
        setTimelineTimestampsEnabled,
        getTimelineTzMode,
        setTimelineTzMode
    };
}

export const ALL_STORAGE_KEYS = [
    STORAGE_KEY_TESTING,
    STORAGE_KEY_PROD,
    SHORTCUT_STORAGE_KEY,
    IMAGE_ANALYSIS_COPY_STORAGE_KEY,
    TIMELINE_TIMESTAMPS_ENABLED_KEY,
    TIMELINE_TZ_MODE_KEY
];
