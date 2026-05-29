import { createHttpFetch } from '../adapters/http-fetch.js';
import { createStorageChrome } from '../adapters/storage-chrome.js';
import { createClipboardApi } from '../shared/clipboard.js';
import { JWT_MESSAGE_SOURCE, TIMELINE_TIMESTAMPS_ENABLED_KEY } from '../shared/constants.js';
import { createImageAnalysis } from '../shared/image-analysis.js';
import { createStorageApi } from '../shared/storage-api.js';
import { createTimelineTimestamps } from '../shared/timeline-timestamps.js';
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
        const timelineTimestamps = createTimelineTimestamps({ storageApi, workOrderApi });
        const ui = createUI({
            storageApi,
            workOrderApi,
            clipboardApi,
            imageAnalysis,
            timelineTimestamps
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
            if (message.type === 'timeline-timestamps-changed') {
                storageApi.setTimelineTimestampsEnabled(!!message.enabled);
                if (message.tzMode) {
                    storageApi.setTimelineTzMode(message.tzMode);
                    timelineTimestamps.invalidateClientTimeZoneCache();
                }
                if (message.enabled) {
                    timelineTimestamps.scheduleTimelineScan();
                } else {
                    timelineTimestamps.removeTimelineTimestampUI();
                }
                sendResponse({ ok: true });
                return false;
            }
            return false;
        });

        ui.initUI();

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local' || !(TIMELINE_TIMESTAMPS_ENABLED_KEY in changes)) return;
            const enabled = changes[TIMELINE_TIMESTAMPS_ENABLED_KEY].newValue === true;
            storageApi.setTimelineTimestampsEnabled(enabled);
            if (enabled) {
                timelineTimestamps.scheduleTimelineScan();
            } else {
                timelineTimestamps.removeTimelineTimestampUI();
            }
        });
    }

    if (document.body) boot();
    else document.addEventListener('DOMContentLoaded', boot);
})();
