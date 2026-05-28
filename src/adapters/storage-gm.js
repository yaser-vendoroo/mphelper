export function createStorageGm() {
    return {
        get(key, defaultValue) {
            return GM_getValue(key, defaultValue);
        },
        set(key, value) {
            GM_setValue(key, value);
        }
    };
}
