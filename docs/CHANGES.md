# Cambios Aplicados — SafeVibe CLI

> Serie de mejoras al pipeline de generación de simulaciones 3D.

## Fase 1 — Correcciones críticas

### 1.1 Fix SIM-CHECK loop (`src/core/secureGenerator.ts:242`)
```diff
- // currentJsCode nunca se actualizaba con el código reparado
+ currentJsCode = this.extractCode(rawRepairedCode);
```
Sin esto, las 3 iteraciones del SIM-CHECK loop descartaban el código reparado por la IA.

### 1.2 max_tokens 4096 (revertido desde 8192)
`standardProvider.ts` y `openRouterProvider.ts` — max_tokens subió de 4096 a 8192 y se revertió a 4096 por límite de 6000 TPM en Groq free tier.

### 1.3 Mutex en AIManager (`src/ai/aiManager.ts`)
Patrón `initPromise` + flag `initialized` para evitar race conditions en inicialización concurrente.

### 1.4 try/finally con cleanup() (`src/core/secureGenerator.ts`)
Se garantiza que `fileManager.cleanup()` se ejecute incluso si `generate()` lanza excepción.

## Fase 2 — Src/Dist sync
Reconstrucción con `tsc` para sincronizar source y dist luego de los fixes.

## Fase 3 — Templates sistema solar
Creación de 4 archivos de template en `src/simulations/solar-system/templates/`:
- `data.ts` — Datos reales de NASA para los 8 planetas + Sol
- `textures.ts` — 13 texturas procedurales (sol, planetas, lunas, estrellas)
- `scene-snippet.ts` — 9 funciones helper (órbitas, planetas, sol, raycaster)
- `system-prompt.md` — Prompt que instruye al LLM a usar las funciones disponibles

Integración en `secureGenerator.ts` con detección automática de keywords de sistema solar.

## Fase 4 — Visual Validator
Creación de `src/validators/visualValidator.ts` con validación Playwright:
- Score 0-100 basado en meshCount, black screen, console/runtime errors
- 3 intentos de corrección visual con feedback loop
- Chromium headless + SwiftShader para WebGL software

## Fase 5 — Snippets reutilizables
5 archivos en `src/simulations/snippets/`:
- `procedural-texture.ts` — Texturas procedurales genéricas (gradient, noise, crater, banded, starfield)
- `orbital-mechanics.ts` — Órbitas, pivotes, inclinación axial
- `interaction.ts` — Raycaster, camera follow, hover labels
- `atmosphere.ts` — Glow atmosférico, capas de nubes
- `lighting.ts` — Iluminación solar y PBR

## Fase 6 — E2E test & fixes de template

### Problemas resueltos:

| Problema | Causa | Fix |
|----------|-------|-----|
| `Unexpected token 'export'` | Templates TS inyectados como JS | stripTSConstructs remove `export` |
| `Unexpected token '!'` | Non-null assertion `canvas.getContext('2d')!` | stripTSConstructs remove `!` |
| `Illegal return statement` | Return type `): { ... }` JS inválido | stripTSConstructs remove inline object types |
| `Error creating WebGL context` | Chromium `--disable-gpu` bloqueaba WebGL | Flags: `--use-gl=angle --use-angle=swiftshader-webgl` |
| `Falta actualizar el HUD` | System prompt no mencionaba HUD | Añadida regla HUD + ejemplo con setupRaycaster + hud.innerHTML |
| `Falta[n] parentesis/llaves` | max_tokens=4096 trunca código largo | SIM-CHECK loop corrige, pero truncamiento persiste por TPM limit |

### Templates convertidos de TS a JS puro:
7 archivos reescritos sin TypeScript para evitar dependencia de stripTSConstructs:
- `textures.ts` — sin anotaciones de tipo, sin `!`, sin `export`
- `scene-snippet.ts` — parámetros inline type `config: { ... } = {}` → `config = {}`
- 5 snippets — mismos cambios

### System prompt mejorado:
- Regla #10: HUD con `hud.innerHTML`
- Ejemplo de código con `setupRaycaster` + `hud.innerHTML`
