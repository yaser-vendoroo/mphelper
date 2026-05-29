import { getWorkOrderIdFromUrl } from './constants.js';
import { getClientTimeZoneFromPayload } from './payload-parsers.js';
import {
    extractRelativeTimeText,
    formatRelativeAgo,
    formatTimelineInstant,
    formatTimelineInstantLines,
    instantFromIso,
    instantToIso,
    isClockTimeText,
    isValidIanaTimeZone,
    resolveInstantFromClockLabel,
    resolveTimelineInstant
} from './time-format.js';

const MPHELPER_ANCHOR_ATTR = 'data-mphelper-timeline-anchor';
const MPHELPER_INSTANT_ATTR = 'data-mphelper-timeline-instant';
const MPHELPER_ORIGINAL_TEXT_ATTR = 'data-mphelper-timeline-original-text';
const MPHELPER_TS_SELECTOR = '.vendoroo-mphelper-timeline-ts[data-mphelper-timeline-ts="1"]';
const MPHELPER_INLINE_TS_SELECTOR = '.vendoroo-mphelper-timeline-ts[data-mphelper-timeline-kind="inline"]';
const SPINE_CLOCK_HIDDEN_CLASS = 'vendoroo-mphelper-spine-clock-hidden';
const RELATIVE_HEADER_HIDDEN_CLASS = 'vendoroo-mphelper-timeline-relative-hidden';
const SPINE_TS_INNER_HTML = ''
    + '<span class="vendoroo-mphelper-timeline-ts-date"></span>'
    + '<span class="vendoroo-mphelper-timeline-ts-time"></span>'
    + '<span class="vendoroo-mphelper-timeline-ts-tz"></span>';

const SKIP_ANCESTOR_SELECTORS = [
    '#vendoroo-wo-helper-overlay',
    '[role="dialog"]',
    'script',
    'style',
    'noscript'
];

const AI_VIEW_MARKERS = /provide feedback|ai generated|view image analysis|evidence|sms to\b/i;

