const IMAGE_REVIEW_TASKS_AND_DESC = `Tasks:
1) Rate how accurate and complete the description is compared to what you see in the image, on a scale of 1–10 (10 = fully accurate and complete).
2) Give a short bullet list: what matches the image, what is missing or wrong, and any overclaims.

Automated description:
---
`;

const IMAGE_REVIEW_PROMPT_SEPARATE = `You are reviewing a resident-submitted maintenance photo and an automated image description (from another system).

I pasted the photo and this text as two separate clipboard pastes — use the image from the other paste in this same chat together with the automated description below.

` + IMAGE_REVIEW_TASKS_AND_DESC;

const IMAGE_REVIEW_PROMPT_COMBINED = `You are reviewing a resident-submitted maintenance photo and an automated image description (from another system).

This paste may include both the photo and the text below in one clipboard entry — use the image together with the automated description.

` + IMAGE_REVIEW_TASKS_AND_DESC;

const IMAGE_REVIEW_PROMPT_SUFFIX = `
---

Respond in this shape:
Score: X/10
- bullet
- bullet
`;

function buildImageReviewClipboardText(analysisText, imageLabel, combinedPaste) {
    const body = (analysisText || '').trim() || '(no analysis text found)';
    const label = imageLabel ? `Image file name: ${imageLabel}\n\n` : '';
    const head = combinedPaste ? IMAGE_REVIEW_PROMPT_COMBINED : IMAGE_REVIEW_PROMPT_SEPARATE;
    return label + head + body + IMAGE_REVIEW_PROMPT_SUFFIX;
}

function parseContentTypeFromHeaders(headers) {
    if (!headers || typeof headers !== 'string') return '';
    const lines = headers.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^content-type:\s*(.+)$/i);
        if (m) return m[1].split(';')[0].trim().toLowerCase();
    }
    return '';
}

function inferImageMimeFromUrl(url) {
    const u = String(url || '').toLowerCase();
    if (u.includes('.png')) return 'image/png';
    if (u.includes('.webp')) return 'image/webp';
    if (u.includes('.gif')) return 'image/gif';
    return 'image/jpeg';
}

function normalizeImageBlobType(blob, urlHint) {
    let t = blob.type && String(blob.type).toLowerCase().split(';')[0].trim();
    if (t === 'image/jpeg' || t === 'image/jpg' || t === 'image/png' || t === 'image/gif' || t === 'image/webp') {
        if (t === 'image/jpg') t = 'image/jpeg';
        return t === blob.type ? blob : blob.slice(0, blob.size, t);
    }
    const u = (urlHint || '').toLowerCase();
    if (u.includes('.png')) return blob.slice(0, blob.size, 'image/png');
    if (u.includes('.webp')) return blob.slice(0, blob.size, 'image/webp');
    if (u.includes('.gif')) return blob.slice(0, blob.size, 'image/gif');
    return blob.slice(0, blob.size, 'image/jpeg');
}

function mimeForClipboardWrite(blobType) {
    const t = (blobType || '').toLowerCase().split(';')[0].trim();
    if (t === 'image/jpg' || t === 'image/pjpeg') return 'image/jpeg';
    if (t === 'image/jpeg' || t === 'image/png') return t;
    return null;
}

async function blobToPngForClipboard(blob) {
    const bmp = await createImageBitmap(blob);
    try {
        const canvas = document.createElement('canvas');
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bmp, 0, 0);
        return await new Promise((resolve, reject) => {
            canvas.toBlob((b) => {
                if (b && b.size > 0) resolve(b);
                else reject(new Error('PNG encode failed'));
            }, 'image/png');
        });
    } finally {
        bmp.close();
    }
}

export function createClipboardApi(http) {
    function copyToClipboard(text) {
        return navigator.clipboard.writeText(text);
    }

    async function fetchUrlAsImageBlob(url) {
        const res = await http.request({
            method: 'GET',
            url,
            responseType: 'arraybuffer'
        });

        if (res.status < 200 || res.status >= 300) {
            throw new Error(`HTTP ${res.status}`);
        }

        const buf = res.response;
        if (!buf || buf.byteLength === 0) {
            throw new Error('Empty image');
        }

        let ct = parseContentTypeFromHeaders(res.responseHeaders);
        if (!ct || ct === 'application/octet-stream') {
            ct = inferImageMimeFromUrl(url);
        }
        return new Blob([buf], { type: ct });
    }

    async function getClipboardReadyImage(img) {
        const src = img.currentSrc || img.src;
        if (!src) throw new Error('No image URL');
        const rawBlob = await fetchUrlAsImageBlob(src);
        let imageBlob = normalizeImageBlobType(rawBlob, src);
        let writeMime = mimeForClipboardWrite(imageBlob.type);
        if (!writeMime) {
            imageBlob = await blobToPngForClipboard(imageBlob);
            writeMime = 'image/png';
        }
        return { imageBlob, writeMime };
    }

    async function copyImageAndPromptCombined(img, analysisText) {
        const alt = img.getAttribute('alt') || '';
        const textCombined = buildImageReviewClipboardText(analysisText, alt, true);
        const textBlob = new Blob([textCombined], { type: 'text/plain;charset=utf-8' });
        const textSeparate = buildImageReviewClipboardText(analysisText, alt, false);

        if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
            await copyToClipboard(textSeparate);
            return { mode: 'text-only', reason: 'clipboard-api' };
        }

        let imageBlob;
        let writeMime;
        try {
            ({ imageBlob, writeMime } = await getClipboardReadyImage(img));
        } catch (fetchErr) {
            await copyToClipboard(textSeparate);
            return { mode: 'text-only', reason: 'image-fetch' };
        }

        const writeCombined = (ib, mime) =>
            navigator.clipboard.write([
                new ClipboardItem({
                    [mime]: Promise.resolve(ib),
                    'text/plain': Promise.resolve(textBlob)
                })
            ]);

        try {
            await writeCombined(imageBlob, writeMime);
            return { mode: 'combined' };
        } catch (firstErr) {
            if (writeMime !== 'image/png') {
                try {
                    const pngBlob = await blobToPngForClipboard(imageBlob);
                    await writeCombined(pngBlob, 'image/png');
                    return { mode: 'combined' };
                } catch (pngErr) {
                    /* fall through */
                }
            }
            await copyToClipboard(textSeparate);
            return { mode: 'text-only', reason: 'combined-write' };
        }
    }

    return { copyToClipboard, copyImageAndPromptCombined };
}
