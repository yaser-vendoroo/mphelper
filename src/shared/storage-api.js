import {
    API_ORIGIN_PROD,
    API_ORIGIN_TESTING,
    DEFAULT_SHORTCUT,
    getEnvConfig,
    IMAGE_ANALYSIS_COPY_STORAGE_KEY,
    SHORTCUT_STORAGE_KEY,
    STORAGE_KEY_PROD,
    STORAGE_KEY_TESTING
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

    return {
        getStoredJwt,
        setStoredJwtForOrigin,
        getStoredShortcut,
        setStoredShortcut,
        getImageAnalysisCopyEnabled,
        setImageAnalysisCopyEnabled
    };
}

export const ALL_STORAGE_KEYS = [
    STORAGE_KEY_TESTING,
    STORAGE_KEY_PROD,
    SHORTCUT_STORAGE_KEY,
    IMAGE_ANALYSIS_COPY_STORAGE_KEY
];
