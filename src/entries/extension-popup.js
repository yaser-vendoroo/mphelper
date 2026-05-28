import { createStorageChrome } from '../adapters/storage-chrome.js';
import { DEFAULT_SHORTCUT } from '../shared/constants.js';
import { parseShortcut } from '../shared/shortcuts.js';
import { createStorageApi } from '../shared/storage-api.js';
import { VERSION } from '../shared/version.js';

(async function() {
    'use strict';

    const shortcutValue = document.getElementById('shortcutValue');
    const recordShortcutButton = document.getElementById('recordShortcutButton');
    const resetShortcutButton = document.getElementById('resetShortcutButton');
    const modifierOneSelect = document.getElementById('modifierOneSelect');
    const modifierTwoSelect = document.getElementById('modifierTwoSelect');
    const imageAnalysisToggle = document.getElementById('imageAnalysisToggle');
    const openDialogButton = document.getElementById('openDialogButton');
    const status = document.getElementById('status');
    const appVersion = document.getElementById('appVersion');
    if (appVersion) appVersion.textContent = 'v' + VERSION;

    const storage = createStorageChrome();
    await storage.init();
    const storageApi = createStorageApi(storage);

    let clearStatusTimer = null;
    let recording = false;
    let finalKey = parseShortcut(DEFAULT_SHORTCUT).key;

    function setStatus(text, timeout = 2200) {
        status.textContent = text;
        if (clearStatusTimer) clearTimeout(clearStatusTimer);
        if (timeout > 0) {
            clearStatusTimer = setTimeout(() => {
                status.textContent = '';
            }, timeout);
        }
    }

    function getSelectedModifiers() {
        return [modifierOneSelect.value, modifierTwoSelect.value].filter(Boolean);
    }

    function buildShortcut() {
        return [...getSelectedModifiers(), finalKey].filter(Boolean).join('+');
    }

    function updateDisabledModifierOptions() {
        const first = modifierOneSelect.value;
        const second = modifierTwoSelect.value;
        if (first && first === second) {
            modifierTwoSelect.value = '';
        }

        for (const select of [modifierOneSelect, modifierTwoSelect]) {
            for (const option of select.options) {
                if (!option.value) {
                    option.disabled = false;
                    continue;
                }
                const otherValue = select === modifierOneSelect ? modifierTwoSelect.value : modifierOneSelect.value;
                option.disabled = option.value === otherValue;
            }
        }
    }

    function persistShortcut(message) {
        updateDisabledModifierOptions();
        const combo = buildShortcut();
        if (!finalKey || !combo) return;

        storageApi.setStoredShortcut(combo);
        shortcutValue.textContent = combo;
        recordShortcutButton.textContent = finalKey;
        if (message) setStatus(message);
    }

    function setEditorFromCombo(combo) {
        const parsed = parseShortcut(combo);
        const mods = [];
        if (parsed.ctrl) mods.push('Ctrl');
        if (parsed.alt) mods.push('Alt');
        if (parsed.shift) mods.push('Shift');
        if (parsed.meta) mods.push('Meta');

        modifierOneSelect.value = mods[0] || '';
        modifierTwoSelect.value = mods[1] || '';
        finalKey = parsed.key || parseShortcut(DEFAULT_SHORTCUT).key;
        updateDisabledModifierOptions();
        shortcutValue.textContent = buildShortcut();
        recordShortcutButton.textContent = finalKey;
    }

    function refreshShortcut() {
        setEditorFromCombo(storageApi.getStoredShortcut());
    }

    function syncImageAnalysisToggle() {
        const enabled = storageApi.getImageAnalysisCopyEnabled();
        imageAnalysisToggle.textContent = enabled ? 'On' : 'Off';
        imageAnalysisToggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
    }

    function normalizeFinalKey(ev) {
        if (ev.key === 'Escape') return 'Escape';
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(ev.key)) return '';
        if (ev.key === ' ') return '';
        return ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;
    }

    function stopRecording(handler) {
        recording = false;
        recordShortcutButton.disabled = false;
        recordShortcutButton.classList.remove('recording');
        document.removeEventListener('keydown', handler, true);
    }

    function startRecordingShortcut() {
        if (recording) return;
        recording = true;
        recordShortcutButton.disabled = true;
        recordShortcutButton.classList.add('recording');
        recordShortcutButton.textContent = 'Press key';
        setStatus('Press the final key. Esc cancels.', 0);

        const onKey = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();

            if (ev.key === 'Escape') {
                stopRecording(onKey);
                setStatus('Shortcut change canceled.');
                return;
            }

            const key = normalizeFinalKey(ev);
            if (!key) {
                setStatus('Choose a letter, number, function key, or named key.', 0);
                return;
            }

            finalKey = key;
            stopRecording(onKey);
            persistShortcut('Shortcut saved.');
        };

        document.addEventListener('keydown', onKey, true);
    }

    async function openPageDialog() {
        openDialogButton.disabled = true;
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs && tabs[0];
            if (!tab || !tab.id) {
                setStatus('No active tab found.');
                return;
            }

            await chrome.tabs.sendMessage(tab.id, {
                source: 'mphelper-popup',
                type: 'open-dialog'
            });
            setStatus('Opened MPHelper on the page.');
        } catch (err) {
            setStatus('Open a Vendoroo Marketplace tab first.');
        } finally {
            openDialogButton.disabled = false;
        }
    }

    async function notifyActiveTab(message) {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs && tabs[0];
            if (tab && tab.id) await chrome.tabs.sendMessage(tab.id, message);
        } catch (err) {
            /* The setting is still persisted for the next Marketplace page load. */
        }
    }

    recordShortcutButton.addEventListener('click', startRecordingShortcut);
    modifierOneSelect.addEventListener('change', () => persistShortcut('Shortcut saved.'));
    modifierTwoSelect.addEventListener('change', () => persistShortcut('Shortcut saved.'));
    resetShortcutButton.addEventListener('click', () => {
        storageApi.setStoredShortcut(DEFAULT_SHORTCUT);
        refreshShortcut();
        setStatus('Shortcut reset.');
    });
    imageAnalysisToggle.addEventListener('click', () => {
        const enabled = !storageApi.getImageAnalysisCopyEnabled();
        storageApi.setImageAnalysisCopyEnabled(enabled);
        syncImageAnalysisToggle();
        notifyActiveTab({
            source: 'mphelper-popup',
            type: 'image-analysis-copy-changed',
            enabled
        });
        setStatus(enabled ? 'Image analysis copy enabled.' : 'Image analysis copy disabled.');
    });
    openDialogButton.addEventListener('click', openPageDialog);

    refreshShortcut();
    syncImageAnalysisToggle();
})();
