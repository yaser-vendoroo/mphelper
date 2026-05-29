const RELATIVE_TIME_RE = /^(just now|\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago)$/i;

/** Match relative time inside longer strings (e.g. "| 7 hours ago"). */
const RELATIVE_TIME_FRAGMENT_RE = /\b(just now|\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago)\b/i;

/** Tooltip-style absolute time from marketplace timeline (e.g. May 29, 2026, 14:47:26). */
const TITLE_ABSOLUTE_RE = /^[A-Za-z]+\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}:\d{2}$/;

const DATE_HEADER_RE = /^([A-Za-z]+)\s+(\d{1,2})$/;
const CLOCK_TIME_RE = /^(\d{1,2}):(\d{2})$/;

const UNIT_MS = {
    second: 1000,
    seconds: 1000,
    minute: 60_000,
    minutes: 60_000,
    hour: 3_600_000,
    hours: 3_600_000,
    day: 86_400_000,
    days: 86_400_000,
    week: 604_800_000,
    weeks: 604_800_000,
    month: 2_592_000_000,
    months: 2_592_000_000,
    year: 31_536_000_000,
    years: 31_536_000_000
};

const TITLE_MONTHS = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11
};

export function isRelativeTimeText(text) {
    if (text == null) return false;
    return RELATIVE_TIME_RE.test(String(text).trim());
}

export function isClockTimeText(text) {
    if (text == null) return false;
    return CLOCK_TIME_RE.test(String(text).trim());
}

export function extractRelativeTimeText(text) {
    if (text == null) return null;
    const match = String(text).match(RELATIVE_TIME_FRAGMENT_RE);
    return match ? match[1] : null;
}

export function inferInstantFromRelative(text) {
    const relative = extractRelativeTimeText(text);
    if (!relative) return null;
    if (/^just now$/i.test(relative)) return new Date();

    const match = relative.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i);
    if (!match) return null;

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const ms = UNIT_MS[unit] ?? UNIT_MS[unit + 's'];
    if (!ms || !Number.isFinite(amount)) return null;

    return new Date(Date.now() - amount * ms);
}

/** Best-effort relative label for restoring native timeline anchors. */
export function formatRelativeAgo(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

    const diffMs = Date.now() - date.getTime();
    if (diffMs < 45_000) return 'just now';

    const units = [
        ['year', 31_536_000_000],
        ['month', 2_592_000_000],
        ['week', 604_800_000],
        ['day', 86_400_000],
        ['hour', 3_600_000],
        ['minute', 60_000],
        ['second', 1000]
    ];

    for (const [unit, ms] of units) {
        const amount = Math.round(diffMs / ms);
        if (amount >= 1) {
            const label = amount === 1 ? unit : `${unit}s`;
            return `${amount} ${label} ago`;
        }
    }

    return 'just now';
}

function parseDateHeader(text) {
    const trimmed = String(text).trim();
    const match = trimmed.match(DATE_HEADER_RE);
    if (!match) return null;

    const month = TITLE_MONTHS[match[1].toLowerCase()];
    if (month == null) return null;

    const day = Number(match[2]);
    const year = new Date().getFullYear();
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
}

function findNearestDateHeader(fromEl) {
    let node = fromEl;
    for (let depth = 0; node && depth < 12; depth += 1) {
        const headers = node.querySelectorAll
            ? node.querySelectorAll('span, p, div, h3, h4, h5, strong')
            : [];
        for (const el of headers) {
            if (el.children.length > 2) continue;
            const parsed = parseDateHeader(el.textContent);
            if (parsed) return parsed;
        }
        node = node.parentElement;
    }
    return null;
}

function findClockTimeInRow(fromEl) {
    let node = fromEl;
    for (let depth = 0; node && depth < 10; depth += 1) {
        if (node.previousElementSibling) {
            const fromSibling = readClockFromSubtree(node.previousElementSibling);
            if (fromSibling) return fromSibling;
        }

        const fromRow = readClockFromSubtree(node);
        if (fromRow) return fromRow;

        node = node.parentElement;
    }
    return null;
}

function readClockFromSubtree(root) {
    if (!root || !root.querySelectorAll) return null;

    const candidates = root.querySelectorAll('span, time, p, div, td');
    for (const el of candidates) {
        if (el.children.length > 0) continue;
        const clock = el.textContent.trim();
        const match = clock.match(CLOCK_TIME_RE);
        if (!match) continue;
        return { hour: Number(match[1]), minute: Number(match[2]) };
    }
    return null;
}

function resolveInstantFromTimelineRow(anchor) {
    const clock = findClockTimeInRow(anchor);
    if (!clock) return null;

    const dateHeader = findNearestDateHeader(anchor);
    const base = dateHeader ? new Date(dateHeader.getTime()) : new Date();
    base.setHours(clock.hour, clock.minute, 0, 0);
    return Number.isNaN(base.getTime()) ? null : base;
}

function readMuiTooltipInstant(el) {
    if (!el || el.nodeType !== 1) return null;

    const describedBy = el.getAttribute('aria-describedby');
    if (describedBy) {
        for (const id of describedBy.split(/\s+/)) {
            const tip = document.getElementById(id);
            if (!tip) continue;
            const fromTip = parseInstantValue(tip.textContent);
            if (fromTip) return fromTip;
        }
    }

    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
        for (const id of labelledBy.split(/\s+/)) {
            const tip = document.getElementById(id);
            if (!tip) continue;
            const fromTip = parseInstantValue(tip.textContent);
            if (fromTip) return fromTip;
        }
    }

    return null;
}

