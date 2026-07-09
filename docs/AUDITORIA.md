# Auditoría SafeVibe CLI

> Fecha: 2026-07-03  
> Proyecto: safevibe-cli  
> Commits analizados: working tree actual

---

## FASE 1 — MAPEO DEL REPOSITORIO

### Árbol del proyecto (src/, profundidad 4)

```
safevibe-cli/
├── config.json                       ← API keys, modelo, proveedor
├── package.json                      ← Dependencias + scripts
├── tsconfig.json                     ← ES2022 + NodeNext + React JSX
├── .gitignore
├── README.md
├── src/
│   ├── index.ts                      (6 LOC)  entrypoint
│   ├── ui.tsx                        (40 LOC) prototype legacy
│   ├── ui/App.tsx                    (281 LOC) UI principal
│   ├── core/
│   │   ├── secureGenerator.ts        (350 LOC) orquestador + pipeline
│   │   └── htmlTemplate.ts           (154 LOC) template HTML final
│   ├── ai/
│   │   ├── aiManager.ts              (69 LOC) router dual-provider
│   │   └── providers/
│   │       ├── types.ts              (3 LOC) interface
│   │       ├── standardProvider.ts    (73 LOC) Groq
│   │       ├── anthropicProvider.ts   (69 LOC) Claude (inactivo)
│   │       ├── nvidiaProvider.ts      (52 LOC) Nvidia (inactivo)
│   │       ├── ollamaProvider.ts      (36 LOC) Ollama (inactivo)
│   │       └── openRouterProvider.ts  (66 LOC) OpenRouter
│   ├── config/
│   │   └── configHandler.ts          (85 LOC) carga/valida/guarda config
│   ├── validators/
│   │   ├── types.ts                  (9 LOC) interfaces
│   │   ├── validatorRouter.ts        (35 LOC) rutea por extensión
│   │   ├── htmlValidator.ts          (41 LOC) valida JS output
│   │   ├── pythonValidator.ts        (24 LOC) inactivo
│   │   ├── typescriptValidator.ts    (30 LOC) inactivo
│   │   └── securityAnalyzer.ts       (76 LOC) escaneo seguridad
│   ├── system/
│   │   ├── fileManager.ts            (29 LOC) sandbox temp
│   │   └── fileReader.ts             (63 LOC) carga PDF/imágenes
│   ├── engine/
│   │   ├── physicsTest.ts            (56 LOC) legacy no usado
│   │   └── renderer.ts               (72 LOC) legacy no usado
│   ├── graphics/                     VACÍO
│   ├── voice/                        VACÍO
│   └── types/
│       └── declarations.d.ts         (16 LOC) type stubs
└── safevibe_output/
    └── simulation.html               último output generado
```

### Tabla de archivos fuente

| Ruta | LOC | Responsabilidad |
|------|-----|-----------------|
| `src/index.ts` | 6 | Entrypoint: `render(<App/>)` con Ink |
| `src/ui/App.tsx` | 281 | Menú TUI, prompts, logs en vivo, resultado, open browser |
| `src/core/secureGenerator.ts` | 350 | Pipeline: build prompt → LLM → extract → anti-bugs → security → validate → template |
| `src/core/htmlTemplate.ts` | 154 | Envuelve código JS en HTML con Three.js r128 + Cannon.js + boilerplate runtime |
| `src/ai/aiManager.ts` | 69 | Inicializa provider según config, rutea visión vs código |
| `src/ai/providers/standardProvider.ts` | 73 | HTTP POST a Groq con retry (5 intentos, backoff) |
| `src/ai/providers/openRouterProvider.ts` | 66 | HTTP POST a OpenRouter (visión) |
| `src/config/configHandler.ts` | 85 | Carga/escribe `config.json`, defaults |
| `src/validators/htmlValidator.ts` | 41 | 4 checks estructurales: material, scene.add, HUD, world.step |
| `src/validators/securityAnalyzer.ts` | 76 | 2 fases: heurística (regex eval/fetch) + verificación HTTP PyPI/npm |
| `src/validators/validatorRouter.ts` | 35 | Enruta por extensión (.ts/.py/.html/.js) |
| `src/system/fileManager.ts` | 29 | Sandbox `/tmp/safevibe-sandbox` |
| `src/system/fileReader.ts` | 63 | Carga PDF (pdf-parse) + imágenes (base64) |

### Métricas del proyecto

