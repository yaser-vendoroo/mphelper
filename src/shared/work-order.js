import { getEnvConfig, WORK_ORDER_API_PATH } from './constants.js';
import {
    getResidentUserIdFromPayload,
    getTitleFromPayload,
    getWoNumberFromPayload,
    getWorkOrderIdFromPayload
} from './payload-parsers.js';

export function createWorkOrderApi(http) {
    function getWorkOrderApiUrl(workOrderId) {
        const base = getEnvConfig().apiBase;
        return workOrderId ? `${base}${WORK_ORDER_API_PATH}/${workOrderId}` : `${base}${WORK_ORDER_API_PATH}/{id}`;
    }

    async function fetchWorkOrder(workOrderId, jwt) {
        const cfg = getEnvConfig();
        const url = getWorkOrderApiUrl(workOrderId);
        const page = cfg.pageOrigin;
        const res = await http.request({
            method: 'GET',
            url,
            headers: {
                accept: 'application/json',
                authorization: `Bearer ${jwt}`,
                origin: page,
                referer: page + '/'
            }
        });

        if (res.status < 200 || res.status >= 300) {
            const msg = res.responseText ? res.responseText.slice(0, 200) : res.statusText;
            throw new Error(`HTTP ${res.status}: ${msg}`);
        }

        const data = JSON.parse(res.responseText);
        return {
            woNumber: getWoNumberFromPayload(data),
            title: getTitleFromPayload(data),
            workOrderId: getWorkOrderIdFromPayload(data),
            residentUserId: getResidentUserIdFromPayload(data),
            rawResponse: res.responseText
        };
    }

    return { fetchWorkOrder, getWorkOrderApiUrl };
}