export function createTimelineTimestamps({ storageApi, workOrderApi }) {
    let clientTimeZoneCache = null;
    let clientTimeZoneFetchStarted = false;
    let scanEpoch = 0;
    let observerPaused = false;

    function rememberAnchorOriginalText(anchor) {
        if (!anchor?.hasAttribute(MPHELPER_ORIGINAL_TEXT_ATTR)) {
            anchor.setAttribute(MPHELPER_ORIGINAL_TEXT_ATTR, anchor.textContent);
        }
    }

    function restoreAnchorOriginalText(anchor) {
        if (!anchor) return;
        const original = anchor.getAttribute(MPHELPER_ORIGINAL_TEXT_ATTR);
        if (original != null) {
            anchor.textContent = original;
            anchor.removeAttribute(MPHELPER_ORIGINAL_TEXT_ATTR);
            return;
        }

        const cachedIso = anchor.getAttribute(MPHELPER_INSTANT_ATTR);
        if (!cachedIso || extractRelativeTimeText(anchor.textContent)) return;

        const relative = formatRelativeAgo(instantFromIso(cachedIso));
        if (relative) anchor.textContent = relative;
    }

    function isInlineTimestampEl(el) {
        return el?.classList?.contains('vendoroo-mphelper-timeline-ts')
            && el.getAttribute('data-mphelper-timeline-kind') === 'inline';
    }

    function shouldSkipElement(el) {
        if (!el || el.nodeType !== 1) return true;
        if (el.classList.contains('vendoroo-mphelper-timeline-ts')) return true;
        for (const selector of SKIP_ANCESTOR_SELECTORS) {
            if (el.closest(selector)) return true;
        }
        return false;
    }

    function isElementVisible(el) {
        if (!el?.isConnected) return false;

        let node = el;
        while (node && node !== document.body) {
            const style = window.getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            node = node.parentElement;
        }

        const rect = el.getBoundingClientRect();
        return rect.width > 0 || rect.height > 0;
    }

    function subtreeHasClockText(root) {
        if (!root) return false;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
            if (isClockTimeText(node.textContent.trim())) return true;
            node = walker.nextNode();
        }
        return false;
    }

    function findTimelineEventContainer(el) {
        let node = el;
        for (let depth = 0; node && depth < 16; depth += 1) {
            const parent = node.parentElement;
            if (!parent || shouldSkipElement(parent)) break;

            const text = parent.textContent || '';
            const childCount = [...parent.children].filter((child) => {
                return child.nodeType === 1
                    && !shouldSkipElement(child)
                    && child.textContent.trim().length > 6;
            }).length;

            if (childCount >= 2 && (extractRelativeTimeText(text) || subtreeHasClockText(parent))) {
                return parent;
            }

            node = parent;
        }
        return null;
    }

    function subtreeHasVisibleSpineClock(root) {
        if (!root || shouldSkipElement(root)) return false;

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
            if (!isClockTimeText(node.textContent.trim())) {
                node = walker.nextNode();
                continue;
            }

            const clockEl = pickClockElement(node);
            if (clockEl
                && isTimelineSpineClock(clockEl)
                && isElementVisible(clockEl)) {
                return true;
            }
            node = walker.nextNode();
        }
        return false;
    }

    function stepHasDedicatedSpineClock(anchor) {
        let node = anchor.parentElement;
        for (let depth = 0; node && depth < 12; depth += 1, node = node.parentElement) {
            if (node.children.length < 2) continue;

            for (const child of node.children) {
                if (child.contains(anchor)) continue;
                if (subtreeHasVisibleSpineClock(child)) return true;
            }
        }
        return false;
    }

    function isLikelyTimelineRelativeLabel(anchor) {
        const text = anchor.textContent.trim();
        if (!extractRelativeTimeText(text) || text.length > 64) return false;
        return anchor.children.length === 0 || text.length <= 32;
    }

    function findTimelineStepRow(el) {
        let node = el;
        for (let depth = 0; depth < 14; depth += 1) {
            const parent = node?.parentElement;
            if (!parent || shouldSkipElement(parent)) break;

            const siblings = [...parent.children].filter((child) => {
                if (child.nodeType !== 1 || shouldSkipElement(child)) return false;
                return child.textContent.trim().length > 24;
            });

            if (siblings.length >= 2 && siblings.includes(node)) {
                return node;
            }

            node = parent;
        }
        return null;
    }

    function pickClockElement(textNode) {
        const trimmed = textNode.textContent.trim();
        if (!isClockTimeText(trimmed)) return null;

        let el = textNode.parentElement;
        let best = null;
        let bestLen = Infinity;

        while (el && el !== document.body) {
            if (shouldSkipElement(el)) return null;

            const text = el.textContent.trim();
            if (isClockTimeText(text) && text.length < bestLen) {
                best = el;
                bestLen = text.length;
            }

            el = el.parentElement;
        }

        return best;
    }

    function hideSpineClockLabel(el) {
        if (!el) return;
        el.classList.add(SPINE_CLOCK_HIDDEN_CLASS);
        el.style.setProperty('display', 'none', 'important');
    }

    function revealSpineClockLabel(el) {
        if (!el) return;
        el.classList.remove(SPINE_CLOCK_HIDDEN_CLASS);
        el.style.removeProperty('display');
    }

    function isTimelineClockScannable(clockEl) {
        if (!clockEl?.isConnected) return false;
        if (clockEl.classList.contains(SPINE_CLOCK_HIDDEN_CLASS)) return true;
        return isElementVisible(clockEl);
    }

    function isSpineClockLabelCandidate(el) {
        if (!el || shouldSkipElement(el) || !el.isConnected) return false;
        if (!isClockTimeText(el.textContent.trim())) return false;
        if (isTimelineSpineClock(el)) return true;

        const next = el.nextElementSibling;
        if (next?.classList?.contains('vendoroo-mphelper-timeline-ts--spine')) return true;

        return !!el.parentElement?.querySelector(':scope > .vendoroo-mphelper-timeline-ts--spine');
    }

    function findSpineClockLabels() {
        const labels = [];
        const seen = new Set();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

        let node = walker.nextNode();
        while (node) {
            if (!isClockTimeText(node.textContent.trim())) {
                node = walker.nextNode();
                continue;
            }

            const clockEl = pickClockElement(node);
            if (!clockEl || seen.has(clockEl) || !isSpineClockLabelCandidate(clockEl)) {
                node = walker.nextNode();
                continue;
            }

            seen.add(clockEl);
            labels.push(clockEl);
            node = walker.nextNode();
        }

        return labels;
    }

    function hideSpineLabelsNearTimestamp(tsEl) {
        let prev = tsEl.previousElementSibling;
        while (prev) {
            const text = prev.textContent.trim();
            if (isClockTimeText(text)) {
                hideSpineClockLabel(prev);
                prev = prev.previousElementSibling;
                continue;
            }
            break;
        }
    }

    function findRowForClock(clockEl) {
        let cell = clockEl;
        for (let depth = 0; cell && depth < 10; depth += 1) {
            const parent = cell.parentElement;
            if (!parent || shouldSkipElement(parent)) break;
            if (parent.children.length >= 2) return parent;
            cell = parent;
        }
        return clockEl.parentElement;
    }

    function rowHasContentColumn(row, clockEl) {
        if (!row) return false;

        let clockColumn = clockEl;
        while (clockColumn.parentElement && clockColumn.parentElement !== row) {
            clockColumn = clockColumn.parentElement;
        }

        for (const child of row.children) {
            if (child === clockColumn || child === clockEl) continue;
            if (shouldSkipElement(child)) continue;
            const text = child.textContent.trim();
            if (text.length > 12 && !isClockTimeText(text)) return true;
        }

        return false;
    }

    function countSpineClocksNear(clockEl) {
        let root = clockEl.parentElement;
        for (let depth = 0; root && depth < 6; depth += 1) {
            let count = 0;
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode();
            while (node) {
                if (isClockTimeText(node.textContent.trim())) count += 1;
                node = walker.nextNode();
            }
            if (count >= 2) return count;
            root = root.parentElement;
        }
        return 0;
    }

    function isTimelineSpineClock(clockEl) {
        if (!clockEl || shouldSkipElement(clockEl)) return false;
        if (!isClockTimeText(clockEl.textContent.trim())) return false;

        const row = findRowForClock(clockEl);
        if (rowHasContentColumn(row, clockEl)) return true;

        return countSpineClocksNear(clockEl) >= 2;
    }

    function pickRelativeAnchor(textNode) {
        let el = textNode.parentElement;
        if (!el || shouldSkipElement(el)) return null;

        let best = null;
        let bestScore = Infinity;

        while (el && el !== document.body) {
            if (shouldSkipElement(el)) return null;

            const trimmed = el.textContent.trim();
            if (extractRelativeTimeText(trimmed) && trimmed.length <= 48) {
                const score = trimmed.length + (el.children.length * 12);
                if (score < bestScore) {
                    best = el;
                    bestScore = score;
                }
            }

            if (el.parentElement && el.parentElement.textContent.trim().length > 180) break;
            el = el.parentElement;
        }

        return best;
    }

    function countRelativeTimesNear(el) {
        let root = el.parentElement;
        for (let depth = 0; root && depth < 6; depth += 1) {
            let count = 0;
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode();
            while (node) {
                if (extractRelativeTimeText(node.textContent)) count += 1;
                node = walker.nextNode();
            }
            if (count >= 2) return count;
            root = root.parentElement;
        }
        return 0;
    }

    function isAiViewMessageContext(el) {
        let node = el;
        for (let depth = 0; node && depth < 10; depth += 1) {
            if (AI_VIEW_MARKERS.test(node.textContent || '')) return true;
            if (node.querySelector && node.querySelector('[class*="avatar" i], img[class*="rounded" i]')) {
                const len = (node.textContent || '').trim().length;
                if (len > 40 && len < 12000) return true;
            }
            node = node.parentElement;
        }
        return false;
    }

    function isTimelineRelativeAnchor(anchor) {
        if (!anchor || shouldSkipElement(anchor)) return false;

        const text = anchor.textContent.trim();
        if (!extractRelativeTimeText(text) || text.length > 64) return false;

        return countRelativeTimesNear(anchor) >= 2
            || isAiViewMessageContext(anchor)
            || isLikelyTimelineRelativeLabel(anchor);
    }

    function findTimelineClockNodes() {
        const clocks = [];
        const seen = new Set();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

        let node = walker.nextNode();
        while (node) {
            if (!isClockTimeText(node.textContent.trim())) {
                node = walker.nextNode();
                continue;
            }

            const clockEl = pickClockElement(node);
            if (!clockEl
                || seen.has(clockEl)
                || !isTimelineSpineClock(clockEl)
                || !isTimelineClockScannable(clockEl)) {
                node = walker.nextNode();
                continue;
            }

            seen.add(clockEl);
            clocks.push(clockEl);
            node = walker.nextNode();
        }

        return clocks;
    }

    function findTimelineRelativeAnchors() {
        const anchors = [];
        const seen = new Set();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

        let node = walker.nextNode();
        while (node) {
            if (!extractRelativeTimeText(node.textContent)) {
                node = walker.nextNode();
                continue;
            }

            const anchor = pickRelativeAnchor(node);
            if (!anchor
                || seen.has(anchor)
                || !isElementVisible(anchor)
                || !isTimelineRelativeAnchor(anchor)) {
                node = walker.nextNode();
                continue;
            }

            seen.add(anchor);
            anchors.push(anchor);
            node = walker.nextNode();
        }

        return anchors;
    }

    function hideRelativeHeaderLabel(el) {
        if (!el) return;
        el.classList.add(RELATIVE_HEADER_HIDDEN_CLASS);
        el.style.setProperty('display', 'none', 'important');
    }

    function revealRelativeHeaderLabel(el) {
        if (!el) return;
        el.classList.remove(RELATIVE_HEADER_HIDDEN_CLASS);
        el.style.removeProperty('display');
    }

    function findHeaderRelativeAnchors() {
        const anchors = [];
        const seen = new Set();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

        let node = walker.nextNode();
        while (node) {
            if (!extractRelativeTimeText(node.textContent)) {
                node = walker.nextNode();
                continue;
            }

            const anchor = pickRelativeAnchor(node);
            if (!anchor || seen.has(anchor) || !isTimelineRelativeAnchor(anchor)) {
                node = walker.nextNode();
                continue;
            }

            seen.add(anchor);
            anchors.push(anchor);
            node = walker.nextNode();
        }

        return anchors;
    }

    function removeAiViewInlineTimestamps() {
        document.querySelectorAll(MPHELPER_INLINE_TS_SELECTOR).forEach((el) => el.remove());
        document.querySelectorAll('.vendoroo-mphelper-timeline-ts-wrap').forEach((wrap) => {
            if (wrap.querySelector(MPHELPER_INLINE_TS_SELECTOR)) {
                unwrapInlineWrap(wrap);
            }
        });
    }

    function syncAiViewRelativeHeaderVisibility(aiViewTimeline) {
        if (!aiViewTimeline) {
            document.querySelectorAll(`.${RELATIVE_HEADER_HIDDEN_CLASS}`).forEach((el) => {
                revealRelativeHeaderLabel(el);
            });
            return;
        }

        for (const anchor of findHeaderRelativeAnchors()) {
            hideRelativeHeaderLabel(anchor);
        }
    }

    function pageHasAiViewTimeline() {
        if (findTimelineClockNodes().length >= 2) return true;
        return document.querySelectorAll(`.${SPINE_CLOCK_HIDDEN_CLASS}`).length >= 2;
    }

    function collectTimelineTargets() {
        const targets = [];
        const stepsWithClock = new Set();
        const aiViewTimeline = pageHasAiViewTimeline();

        for (const clockEl of findTimelineClockNodes()) {
            const step = findTimelineEventContainer(clockEl) || findTimelineStepRow(clockEl);
            if (step) stepsWithClock.add(step);
            targets.push({
                placementEl: clockEl,
                instantEl: clockEl,
                kind: 'clock'
            });
        }

        if (!aiViewTimeline) {
            for (const anchor of findTimelineRelativeAnchors()) {
                const step = findTimelineEventContainer(anchor) || findTimelineStepRow(anchor);
                if (step && stepsWithClock.has(step)) continue;
                if (stepHasDedicatedSpineClock(anchor)) continue;

                targets.push({
                    placementEl: anchor,
                    instantEl: anchor,
                    kind: 'inline'
                });
            }
        }

        return targets;
    }

    function syncAiViewSpineClockVisibility(aiViewTimeline) {
        if (!aiViewTimeline) {
            document.querySelectorAll(`.${SPINE_CLOCK_HIDDEN_CLASS}`).forEach((el) => {
                revealSpineClockLabel(el);
            });
            return;
        }

        for (const clockEl of findSpineClockLabels()) {
            hideSpineClockLabel(clockEl);
        }

        document.querySelectorAll('.vendoroo-mphelper-timeline-ts--spine').forEach((tsEl) => {
            hideSpineLabelsNearTimestamp(tsEl);
        });
    }

    function ensureSpineTimestampEl(clockEl) {
        let tsEl = findClockTimestamp(clockEl);
        if (!tsEl) {
            tsEl = document.createElement('div');
            tsEl.className = 'vendoroo-mphelper-timeline-ts vendoroo-mphelper-timeline-ts--spine';
            tsEl.setAttribute('data-mphelper-timeline-ts', '1');
            tsEl.setAttribute('data-mphelper-timeline-kind', 'clock');
            tsEl.innerHTML = SPINE_TS_INNER_HTML;
            clockEl.insertAdjacentElement('afterend', tsEl);
            return tsEl;
        }

        if (!tsEl.querySelector('.vendoroo-mphelper-timeline-ts-date')) {
            tsEl.className = 'vendoroo-mphelper-timeline-ts vendoroo-mphelper-timeline-ts--spine';
            tsEl.innerHTML = SPINE_TS_INNER_HTML;
        }

        return tsEl;
    }

    function setSpineTimestampLines(tsEl, lines) {
        tsEl.querySelector('.vendoroo-mphelper-timeline-ts-date').textContent = lines.dateLine;
        tsEl.querySelector('.vendoroo-mphelper-timeline-ts-time').textContent = lines.timeLine;
        tsEl.querySelector('.vendoroo-mphelper-timeline-ts-tz').textContent = lines.unavailable
            ? `${lines.tzLine} (client TZ unavailable)`
            : lines.tzLine;
    }

    function scrapeClientTimeZoneFromDom() {
        const attrSelectors = [
            '[data-timezone]',
            '[data-time-zone]',
            '[data-tz]'
        ];
        for (const selector of attrSelectors) {
            const el = document.querySelector(selector);
            if (!el) continue;
            const tz = el.getAttribute('data-timezone')
                || el.getAttribute('data-time-zone')
                || el.getAttribute('data-tz');
            if (isValidIanaTimeZone(tz)) return tz;
        }

        const meta = document.querySelector('meta[name="timezone"], meta[name="time-zone"], meta[property="timezone"]');
        if (meta) {
            const tz = meta.getAttribute('content');
            if (isValidIanaTimeZone(tz)) return tz;
        }

        return null;
    }

    async function ensureClientTimeZone() {
        if (clientTimeZoneCache && isValidIanaTimeZone(clientTimeZoneCache)) {
            return clientTimeZoneCache;
        }

        const fromDom = scrapeClientTimeZoneFromDom();
        if (isValidIanaTimeZone(fromDom)) {
            clientTimeZoneCache = fromDom;
            return clientTimeZoneCache;
        }

        if (clientTimeZoneFetchStarted) return clientTimeZoneCache;
        clientTimeZoneFetchStarted = true;

        const workOrderId = getWorkOrderIdFromUrl();
        const jwt = storageApi.getStoredJwt();
        if (!workOrderId || !jwt) return null;

        try {
            const data = await workOrderApi.fetchWorkOrder(workOrderId, jwt);
            const raw = data.rawResponse ? JSON.parse(data.rawResponse) : null;
            const tz = getClientTimeZoneFromPayload(raw);
            if (isValidIanaTimeZone(tz)) {
                clientTimeZoneCache = tz;
                scheduleTimelineScan();
            }
        } catch {
            /* Client TZ stays unavailable until a later scan. */
        }

        return clientTimeZoneCache;
    }

    function resolveInstantForTarget(instantEl, kind) {
        if (kind === 'clock') {
            const fromClock = resolveInstantFromClockLabel(instantEl);
            if (fromClock) return fromClock;
        }
        return resolveTimelineInstant(instantEl);
    }

    function getOrCacheInstant(instantEl, kind) {
        const mode = storageApi.getTimelineTzMode();
        const cachedIso = instantEl.getAttribute(MPHELPER_INSTANT_ATTR);
        const cachedMode = instantEl.getAttribute('data-mphelper-timeline-mode');

        if (cachedIso && cachedMode === mode) {
            const fromCache = instantFromIso(cachedIso);
            if (fromCache) return fromCache;
        }

        const instant = resolveInstantForTarget(instantEl, kind);
        if (!instant) return null;

        instantEl.setAttribute(MPHELPER_ANCHOR_ATTR, '1');
        instantEl.setAttribute(MPHELPER_INSTANT_ATTR, instantToIso(instant));
        instantEl.setAttribute('data-mphelper-timeline-mode', mode);
        return instant;
    }

    function ensureInlineWrap(anchor) {
        const parent = anchor.parentElement;
        if (parent?.classList.contains('vendoroo-mphelper-timeline-ts-wrap')) {
            return parent;
        }

        const wrap = document.createElement('span');
        wrap.className = 'vendoroo-mphelper-timeline-ts-wrap';
        anchor.parentNode.insertBefore(wrap, anchor);
        wrap.appendChild(anchor);
        return wrap;
    }

    function coalesceInlineTimestamp(wrap) {
        let tsEl = wrap.querySelector(MPHELPER_INLINE_TS_SELECTOR);

        let sibling = wrap.nextElementSibling;
        while (isInlineTimestampEl(sibling)) {
            const orphan = sibling;
            sibling = sibling.nextElementSibling;
            if (!tsEl) {
                wrap.appendChild(orphan);
                orphan.classList.remove('vendoroo-mphelper-timeline-ts--inline');
                orphan.classList.add('vendoroo-mphelper-timeline-ts--stack');
                tsEl = orphan;
            } else {
                orphan.remove();
            }
        }

        return tsEl;
    }

    function shouldAbortScan(epoch) {
        return epoch !== scanEpoch || !storageApi.getTimelineTimestampsEnabled();
    }

    function migrateLegacyInlineSibling(anchor) {
        const next = anchor.nextElementSibling;
        if (!isInlineTimestampEl(next)) return;

        const wrap = ensureInlineWrap(anchor);
        if (next.parentElement === wrap) return;

        wrap.appendChild(next);
        next.classList.remove('vendoroo-mphelper-timeline-ts--inline');
        next.classList.add('vendoroo-mphelper-timeline-ts--stack');
    }

    function findInlineTimestamp(anchor) {
        migrateLegacyInlineSibling(anchor);

        const wrap = anchor.closest('.vendoroo-mphelper-timeline-ts-wrap');
        if (wrap && wrap.contains(anchor)) {
            return wrap.querySelector(MPHELPER_INLINE_TS_SELECTOR);
        }

        const next = anchor.nextElementSibling;
        if (isInlineTimestampEl(next)) {
            return next;
        }
        return null;
    }

    function getInlineAnchorFromTimestamp(tsEl) {
        const wrap = tsEl.closest('.vendoroo-mphelper-timeline-ts-wrap');
        if (wrap) {
            return wrap.querySelector(`[${MPHELPER_ANCHOR_ATTR}]`) || wrap.firstElementChild;
        }
        return tsEl.previousElementSibling;
    }

    function unwrapInlineWrap(wrap) {
        const parent = wrap.parentElement;
        if (!parent) {
            wrap.remove();
            return;
        }
        while (wrap.firstChild) {
            parent.insertBefore(wrap.firstChild, wrap);
        }
        wrap.remove();
    }

    function findClockTimestamp(clockEl) {
        const next = clockEl.nextElementSibling;
        if (next && next.classList.contains('vendoroo-mphelper-timeline-ts')) return next;
        return null;
    }

    function removeMisplacedStepFooters() {
        document.querySelectorAll('.vendoroo-mphelper-timeline-ts[data-mphelper-timeline-kind="step-footer"]').forEach((el) => {
            el.remove();
        });
        document.querySelectorAll('.vendoroo-mphelper-timeline-ts-slot').forEach((el) => el.remove());
        document.querySelectorAll('.vendoroo-mphelper-timeline-ts-break').forEach((el) => el.remove());
    }

    function removeOrphanFooterSlots() {
        document.querySelectorAll('.vendoroo-mphelper-timeline-ts-slot').forEach((slot) => {
            if (!slot.querySelector('.vendoroo-mphelper-timeline-ts')) {
                const prev = slot.previousElementSibling;
                if (prev && prev.classList.contains('vendoroo-mphelper-timeline-ts-break')) prev.remove();
                slot.remove();
            }
        });
    }

    function unwrapLegacyHosts() {
        document.querySelectorAll('.vendoroo-mphelper-timeline-ts-wrap--legacy').forEach((wrap) => {
            const parent = wrap.parentElement;
            if (!parent) {
                wrap.remove();
                return;
            }
            while (wrap.firstChild) {
                parent.insertBefore(wrap.firstChild, wrap);
            }
            wrap.remove();
        });
    }

    function injectTimelineTimestamp(target, clientTimeZone) {
        if (!storageApi.getTimelineTimestampsEnabled()) return;

        const { placementEl, instantEl, kind } = target;
        rememberAnchorOriginalText(instantEl);
        const instant = getOrCacheInstant(instantEl, kind);
        if (!instant) return;

        const mode = storageApi.getTimelineTzMode();
        const aiViewTimeline = pageHasAiViewTimeline();

        let tsEl;
        if (kind === 'clock') {
            if (aiViewTimeline) {
                const lines = formatTimelineInstantLines(instant, mode, clientTimeZone);
                if (!lines.dateLine || !lines.timeLine) return;
                tsEl = ensureSpineTimestampEl(placementEl);
                setSpineTimestampLines(tsEl, lines);
                return;
            }

            const { text } = formatTimelineInstant(instant, mode, clientTimeZone);
            if (!text) return;
            tsEl = findClockTimestamp(placementEl);
            if (!tsEl) {
                tsEl = document.createElement('div');
                tsEl.className = 'vendoroo-mphelper-timeline-ts';
                tsEl.setAttribute('data-mphelper-timeline-ts', '1');
                tsEl.setAttribute('data-mphelper-timeline-kind', 'clock');
                placementEl.insertAdjacentElement('afterend', tsEl);
            }
            tsEl.textContent = text;
            return;
        }

        if (aiViewTimeline) return;

        const { text } = formatTimelineInstant(instant, mode, clientTimeZone);
        if (!text) return;

        migrateLegacyInlineSibling(placementEl);
        const wrap = ensureInlineWrap(placementEl);
        tsEl = coalesceInlineTimestamp(wrap);
        if (!tsEl) {
            tsEl = document.createElement('span');
            tsEl.className = 'vendoroo-mphelper-timeline-ts vendoroo-mphelper-timeline-ts--stack';
            tsEl.setAttribute('data-mphelper-timeline-ts', '1');
            tsEl.setAttribute('data-mphelper-timeline-kind', 'inline');
            wrap.appendChild(tsEl);
        }

        tsEl.textContent = text;
    }

    function removeTimelineTimestampUI() {
        observerPaused = true;
        scanEpoch += 1;

        document.querySelectorAll('.vendoroo-mphelper-timeline-ts-wrap').forEach((wrap) => {
            unwrapInlineWrap(wrap);
        });
        document.querySelectorAll(MPHELPER_TS_SELECTOR).forEach((el) => el.remove());
        document.querySelectorAll('.vendoroo-mphelper-timeline-ts-slot').forEach((el) => el.remove());
        document.querySelectorAll('.vendoroo-mphelper-timeline-ts-break').forEach((el) => el.remove());
        unwrapLegacyHosts();
        document.querySelectorAll(`[${MPHELPER_ANCHOR_ATTR}]`).forEach((el) => {
            restoreAnchorOriginalText(el);
            el.removeAttribute(MPHELPER_ANCHOR_ATTR);
            el.removeAttribute(MPHELPER_INSTANT_ATTR);
            el.removeAttribute('data-mphelper-timeline-mode');
            el.removeAttribute('data-mphelper-timeline-kind');
        });
        document.querySelectorAll(`.${SPINE_CLOCK_HIDDEN_CLASS}`).forEach((el) => {
            revealSpineClockLabel(el);
        });
        document.querySelectorAll(`.${RELATIVE_HEADER_HIDDEN_CLASS}`).forEach((el) => {
            revealRelativeHeaderLabel(el);
        });
        observerPaused = false;
    }

    async function scanTimelineTimestamps(epoch) {
        if (!storageApi.getTimelineTimestampsEnabled()) {
            removeTimelineTimestampUI();
            return;
        }

        if (epoch !== scanEpoch) return;

        observerPaused = true;
        try {
            removeMisplacedStepFooters();

            let clientTimeZone = null;
            if (storageApi.getTimelineTzMode() === 'client') {
                clientTimeZone = await ensureClientTimeZone();
            }

            if (shouldAbortScan(epoch)) {
                if (!storageApi.getTimelineTimestampsEnabled()) removeTimelineTimestampUI();
                return;
            }

            const targets = collectTimelineTargets();
            const aiViewTimeline = pageHasAiViewTimeline();
            const activeInlineAnchors = new Set();
            const activeClocks = new Set();

            for (const target of targets) {
                if (shouldAbortScan(epoch)) break;
                injectTimelineTimestamp(target, clientTimeZone);
                if (target.kind === 'inline') activeInlineAnchors.add(target.placementEl);
                if (target.kind === 'clock') activeClocks.add(target.placementEl);
            }

            if (shouldAbortScan(epoch)) {
                if (!storageApi.getTimelineTimestampsEnabled()) removeTimelineTimestampUI();
                return;
            }

            document.querySelectorAll('.vendoroo-mphelper-timeline-ts[data-mphelper-timeline-kind="clock"]').forEach((el) => {
                const clock = el.previousElementSibling;
                if (!clock || !activeClocks.has(clock)) el.remove();
            });

            document.querySelectorAll('.vendoroo-mphelper-timeline-ts[data-mphelper-timeline-kind="inline"]').forEach((el) => {
                const anchor = getInlineAnchorFromTimestamp(el);
                if (!anchor || !activeInlineAnchors.has(anchor)) {
                    const wrap = el.closest('.vendoroo-mphelper-timeline-ts-wrap');
                    el.remove();
                    if (wrap && !wrap.querySelector(MPHELPER_INLINE_TS_SELECTOR)) {
                        unwrapInlineWrap(wrap);
                    }
                }
            });

            document.querySelectorAll('.vendoroo-mphelper-timeline-ts-wrap:empty').forEach((wrap) => wrap.remove());

            if (aiViewTimeline) {
                removeAiViewInlineTimestamps();
            }

            syncAiViewRelativeHeaderVisibility(aiViewTimeline);
            syncAiViewSpineClockVisibility(aiViewTimeline);

            removeOrphanFooterSlots();
        } finally {
            observerPaused = false;
        }
    }

    let scanScheduled = false;
    function scheduleTimelineScan() {
        if (observerPaused || scanScheduled) return;
        scanScheduled = true;
        requestAnimationFrame(() => {
            scanScheduled = false;
            scanTimelineTimestamps(scanEpoch);
        });
    }

    function installTimelineObserver() {
        if (!document.body) return;
        scheduleTimelineScan();
        const obs = new MutationObserver(() => {
            if (observerPaused) return;
            scheduleTimelineScan();
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    function invalidateClientTimeZoneCache() {
        clientTimeZoneCache = null;
        clientTimeZoneFetchStarted = false;
        document.querySelectorAll(`[${MPHELPER_ANCHOR_ATTR}]`).forEach((el) => {
            el.removeAttribute(MPHELPER_INSTANT_ATTR);
            el.removeAttribute('data-mphelper-timeline-mode');
        });
    }

    return {
        installTimelineObserver,
        scheduleTimelineScan,
        removeTimelineTimestampUI,
        invalidateClientTimeZoneCache
    };
}
