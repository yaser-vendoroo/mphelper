import { getWorkOrderIdFromUrl } from './constants.js';
import { eventMatchesShortcut } from './shortcuts.js';
import { VERSION } from './version.js';

const ICON_FLOAT = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function getStylesCss(fontFamily) {
    return `
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
                font-family: ${fontFamily};
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
                font-family: ${fontFamily};
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
                display: flex;
                align-items: baseline;
                gap: 8px;
            }
            #vendoroo-wo-helper-overlay .vendoroo-version {
                font-size: 11px;
                font-weight: 400;
                letter-spacing: .2px;
                color: rgba(0,0,0,.48);
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
                font-family: ${fontFamily};
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
}

export function createUI({
    storageApi,
    workOrderApi,
    clipboardApi,
    imageAnalysis
}) {
    const fontFamily = FONT_STACK;

    function injectMaterialStyles() {
        if (document.getElementById('vendoroo-mphelper-styles')) return;
        const style = document.createElement('style');
        style.id = 'vendoroo-mphelper-styles';
        style.textContent = getStylesCss(fontFamily);
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
                await clipboardApi.copyToClipboard(text);
                if (statusEl) statusEl.textContent = 'Copied!';
                setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 1500);
            } catch (e) {
                if (statusEl) statusEl.textContent = 'Copy failed';
            }
        };
        wrap.append(labelEl, valueSpan);
        return { wrap, valueSpan };
    }

    function createFloatingButton() {
        const btn = document.createElement('button');
        btn.className = 'vendoroo-mphelper-fab';
        btn.innerHTML = ICON_FLOAT;
        btn.title = 'MPHelper – Vendoroo Marketplace Helper';
        return btn;
    }

    function openDialog() {
        if (document.getElementById('vendoroo-wo-helper-overlay')) return;
        injectMaterialStyles();

        const overlay = document.createElement('div');
        overlay.id = 'vendoroo-wo-helper-overlay';

        const scrim = document.createElement('div');
        scrim.className = 'vendoroo-dialog-scrim';

        const dialog = document.createElement('div');
        dialog.className = 'vendoroo-dialog-surface';

        const title = document.createElement('h2');
        title.className = 'vendoroo-dialog-title';
        const titleText = document.createElement('span');
        titleText.textContent = 'MPHelper';
        const versionTag = document.createElement('span');
        versionTag.className = 'vendoroo-version';
        versionTag.textContent = 'v' + VERSION;
        versionTag.title = 'MPHelper version';
        title.append(titleText, versionTag);

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
                await clipboardApi.copyToClipboard(lastRawResponse);
                status.textContent = 'API response copied to clipboard';
                setTimeout(() => { status.textContent = ''; }, 2000);
            } catch (e) {
                status.textContent = 'Copy failed';
            }
        };

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
            const jwt = storageApi.getStoredJwt();
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
                const data = await workOrderApi.fetchWorkOrder(workOrderId, jwt);
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
        imageAnalysis.installImageAnalysisCopyObserver();
        const floatingBtn = createFloatingButton();
        floatingBtn.onclick = openDialog;
        floatingBtn.style.display = 'none';
        document.body.appendChild(floatingBtn);

        document.addEventListener('keydown', function(ev) {
            if (document.getElementById('vendoroo-wo-helper-overlay')) return;
            if (eventMatchesShortcut(ev, storageApi.getStoredShortcut())) {
                ev.preventDefault();
                openDialog();
            }
        });
    }

    return { initUI, openDialog, injectMaterialStyles };
}