| Métrica | Valor |
|---------|-------|
| LOC activos (en pipeline) | ~1,030 |
| LOC legacy/inactivos | ~402 |
| LOC totales | ~1,432 |
| Archivos activos | 12 |
| Archivos legacy/inactivos | 10 (7 archivos + 2 directorios vacíos + 1 función muerta) |
| Dependencias activas | 6 de 9 |

---

## FASE 2 — SYSTEM PROMPT Y PIPELINE DE GENERACIÓN

### System prompt (simulación 3D) — `secureGenerator.ts:162-205`

```
Eres un simulador cientifico 3D experto en Three.js y CANNON.js.
CRITICO: Escribe SOLO codigo JavaScript PURO (ES5/ES6).
THREE (r128), CANNON (0.6.2) y OrbitControls son variables globales.

La plantilla SafeVibe YA PROVEE:
  - scene, camera (PerspectiveCamera 55deg), renderer (ACESFilmic+sRGB)
  - OrbitControls con damping, clock, resize handler
  - Iluminacion PBR: AmbientLight + DirectionalLight + fill + rim
  - Bucle animate() por defecto
  - FPS counter auto

TU SOLO AGREGA objetos a scene con scene.add().
NO crees scene/camera/renderer/controls nuevos.

REGLAS (12 items):
  1. var (no const/let) — JAMAS redeclares hud, scene, camera, etc.
  2. Materiales: MeshStandardMaterial / MeshPhysicalMaterial
  3. SOMBRAS: castShadow = receiveShadow = true
  4. ORBITAS: pivote Object3D jerarquico
  5. ESTRELLAS: THREE.Points / InstancedMesh
  6. LINEAS: BufferGeometry.setFromPoints — JAMAS RingGeometry
  7. CANNON: world.gravity.set(0,-9.82,0); world.allowSleep=true;
  8. HUD: hud.innerHTML una vez, textContent en animate()
  9. DELTA TIME: Math.min(clock.getDelta(), 0.05)
 10. DATOS CIENTIFICOS: valores reales, NO Math.random()
 11. NO CANNON en orbitales (matematicas puras)
 12. Performance: reusa geometrias

BLOQUE SISTEMA SOLAR (11 items A-K):
  - 8 planetas con datos reales, raycaster + click, anillos Saturno,
    etiquetas Sprite, toggle orbitas [O], linea orbital por planeta,
    Sol emissive + PointLight, reposicionar camara, escala coherente
```

### Pipeline de generación

```
LLAMADA INICIAL (1)
  systemInstruction (~1200 chars) + userPrompt + imageBase64
  ↓ Groq (qwen/qwen3-32b, temperature 0.5, max_tokens 4096)
  ↓ extractCode() — strip ```, <think>, todo salvo JS puro

SIM-CHECK LOOP (hasta 3 iteraciones, NO consume MAX_RETRIES)
  15 validaciones anti-bug sintácticas
  ↓ si errores → repairPrompt → Groq → re-extract → hasta 3x
  ↓ fix orbital: regex elimina CANNON si detecta astronomía

for (attempt = 1; attempt ≤ 5; attempt++) {
  SECURITY (se ejecuta primero cada iteración)
    2 fases: heurística + verificación HTTP PyPI/npm
    ↓ si error: repairPrompt → Groq → re-extract → continue

  VALIDATION (se ejecuta después cada iteración)
    Escribe sandbox.js → router.validate()
    HtmlValidator: 4 checks (scene.add, material, HUD, world.step)
    ↓ si error: repairPrompt → Groq → re-extract → continue

  si AMBAS pasan → break
}

generateHtmlBoilerplate(jsCode)
  ↓ htmlTemplate.ts → <!DOCTYPE html> con boilerplate + código inyectado
```

### Modelos y providers

| Rol | Proveedor | Modelo | max_tokens | temperature |
|-----|-----------|--------|------------|-------------|
| Código (generación + reparaciones) | Groq | `qwen/qwen3-32b` | 4096 | 0.5 |
| Visión (imagen a prompt) | OpenRouter | `google/gemma-4-31b-it:free` | 4096 | 0.5 |

**Config actual** (`config.json`):
```json
{
  "ai": {
    "provider": "groq-cloud",
    "model": "qwen/qwen3-32b",
    "apiKey": "gsk_...",
    "visionProvider": "openrouter",
    "visionApiKey": "sk-or-...",
    "visionModel": "google/gemma-4-31b-it:free"
  },
  "security": { "autoFixLoop": true }
}
```

---

## FASE 3 — UI / INTERACCIÓN CON USUARIO

### Mapa de vistas (View state machine)

```
                  +--- [x] Exit ──→ exit()
                  |
    menu ──→ lang ──→ prompt ──→ processing ──→ result ──→ q → exit()
       │                                              ↑
       ├──→ sim_prompt ──→ processing ──→ running_sim ──→ Enter → menu
       │                            ↑
       └──→ file_path ──→ file_mode ──→ file_prompt ──→ processing
