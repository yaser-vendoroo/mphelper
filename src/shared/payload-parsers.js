export function getWoNumberFromPayload(data) {
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

export function getTitleFromPayload(data) {
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

export function getWorkOrderIdFromPayload(data) {
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

export function getResidentUserIdFromPayload(data) {
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

function collectTimeZoneCandidates(obj, out) {
    if (obj == null || typeof obj !== 'object') return;
    const keys = [
        'timeZone', 'timezone', 'TimeZone', 'Timezone',
        'propertyTimeZone', 'clientTimeZone', 'ClientTimeZone'
    ];
    for (const key of keys) {
        const v = obj[key];
        if (v != null && String(v).trim() !== '') out.push(String(v).trim());
    }
    if (obj.property && typeof obj.property === 'object') {
        for (const key of ['timeZone', 'timezone', 'TimeZone', 'Timezone']) {
            const v = obj.property[key];
            if (v != null && String(v).trim() !== '') out.push(String(v).trim());
        }
    }
    if (obj.client && typeof obj.client === 'object') {
        for (const key of ['timeZone', 'timezone', 'TimeZone']) {
            const v = obj.client[key];
            if (v != null && String(v).trim() !== '') out.push(String(v).trim());
        }
    }
}

export function getClientTimeZoneFromPayload(data) {
    if (data == null || typeof data !== 'object') return null;
    const candidates = [];
    collectTimeZoneCandidates(data, candidates);
    if (data.data && typeof data.data === 'object') {
        collectTimeZoneCandidates(data.data, candidates);
    }
    for (const tz of candidates) {
        if (/^[A-Za-z_]+\/[A-Za-z_]+$/.test(tz) || tz === 'UTC') return tz;
    }
    return candidates[0] || null;
}
