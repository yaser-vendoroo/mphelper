import { createHttpFetch } from '../adapters/http-fetch.js';
import { createStorageChrome } from '../adapters/storage-chrome.js';
import { createClipboardApi } from '../shared/clipboard.js';
import { JWT_MESSAGE_SOURCE } from '../shared/constants.js';
import { createImageAnalysis } from '../shared/image-analysis.js';
import { createStorageApi } from '../shared/storage-api.js';
import { createUI } from '../shared/ui.js';
import { createWorkOrderApi } from '../shared/work-order.js';

(function() {
    'use strict';

    function injectPageInterceptor() {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('page-interceptor.js');
        script.onload = () => script.remove();
        (document.head || document.documentElement).appendChild(script);
    }

    injectPageInterceptor();

    const storage = createStorageChrome();
    const storageApiPromise = storage.init().then(() => createStorageApi(storage));

    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        if (event.origin !== window.location.origin) return;
        const data = event.data;
        if (!data || data.source !== JWT_MESSAGE_SOURCE) return;
        if (!data.apiOrigin || !data.token) return;
        storageApiPromise.then((storageApi) => {
            storageApi.setStoredJwtForOrigin(data.apiOrigin, data.token);
        });
    });

    async function boot() {
        const storageApi = await storageApiPromise;
        const http = createHttpFetch();
        const workOrderApi = createWorkOrderApi(http);
        const clipboardApi = createClipboardApi(http);
        const imageAnalysis = createImageAnalysis(storageApi, clipboardApi);
        const ui = createUI({
            storageApi,
            workOrderApi,
            clipboardApi,
            imageAnalysis,
            loadGoogleFonts: false
        });

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (!message || message.source !== 'mphelper-popup') {
                return false;
            }
            if (message.type === 'open-dialog') {
                ui.openDialog();
                sendResponse({ ok: true });
                return false;
            }
            if (message.type === 'image-analysis-copy-changed') {
                storageApi.setImageAnalysisCopyEnabled(!!message.enabled);
                if (message.enabled) {
                    imageAnalysis.scheduleImageAnalysisScan();
                } else {
                    imageAnalysis.removeImageAnalysisCopyUI();
                }
                sendResponse({ ok: true });
                return false;
            }
            return false;
        });

        ui.initUI();
    }

    if (document.body) boot();
    else document.addEventListener('DOMContentLoaded', boot);
})();
