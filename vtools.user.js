// ==UserScript==
// @name         MPHelper
// @namespace    http://tampermonkey.net/
// @version      1.9
// @description  MPHelper - Vendoroo Marketplace WO Number Helper & tools
// @match        https://testing-marketplace.vendoroo.ai/*
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      api-testing-marketplace.vendoroo.ai
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'vendoroo_wo_helper_jwt';
    const SHORTCUT_STORAGE_KEY = 'vendoroo_mphelper_shortcut';
    const DEFAULT_SHORTCUT = 'Ctrl+Shift+M';
    const API_BASE = 'https://api-testing-marketplace.vendoroo.ai';
    const WORK_ORDER_API_PATH = '/api/WorkOrder';

    function getStoredJwt() {
        return GM_getValue(STORAGE_KEY, '');
    }

    function setStoredJwt(jwt) {
        GM_setValue(STORAGE_KEY, jwt);
    }

    function getStoredShortcut() {
        return GM_getValue(SHORTCUT_STORAGE_KEY, DEFAULT_SHORTCUT);
    }
    function setStoredShortcut(combo) {
        GM_setValue(SHORTCUT_STORAGE_KEY, combo);
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

    const API_ORIGIN = 'api-testing-marketplace.vendoroo.ai';
    function captureTokenFromAuthHeader(authHeader) {
        if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7).trim();
            if (token.length > 0) setStoredJwt(token);
        }
    }

    function installJwtInterceptor() {
        const origFetch = window.fetch;
        if (origFetch) {
            window.fetch = function(input, init) {
                const url = typeof input === 'string' ? input : (input && input.url);
                if (url && url.includes(API_ORIGIN)) {
                    const headers = init && init.headers;
                    if (headers) {
                        const auth = headers instanceof Headers ? headers.get('authorization') : (headers.Authorization || headers.authorization);
                        captureTokenFromAuthHeader(auth);
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
            if (this._mpHelperUrl && this._mpHelperUrl.includes(API_ORIGIN) && this._mpHelperAuth) {
                captureTokenFromAuthHeader(this._mpHelperAuth);
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

    function getWorkOrderApiUrl(workOrderId) {
        return workOrderId ? `${API_BASE}${WORK_ORDER_API_PATH}/${workOrderId}` : `${API_BASE}${WORK_ORDER_API_PATH}/{id}`;
    }

    function fetchWorkOrder(workOrderId, jwt) {
        const url = getWorkOrderApiUrl(workOrderId);
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                headers: {
                    'accept': 'application/json',
                    'authorization': `Bearer ${jwt}`,
                    'origin': 'https://testing-marketplace.vendoroo.ai',
                    'referer': 'https://testing-marketplace.vendoroo.ai/'
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
                            title: getTitleFromPayload(data)
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

    const clickableRowStyle = 'margin-bottom: 12px;';
    const clickableValueStyle = [
        'cursor: pointer; display: inline-block; padding: 6px 12px; border-radius: 8px;',
        'background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0;',
        'font-size: 13px; font-family: inherit;'
    ].join(' ');
    const clickableValueStyleHover = [
        'cursor: pointer; display: inline-block; padding: 6px 12px; border-radius: 8px;',
        'background: #e2e8f0; color: #334155; border: 1px solid #cbd5e1;',
        'font-size: 13px; font-family: inherit;'
    ].join(' ');

    function makeClickableRow(label, value, statusEl) {
        const wrap = document.createElement('div');
        wrap.style.cssText = clickableRowStyle;
        const labelSpan = document.createElement('span');
        labelSpan.textContent = label + ': ';
        labelSpan.style.fontWeight = '600';
        const valueSpan = document.createElement('span');
        valueSpan.textContent = value != null && value !== '' ? String(value) : '—';
        valueSpan.style.cssText = clickableValueStyle;
        valueSpan.title = 'Click to copy';
        valueSpan.onmouseenter = () => { valueSpan.style.cssText = clickableValueStyleHover; };
        valueSpan.onmouseleave = () => { valueSpan.style.cssText = clickableValueStyle; };
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
        wrap.append(labelSpan, valueSpan);
        return { wrap, valueSpan };
    }

    const ICON_FLOAT = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';

    function createFloatingButton() {
        const btn = document.createElement('button');
        btn.innerHTML = ICON_FLOAT;
        btn.title = 'MPHelper – Vendoroo Marketplace Helper';
        btn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 999999;
            width: 40px;
            height: 40px;
            padding: 0;
            border-radius: 50%;
            border: none;
            background: #2563eb;
            color: white;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        return btn;
    }

    function openDialog() {
        const overlay = document.createElement('div');
        overlay.id = 'vendoroo-wo-helper-overlay';
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 1000000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 24px;
            min-width: 360px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        `;

        const title = document.createElement('h3');
        title.textContent = 'MPHelper';
        title.style.marginTop = '0';

        const requestId = getWorkOrderIdFromUrl();
        const status = document.createElement('div');
        status.style.cssText = 'margin-top: 8px; font-size: 13px; color: #666; min-height: 20px;';

        const rowRequestId = makeClickableRow('Request ID', requestId, status);
        const rowTitle = makeClickableRow('Work order title', null, status);
        const rowWoNumber = makeClickableRow('Work order number', null, status);
        if (requestId) {
            rowTitle.valueSpan.textContent = 'Loading...';
            rowWoNumber.valueSpan.textContent = 'Loading...';
        }

        const shortcutRow = document.createElement('div');
        shortcutRow.style.cssText = 'margin-bottom: 12px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;';
        const shortcutLabel = document.createElement('span');
        shortcutLabel.textContent = 'Shortcut: ';
        shortcutLabel.style.fontWeight = '600';
        const shortcutDisplay = document.createElement('span');
        shortcutDisplay.textContent = getStoredShortcut();
        shortcutDisplay.style.cssText = 'padding: 4px 8px; background: #f1f5f9; border-radius: 6px; font-size: 13px;';
        const changeShortcutBtn = document.createElement('button');
        changeShortcutBtn.textContent = 'Change';
        changeShortcutBtn.style.cssText = 'padding: 4px 10px; font-size: 12px; cursor: pointer;';

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

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = 'margin-top: 12px; padding: 6px 16px;';

        function close() {
            overlay.remove();
        }

        overlay.onclick = (e) => { if (e.target === overlay) close(); };
        closeBtn.onclick = close;

        async function loadWorkOrder() {
            const workOrderId = getWorkOrderIdFromUrl();
            const jwt = getStoredJwt();
            if (!workOrderId) {
                rowTitle.valueSpan.textContent = '—';
                rowWoNumber.valueSpan.textContent = '—';
                return;
            }
            if (!jwt) {
                rowTitle.valueSpan.textContent = '—';
                rowWoNumber.valueSpan.textContent = 'No token yet — use the site to load data';
                return;
            }
            try {
                const data = await fetchWorkOrder(workOrderId, jwt);
                rowTitle.valueSpan.textContent = data.title != null ? String(data.title) : '—';
                rowWoNumber.valueSpan.textContent = data.woNumber != null ? String(data.woNumber) : '—';
            } catch (e) {
                rowTitle.valueSpan.textContent = '—';
                rowWoNumber.valueSpan.textContent = 'Error: ' + (e.message || 'Request failed');
            }
        }

        dialog.append(
            title,
            rowRequestId.wrap,
            rowTitle.wrap,
            rowWoNumber.wrap,
            shortcutRow,
            status,
            closeBtn
        );
        loadWorkOrder();
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    function initUI() {
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
