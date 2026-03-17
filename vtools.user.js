// ==UserScript==
// @name         vtools
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Vendoroo Marketplace - WO Number Helper & tools
// @match        https://testing-marketplace.vendoroo.ai/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      api-testing-marketplace.vendoroo.ai
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'vendoroo_wo_helper_jwt';

    function getStoredJwt() {
        return GM_getValue(STORAGE_KEY, '');
    }

    function setStoredJwt(jwt) {
        GM_setValue(STORAGE_KEY, jwt);
    }

    function getWorkOrderIdFromUrl() {
        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const match = window.location.href.match(uuidRegex);
        return match ? match[0] : null;
    }

    function fetchWoNumber(workOrderId, jwt) {
        const url = `https://api-testing-marketplace.vendoroo.ai/api/WorkOrder/${workOrderId}`;
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
                        const data = JSON.parse(res.responseText);
                        resolve(data.woNumber != null ? data.woNumber : null);
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

    function createFloatingButton() {
        const btn = document.createElement('button');
        btn.textContent = 'vtools';
        btn.title = 'Vendoroo tools';
        btn.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 999999;
            min-width: 56px;
            height: 48px;
            padding: 0 12px;
            border-radius: 24px;
            border: none;
            background: #2563eb;
            color: white;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            font-size: 14px;
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
        title.textContent = 'vtools';
        title.style.marginTop = '0';

        const jwtLabel = document.createElement('label');
        jwtLabel.textContent = 'JWT Token';
        jwtLabel.style.display = 'block';
        jwtLabel.style.marginBottom = '4px';

        const jwtInput = document.createElement('input');
        jwtInput.type = 'password';
        jwtInput.placeholder = 'Paste JWT here';
        jwtInput.value = getStoredJwt();
        jwtInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 16px; box-sizing: border-box;';

        const saveJwtBtn = document.createElement('button');
        saveJwtBtn.textContent = 'Save JWT';
        saveJwtBtn.style.cssText = 'margin-bottom: 16px; padding: 6px 12px;';

        const copyWoBtn = document.createElement('button');
        copyWoBtn.textContent = 'Copy WO Number';
        copyWoBtn.style.cssText = 'display: block; padding: 10px 20px; margin-bottom: 8px; width: 100%;';

        const status = document.createElement('div');
        status.style.cssText = 'margin-top: 12px; font-size: 13px; color: #666; min-height: 20px;';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = 'margin-top: 12px; padding: 6px 16px;';

        saveJwtBtn.onclick = () => {
            setStoredJwt(jwtInput.value.trim());
            status.textContent = 'JWT saved.';
        };

        copyWoBtn.onclick = async () => {
            const jwt = jwtInput.value.trim() || getStoredJwt();
            if (!jwt) {
                status.textContent = 'Please enter and save a JWT first.';
                return;
            }
            const workOrderId = getWorkOrderIdFromUrl();
            if (!workOrderId) {
                status.textContent = 'No Work Order ID found in URL. Open a work order page first.';
                return;
            }
            status.textContent = 'Fetching...';
            try {
                const woNumber = await fetchWoNumber(workOrderId, jwt);
                if (woNumber != null) {
                    await copyToClipboard(String(woNumber));
                    status.textContent = `Copied: ${woNumber}`;
                } else {
                    status.textContent = 'API did not return woNumber.';
                }
            } catch (e) {
                status.textContent = 'Error: ' + (e.message || 'Request failed');
            }
        };

        function close() {
            overlay.remove();
        }

        overlay.onclick = (e) => { if (e.target === overlay) close(); };
        closeBtn.onclick = close;

        dialog.append(title, jwtLabel, jwtInput, saveJwtBtn, copyWoBtn, status, closeBtn);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    const floatingBtn = createFloatingButton();
    floatingBtn.onclick = openDialog;
    document.body.appendChild(floatingBtn);
})();
