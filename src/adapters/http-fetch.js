export function createHttpFetch() {
    return {
        async request({ method, url, headers, responseType }) {
            const res = await fetch(url, { method, headers });
            const responseHeaders = Array.from(res.headers.entries())
                .map(([name, value]) => `${name}: ${value}`)
                .join('\n');

            if (responseType === 'arraybuffer') {
                const buf = await res.arrayBuffer();
                return {
                    status: res.status,
                    statusText: res.statusText,
                    response: buf,
                    responseText: '',
                    responseHeaders
                };
            }

            const responseText = await res.text();
            return {
                status: res.status,
                statusText: res.statusText,
                responseText,
                responseHeaders
            };
        }
    };
}
