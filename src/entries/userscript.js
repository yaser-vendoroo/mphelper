import { createHttpGm } from '../adapters/http-gm.js';
import { createStorageGm } from '../adapters/storage-gm.js';
import { createClipboardApi } from '../shared/clipboard.js';
import { createImageAnalysis } from '../shared/image-analysis.js';
import { installJwtInterceptorInline } from '../shared/jwt-interceptor-inline.js';
import { createStorageApi } from '../shared/storage-api.js';
import { createUI } from '../shared/ui.js';
import { createWorkOrderApi } from '../shared/work-order.js';

(function() {
    'use strict';

    const storage = createStorageGm();
    const storageApi = createStorageApi(storage);
    const http = createHttpGm();
    const workOrderApi = createWorkOrderApi(http);
    const clipboardApi = createClipboardApi(http);
    const imageAnalysis = createImageAnalysis(storageApi, clipboardApi);
    const ui = createUI({
        storageApi,
        workOrderApi,
        clipboardApi,
        imageAnalysis,
        loadGoogleFonts: true
    });

    installJwtInterceptorInline((apiOrigin, token) => {
        storageApi.setStoredJwtForOrigin(apiOrigin, token);
    });

    function boot() {
        ui.initUI();
    }

    if (document.body) boot();
    else document.addEventListener('DOMContentLoaded', boot);
})();
