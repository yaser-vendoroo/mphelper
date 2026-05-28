import { resolveApiOriginFromUrl } from './constants.js';

function captureTokenFromAuthHeader(authHeader, onCapture) {
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        if (token.length > 0) onCapture(token);
    }
}

export function installJwtInterceptorInline(onCaptureWithOrigin) {
    function handleCapture(apiOrigin, authHeader) {
        if (!apiOrigin) return;
        captureTokenFromAuthHeader(authHeader, (token) => onCaptureWithOrigin(apiOrigin, token));
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
                    handleCapture(apiOrigin, auth);
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
            handleCapture(apiOrigin, this._mpHelperAuth);
        }
        return origSend.apply(this, arguments);
    };
}