export function isValidIanaTimeZone(tz) {
    if (!tz || typeof tz !== 'string') return false;
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

function parseTitleAbsolute(text) {
    const trimmed = String(text).trim();
    if (!TITLE_ABSOLUTE_RE.test(trimmed)) return null;

    const match = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4}),\s+(\d{1,2}):(\d{2}):(\d{2})$/);
    if (!match) return null;

    const month = TITLE_MONTHS[match[1].toLowerCase()];
    if (month == null) return null;

    const day = Number(match[2]);
    const year = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6]);
    const date = new Date(year, month, day, hour, minute, second);
    return Number.isNaN(date.getTime()) ? null : date;
}

function parseInstantValue(value) {
    if (value == null || value === '') return null;
    const text = String(value).trim();
    const fromTitle = parseTitleAbsolute(text);
    if (fromTitle) return fromTitle;

    const parsed = Date.parse(text);
    if (!Number.isNaN(parsed)) return new Date(parsed);
    return null;
}

function readInstantFromElement(el) {
    if (!el || el.nodeType !== 1) return null;

    if (el.tagName === 'TIME') {
        const dt = el.getAttribute('datetime');
        const fromDt = parseInstantValue(dt);
        if (fromDt) return fromDt;
    }

    for (const attr of ['datetime', 'data-datetime', 'data-timestamp', 'data-time']) {
        const fromAttr = parseInstantValue(el.getAttribute(attr));
        if (fromAttr) return fromAttr;
    }

    const title = el.getAttribute('title');
    const fromTitle = parseInstantValue(title);
    if (fromTitle) return fromTitle;

    const aria = el.getAttribute('aria-label');
    const fromAria = parseInstantValue(aria);
    if (fromAria) return fromAria;

    return null;
}

/** Resolve absolute instant for a timeline relative-time anchor. */
export function resolveTimelineInstant(anchor) {
    if (!anchor) return null;

    let node = anchor;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
        const instant = readInstantFromElement(node);
        if (instant) return instant;

        const muiInstant = readMuiTooltipInstant(node);
        if (muiInstant) return muiInstant;

        const timeChild = node.querySelector && node.querySelector('time[datetime]');
        if (timeChild) {
            const fromChild = readInstantFromElement(timeChild);
            if (fromChild) return fromChild;
        }
    }

    const fromRow = resolveInstantFromTimelineRow(anchor);
    if (fromRow) return fromRow;

    return inferInstantFromRelative(anchor.textContent);
}

/** Resolve instant from a spine clock label (e.g. "16:04") plus nearest date header. */
export function resolveInstantFromClockLabel(clockEl) {
    if (!clockEl || clockEl.nodeType !== 1) return null;
    const text = clockEl.textContent.trim();
    if (!isClockTimeText(text)) return null;

    const match = text.match(CLOCK_TIME_RE);
    if (!match) return null;

    const dateHeader = findNearestDateHeader(clockEl);
    const base = dateHeader ? new Date(dateHeader.getTime()) : new Date();
    base.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return Number.isNaN(base.getTime()) ? null : base;
}

const FORMATTER_CACHE = new Map();

function getFormatter(timeZone) {
    const key = timeZone || '__local__';
    if (!FORMATTER_CACHE.has(key)) {
        FORMATTER_CACHE.set(key, new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone,
            timeZoneName: 'short'
        }));
    }
    return FORMATTER_CACHE.get(key);
}

/**
 * @param {Date} date
 * @param {'local'|'client'|'utc'} mode
 * @param {string|null} clientTimeZone IANA zone when mode is client
 * @returns {{ text: string, unavailable: boolean }}
 */
export function formatTimelineInstant(date, mode, clientTimeZone) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return { text: '', unavailable: false };
    }

    if (mode === 'utc') {
        return { text: getFormatter('UTC').format(date), unavailable: false };
    }

    if (mode === 'client') {
        if (!isValidIanaTimeZone(clientTimeZone)) {
            return {
                text: getFormatter(undefined).format(date) + ' (client TZ unavailable)',
                unavailable: true
            };
        }
        return { text: getFormatter(clientTimeZone).format(date), unavailable: false };
    }

    return { text: getFormatter(undefined).format(date), unavailable: false };
}

/**
 * @param {Date} date
 * @param {'local'|'client'|'utc'} mode
 * @param {string|null} clientTimeZone
 * @returns {{ dateLine: string, timeLine: string, tzLine: string, unavailable: boolean }}
 */
export function formatTimelineInstantLines(date, mode, clientTimeZone) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return { dateLine: '', timeLine: '', tzLine: '', unavailable: false };
    }

    let timeZone;
    let unavailable = false;
    if (mode === 'utc') {
        timeZone = 'UTC';
    } else if (mode === 'client') {
        if (!isValidIanaTimeZone(clientTimeZone)) {
            timeZone = undefined;
            unavailable = true;
        } else {
            timeZone = clientTimeZone;
        }
    }

    const dateLine = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone
    }).format(date);

    const timeLine = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone
    }).format(date);

    const tzParts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'short'
    }).formatToParts(date);

    const tzLine = tzParts.find((part) => part.type === 'timeZoneName')?.value || '';

    return { dateLine, timeLine, tzLine, unavailable };
}

export function instantToIso(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return date.toISOString();
}

export function instantFromIso(iso) {
    if (!iso) return null;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
}
