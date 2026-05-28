export function createImageAnalysis(storageApi, clipboardApi) {
    function findAnalysisTextForRequestImage(img) {
        let row = img.closest('div.flex');
        if (!row) return '';
        let p = row.querySelector('p');
        if (p && p.textContent) return p.textContent.trim();
        const aside = row.querySelector('.float-right');
        if (aside) {
            p = aside.querySelector('p');
            if (p && p.textContent) return p.textContent.trim();
        }
        return '';
    }

    function markInjected(el) {
        el.setAttribute('data-mphelper-image-copy', '1');
    }

    function isInjected(el) {
        return el.getAttribute('data-mphelper-image-copy') === '1';
    }

    function removeImageAnalysisCopyUI() {
        document.querySelectorAll('.vendoroo-mphelper-image-analysis-actions').forEach((el) => el.remove());
        document.querySelectorAll('img[data-mphelper-image-copy="1"]').forEach((im) => im.removeAttribute('data-mphelper-image-copy'));
    }

    function injectImageAnalysisCopyButton(img) {
        if (!storageApi.getImageAnalysisCopyEnabled()) return;
        if (!img || img.tagName !== 'IMG' || isInjected(img)) return;
        const row = img.closest('div.flex');
        if (!row) return;

        markInjected(img);
        const wrap = document.createElement('div');
        wrap.className = 'vendoroo-mphelper-image-analysis-actions';

        const defaultLabel = 'Copy for AI review';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'vendoroo-mphelper-image-analysis-copy';
        btn.textContent = defaultLabel;
        btn.title = 'Copy image and LLM prompt together (one clipboard entry; some apps paste only text)';

        let resetTimer = null;
        function flash(className, label, ms) {
            btn.classList.remove('vendoroo-mphelper-copy-done', 'vendoroo-mphelper-copy-fail');
            if (className) btn.classList.add(className);
            btn.textContent = label;
            if (resetTimer) clearTimeout(resetTimer);
            resetTimer = setTimeout(() => {
                btn.classList.remove('vendoroo-mphelper-copy-done', 'vendoroo-mphelper-copy-fail');
                btn.textContent = defaultLabel;
            }, ms);
        }

        btn.addEventListener('click', async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const analysis = findAnalysisTextForRequestImage(img);
            btn.disabled = true;
            try {
                const result = await clipboardApi.copyImageAndPromptCombined(img, analysis);
                if (result.mode === 'combined') {
                    flash('vendoroo-mphelper-copy-done', 'Copied (image + text)', 2400);
                } else {
                    flash('vendoroo-mphelper-copy-done', 'Copied text only', 3200);
                }
            } catch (err) {
                flash('vendoroo-mphelper-copy-fail', 'Copy failed', 2500);
            } finally {
                btn.disabled = false;
            }
        });

        wrap.appendChild(btn);
        row.appendChild(wrap);
    }

    function scanImageAnalysisCopyTargets() {
        if (!storageApi.getImageAnalysisCopyEnabled()) {
            removeImageAnalysisCopyUI();
            return;
        }
        document.querySelectorAll('img[data-id="request-files-image"]').forEach(injectImageAnalysisCopyButton);
    }

    let imageAnalysisScanScheduled = false;
    function scheduleImageAnalysisScan() {
        if (imageAnalysisScanScheduled) return;
        imageAnalysisScanScheduled = true;
        requestAnimationFrame(() => {
            imageAnalysisScanScheduled = false;
            scanImageAnalysisCopyTargets();
        });
    }

    function installImageAnalysisCopyObserver() {
        if (!document.body) return;
        scanImageAnalysisCopyTargets();
        const obs = new MutationObserver(() => scheduleImageAnalysisScan());
        obs.observe(document.body, { childList: true, subtree: true });
    }

    return {
        installImageAnalysisCopyObserver,
        scheduleImageAnalysisScan,
        removeImageAnalysisCopyUI
    };
}