```

12 estados: `menu | lang | prompt | sim_prompt | processing | result | running_sim | file_path | file_mode | file_prompt`

### Menú principal

```
┌─────────────────────────────────────┐
│  SAFEVIBE CLI // PROTOCOL ACTIVE    │
├─────────────────────────────────────┤
│  [>] Generate Secure Code           │  → lang (TS/PY)
│  [~] Run 3D Physics Simulation (AI) │  → sim_prompt
│  [i] Upload Image / PDF Exercise    │  → file_path
│  [x] Exit Protocol                  │  → exit()
└─────────────────────────────────────┘
```

### Flujo por opción

| Opción | Pasos | End state |
|--------|-------|-----------|
| **Generate Secure Code** | `menu → lang` (TS/PY) → `prompt` → `processing` → `result` | q → exit |
| **3D Simulation** | `menu → sim_prompt` → `processing` → `running_sim` (abre navegador) | Enter → menu |
| **Upload Image/PDF** | `menu → file_path` → `file_mode` → `file_prompt` → `processing` | result o running_sim |

### Pantalla de procesamiento

```
┌─ SAFEVIBE SCIENTIFIC PROTOCOL RUNNING ─────────────────┐
│ - Requesting code to cloud AI...                        │  info (blanco)
│ - Initial code received.                                │  success (verde)
│ - [SIM-CHECK] 3 error(es) de simulacion detectados...  │  warn (amarillo)
│   ↳ ANTI-BUG: No hay scene.add()...                     │  error (rojo)
│ - [REACT] Solicitando correccion a la IA...             │  warn (amarillo)
│ - [SECURE] Code passed security and compilation.         │  success (verde)
└────────────────────────────────────────────────────────┘
```

### Atajos de teclado

| Tecla | Vista | Acción |
|-------|-------|--------|
| `q` | `result` | `exit()` — cierra la CLI |
| `Enter` | `running_sim` | Reset → `menu` |
| `Enter` | Inputs | Dispara `handleGenerate()` o `handleFileLoad()` |
| Arrow keys | `menu`, `lang`, `file_mode` | Navegación `SelectInput` |

### Manejo de archivos (PDF/imagenes)

- **PDF**: extrae texto con `pdf-parse`, inyecta como `[EJERCICIO EXTRAÍDO DEL PDF]\n{texto}\n\n[INSTRUCCIÓN]\n{prompt}`
- **Imagen (png/jpg/webp)**: convierte a base64, pasa vía OpenRouter visión
- **TXT**: lee como texto plano

### Librerías UI

| Librería | Uso |
|----------|-----|
| `ink` ^6.8.0 | React para CLI (`Box`, `Text`, `useApp`, `useInput`) |
| `ink-select-input` ^6.2.0 | Menú de selección |
| `ink-text-input` ^6.0.0 | Input de texto |
| `picocolors` ^1.1.1 | Colores ANSI |

---

## FASE 4 — VALIDADORES, SEGURIDAD Y ANTI-BUG RULES

### SecurityAnalyzer — 2 fases

**Fase 1 — Heurística (sincrónica, regex)**

| Lenguaje | Patrón bloqueado | Riesgo |
|----------|-----------------|--------|
| Python | `eval(`, `exec(`, `os.system(`, `subprocess.*shell=True` | RCE |
| TS/JS | `child_process.exec(`, `@ts-ignore`, `eval(`, `dangerouslySetInnerHTML` (warning) | RCE/XSS |

**Fase 2 — Dependencias fantasma (asincrónica, HTTP)**

| Lenguaje | Registro | Mecanismo |
|----------|----------|-----------|
| Python | `pypi.org/pypi/{pkg}/json` | Fetch → si 404: "Dependencia falsa" |
| TS/JS | `registry.npmjs.org/{pkg}` | Fetch → si 404: "Dependencia falsa" |

### HtmlValidator — 4 checks

| # | Check | Error si falla |
|---|-------|----------------|
| 1 | CANNON → world.step | "Falta llamar a world.step" |
| 2 | Material Three.js | "Falta usar un material compatible" |
| 3 | scene.add() | "No se agregan objetos a la escena" |
| 4 | HUD update | "Falta actualizar el HUD" |

### Anti-bug validation — 15 checks

| # | Bug | Detección |
|---|-----|-----------|
| 1 | Redeclarar `hud` | `(var\|const\|let) hud =` |
| 2 | Float32BufferAttribute 2D→3D | Pattern match sin push(z) |
| 3 | TypeScript en JS | `as Type` o `: type` annotations |
| 5 | RingGeometry para órbitas | `RingGeometry(` presente |
| 6 | Saturno sin anillos | `Saturno` sin `ring` |
| 7 | scene.add() después de animate() | `animate(` antes que `scene.add(` |
| 8 | Math.random() para datos científicos | `Math.random() * N` + keywords |
| 9 | Radio excesivo | `radius > distance/3` |
| 10 | CANNON en orbitales | `CANNON` + keywords astronómicas |
| 12 | Paréntesis desbalanceados | count `(` vs `)` |
| 13 | Llaves desbalanceadas | count `{` vs `}` |
| 14 | animate() sin renderer.render() | `animate(` sin `renderer.render(` |
| 15 | animate() sin controls.update() | `animate(` sin `controls.update(` |
| 16 | Sin scene.add() | `scene.add(` ausente |

### ValidatorRouter

```
.ts → TypescriptValidator   (inactivo — no se usa en pipeline actual)
.py → PythonValidator        (inactivo)
.html → HtmlValidator        (activo)
.js → HtmlValidator          (activo)
```

---

## FASE 5 — HTML TEMPLATE

### Estructura del output (`htmlTemplate.ts`)

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SafeVibe Scientific Simulation</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { overflow:hidden; background:#0a0a1a; font-family:monospace; }
    #hud { position:absolute; top:12px; left:12px; ... backdrop-filter:blur(6px); }
    #fps { position:absolute; bottom:12px; right:16px; ... }
  </style>
</head>
<body>
  <div id="hud"></div>
  <div id="fps"></div>

  <!-- CDNs -->
  <script src="three.js r128"></script>
  <script src="cannon.js 0.6.2"></script>
  <script src="OrbitControls r128"></script>

  <script>
    // SafeVibe Runtime (70 líneas boilerplate)
    var hud = document.getElementById('hud');
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(55, ...);
    var renderer = new THREE.WebGLRenderer({ antialias: true, ... });
    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    // Luces: AmbientLight + DirectionalLight + fill + rim
    var clock = new THREE.Clock();
    // Resize handler
    function animate() { requestAnimationFrame(animate); ... }

    // ================================================================
    //  INICIO — CODIGO GENERADO POR IA
    // ================================================================
    ${jsCode}       ← se inyecta textual
    // ================================================================
    //  FIN — CODIGO GENERADO POR IA
    // ================================================================

    animate();      ← siempre arranca
  </script>
</body>
</html>
```

### CDNs

| Librería | URL | Versión |
|----------|-----|---------|
| Three.js | `cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` | r128 |
| Cannon.js | `cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js` | 0.6.2 |
| OrbitControls | `cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js` | r128 |

### Observaciones

- Sin transformación post-LLM: el código JS se inyecta textual
- `animate()` puede ser sobreescrito por hoisting de function declaration
- Dos CDNs diferentes para Three r128 (cdnjs + jsdelivr)
- Sin SRI hashes, sin polyfills, sin try-catch WebGL

---

## FASE 6 — AI PROVIDERS

### Interface común

```typescript
interface AIProvider {
  sendPrompt(system, user, imageBase64?, mimeType?): Promise<string>;
}
```

### AIManager — Router dual

```
ask(system, user, imageBase64?, mimeType?)
  ├─ imageBase64 + visionProvider → visionProvider.sendPrompt()  ← OpenRouter
  └─ no                           → provider.sendPrompt()        ← Groq
```

Inicialización lazy: `if (!this.provider) await this.initialize()`

### Proveedores

| Proveedor | Clase | Implementado | Usado hoy | max_tokens | temp |
|-----------|-------|:---:|:---:|:---:|:---:|
| Groq Cloud | `StandardProvider` | ✓ | **SÍ** (código) | 4096 | 0.5 |
| OpenRouter | `OpenRouterProvider` | ✓ | **SÍ** (visión) | 4096 | 0.5 |
| Anthropic | `AnthropicProvider` | ✓ | No | 4096 | 0.5 |
| NVIDIA | `NvidiaProvider` | ✓ | No | 8192 | 1.0 |
| Ollama local | `OllamaProvider` | ✓ | No | — | — |

### StandardProvider (Groq) — Retry policy

- 5 intentos máximos
- Error 429 "try again in Xs": espera `ceil(X) + 2`
- Otros errores: backoff `min(2*attempt + 3, 30)` segundos
- Sin timeout de fetch

### OpenRouterProvider

- Sin retry: falla directo en cualquier error
- Headers: `HTTP-Referer` + `X-Title` para tracking OpenRouter
- Soporta imágenes multi-modal (text + image_url)

### Config (`configHandler.ts`)

- `loadConfig()`: lee `config.json`, si no existe crea defaults
- `saveConfig()`: escribe con `JSON.stringify(data, null, 2)`

---

## FASE 7 — SISTEMA DE ARCHIVOS, LEGACY Y DIRECTORIOS VACÍOS

### FileManager

```
initSandbox():  mkdir /tmp/safevibe-sandbox
writeCode():    writeFile /tmp/safevibe-sandbox/{name}
cleanup():      rm -rf /tmp/safevibe-sandbox
```

### FileReader

| Extensión | Tipo | Output |
|-----------|------|--------|
| `.png`, `.jpg`, `.jpeg`, `.webp` | Imagen | `{ type: 'image', content: base64, mimeType }` |
| `.pdf` | PDF | `{ type: 'text', content: data.text }` |

### Directorios vacíos

- `src/graphics/` — planificado para renderizado ASCII
- `src/voice/` — planificado para STT (whisper-cpp) + TTS (piper)
- Ambos referenciados en `config.json` pero nunca en código

### Código legacy no usado

| Archivo | LOC | Descripción |
|---------|-----|-------------|
| `src/engine/physicsTest.ts` | 56 | Donut ASCII rotatorio (port de Andy Sloane) |
| `src/engine/renderer.ts` | 72 | Motor render 2D ASCII con perspectiva |
| `src/ui.tsx` | 40 | Prototipo UI con ink-box |
| `src/ai/providers/anthropicProvider.ts` | 69 | Claude API (inactivo) |
| `src/ai/providers/nvidiaProvider.ts` | 52 | Nvidia API (inactivo) |
| `src/ai/providers/ollamaProvider.ts` | 36 | Ollama local (inactivo) |
| `src/validators/pythonValidator.ts` | 24 | No usado en pipeline |
| `src/validators/typescriptValidator.ts` | 30 | No usado en pipeline |
| `isComplexSimulation()` (función) | 23 | Definida en secureGenerator:323, nunca llamada |

### Dependencias no usadas

| Dependencia | package.json | Imports reales |
|-------------|:---:|:---:|
| `@clack/prompts` | ^0.9.1 | 0 |
| `base64-img` | ^1.0.4 | 0 |
| `ink-box` | ^1.0.0 | Solo en ui.tsx (legacy) |

---

## FASE 8 — ANÁLISIS CRÍTICO: BUGS Y PLAN DE ACCIÓN

### 🔴 Críticos / Bugs funcionales

| # | Severidad | Archivo | Línea | Problema |
|---|-----------|---------|-------|----------|
| 1 | **CRÍTICO** | `secureGenerator.ts` | 241 | `currentJsCode` nunca se actualiza con `rawRepairedCode` en SIM-CHECK loop. El código reparado por la IA se descarta. 3 iteraciones inefectivas. |
| 2 | **CRÍTICO** | `secureGenerator.ts` | 323 | `isComplexSimulation()` definida pero nunca llamada en source. Dist sí la usa → source/dist desincronizados. |
| 3 | **ALTO** | `aiManager.ts` | 61 | Race condition: `if (!this.provider) await this.initialize()` sin mutex. Múltiples `ask()` concurrentes crean providers duplicados. |
| 4 | **ALTO** | `standardProvider.ts` | 26 | Acepta `imageBase64`/`mimeType` en firma pero nunca los envía en el body. Imagen perdida si rutea a Groq. |
| 5 | **ALTO** | `standardProvider.ts:29`, `securityAnalyzer.ts:38,60` | — | `fetch()` sin `AbortController`. Si API cuelga, CLI se congela. |
| 6 | **ALTO** | `secureGenerator.ts` | 270 | Security error truncado a 100 chars en repairPrompt. LLM no ve el error completo. |
| 7 | **ALTO** | `secureGenerator.ts` | 308 | `cleanup()` fuera de `try/finally`. Excepción en `generate()` filtra `/tmp/safevibe-sandbox`. |
| 8 | **ALTO** | `App.tsx` | 91 | `xdg-open` Linux-only. Sin fallback para macOS/Windows. |

### 🟡 Graves / Riesgos de diseño

| # | Severidad | Archivo | Problema |
|---|-----------|---------|----------|
| 9 | **MEDIO** | `securityAnalyzer.ts:21-22` | Regex incompleta: no capta `child_process.execSync`, `spawn`, `fork`, destructuring, `@ts-expect-error` |
| 10 | **MEDIO** | `secureGenerator.ts:258` | Security + Validation comparten MAX_RETRIES=5 en un solo loop. Deberían ser independientes. |
| 11 | **MEDIO** | `securityAnalyzer.ts:29-68` | Verificación HTTP de dependencias secuencial. 15 imports = 15 viajes redondos seriales. |
| 12 | **BAJO** | `htmlTemplate.ts:36-38` | CDNs sin SRI hashes. CDN comprometido → XSS en simulaciones. |
| 13 | **BAJO** | `htmlTemplate.ts:74` | `renderer.outputEncoding` deprecado desde r128. Usar `outputColorSpace`. |
| 14 | **BAJO** | `App.tsx` | Sin cancelación de generación en curso. UI no responde durante processing. |
| 15 | **BAJO** | `App.tsx:91` | `xdg-open` spawn sin cleanup. Múltiples generaciones → múltiples pestañas. |

### 🟢 Menores / Mantenimiento

| # | Severidad | Archivo | Problema |
|---|-----------|---------|----------|
| 16 | **BAJO** | `standardProvider.ts:59-60` | `data.choices[0].message.content.trim()` sin validación de estructura |
| 17 | **BAJO** | `configHandler.ts:56` | `CONFIG_PATH` evaluado en tiempo de import, no de uso |
| 18 | **BAJO** | `package.json` | 3 dependencias no usadas: `@clack/prompts`, `base64-img`, `ink-box` |
| 19 | **BAJO** | `App.tsx` | Sin "volver al menú" desde vista `result`, solo `q` para salir |
| 20 | **BAJO** | — | Source y dist desincronizados: `dist/` tiene fixes que `src/` no |

---

## PLAN DE ACCIÓN

### Prioridad 1 — Bugs que rompen funcionalidad

```
[ ] Fix #1: Asignar currentJsCode = this.extractCode(rawRepairedCode) en SIM-CHECK loop
    Archivo: src/core/secureGenerator.ts ~line 241
    Impacto: Sin esto, el SIM-CHECK loop no repara nada

[ ] Fix #3: Sincronizar initialize() con un semáforo simple (boolean + if)
    Archivo: src/ai/aiManager.ts
    Impacto: Race condition en llamadas concurrentes

[ ] Fix #4: Pasar imagen en body de StandardProvider o loggear warning
    Archivo: src/ai/providers/standardProvider.ts
    Impacto: Imágenes perdidas silenciosamente con Groq
```

### Prioridad 2 — Resolver discrepancy source/dist

```
[ ] Sincronizar src/ con dist/: la dist tiene fixes (asignación en simFix loop,
    llamada a isComplexSimulation()) que la source perdió
    Revisar git log para entender qué commit desincronizó
```

### Prioridad 3 — Resiliencia y errores silenciosos

```
[ ] Fix #5: Agregar AbortController con timeout (30s) a todos los fetch()
    Archivos: standardProvider.ts, securityAnalyzer.ts

[ ] Fix #7: Envolver generate() en try/finally con cleanup()
    Archivo: src/core/secureGenerator.ts

[ ] Fix #12: Agregar atributos integrity a CDNs en htmlTemplate.ts
    Opcional: servir assets locales
```

### Prioridad 4 — Cross-platform

```
[ ] Fix #8: Reemplazar xdg-open con open (opn/open npm package) o
    usar os.platform() para elegir: xdg-open / open / start
    Archivo: src/ui/App.tsx
```

### Prioridad 5 — Mejoras de pipeline

```
[ ] Separar Security loop y Validation loop (MAX_RETRIES independientes)
[ ] Paralelizar verificación HTTP de dependencias (Promise.all)
[ ] Completar regex de seguridad (execSync, spawn, fork, @ts-expect-error)
[ ] Agregar "volver al menú" desde vista result
[ ] Limpiar dependencias no usadas
[ ] Eliminar/fusionar código legacy (engine/, ui.tsx, providers inactivos)
[ ] Agregar barra de progreso / spinner durante processing
```
