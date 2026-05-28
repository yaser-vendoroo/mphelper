(function() {
    'use strict';

    const API_ORIGIN_TESTING = 'api-testing-marketplace.vendoroo.ai';
    const API_ORIGIN_PROD = 'api-marketplace.vendoroo.ai';
    const JWT_MESSAGE_SOURCE = 'mphelper-jwt';

    function resolveApiOriginFromUrl(url) {
        if (!url || typeof url !== 'string') return null;
        if (url.includes(API_ORIGIN_PROD)) return API_ORIGIN_PROD;
        if (url.includes(API_ORIGIN_TESTING)) return API_ORIGIN_TESTING;
        return null;
    }

    function postCapturedToken(apiOrigin, token) {
        window.postMessage({
            source: JWT_MESSAGE_SOURCE,
            apiOrigin,
            token
        }, window.location.origin);
    }

    function captureTokenFromAuthHeader(authHeader, apiOrigin) {
        if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7).trim();
            if (token.length > 0 && apiOrigin) postCapturedToken(apiOrigin, token);
        }
    }

    const origFetch = window.fetch;
    if (origFetch) {
        window.fetch = function(input, init) {
            const url = typeof input === 'string' ? input : (input && input.url);
            const apiOrigin = resolveApiOriginFromUrl(url);
            if (apiOrigin) {
                const headers = init && init.headers;
                if (headers) {
                    const auth = headers instanceof Headers ? headers.get('authorization') : (headers.Authorization || headers.authorization);
                    captureTokenFromAuthHeader(auth, apiOrigin);
                }
            }
            return origFetch.apply(this, arguments);
        };
    }

    const XHR = XMLHttpRequest.prototype;
    const origOpen = XHR.open;
    const origSetRequestHeader = XHR.setRequestHeader;
    const origSend = XHR.send;
    XHR.open = function(_, url) {
        this._mpHelperUrl = url;
        return origOpen.apply(this, arguments);
    };
    XHR.setRequestHeader = function(name, value) {
        if (String(name).toLowerCase() === 'authorization') this._mpHelperAuth = value;
        return origSetRequestHeader.apply(this, arguments);
    };
    XHR.send = function() {
        const apiOrigin = resolveApiOriginFromUrl(this._mpHelperUrl);
        if (apiOrigin && this._mpHelperAuth) {
            captureTokenFromAuthHeader(this._mpHelperAuth, apiOrigin);
        }
        return origSend.apply(this, arguments);
    };
})();
