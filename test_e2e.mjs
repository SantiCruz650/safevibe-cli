import { SecureGenerator } from './dist/core/secureGenerator.js';
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const prompt = `Simulación del sistema solar con los 8 planetas, anillos de Saturno, lunas, clic para seleccionar planeta, toggle de órbitas con tecla O`;

const logs = [];
const onLog = (msg, type) => {
  const icon = type === 'error' ? '✗' : type === 'success' ? '✓' : type === 'warn' ? '⚠' : '•';
  console.log(`  ${icon} ${msg}`);
  logs.push(`[${type}] ${msg}`);
};

console.log('\n=== INICIANDO GENERACIÓN DEL SISTEMA SOLAR ===\n');
console.log(`Prompt: "${prompt}"\n`);

const gen = new SecureGenerator();
await gen.init();

const start = Date.now();
const result = await gen.generate('web', prompt, onLog, true);
const elapsed = ((Date.now() - start) / 1000).toFixed(1);

console.log(`\n=== RESULTADO (${elapsed}s) ===`);
console.log(`  Success: ${result.success}`);
console.log(`  Extension: ${result.extension}`);
console.log(`  Code length: ${result.code.length} chars`);

if (!result.success) {
  console.log('\n  ✗ GENERACIÓN FALLÓ');
  process.exit(1);
}

const outDir = path.join(process.cwd(), 'safevibe_output');
await fs.promises.mkdir(outDir, { recursive: true });
const htmlPath = path.join(outDir, 'e2e_solar_system.html');
await fs.promises.writeFile(htmlPath, result.code);
console.log(`\n  HTML escrito: ${htmlPath}`);

console.log('\n=== VALIDACIÓN VISUAL CON PLAYWRIGHT ===\n');

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-webgl', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const consoleErrors = [];
const runtimeErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => runtimeErrors.push(err.message));
page.on('crash', () => runtimeErrors.push('Browser tab crashed'));

console.log('  Cargando HTML en Chromium headless...');
await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(e => {
  console.log(`  ⚠ Error loading page: ${e.message}`);
});
await page.waitForTimeout(3000);

let meshCount = 0;
try {
  meshCount = await page.evaluate(() => {
    try {
      const s = window.scene;
      if (!s || !s.children) return -1;
      let c = 0;
      s.children.forEach(ch => {
        if (ch.isMesh) c++;
        if (ch.children) ch.children.forEach(gc => { if (gc.isMesh) c++; });
      });
      return c;
    } catch { return -1; }
  });
} catch {
  runtimeErrors.push('Page closed before mesh evaluation');
}

const screenshotDir = path.join(process.cwd(), 'docs', 'screenshots');
await fs.promises.mkdir(screenshotDir, { recursive: true });
const screenshotPath = path.join(screenshotDir, 'solar-system-after.png');
await page.screenshot({ path: screenshotPath, fullPage: true });
console.log(`  Screenshot: ${screenshotPath}`);

await browser.close();

console.log('\n=== REPORTE ===');
console.log(`  Score visual: ${meshCount >= 8 ? 30 : 0}/${meshCount >= 15 ? 20 : 0}`);
console.log(`  Mesh count: ${meshCount}`);
console.log(`  8+ planetas visibles: ${meshCount >= 8 ? '✓' : '✗'}`);
console.log(`  Anillos Saturno: ${result.code.includes('Saturno') || result.code.includes('saturn') || result.code.includes('Ring') ? '✓ (en código)' : '?'}`);
console.log(`  Estrellas fondo: ${result.code.includes('starfield') || result.code.includes('createStarfield') ? '✓' : '?'}`);
console.log(`  Errores consola: ${consoleErrors.length === 0 ? '0 ✓' : consoleErrors.length}`);
console.log(`  Errores runtime: ${runtimeErrors.length === 0 ? '0 ✓' : runtimeErrors.length}`);
console.log(`  Tiempo total: ${elapsed}s`);

if (consoleErrors.length > 0) {
  console.log('\n  Errores de consola:');
  consoleErrors.forEach(e => console.log(`    ✗ ${e.substring(0, 120)}`));
}
if (runtimeErrors.length > 0) {
  console.log('\n  Errores runtime:');
  runtimeErrors.forEach(e => console.log(`    ✗ ${e.substring(0, 120)}`));
}

console.log('\n=== FIN DE PRUEBA ===\n');
