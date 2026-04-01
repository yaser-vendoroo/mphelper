// ==UserScript==
// @name         MPHelper
// @namespace    http://tampermonkey.net/
// @version      2.7.0
// @description  MPHelper - Vendoroo Marketplace WO Number Helper & tools
// @match        https://testing-marketplace.vendoroo.ai/*
// @match        https://marketplace.vendoroo.ai/*
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      api-testing-marketplace.vendoroo.ai
// @connect      api-marketplace.vendoroo.ai
// @connect      fonts.googleapis.com
// @connect      fonts.gstatic.com
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY_TESTING = 'vendoroo_wo_helper_jwt';
    const STORAGE_KEY_PROD = 'vendoroo_wo_helper_jwt_prod';
    const SHORTCUT_STORAGE_KEY = 'vendoroo_mphelper_shortcut';
    const IMAGE_ANALYSIS_COPY_STORAGE_KEY = 'vendoroo_mphelper_image_analysis_copy_enabled';
    const DEFAULT_SHORTCUT = 'Ctrl+Shift+M';
    const WORK_ORDER_API_PATH = '/api/WorkOrder';

    const HOST_TESTING = 'testing-marketplace.vendoroo.ai';
    const HOST_PROD = 'marketplace.vendoroo.ai';
    const API_ORIGIN_TESTING = 'api-testing-marketplace.vendoroo.ai';
    const API_ORIGIN_PROD = 'api-marketplace.vendoroo.ai';

    function isProductionMarketplace() {
        return window.location.hostname === HOST_PROD;
    }

    function getEnvConfig() {
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

    function getStoredJwt() {
        return GM_getValue(getEnvConfig().jwtKey, '');
    }

    function setStoredJwtForOrigin(apiOrigin, jwt) {
        const key = apiOrigin === API_ORIGIN_PROD ? STORAGE_KEY_PROD : STORAGE_KEY_TESTING;
        GM_setValue(key, jwt);
    }

    function getStoredShortcut() {
        return GM_getValue(SHORTCUT_STORAGE_KEY, DEFAULT_SHORTCUT);
    }
    function setStoredShortcut(combo) {
        GM_setValue(SHORTCUT_STORAGE_KEY, combo);
    }
    function getImageAnalysisCopyEnabled() {
        return GM_getValue(IMAGE_ANALYSIS_COPY_STORAGE_KEY, false) === true;
    }
    function setImageAnalysisCopyEnabled(enabled) {
        GM_setValue(IMAGE_ANALYSIS_COPY_STORAGE_KEY, !!enabled);
    }
    function parseShortcut(combo) {
        const parts = String(combo).split('+').map(p => p.trim()).filter(Boolean);
        const mods = ['Ctrl', 'Alt', 'Shift', 'Meta'];
        const key = parts.find(p => !mods.includes(p)) || '';
        return {
            ctrl: parts.includes('Ctrl'),
            alt: parts.includes('Alt'),
            shift: parts.includes('Shift'),
            meta: parts.includes('Meta'),
            key: key.length === 1 ? key.toUpperCase() : key
        };
    }
    function eventToShortcut(ev) {
        const parts = [];
        if (ev.ctrlKey) parts.push('Ctrl');
        if (ev.altKey) parts.push('Alt');
        if (ev.shiftKey) parts.push('Shift');
        if (ev.metaKey) parts.push('Meta');
        const k = ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;
        if (k && !['Control', 'Alt', 'Shift', 'Meta'].includes(ev.key)) parts.push(k);
        return parts.join('+') || '';
    }
    function eventMatchesShortcut(ev, combo) {
        const p = parseShortcut(combo);
        if (!p.key) return false;
        return ev.ctrlKey === p.ctrl && ev.altKey === p.alt && ev.shiftKey === p.shift && ev.metaKey === p.meta &&
            (ev.key === p.key || (ev.key.length === 1 && ev.key.toUpperCase() === p.key));

    }

    function resolveApiOriginFromUrl(url) {
        if (!url || typeof url !== 'string') return null;
        if (url.includes(API_ORIGIN_PROD)) return API_ORIGIN_PROD;
        if (url.includes(API_ORIGIN_TESTING)) return API_ORIGIN_TESTING;
        return null;
    }

    function captureTokenFromAuthHeader(authHeader, apiOrigin) {
        if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7).trim();
            if (token.length > 0 && apiOrigin) setStoredJwtForOrigin(apiOrigin, token);
        }
    }

    function installJwtInterceptor() {
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
        XHR.send = function(body) {
            const apiOrigin = resolveApiOriginFromUrl(this._mpHelperUrl);
            if (apiOrigin && this._mpHelperAuth) {
                captureTokenFromAuthHeader(this._mpHelperAuth, apiOrigin);
            }
            return origSend.apply(this, arguments);
        };
    }
    installJwtInterceptor();

    function getWorkOrderIdFromUrl() {
        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const match = window.location.href.match(uuidRegex);
        return match ? match[0] : null;
    }

    function getWoNumberFromPayload(data) {
        if (data == null || typeof data !== 'object') return null;
        const candidates = [
            data.woNumber,
            data.WoNumber,
            data.wo_number,
            data.workOrderNumber,
            data.WorkOrderNumber
        ];
        if (data.data && typeof data.data === 'object') {
            candidates.push(data.data.woNumber, data.data.WoNumber, data.data.workOrderNumber);
        }
        for (const v of candidates) {
            if (v != null && String(v).trim() !== '') return v;
        }
        return null;
    }

    function getTitleFromPayload(data) {
        if (data == null || typeof data !== 'object') return null;
        const candidates = [
            data.title,
            data.Title,
            data.workOrderTitle,
            data.WorkOrderTitle,
            data.name,
            data.Name,
            data.subject,
            data.Subject
        ];
        if (data.data && typeof data.data === 'object') {
            candidates.push(data.data.title, data.data.Title, data.data.workOrderTitle, data.data.name);
        }
        for (const v of candidates) {
            if (v != null && String(v).trim() !== '') return v;
        }
        return null;
    }

    /** Work order entity id from API (key name varies); used with URL UUID as fallback. */
    function getWorkOrderIdFromPayload(data) {
        if (data == null || typeof data !== 'object') return null;
        const candidates = [
            data.workOrderId,
            data.WorkOrderId,
            data.work_order_id,
            data.id,
            data.Id,
            data.ID,
            data.requestId,
            data.RequestId,
            data.guid,
            data.Guid,
            data.uuid,
            data.Uuid
        ];
        if (data.data && typeof data.data === 'object') {
            const d = data.data;
            candidates.push(
                d.workOrderId, d.WorkOrderId, d.work_order_id,
                d.id, d.Id, d.requestId, d.RequestId, d.guid, d.Guid
            );
        }
        for (const v of candidates) {
            if (v != null && String(v).trim() !== '') return String(v).trim();
        }
        return null;
    }

    /** Resident user id from API (e.g. data.aiResidentComData.resident.userId). */
    function getResidentUserIdFromPayload(data) {
        if (data == null || typeof data !== 'object') return null;
        const candidates = [
            data.residentUserId,
            data.resident_user_id,
            data.ResidentUserId
        ];
        const inner = data.data && typeof data.data === 'object' ? data.data : null;
        if (inner) {
            candidates.push(inner.residentUserId, inner.resident_user_id, inner.ResidentUserId);
            const arc = inner.aiResidentComData;
            if (arc && arc.resident && arc.resident.userId != null) {
                candidates.push(arc.resident.userId);
            }
        }
        const arc = data.aiResidentComData;
        if (arc && arc.resident && arc.resident.userId != null) {
            candidates.push(arc.resident.userId);
        }
        for (const v of candidates) {
            if (v != null && String(v).trim() !== '') return String(v).trim();
        }
        return null;
    }

    function getWorkOrderApiUrl(workOrderId) {
        const base = getEnvConfig().apiBase;
        return workOrderId ? `${base}${WORK_ORDER_API_PATH}/${workOrderId}` : `${base}${WORK_ORDER_API_PATH}/{id}`;
    }

    function fetchWorkOrder(workOrderId, jwt) {
        const cfg = getEnvConfig();
        const url = getWorkOrderApiUrl(workOrderId);
        const page = cfg.pageOrigin;
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                headers: {
                    'accept': 'application/json',
                    'authorization': `Bearer ${jwt}`,
                    'origin': page,
                    'referer': page + '/'
                },
                onload: (res) => {
                    try {
                        if (res.status < 200 || res.status >= 300) {
                            const msg = res.responseText ? res.responseText.slice(0, 200) : res.statusText;
                            reject(new Error(`HTTP ${res.status}: ${msg}`));
                            return;
                        }
                        const data = JSON.parse(res.responseText);
                        resolve({
                            woNumber: getWoNumberFromPayload(data),
                            title: getTitleFromPayload(data),
                            workOrderId: getWorkOrderIdFromPayload(data),
                            residentUserId: getResidentUserIdFromPayload(data),
                            rawResponse: res.responseText
                        });
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: () => reject(new Error('Network error'))
            });
        });
    }

    function copyToClipboard(text) {
        return navigator.clipboard.writeText(text);
    }

    const IMAGE_REVIEW_TASKS_AND_DESC = `Tasks:
1) Rate how accurate and complete the description is compared to what you see in the image, on a scale of 1–10 (10 = fully accurate and complete).
2) Give a short bullet list: what matches the image, what is missing or wrong, and any overclaims.

Automated description:
---
`;

    const IMAGE_REVIEW_PROMPT_SEPARATE = `You are reviewing a resident-submitted maintenance photo and an automated image description (from another system).

I pasted the photo and this text as two separate clipboard pastes — use the image from the other paste in this same chat together with the automated description below.

` + IMAGE_REVIEW_TASKS_AND_DESC;

    const IMAGE_REVIEW_PROMPT_COMBINED = `You are reviewing a resident-submitted maintenance photo and an automated image description (from another system).

This paste may include both the photo and the text below in one clipboard entry — use the image together with the automated description.

` + IMAGE_REVIEW_TASKS_AND_DESC;

    const IMAGE_REVIEW_PROMPT_SUFFIX = `
---

Respond in this shape:
Score: X/10
- bullet
- bullet
`;

    function buildImageReviewClipboardText(analysisText, imageLabel, combinedPaste) {
        const body = (analysisText || '').trim() || '(no analysis text found)';
        const label = imageLabel ? `Image file name: ${imageLabel}\n\n` : '';
        const head = combinedPaste ? IMAGE_REVIEW_PROMPT_COMBINED : IMAGE_REVIEW_PROMPT_SEPARATE;
        return label + head + body + IMAGE_REVIEW_PROMPT_SUFFIX;
    }

    function parseContentTypeFromGmHeaders(headers) {
        if (!headers || typeof headers !== 'string') return '';
        const lines = headers.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const m = lines[i].match(/^content-type:\s*(.+)$/i);
            if (m) return m[1].split(';')[0].trim().toLowerCase();
        }
        return '';
    }

    function inferImageMimeFromUrl(url) {
        const u = String(url || '').toLowerCase();
        if (u.includes('.png')) return 'image/png';
        if (u.includes('.webp')) return 'image/webp';
        if (u.includes('.gif')) return 'image/gif';
        return 'image/jpeg';
    }

    /** Tampermonkey: arraybuffer + Content-Type is more reliable than responseType blob. */
    function fetchUrlAsImageBlob(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType: 'arraybuffer',
                onload: (res) => {
                    if (res.status < 200 || res.status >= 300) {
                        reject(new Error(`HTTP ${res.status}`));
                        return;
                    }
                    const buf = res.response;
                    if (!buf || buf.byteLength === 0) {
                        reject(new Error('Empty image'));
                        return;
                    }
                    let ct = parseContentTypeFromGmHeaders(res.responseHeaders);
                    if (!ct || ct === 'application/octet-stream') {
                        ct = inferImageMimeFromUrl(url);
                    }
                    resolve(new Blob([buf], { type: ct }));
                },
                onerror: () => reject(new Error('Network error')),
                ontimeout: () => reject(new Error('Timeout'))
            });
        });
    }

    function normalizeImageBlobType(blob, urlHint) {
        let t = blob.type && String(blob.type).toLowerCase().split(';')[0].trim();
        if (t === 'image/jpeg' || t === 'image/jpg' || t === 'image/png' || t === 'image/gif' || t === 'image/webp') {
            if (t === 'image/jpg') t = 'image/jpeg';
            return t === blob.type ? blob : blob.slice(0, blob.size, t);
        }
        const u = (urlHint || '').toLowerCase();
        if (u.includes('.png')) return blob.slice(0, blob.size, 'image/png');
        if (u.includes('.webp')) return blob.slice(0, blob.size, 'image/webp');
        if (u.includes('.gif')) return blob.slice(0, blob.size, 'image/gif');
        return blob.slice(0, blob.size, 'image/jpeg');
    }

    /** Clipboard API expects IANA names; image/jpg is invalid. Only png/jpeg are widely writable. */
    function mimeForClipboardWrite(blobType) {
        const t = (blobType || '').toLowerCase().split(';')[0].trim();
        if (t === 'image/jpg' || t === 'image/pjpeg') return 'image/jpeg';
        if (t === 'image/jpeg' || t === 'image/png') return t;
        return null;
    }

    async function blobToPngForClipboard(blob) {
        const bmp = await createImageBitmap(blob);
        try {
            const canvas = document.createElement('canvas');
            canvas.width = bmp.width;
            canvas.height = bmp.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bmp, 0, 0);
            return await new Promise((resolve, reject) => {
                canvas.toBlob((b) => {
                    if (b && b.size > 0) resolve(b);
                    else reject(new Error('PNG encode failed'));
                }, 'image/png');
            });
        } finally {
            bmp.close();
        }
    }

    async function getClipboardReadyImage(img) {
        const src = img.currentSrc || img.src;
        if (!src) throw new Error('No image URL');
        const rawBlob = await fetchUrlAsImageBlob(src);
        let imageBlob = normalizeImageBlobType(rawBlob, src);
        let writeMime = mimeForClipboardWrite(imageBlob.type);
        if (!writeMime) {
            imageBlob = await blobToPngForClipboard(imageBlob);
            writeMime = 'image/png';
        }
        return { imageBlob, writeMime };
    }

    /**
     * One ClipboardItem with image + text/plain (some apps still paste only text).
     * Falls back to text-only if combined write fails.
     */
    async function copyImageAndPromptCombined(img, analysisText) {
        const alt = img.getAttribute('alt') || '';
        const textCombined = buildImageReviewClipboardText(analysisText, alt, true);
        const textBlob = new Blob([textCombined], { type: 'text/plain;charset=utf-8' });
        const textSeparate = buildImageReviewClipboardText(analysisText, alt, false);

        if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
            await copyToClipboard(textSeparate);
            return { mode: 'text-only', reason: 'clipboard-api' };
        }

        let imageBlob;
        let writeMime;
        try {
            ({ imageBlob, writeMime } = await getClipboardReadyImage(img));
        } catch (fetchErr) {
            await copyToClipboard(textSeparate);
            return { mode: 'text-only', reason: 'image-fetch' };
        }

        const writeCombined = (ib, mime) =>
            navigator.clipboard.write([
                new ClipboardItem({
                    [mime]: Promise.resolve(ib),
                    'text/plain': Promise.resolve(textBlob)
                })
            ]);

        try {
            await writeCombined(imageBlob, writeMime);
            return { mode: 'combined' };
        } catch (firstErr) {
            if (writeMime !== 'image/png') {
                try {
                    const pngBlob = await blobToPngForClipboard(imageBlob);
                    await writeCombined(pngBlob, 'image/png');
                    return { mode: 'combined' };
                } catch (pngErr) {
                    /* fall through */
                }
            }
            try {
                await copyToClipboard(textSeparate);
                return { mode: 'text-only', reason: 'combined-write' };
            } catch (textErr) {
                throw textErr;
            }
        }
    }

    function findAnalysisTextForRequestImage(img) {
        let row = img.closest('div.flex');
        if (!row) return '';
        let p = row.querySelector('p');
        if (p && p.textContent) return p.textContent.trim();
        const aside = row.querySelector('.float-right');
        if (aside) {
            p = aside.querySelector('p');
            if (p && p.textContent) return p.textContent.trim();
        }
        return '';
    }

    function markInjected(el) {
        el.setAttribute('data-mphelper-image-copy', '1');
    }
    function isInjected(el) {
        return el.getAttribute('data-mphelper-image-copy') === '1';
    }

    function removeImageAnalysisCopyUI() {
        document.querySelectorAll('.vendoroo-mphelper-image-analysis-actions').forEach((el) => el.remove());
        document.querySelectorAll('img[data-mphelper-image-copy="1"]').forEach((im) => im.removeAttribute('data-mphelper-image-copy'));
    }

    function injectImageAnalysisCopyButton(img) {
        if (!getImageAnalysisCopyEnabled()) return;
        if (!img || img.tagName !== 'IMG' || isInjected(img)) return;
        const row = img.closest('div.flex');
        if (!row) return;

        markInjected(img);
        const wrap = document.createElement('div');
        wrap.className = 'vendoroo-mphelper-image-analysis-actions';

        const defaultLabel = 'Copy for AI review';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'vendoroo-mphelper-image-analysis-copy';
        btn.textContent = defaultLabel;
        btn.title = 'Copy image and LLM prompt together (one clipboard entry; some apps paste only text)';

        let resetTimer = null;
        function flash(className, label, ms) {
            btn.classList.remove('vendoroo-mphelper-copy-done', 'vendoroo-mphelper-copy-fail');
            if (className) btn.classList.add(className);
            btn.textContent = label;
            if (resetTimer) clearTimeout(resetTimer);
            resetTimer = setTimeout(() => {
                btn.classList.remove('vendoroo-mphelper-copy-done', 'vendoroo-mphelper-copy-fail');
                btn.textContent = defaultLabel;
            }, ms);
        }

        btn.addEventListener('click', async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const analysis = findAnalysisTextForRequestImage(img);
            btn.disabled = true;
            try {
                const result = await copyImageAndPromptCombined(img, analysis);
                if (result.mode === 'combined') {
                    flash('vendoroo-mphelper-copy-done', 'Copied (image + text)', 2400);
                } else {
                    flash('vendoroo-mphelper-copy-done', 'Copied text only', 3200);
                }
            } catch (err) {
                flash('vendoroo-mphelper-copy-fail', 'Copy failed', 2500);
            } finally {
                btn.disabled = false;
            }
        });

        wrap.appendChild(btn);
        row.appendChild(wrap);
    }

    function scanImageAnalysisCopyTargets() {
        if (!getImageAnalysisCopyEnabled()) {
            removeImageAnalysisCopyUI();
            return;
        }
        document.querySelectorAll('img[data-id="request-files-image"]').forEach(injectImageAnalysisCopyButton);
    }

    let imageAnalysisScanScheduled = false;
    function scheduleImageAnalysisScan() {
        if (imageAnalysisScanScheduled) return;
        imageAnalysisScanScheduled = true;
        requestAnimationFrame(() => {
            imageAnalysisScanScheduled = false;
            scanImageAnalysisCopyTargets();
        });
    }

    function installImageAnalysisCopyObserver() {
        if (!document.body) return;
        scanImageAnalysisCopyTargets();
        const obs = new MutationObserver(() => scheduleImageAnalysisScan());
        obs.observe(document.body, { childList: true, subtree: true });
    }

    function injectMaterialStyles() {
        if (document.getElementById('vendoroo-mphelper-styles')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap';
        document.head.appendChild(link);
        const style = document.createElement('style');
        style.id = 'vendoroo-mphelper-styles';
        style.textContent = `
            #vendoroo-wo-helper-overlay, .vendoroo-mphelper-fab {
                --md-sys-color-primary: #6750a4;
                --md-sys-color-on-primary: #fff;
                --md-sys-color-primary-container: #eaddff;
                --md-sys-color-on-primary-container: #21005d;
                --md-sys-color-surface: #fef7ff;
                --md-sys-color-surface-dim: #ded8e1;
                --md-sys-color-outline: #79747e;
                --md-sys-color-outline-variant: #e7e0ec;
                --md-elevation-1: 0 1px 2px rgba(0,0,0,.3), 0 1px 3px 1px rgba(0,0,0,.15);
                --md-elevation-2: 0 2px 6px 2px rgba(0,0,0,.15), 0 1px 2px rgba(0,0,0,.2);
                --md-elevation-3: 0 4px 8px -2px rgba(0,0,0,.2), 0 2px 4px -2px rgba(0,0,0,.14);
                --md-shape-full: 9999px;
                --md-shape-extra-small: 4px;
                --md-shape-small: 8px;
                --md-shape-medium: 12px;
                --md-shape-large: 16px;
            }
            .vendoroo-mphelper-fab {
                font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 999999;
                width: 56px;
                height: 56px;
                padding: 0;
                border-radius: var(--md-shape-large);
                border: none;
                background: var(--md-sys-color-primary);
                color: var(--md-sys-color-on-primary);
                cursor: pointer;
                box-shadow: var(--md-elevation-3);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: box-shadow .2s, transform .1s;
            }
            .vendoroo-mphelper-fab:hover {
                box-shadow: 0 6px 10px -2px rgba(0,0,0,.2), 0 3px 6px -2px rgba(0,0,0,.14);
            }
            .vendoroo-mphelper-fab:active {
                transform: scale(0.98);
            }
            #vendoroo-wo-helper-overlay {
                font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            #vendoroo-wo-helper-overlay .vendoroo-dialog-scrim {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,.32);
                z-index: 1000000;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            #vendoroo-wo-helper-overlay .vendoroo-dialog-surface {
                background: var(--md-sys-color-surface, #fef7ff);
                border-radius: 28px;
                padding: 24px 24px 28px;
                min-width: 360px;
                max-width: 90vw;
                box-shadow: var(--md-elevation-3, 0 4px 8px -2px rgba(0,0,0,.2));
                position: relative;
                z-index: 1000001;
            }
            #vendoroo-wo-helper-overlay .vendoroo-dialog-title {
                margin: 0 0 20px;
                font-size: 22px;
                font-weight: 500;
                letter-spacing: 0;
                line-height: 28px;
                color: rgba(0,0,0,.87);
            }
            #vendoroo-wo-helper-overlay .vendoroo-row {
                margin-bottom: 16px;
            }
            #vendoroo-wo-helper-overlay .vendoroo-row-label {
                display: block;
                font-size: 12px;
                font-weight: 500;
                letter-spacing: .5px;
                color: rgba(0,0,0,.6);
                margin-bottom: 4px;
            }
            #vendoroo-wo-helper-overlay .vendoroo-chip {
                display: inline-block;
                padding: 8px 16px;
                border-radius: var(--md-shape-small, 8px);
                background: var(--md-sys-color-primary-container, #eaddff);
                color: var(--md-sys-color-on-primary-container, #21005d);
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                border: none;
                transition: background .2s, box-shadow .15s;
                box-shadow: none;
            }
            #vendoroo-wo-helper-overlay .vendoroo-chip:hover {
                background: #d4c4ed;
                box-shadow: var(--md-elevation-1, 0 1px 2px rgba(0,0,0,.3));
            }
            #vendoroo-wo-helper-overlay .vendoroo-chip:active {
                box-shadow: none;
            }
            #vendoroo-wo-helper-overlay .vendoroo-chip.vendoroo-chip-empty {
                background: var(--md-sys-color-surface-dim, #eee);
                color: rgba(0,0,0,.38);
                cursor: default;
            }
            #vendoroo-wo-helper-overlay .vendoroo-chip.vendoroo-chip-empty:hover {
                box-shadow: none;
            }
            #vendoroo-wo-helper-overlay .vendoroo-actions {
                margin-top: 24px;
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                justify-content: flex-end;
            }
            #vendoroo-wo-helper-overlay .vendoroo-btn {
                font-family: inherit;
                font-size: 14px;
                font-weight: 500;
                letter-spacing: .1px;
                padding: 10px 24px;
                border-radius: var(--md-shape-full, 9999px);
                border: none;
                cursor: pointer;
                transition: box-shadow .2s, background .2s;
            }
            #vendoroo-wo-helper-overlay .vendoroo-btn-filled {
                background: var(--md-sys-color-primary, #6750a4);
                color: var(--md-sys-color-on-primary, #fff);
                box-shadow: var(--md-elevation-1, 0 1px 2px rgba(0,0,0,.3));
            }
            #vendoroo-wo-helper-overlay .vendoroo-btn-filled:hover {
                box-shadow: var(--md-elevation-2, 0 2px 6px 2px rgba(0,0,0,.15));
            }
            #vendoroo-wo-helper-overlay .vendoroo-btn-text {
                background: transparent;
                color: var(--md-sys-color-primary, #6750a4);
            }
            #vendoroo-wo-helper-overlay .vendoroo-btn-text:hover {
                background: rgba(103,80,164,.08);
            }
            #vendoroo-wo-helper-overlay .vendoroo-status {
                margin-top: 8px;
                font-size: 12px;
                color: rgba(0,0,0,.6);
                min-height: 20px;
            }
            #vendoroo-wo-helper-overlay .vendoroo-shortcut-row {
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            #vendoroo-wo-helper-overlay .vendoroo-shortcut-label {
                font-size: 14px;
                font-weight: 500;
                color: rgba(0,0,0,.87);
            }
            #vendoroo-wo-helper-overlay .vendoroo-shortcut-badge {
                padding: 6px 12px;
                border-radius: var(--md-shape-extra-small, 4px);
                background: var(--md-sys-color-outline-variant, #e7e0ec);
                font-size: 13px;
                font-weight: 500;
            }
            .vendoroo-mphelper-image-analysis-actions {
                display: flex;
                flex-direction: column;
                align-items: stretch;
                gap: 6px;
                flex-shrink: 0;
                align-self: flex-start;
                margin-left: auto;
            }
            .vendoroo-mphelper-image-analysis-copy {
                font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                padding: 6px 12px;
                font-size: 12px;
                font-weight: 500;
                color: var(--md-sys-color-primary, #6750a4);
                background: rgba(103, 80, 164, 0.08);
                border: 1px solid rgba(103, 80, 164, 0.35);
                border-radius: var(--md-shape-small, 8px);
                cursor: pointer;
                transition: background .15s, box-shadow .15s;
                white-space: nowrap;
            }
            .vendoroo-mphelper-image-analysis-copy:hover {
                background: rgba(103, 80, 164, 0.14);
                box-shadow: var(--md-elevation-1, 0 1px 2px rgba(0,0,0,.2));
            }
            .vendoroo-mphelper-image-analysis-copy:active {
                transform: scale(0.98);
            }
            .vendoroo-mphelper-image-analysis-copy.vendoroo-mphelper-copy-done {
                color: #1b5e20;
                border-color: #a5d6a7;
                background: #e8f5e9;
            }
            .vendoroo-mphelper-image-analysis-copy.vendoroo-mphelper-copy-fail {
                color: #b71c1c;
                border-color: #ef9a9a;
                background: #ffebee;
            }
        `;
        document.head.appendChild(style);
    }

    function makeClickableRow(label, value, statusEl) {
        const wrap = document.createElement('div');
        wrap.className = 'vendoroo-row';
        const labelEl = document.createElement('span');
        labelEl.className = 'vendoroo-row-label';
        labelEl.textContent = label;
        const valueSpan = document.createElement('span');
        valueSpan.className = 'vendoroo-chip';
        const isEmpty = value == null || value === '';
        if (isEmpty) valueSpan.classList.add('vendoroo-chip-empty');
        valueSpan.textContent = value != null && value !== '' ? String(value) : '—';
        valueSpan.title = isEmpty ? '' : 'Click to copy';
        valueSpan.onclick = async () => {
            const text = valueSpan.textContent && valueSpan.textContent !== '—' && valueSpan.textContent !== 'Loading...' ? valueSpan.textContent : '';
            if (!text) return;
            try {
                await copyToClipboard(text);
                if (statusEl) statusEl.textContent = 'Copied!';
                setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 1500);
            } catch (e) {
                if (statusEl) statusEl.textContent = 'Copy failed';
            }
        };
        wrap.append(labelEl, valueSpan);
        return { wrap, valueSpan };
    }

    const ICON_FLOAT = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';

    function createFloatingButton() {
        const btn = document.createElement('button');
        btn.className = 'vendoroo-mphelper-fab';
        btn.innerHTML = ICON_FLOAT;
        btn.title = 'MPHelper – Vendoroo Marketplace Helper';
        return btn;
    }

    function openDialog() {
        injectMaterialStyles();

        const overlay = document.createElement('div');
        overlay.id = 'vendoroo-wo-helper-overlay';

        const scrim = document.createElement('div');
        scrim.className = 'vendoroo-dialog-scrim';

        const dialog = document.createElement('div');
        dialog.className = 'vendoroo-dialog-surface';

        const title = document.createElement('h2');
        title.className = 'vendoroo-dialog-title';
        title.textContent = 'MPHelper';

        const requestId = getWorkOrderIdFromUrl();
        const status = document.createElement('div');
        status.className = 'vendoroo-status';

        const rowRequestId = makeClickableRow('Request ID', requestId, status);
        const rowTitle = makeClickableRow('Work order title', null, status);
        const rowWorkOrderId = makeClickableRow('Work order ID', null, status);
        const rowWoNumber = makeClickableRow('Work order number', null, status);
        const rowResidentUserId = makeClickableRow('Resident user ID', null, status);
        if (requestId) {
            rowTitle.valueSpan.textContent = 'Loading...';
            rowTitle.valueSpan.classList.remove('vendoroo-chip-empty');
            rowWorkOrderId.valueSpan.textContent = 'Loading...';
            rowWorkOrderId.valueSpan.classList.remove('vendoroo-chip-empty');
            rowWoNumber.valueSpan.textContent = 'Loading...';
            rowWoNumber.valueSpan.classList.remove('vendoroo-chip-empty');
            rowResidentUserId.valueSpan.textContent = 'Loading...';
            rowResidentUserId.valueSpan.classList.remove('vendoroo-chip-empty');
        }

        let lastRawResponse = null;
        const copyApiResponseBtn = document.createElement('button');
        copyApiResponseBtn.className = 'vendoroo-btn vendoroo-btn-text';
        copyApiResponseBtn.textContent = 'Copy API Response';
        copyApiResponseBtn.onclick = async () => {
            if (lastRawResponse == null) {
                status.textContent = 'No API response yet — load a work order first';
                setTimeout(() => { status.textContent = ''; }, 2500);
                return;
            }
            try {
                await copyToClipboard(lastRawResponse);
                status.textContent = 'API response copied to clipboard';
                setTimeout(() => { status.textContent = ''; }, 2000);
            } catch (e) {
                status.textContent = 'Copy failed';
            }
        };

        const shortcutRow = document.createElement('div');
        shortcutRow.className = 'vendoroo-shortcut-row';
        const shortcutLabel = document.createElement('span');
        shortcutLabel.className = 'vendoroo-shortcut-label';
        shortcutLabel.textContent = 'Shortcut';
        const shortcutDisplay = document.createElement('span');
        shortcutDisplay.className = 'vendoroo-shortcut-badge';
        shortcutDisplay.textContent = getStoredShortcut();
        const changeShortcutBtn = document.createElement('button');
        changeShortcutBtn.className = 'vendoroo-btn vendoroo-btn-text';
        changeShortcutBtn.textContent = 'Change';

        function updateShortcutDisplay() {
            shortcutDisplay.textContent = getStoredShortcut();
        }
        function startRecordingShortcut() {
            status.textContent = 'Press shortcut... (Esc to cancel)';
            const onKey = function(ev) {
                ev.preventDefault();
                ev.stopPropagation();
                if (ev.key === 'Escape') {
                    status.textContent = '';
                    document.removeEventListener('keydown', onKey, true);
                    return;
                }
                const combo = eventToShortcut(ev);
                if (combo) {
                    setStoredShortcut(combo);
                    updateShortcutDisplay();
                    status.textContent = 'Shortcut saved.';
                    document.removeEventListener('keydown', onKey, true);
                    setTimeout(() => { status.textContent = ''; }, 2000);
                }
            };
            document.addEventListener('keydown', onKey, true);
        }
        changeShortcutBtn.onclick = startRecordingShortcut;
        shortcutRow.append(shortcutLabel, shortcutDisplay, changeShortcutBtn);

        const imageCopyRow = document.createElement('div');
        imageCopyRow.className = 'vendoroo-shortcut-row';
        const imageCopyLabel = document.createElement('span');
        imageCopyLabel.className = 'vendoroo-shortcut-label';
        imageCopyLabel.textContent = 'Image analysis copy';
        const imageCopyToggle = document.createElement('button');
        imageCopyToggle.type = 'button';
        imageCopyToggle.className = 'vendoroo-btn vendoroo-btn-text';
        imageCopyToggle.setAttribute('role', 'switch');
        function syncImageCopyToggle() {
            const on = getImageAnalysisCopyEnabled();
            imageCopyToggle.textContent = on ? 'On' : 'Off';
            imageCopyToggle.setAttribute('aria-checked', on ? 'true' : 'false');
        }
        syncImageCopyToggle();
        imageCopyToggle.onclick = () => {
            const next = !getImageAnalysisCopyEnabled();
            setImageAnalysisCopyEnabled(next);
            syncImageCopyToggle();
            if (next) {
                scheduleImageAnalysisScan();
            } else {
                removeImageAnalysisCopyUI();
            }
            status.textContent = next ? 'Image analysis copy enabled' : 'Image analysis copy disabled';
            setTimeout(() => { status.textContent = ''; }, 2000);
        };
        imageCopyRow.append(imageCopyLabel, imageCopyToggle);

        const buttonRow = document.createElement('div');
        buttonRow.className = 'vendoroo-actions';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'vendoroo-btn vendoroo-btn-filled';
        closeBtn.textContent = 'Close';
        buttonRow.append(copyApiResponseBtn, closeBtn);

        function close() {
            overlay.remove();
        }

        scrim.onclick = (e) => { if (e.target === scrim) close(); };
        closeBtn.onclick = close;

        function setChip(el, text) {
            const isEmpty = !text || text === '—';
            el.textContent = text || '—';
            if (isEmpty) el.classList.add('vendoroo-chip-empty');
            else el.classList.remove('vendoroo-chip-empty');
        }

        async function loadWorkOrder() {
            const workOrderId = getWorkOrderIdFromUrl();
            const jwt = getStoredJwt();
            if (!workOrderId) {
                setChip(rowTitle.valueSpan, '—');
                setChip(rowWorkOrderId.valueSpan, '—');
                setChip(rowWoNumber.valueSpan, '—');
                setChip(rowResidentUserId.valueSpan, '—');
                return;
            }
            if (!jwt) {
                setChip(rowTitle.valueSpan, '—');
                setChip(rowWorkOrderId.valueSpan, '—');
                setChip(rowWoNumber.valueSpan, 'No token yet — use the site to load data');
                setChip(rowResidentUserId.valueSpan, '—');
                return;
            }
            try {
                const data = await fetchWorkOrder(workOrderId, jwt);
                lastRawResponse = data.rawResponse != null ? data.rawResponse : null;
                setChip(rowTitle.valueSpan, data.title != null ? String(data.title) : null);
                const idFromApi = data.workOrderId;
                setChip(rowWorkOrderId.valueSpan, idFromApi != null && idFromApi !== '' ? String(idFromApi) : workOrderId);
                setChip(rowWoNumber.valueSpan, data.woNumber != null ? String(data.woNumber) : null);
                setChip(rowResidentUserId.valueSpan, data.residentUserId != null ? String(data.residentUserId) : null);
            } catch (e) {
                lastRawResponse = null;
                setChip(rowTitle.valueSpan, null);
                setChip(rowWorkOrderId.valueSpan, null);
                setChip(rowWoNumber.valueSpan, 'Error: ' + (e.message || 'Request failed'));
                setChip(rowResidentUserId.valueSpan, null);
            }
        }

        dialog.append(
            title,
            rowRequestId.wrap,
            rowTitle.wrap,
            rowWorkOrderId.wrap,
            rowWoNumber.wrap,
            rowResidentUserId.wrap,
            shortcutRow,
            imageCopyRow,
            status,
            buttonRow
        );
        loadWorkOrder();
        scrim.appendChild(dialog);
        overlay.appendChild(scrim);
        document.body.appendChild(overlay);
    }

    function initUI() {
        injectMaterialStyles();
        installImageAnalysisCopyObserver();
        const floatingBtn = createFloatingButton();
        floatingBtn.onclick = openDialog;
        floatingBtn.style.display = 'none'; // use shortcut only (e.g. Ctrl+Shift+M)
        document.body.appendChild(floatingBtn);

        document.addEventListener('keydown', function(ev) {
            if (document.getElementById('vendoroo-wo-helper-overlay')) return;
            if (eventMatchesShortcut(ev, getStoredShortcut())) {
                ev.preventDefault();
                openDialog();
            }
        });
    }
    if (document.body) initUI(); else document.addEventListener('DOMContentLoaded', initUI);
})();
