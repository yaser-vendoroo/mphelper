export const STORAGE_KEY_TESTING = 'vendoroo_wo_helper_jwt';
export const STORAGE_KEY_PROD = 'vendoroo_wo_helper_jwt_prod';
export const SHORTCUT_STORAGE_KEY = 'vendoroo_mphelper_shortcut';
export const IMAGE_ANALYSIS_COPY_STORAGE_KEY = 'vendoroo_mphelper_image_analysis_copy_enabled';
export const DEFAULT_SHORTCUT = 'Ctrl+Shift+M';
export const WORK_ORDER_API_PATH = '/api/WorkOrder';

export const HOST_TESTING = 'testing-marketplace.vendoroo.ai';
export const HOST_PROD = 'marketplace.vendoroo.ai';
export const API_ORIGIN_TESTING = 'api-testing-marketplace.vendoroo.ai';
export const API_ORIGIN_PROD = 'api-marketplace.vendoroo.ai';

export const JWT_MESSAGE_SOURCE = 'mphelper-jwt';

export function isProductionMarketplace() {
    return window.location.hostname === HOST_PROD;
}

export function getEnvConfig() {
    if (isProductionMarketplace()) {
        return {
            apiBase: 'https://' + API_ORIGIN_PROD,
            apiOrigin: API_ORIGIN_PROD,
            pageOrigin: 'https://' + HOST_PROD,
            jwtKey: STORAGE_KEY_PROD
        };
    }
    return {
        apiBase: 'https://' + API_ORIGIN_TESTING,
        apiOrigin: API_ORIGIN_TESTING,
        pageOrigin: 'https://' + HOST_TESTING,
        jwtKey: STORAGE_KEY_TESTING
    };
}

export function getWorkOrderIdFromUrl() {
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = window.location.href.match(uuidRegex);
    return match ? match[0] : null;
}

export function resolveApiOriginFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    if (url.includes(API_ORIGIN_PROD)) return API_ORIGIN_PROD;
    if (url.includes(API_ORIGIN_TESTING)) return API_ORIGIN_TESTING;
    return null;
}
