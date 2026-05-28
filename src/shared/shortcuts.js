export function parseShortcut(combo) {
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

export function eventToShortcut(ev) {
    const parts = [];
    if (ev.ctrlKey) parts.push('Ctrl');
    if (ev.altKey) parts.push('Alt');
    if (ev.shiftKey) parts.push('Shift');
    if (ev.metaKey) parts.push('Meta');
    const k = ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;
    if (k && !['Control', 'Alt', 'Shift', 'Meta'].includes(ev.key)) parts.push(k);
    return parts.join('+') || '';
}

export function eventMatchesShortcut(ev, combo) {
    const p = parseShortcut(combo);
    if (!p.key) return false;
    return ev.ctrlKey === p.ctrl && ev.altKey === p.alt && ev.shiftKey === p.shift && ev.metaKey === p.meta &&
        (ev.key === p.key || (ev.key.length === 1 && ev.key.toUpperCase() === p.key));
}
