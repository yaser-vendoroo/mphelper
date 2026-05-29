import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const MINIFY = process.env.MPHELPER_MINIFY !== '0';

const distDir = path.join(root, 'dist');
const extDir = path.join(distDir, 'extension');

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
}

function logFileSize(filePath) {
    const name = path.basename(filePath);
    const size = fs.statSync(filePath).size;
    return `${name} ${formatSize(size)}`;
}

async function renderIcons() {
    const iconsSrcDir = path.join(root, 'extension-static/icons');
    const iconsOutDir = path.join(extDir, 'icons');
    ensureDir(iconsOutDir);

    const master = fs.readFileSync(path.join(iconsSrcDir, 'icon.svg'));
    const small = fs.readFileSync(path.join(iconsSrcDir, 'icon-small.svg'));

    const renders = [
        { src: small, size: 16, out: 'icon-16.png' },
        { src: small, size: 32, out: 'icon-32.png' },
        { src: master, size: 48, out: 'icon-48.png' },
        { src: master, size: 128, out: 'icon-128.png' }
    ];

    await Promise.all(renders.map((r) =>
        sharp(r.src, { density: Math.max(72, Math.ceil((r.size / 128) * 384)) })
            .resize(r.size, r.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png({ compressionLevel: 9 })
            .toFile(path.join(iconsOutDir, r.out))
    ));
}

async function build() {
    ensureDir(extDir);

    const extensionCommon = {
        bundle: true,
        platform: 'browser',
        target: ['chrome109'],
        legalComments: 'none',
        minify: MINIFY,
        define: {
            __MPHELPER_VERSION__: JSON.stringify(version)
        }
    };

    const contentOut = path.join(extDir, 'content.js');
    const popupOut = path.join(extDir, 'popup.js');
    const pageInterceptorOut = path.join(extDir, 'page-interceptor.js');
    const cssOut = path.join(extDir, 'mphelper-lite.css');

    await esbuild.build({
        ...extensionCommon,
        entryPoints: [path.join(root, 'src/entries/extension-content.js')],
        format: 'iife',
        outfile: contentOut
    });

    await esbuild.build({
        ...extensionCommon,
        entryPoints: [path.join(root, 'src/entries/extension-popup.js')],
        format: 'iife',
        outfile: popupOut
    });

    await esbuild.build({
        ...extensionCommon,
        entryPoints: [path.join(root, 'src/shared/jwt-interceptor-page.js')],
        format: 'iife',
        outfile: pageInterceptorOut
    });

    await esbuild.build({
        entryPoints: [path.join(root, 'extension-static/mphelper-lite.css')],
        loader: { '.css': 'css' },
        minify: MINIFY,
        outfile: cssOut
    });

    const manifestTemplate = fs.readFileSync(
        path.join(root, 'extension-static/manifest.json'),
        'utf8'
    );
    fs.writeFileSync(
        path.join(extDir, 'manifest.json'),
        manifestTemplate.replace('__VERSION__', version)
    );

    fs.copyFileSync(
        path.join(root, 'extension-static/popup.html'),
        path.join(extDir, 'popup.html')
    );

    await renderIcons();

    const extSizes = [
        logFileSize(contentOut),
        logFileSize(popupOut),
        logFileSize(pageInterceptorOut),
        logFileSize(cssOut)
    ].join(' · ');

    console.log(`Built MPHelper v${version}`);
    console.log(`  Extension: dist/extension/ (${MINIFY ? 'minified' : 'readable'})`);
    console.log(`  Bundle sizes: ${extSizes}`);
}

build().catch((err) => {
    console.error(err);
    process.exit(1);
});
