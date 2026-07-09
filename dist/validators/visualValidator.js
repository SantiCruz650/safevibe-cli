import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
export async function serveDir(dir) {
    const server = http.createServer((req, res) => {
        const rel = decodeURIComponent((req.url || '/').split('?')[0]);
        const filePath = path.join(dir, rel === '/' ? 'index.html' : rel);
        if (!filePath.startsWith(dir)) {
            res.statusCode = 403;
            return res.end();
        }
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.statusCode = 404;
                return res.end('Not found');
            }
            const ext = path.extname(filePath);
            res.setHeader('Content-Type', ext === '.html' ? 'text/html' :
                ext === '.js' || ext === '.mjs' ? 'text/javascript' : 'application/octet-stream');
            res.end(data);
        });
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', () => r()));
    const { port } = server.address();
    return { origin: `http://127.0.0.1:${port}`, close: () => server.close() };
}
export class VisualValidator {
    screenshotDir;
    constructor(screenshotDir) {
        this.screenshotDir = screenshotDir || '/tmp/safevibe-screenshots';
    }
    async validate(htmlPath) {
        await fs.promises.mkdir(this.screenshotDir, { recursive: true });
        const browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--use-gl=angle',
                '--use-angle=swiftshader-webgl',
                '--enable-webgl',
                '--enable-unsafe-swiftshader',
            ],
        });
        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
        });
        const page = await context.newPage();
        const consoleErrors = [];
        const runtimeErrors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });
        page.on('pageerror', (err) => {
            runtimeErrors.push(err.message);
        });
        page.on('crash', () => {
            runtimeErrors.push('Browser tab crashed');
        });
        page.on('requestfailed', (req) => {
            runtimeErrors.push(`Request fallida: ${req.url()} (${req.failure()?.errorText ?? 'desconocido'})`);
        });
        page.on('response', (res) => {
            if (res.status() >= 400) {
                runtimeErrors.push(`HTTP ${res.status()} al cargar ${res.url()}`);
            }
        });
        const srv = await serveDir(path.dirname(htmlPath));
        try {
            await page
                .goto(`${srv.origin}/${path.basename(htmlPath)}`, { waitUntil: 'networkidle', timeout: 30000 })
                .catch(() => {
                runtimeErrors.push('Timeout/error loading page');
            });
            // Esperar 2 frames + polling activo hasta que window.scene tenga meshes (o timeout).
            // Las texturas procedurales tardan; un delay fijo cuenta demasiado pronto y devuelve -1.
            await page.evaluate(async () => {
                await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            });
            const SCENE_TIMEOUT_MS = 8000;
            const POLL_MS = 200;
            const started = Date.now();
            while (Date.now() - started < SCENE_TIMEOUT_MS) {
                const ready = await page.evaluate(() => {
                    const win = window;
                    if (!win.scene || !win.scene.children)
                        return false;
                    let count = 0;
                    const stack = [win.scene];
                    while (stack.length) {
                        const o = stack.pop();
                        if (!o)
                            continue;
                        if (o.isMesh)
                            count++;
                        if (o.children)
                            for (const c of o.children)
                                stack.push(c);
                    }
                    return count > 0;
                }).catch(() => false);
                if (ready)
                    break;
                await new Promise((r) => setTimeout(r, POLL_MS));
            }
            // margen extra para que terminen de renderizarse las texturas
            await page.waitForTimeout(500);
            let meshCount = 0;
            try {
                const meshInfo = await page.evaluate(() => {
                    const win = window;
                    const diag = {
                        hasScene: !!win.scene,
                        hasRenderer: !!win.renderer,
                        hasCamera: !!win.camera,
                        childrenCount: win.scene?.children?.length ?? -1,
                        hasCanvasInDom: !!document.querySelector('canvas'),
                        count: 0,
                        error: null,
                    };
                    try {
                        if (!win.scene || !win.scene.children) {
                            diag.error = 'window.scene no existe o no tiene children';
                            return diag;
                        }
                        let count = 0;
                        const stack = [win.scene];
                        while (stack.length) {
                            const o = stack.pop();
                            if (!o)
                                continue;
                            if (o.isMesh)
                                count++;
                            if (o.children)
                                for (const c of o.children)
                                    stack.push(c);
                        }
                        diag.count = count;
                    }
                    catch (e) {
                        diag.error = (e && e.name ? e.name + ': ' : '') + (e && e.message ? e.message : String(e));
                    }
                    return diag;
                });
                meshCount = meshInfo.count;
                if (meshInfo.error) {
                    meshCount = -1;
                    runtimeErrors.push(`Conteo de meshes fallo: ${meshInfo.error} | scene=${meshInfo.hasScene} ` +
                        `renderer=${meshInfo.hasRenderer} camera=${meshInfo.hasCamera} ` +
                        `children=${meshInfo.childrenCount} canvasEnDOM=${meshInfo.hasCanvasInDom}`);
                }
                else if (meshCount === 0) {
                    runtimeErrors.push(`Escena sin meshes | scene=${meshInfo.hasScene} children=${meshInfo.childrenCount} ` +
                        `canvasEnDOM=${meshInfo.hasCanvasInDom}`);
                }
            }
            catch (e) {
                meshCount = -1;
                runtimeErrors.push(`page.evaluate del conteo fallo (page cerrada?): ${e.message}`);
            }
            // === Verificar WebGL real (pixel readback) ===
            let rendersNothing = true;
            let webglInfo = 'no-info';
            try {
                const webglStatus = await page.evaluate(() => {
                    const win = window;
                    let canvas = null;
                    try {
                        if (win.renderer && win.renderer.domElement) {
                            canvas = win.renderer.domElement;
                        }
                    }
                    catch (e) { }
                    if (!canvas)
                        canvas = document.querySelector('canvas');
                    if (!canvas)
                        return { error: 'no canvas' };
                    try {
                        if (win.renderer && win.scene && win.camera) {
                            win.renderer.render(win.scene, win.camera);
                        }
                    }
                    catch (e) { }
                    const gl = canvas.getContext('webgl2') ||
                        canvas.getContext('webgl');
                    if (!gl)
                        return { error: 'no gl context' };
                    const cw = canvas.width || 1280;
                    const ch = canvas.height || 720;
                    const pixel = new Uint8Array(4);
                    gl.readPixels(Math.floor(cw / 2), Math.floor(ch / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
                    const samples = [Array.from(pixel)];
                    const positions = [
                        [Math.floor(cw * 0.25), Math.floor(ch * 0.25)],
                        [Math.floor(cw * 0.75), Math.floor(ch * 0.25)],
                        [Math.floor(cw * 0.25), Math.floor(ch * 0.75)],
                        [Math.floor(cw * 0.75), Math.floor(ch * 0.75)],
                    ];
                    for (const [px, py] of positions) {
                        const p2 = new Uint8Array(4);
                        gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p2);
                        samples.push(Array.from(p2));
                    }
                    const allBlack = samples.every((s) => (s[0] === 0 && s[1] === 0 && s[2] === 0));
                    return {
                        renderer: gl.getParameter(gl.RENDERER),
                        centerPixel: samples[0],
                        allSamples: samples,
                        allBlack,
                        canvasSize: [cw, ch],
                    };
                });
                if (webglStatus && !webglStatus.error) {
                    rendersNothing = Boolean(webglStatus.allBlack);
                    webglInfo = `renderer=${webglStatus.renderer}, center=${JSON.stringify(webglStatus.centerPixel)}, allBlack=${webglStatus.allBlack}`;
                }
                else {
                    webglInfo = (webglStatus && webglStatus.error) || 'unknown';
                    runtimeErrors.push(`WebGL: ${webglInfo}`);
                }
            }
            catch (e) {
                runtimeErrors.push(`Pixel readback failed: ${e.message}`);
            }
            const isBlackScreen = meshCount <= 0 || rendersNothing;
            const screenshotName = `sim-${Date.now()}.png`;
            const screenshotPath = path.join(this.screenshotDir, screenshotName);
            try {
                await page.screenshot({ path: screenshotPath, fullPage: true });
            }
            catch {
                runtimeErrors.push('Screenshot failed (page crashed)');
            }
            try {
                await browser.close();
            }
            catch { }
            const reasons = [];
            let score = 0;
            if (meshCount >= 8) {
                score += 30;
            }
            else {
                reasons.push(`meshCount: ${meshCount} (esperado >= 8)`);
            }
            if (meshCount >= 15) {
                score += 20;
            }
            if (!isBlackScreen) {
                score += 20;
            }
            else {
                if (rendersNothing) {
                    reasons.push(`WebGL no renderiza píxeles (contexto existe pero canvas vacío). ${webglInfo}`);
                }
                else {
                    reasons.push('Pantalla negra (meshCount <= 0)');
                }
            }
            if (consoleErrors.length === 0) {
                score += 15;
            }
            else {
                reasons.push(`Errores consola: ${consoleErrors.slice(0, 3).join('; ')}`);
            }
            if (runtimeErrors.length === 0) {
                score += 15;
            }
            else {
                reasons.push(`Errores runtime: ${runtimeErrors.slice(0, 3).join('; ')}`);
            }
            return {
                pass: score >= 70,
                meshCount,
                isBlackScreen,
                consoleErrors,
                runtimeErrors,
                screenshotPath,
                score,
                reasons,
            };
        }
        finally {
            srv.close();
        }
    }
}
