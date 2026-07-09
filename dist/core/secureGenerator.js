import { AIManager } from '../ai/aiManager.js';
import { FileManager } from '../system/fileManager.js';
import { ValidatorRouter } from '../validators/validatorRouter.js';
import { SecurityAnalyzer } from '../validators/securityAnalyzer.js';
import { VisualValidator } from '../validators/visualValidator.js';
import { generateHtmlBoilerplate } from './htmlTemplate.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SIMULATIONS_DIR = path.join(PROJECT_ROOT, 'src', 'simulations');
export class SecureGenerator {
    aiManager = new AIManager();
    fileManager = new FileManager();
    router = new ValidatorRouter();
    security = new SecurityAnalyzer();
    visualValidator = new VisualValidator();
    outputDir = path.join(process.cwd(), 'safevibe_output');
    async init() {
        await this.fileManager.initSandbox();
        await fs.mkdir(this.outputDir, { recursive: true });
    }
    extractCode(aiResponse) {
        // Intento 1: bloque markdown completo (con cierre ```)
        const fullBlock = aiResponse.match(/```(?:javascript|js|typescript|html|ts|py)?[ \t]*\r?\n([\s\S]*?)```/);
        if (fullBlock && fullBlock[1])
            return this.stripMarkdownArtifacts(fullBlock[1].trim());
        // Intento 2: bloque sin cierre (IA truncó la respuesta) — toma todo lo que sigue al opening ```
        const openBlock = aiResponse.match(/```(?:javascript|js|typescript|html|ts|py)?[ \t]*\r?\n([\s\S]+)$/);
        if (openBlock && openBlock[1])
            return this.stripMarkdownArtifacts(openBlock[1].trim());
        // Intento 3: respuesta plana sin bloques
        return this.stripMarkdownArtifacts(aiResponse.trim());
    }
    /** Elimina líneas que son solo backticks de markdown que quedaron en el código */
    stripMarkdownArtifacts(code) {
        return code
            .replace(/<think>[\s\S]*?<\/think>/g, '') // elimina bloques <think> de la IA
            .split('\n')
            .filter(line => !/^```/.test(line.trimStart())) // elimina líneas ``` javascript, ``` etc.
            .join('\n')
            .trim();
    }
    /** Valida errores recurrentes específicos de simulaciones browser/THREE.js */
    validateSimulationCode(code) {
        const errors = [];
        // NUEVO Bug #0: import/export ES modules (CRÍTICO - rompe todo)
        if (/^\s*import\s+/m.test(code) || /\bfrom\s+['"][^'"]+['"]/m.test(code)) {
            errors.push('ANTI-BUG CRÍTICO: NUNCA uses import/export ES modules. TODO es global. Borra todas las líneas "import ..." y "export ...".');
        }
        // NUEVO Bug #0b: redeclarar scene/camera/renderer/controls/clock
        const boilerplate = ['scene', 'camera', 'renderer', 'controls', 'clock'];
        boilerplate.forEach(v => {
            const re = new RegExp('\\b(var|let|const)\\s+' + v + '\\s*=', 'g');
            if (re.test(code)) {
                errors.push('ANTI-BUG CRÍTICO: ' + v + ' ya existe (lo provee el boilerplate). NO lo redeclares con var/let/const.');
            }
        });
        // NUEVO Bug #0c: crear THREE.Scene/Camera/Renderer nuevos
        if (/new\s+THREE\.Scene\s*\(/.test(code)) {
            errors.push('ANTI-BUG: NO crees new THREE.Scene(). Usa la variable global "scene" ya creada.');
        }
        if (/new\s+THREE\.WebGLRenderer/.test(code)) {
            errors.push('ANTI-BUG: NO crees new THREE.WebGLRenderer(). Usa la variable global "renderer" ya creada.');
        }
        if (/new\s+THREE\.PerspectiveCamera/.test(code)) {
            errors.push('ANTI-BUG: NO crees new THREE.PerspectiveCamera(). Usa la variable global "camera" ya creada.');
        }
        if (/new\s+THREE\.OrbitControls/.test(code)) {
            errors.push('ANTI-BUG: NO crees new THREE.OrbitControls(). Usa la variable global "controls" ya creada.');
        }
        // Bug recurrente #1: IA redeclara 'var hud' siendo que el bootstrap ya lo declara
        const hudDeclarations = (code.match(/\bvar\s+hud\s*=/g) || []).length
            + (code.match(/\bconst\s+hud\s*=/g) || []).length
            + (code.match(/\blet\s+hud\s*=/g) || []).length;
        if (hudDeclarations > 0) {
            errors.push('ANTI-BUG: "hud" ya esta declarada. NO la redeclares. Usa hud.innerHTML = ...; directamente.');
        }
        // Bug recurrente #2: Float32BufferAttribute con array de 2 valores por punto declarado como 3
        // Detecta: push(x); push(y); sin push(z); antes de Float32BufferAttribute(..., 3)
        if (/Float32BufferAttribute\s*\(/.test(code)) {
            // Busca patrones donde solo se pushean 2 valores por iteración pero se pasa componentes=3
            const bad2d = code.match(/\.push\([^)]+\);\s*\n\s*[\w.]+\.push\([^)]+\);\s*\n(?!\s*[\w.]+\.push)[\s\S]{0,200}Float32BufferAttribute[^,]+,\s*3\s*\)/);
            if (bad2d) {
                errors.push('ANTI-BUG: Float32BufferAttribute necesita x,y,z. Si solo pusheas x,y agrega push(0) para z.');
            }
        }
        // Bug recurrente #3: TypeScript syntax en HTML puro
        if (/\bas\s+[A-Z][a-zA-Z]+\b/.test(code) || /:\s*(?:number|string|boolean|HTMLElement|any)\b/.test(code)) {
            errors.push('ANTI-BUG: Se detectó sintaxis de TypeScript en código JavaScript puro ("as Type" o anotaciones de tipo). ' +
                'Este código se ejecuta directamente en el navegador. Elimina todos los tipos TypeScript y usa JavaScript puro.');
        }
        // Bug recurrente #5: orbitas con RingGeometry en vez de THREE.Line + BufferGeometry.setFromPoints
        if (/RingGeometry\s*\(/.test(code)) {
            errors.push('ANTI-BUG: No uses RingGeometry para orbitas. Usa BufferGeometry.setFromPoints + THREE.Line con Math.cos/sin.');
        }
        // Bug recurrente #6: Saturno sin anillos
        if (/Saturno/.test(code) && !/Ring\(/.test(code) && !/ring/i.test(code)) {
            errors.push('ANTI-BUG: Saturno necesita anillos. Crea THREE.RingGeometry(radio*1.2, radio*2.4, 64) con DoubleSide.');
        }
        // Bug recurrente #8: Math.random() para datos cientificos (temperatura, masa, lunas)
        const randomScientific = (code.match(/Math\.random\(\)\s*[*]\s*\d+/g) || []).length;
        if (randomScientific > 0 && /temperatura|masa|lunas|gravedad|poblacion|superficie|pib/i.test(code)) {
            errors.push('ANTI-BUG: No uses Math.random() para datos cientificos. Usa valores reales fijos (temperatura, masa, etc).');
        }
        // Bug recurrente #9: planetas con radio excesivo respecto a su distancia (se superponen visualmente)
        const radiusMatches = code.match(/radius:\s*([\d.]+)/g);
        const distanceMatches = code.match(/distance:\s*([\d.]+)/g);
        if (radiusMatches && distanceMatches) {
            for (let i = 0; i < Math.min(radiusMatches.length, distanceMatches.length); i++) {
                const r = parseFloat(radiusMatches[i].split(':')[1]);
                const d = parseFloat(distanceMatches[i].split(':')[1]);
                if (d > 0 && r > d / 3) {
                    errors.push('ANTI-BUG: Planeta radio=' + r + ' distancia=' + d + ' demasiado grande. radio debe ser < distancia/5.');
                    break;
                }
            }
        }
        // Bug recurrente #10: CANNON.js usado en simulaciones orbitales/astronomicas (NO necesita fisica de choques)
        // Cuando la IA agrega CANNON, el validador exige fixedTimeStep, world.step, allowSleep, solver.iterations,
        // y la IA nunca acierta los 4 a la vez, provocando agotamiento de reintentos.
        if (/CANNON/.test(code) && /\b(orbita|solar|planeta|satelite|estrella|galaxia|astronomia|tierra|marte|jupiter|saturno|urano|neptuno|mercurio|venus)\b/i.test(code)) {
            errors.push('ANTI-BUG: NO uses CANNON en simulaciones orbitales. Modela con x=r*cos(a), z=r*sin(a) en animate().');
        }
        // Bug recurrente #12: parentesis, corchetes o llaves sin cerrar (codigo truncado)
        var opens = (code.match(/\(/g) || []).length;
        var closes = (code.match(/\)/g) || []).length;
        if (opens !== closes) {
            errors.push('ANTI-BUG: ' + opens + ' parentesis abiertos, ' + closes + ' cerrados. Codigo TRUNCADO. Faltan parentesis.');
        }
        var curlyOpens = (code.match(/\{/g) || []).length;
        var curlyCloses = (code.match(/\}/g) || []).length;
        if (curlyOpens !== curlyCloses) {
            errors.push('ANTI-BUG: ' + curlyOpens + ' llaves abiertas, ' + curlyCloses + ' cerradas. Faltan llaves de cierre.');
        }
        // Bug recurrente #13: animate() no llama a renderer.render() (causa pantalla negra)
        if (/function\s+animate\s*\(/.test(code) && !/renderer\.render\s*\(/.test(code)) {
            errors.push('ANTI-BUG: animate() debe llamar a renderer.render(scene, camera) o la pantalla quedara en negro.');
        }
        // Bug recurrente #14: animate() definida sin controls.update() (orbits no responden)
        if (/function\s+animate\s*\(/.test(code) && !/controls\.update\s*\(/.test(code)) {
            errors.push('ANTI-BUG: animate() debe llamar a controls.update() o los controles no responden.');
        }
        // Bug recurrente #15: escena vacia — no hay scene.add() en el codigo
        if (!/scene\.add\s*\(/.test(code)) {
            errors.push('ANTI-BUG: No hay scene.add(). La escena estara vacia. Agrega objetos con scene.add(mesh).');
        }
        return errors;
    }
    /**
     * Colapsa funciones top-level duplicadas conservando la PRIMERA aparicion y borrando
     * las siguientes. Como los templates se concatenan antes que el codigo de la IA, "la
     * primera" es la del template (fuente de verdad). Resuelve "Identifier already declared"
     * venga de donde venga: template-vs-template, IA-vs-template, o IA duplicandose.
     */
    collapseDuplicateTopLevelFunctions(code) {
        const seen = new Set();
        const removed = [];
        const lines = code.split('\n');
        const out = [];
        let i = 0;
        while (i < lines.length) {
            const match = /^function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(lines[i]); // solo columna 0
            if (match) {
                const name = match[1];
                if (seen.has(name)) {
                    removed.push(name);
                    let depth = 0;
                    let started = false;
                    while (i < lines.length) {
                        for (const ch of lines[i]) {
                            if (ch === '{') {
                                depth++;
                                started = true;
                            }
                            else if (ch === '}') {
                                depth--;
                            }
                        }
                        i++;
                        if (started && depth <= 0)
                            break; // se cerro el cuerpo de la funcion
                    }
                    continue; // no la agregamos a out
                }
                seen.add(name);
            }
            out.push(lines[i]);
            i++;
        }
        return { code: out.join('\n'), removed };
    }
    /**
     * Genera API summary comprimido de templates (para enviar al LLM sin exceder TPM).
     * NO envía las implementaciones, solo firmas + descripción.
     * Las implementaciones se inyectan después en el HTML final.
     */
    buildTemplatesApiSummary(fullTemplates) {
        // Extraer solo firmas de funciones: function name(...) { ... }
        const fnMatches = fullTemplates.match(/(?:function|var)\s+(\w+)\s*\([^)]*\)/g) || [];
        // Extraer nombres de variables globales importantes
        const varMatches = fullTemplates.match(/var\s+(\w+)\s*=/g) || [];
        const vars = varMatches.map(v => v.replace(/var\s+/, '').replace(/\s*=$/, '')).filter(v => !['i', 'j', 'k', 'x', 'y', 'z', 'n', 'r', 'g', 'b'].includes(v));
        const uniqueVars = [...new Set(vars)].slice(0, 20);
        return '## VARIABLES GLOBALES YA DISPONIBLES (NO redeclarar, NO importar, SOLO USAR):\n' +
            'scene, camera, renderer, controls, clock, hud\n\n' +
            '## API DISPONIBLE (no reimplementes, solo LLAMA):\n' +
            '\nFunciones:\n' +
            fnMatches.slice(0, 30).map(f => '  - ' + f.replace(/\s+/g, ' ').trim()).join('\n') +
            '\n\nConstantes/Arrays:\n' +
            uniqueVars.map(v => '  - ' + v).join('\n') +
            '\n\n## REGLAS CRÍTICAS:\n' +
            '1. NUNCA uses import/export ES modules (rompe el script)\n' +
            '2. NUNCA redeclares scene/camera/renderer/controls/clock/hud\n' +
            '3. NUNCA uses TypeScript (as Type, : type)\n' +
            '4. TODO es global, llama funciones directamente\n' +
            '5. createSun/createPlanetMesh ya hacen scene.add() internamente\n';
    }
    /**
     * Genera simulación de sistema solar en 3 llamadas LLM pequeñas (TPM 6000 safe).
     * Llamada 1: datos + Sol + planetas (sin lunas ni órbitas)
     * Llamada 2: lunas + órbitas + raycaster + HUD
     * Llamada 3: animate() + key handler
     */
    async generateSolarSystemChunked(userPrompt, systemInstruction, solarSystemTemplates, onLog, imageBase64, mimeType) {
        const apiSummary = this.buildTemplatesApiSummary(solarSystemTemplates);
        onLog('[CHUNKED] API summary: ' + apiSummary.length + ' bytes', 'info');
        const base = apiSummary + '\n\n' + systemInstruction;
        // === LLAMADA 1: Sol + planetas ===
        const prompt1 = base +
            '\n\nTAREA 1 de 3: Genera SOLO:\n' +
            '1. var sun = createSun(8, getPlanetTexture(\'sun\'))\n' +
            '2. var planets = []; var meshes = [];\n' +
            '3. Bucle SOLAR_SYSTEM_DATA.forEach → createPlanetMesh + getPlanetTexture\n' +
            '4. obj.mesh.name = planet.id (para raycaster)\n' +
            '5. planets.push(obj); meshes.push(obj.mesh)\n\n' +
            'NO escribas function animate(). NO crees scene/camera (ya existen).\n' +
            'NO uses import. TODO es global.\n\n' +
            'Usuario: ' + userPrompt;
        onLog('[CHUNKED] Llamada 1/3: Sol + planetas...', 'info');
        const raw1 = await this.aiManager.ask(prompt1, '', imageBase64, mimeType);
        const code1 = this.extractCode(raw1);
        onLog('[CHUNKED] Fase 1 recibida (' + code1.length + ' chars).', 'success');
        await new Promise(r => setTimeout(r, 3000)); // pausa TPM
        // === LLAMADA 2: lunas + órbitas + raycaster + HUD ===
        const prompt2 = base +
            '\n\nCODIGO ANTERIOR (no lo repitas):\n' + code1.substring(0, 800) +
            '\n\nTAREA 2 de 3: Agrega SOLO:\n' +
            '1. Bucle planets.forEach → crear lunas con createMoonMesh\n' +
            '2. Bucle planets.forEach → crear órbita con createOrbitLine(planet.distance)\n' +
            '3. setupRaycaster(camera, renderer.domElement, meshes, callback)\n' +
            '4. En callback: hud.innerHTML = datos del planeta\n' +
            '5. camera.position.set(0, 80, 180); camera.lookAt(0,0,0)\n\n' +
            'NO repitas el código anterior. NO escribas animate().';
        onLog('[CHUNKED] Llamada 2/3: lunas + órbitas + raycaster...', 'info');
        const raw2 = await this.aiManager.ask(prompt2, '', imageBase64, mimeType);
        const code2 = this.extractCode(raw2);
        onLog('[CHUNKED] Fase 2 recibida (' + code2.length + ' chars).', 'success');
        await new Promise(r => setTimeout(r, 3000));
        // === LLAMADA 3: animate + key handler ===
        const prompt3 = base +
            '\n\nVARIABLES DISPONIBLES: planets (array de {mesh, pivot, group}), SOLAR_SYSTEM_DATA, meshes\n' +
            '\nTAREA 3 de 3: Escribe SOLO:\n' +
            '1. function animate() { requestAnimationFrame(animate); var dt = Math.min(clock.getDelta(), 0.05); planets.forEach(function(p, i) { updateOrbitalPosition(p.pivot, dt, SOLAR_SYSTEM_DATA[i+1].orbitalPeriod); }); controls.update(); renderer.render(scene, camera); }\n' +
            '2. animate();\n' +
            '3. document.addEventListener(\'keydown\', function(e) { if (e.key.toLowerCase() === \'o\') { /* toggle órbitas */ } });\n\n' +
            'SOLO animate + key handler.';
        onLog('[CHUNKED] Llamada 3/3: animate + teclado...', 'info');
        const raw3 = await this.aiManager.ask(prompt3, '', imageBase64, mimeType);
        const code3 = this.extractCode(raw3);
        onLog('[CHUNKED] Fase 3 recibida (' + code3.length + ' chars).', 'success');
        return code1 + '\n\n// === LUNAS + ÓRBITAS + RAYCASTER ===\n\n' + code2 +
            '\n\n// === ANIMATION LOOP ===\n\n' + code3;
    }
    async generate(langChoice, userPrompt, onLog, isSimulation = false, imageBase64, mimeType) {
        const MAX_RETRIES = 5;
        let currentJsCode = '';
        let isSecure = false;
        let extension = '.ts';
        let langKey = 'typescript';
        let systemInstruction = '';
        let solarSystemTemplates = '';
        try {
            if (isSimulation) {
                extension = '.html';
                langKey = 'javascript';
                const isSolarSystem = /\b(sistema\s+solar|planetas?|órbita|orbita|mercurio|venus|tierra|marte|jupiter|saturno|urano|neptuno)\b/i.test(userPrompt);
                if (isSolarSystem) {
                    const templateDir = path.join(SIMULATIONS_DIR, 'solar-system', 'templates');
                    const snippetsDir = path.join(SIMULATIONS_DIR, 'snippets');
                    const [dataContent, texturesContent, textureMapContent, snippetsContent, promptContent, proceduralTex, orbitalMech, interactionSn, atmosphereSn, lightingSn] = await Promise.all([
                        fs.readFile(path.join(templateDir, 'data.js.txt'), 'utf-8'),
                        fs.readFile(path.join(templateDir, 'textures.js.txt'), 'utf-8'),
                        fs.readFile(path.join(templateDir, 'texture-fn-map.js.txt'), 'utf-8'),
                        fs.readFile(path.join(templateDir, 'scene-snippet.js.txt'), 'utf-8'),
                        fs.readFile(path.join(templateDir, 'system-prompt.md'), 'utf-8'),
                        fs.readFile(path.join(snippetsDir, 'procedural-texture.js.txt'), 'utf-8'),
                        fs.readFile(path.join(snippetsDir, 'orbital-mechanics.js.txt'), 'utf-8'),
                        fs.readFile(path.join(snippetsDir, 'interaction.js.txt'), 'utf-8'),
                        fs.readFile(path.join(snippetsDir, 'atmosphere.js.txt'), 'utf-8'),
                        fs.readFile(path.join(snippetsDir, 'lighting.js.txt'), 'utf-8'),
                    ]);
                    const stripTSConstructs = (s) => s
                        // Comentarios y declaraciones TypeScript
                        .replace(/\/\/\s*@ts-nocheck\s*$/gm, '')
                        .replace(/^declare\s+(const|var|let|function|class|enum|namespace|module)\s+[^;]+;/gm, '')
                        // Imports/exports ES modules
                        .replace(/^export\s+/gm, '')
                        .replace(/^import\s+[^;]+;\s*$/gm, '')
                        .replace(/^\/\/\/\s*<reference.*$/gm, '')
                        // Interfaces (bloques completos)
                        .replace(/^interface\s+\w[^{]*\{[\s\S]*?^\}/gm, '')
                        // Type aliases
                        .replace(/^type\s+\w+\s*=[^;]+;\s*$/gm, '')
                        // Type assertions: "x as Type" → "x"
                        .replace(/\s+as\s+[A-Z]\w*(?:<[^>]*>)?/g, '')
                        // Non-null assertion: "x!" → "x"
                        .replace(/!([,;\s\)\]\}])/g, '$1')
                        // Declavar variables con tipo: "const x: Type = ..." → "const x = ..."
                        // SAFETY: solo matchea UNA variable a la vez, NO toca lo que sigue de la coma
                        .replace(/\b(const|let|var)\s+(\w+)\s*:\s*[A-Za-z_][\w<>\[\],\s|&]*(?=\s*=)/g, '$1 $2')
                        // Function return type: "function f(): Type {" → "function f() {"
                        .replace(/(function\s+\w+\s*\([^)]*\))\s*:\s*[A-Za-z_][\w<>\[\],\s|&]*\s*\{/g, '$1 {')
                        // Function params: "(x: Type)" → "(x)" — SOLO un parámetro a la vez
                        .replace(/\((\w+)\s*:\s*[A-Za-z_][\w<>\[\],\s|&]*(?=[,\)])/g, '($1')
                        .trim();
                    const allSnippets = [
                        dataContent, texturesContent, textureMapContent, snippetsContent,
                        proceduralTex, orbitalMech, interactionSn, atmosphereSn, lightingSn,
                    ].map(stripTSConstructs).join('\n\n');
                    solarSystemTemplates = allSnippets;
                    systemInstruction = promptContent;
                    onLog(`[TEMPLATES] Modo sistema solar activado. Templates: ${solarSystemTemplates.length} bytes, System prompt: ${systemInstruction.length} bytes`, 'info');
                }
                else {
                    systemInstruction =
                        'CRITICO: Escribe SOLO codigo JavaScript PURO (ES5/ES6). NUNCA TypeScript, import/export, ni tipos.\n' +
                            'THREE (r128), CANNON (0.6.2) y OrbitControls son variables globales.\n' +
                            '\n' +
                            'La plantilla SafeVibe YA PROVEE:\n' +
                            '- scene, camera (PerspectiveCamera 55deg), renderer (antialias+PCFSoftShadowMap+ACESFilmic+sRGB)\n' +
                            '- OrbitControls con damping, clock, resize handler\n' +
                            '- Iluminacion: AmbientLight + DirectionalLight (sombras) + fill + rim\n' +
                            '- Bucle animate() por defecto: requestAnimationFrame -> controls.update() -> renderer.render()\n' +
                            '- FPS counter auto\n' +
                            '\n' +
                            'TU SOLO AGREGA objetos a scene con scene.add(). NO crees scene/camera/renderer/controls nuevos.\n' +
                            'Si NECESITAS logica por frame (fisica, animaciones, orbitas), sobreescribe animate():\n' +
                            '  function animate(){ requestAnimationFrame(animate); var dt=Math.min(clock.getDelta(),0.05); controls.update(); renderer.render(scene,camera); }\n' +
                            'Si NO necesitas logica, no definas animate().\n' +
                            '\n' +
                            'REGLAS:\n' +
                            '1. var (no const/let) para vars de alto nivel. JAMAS redeclares hud, scene, camera, renderer, controls, clock.\n' +
                            '2. Materiales: MeshStandardMaterial o MeshPhysicalMaterial (PBR con roughness/metalness).\n' +
                            '3. SOMBRAS: mesh.castShadow = mesh.receiveShadow = true en cada objeto.\n' +
                            '4. ORBITAS: THREE.Object3D como pivote jerarquico: pivote.add(planeta); scene.add(pivote); pivote.rotation.y += dt * vel;\n' +
                            '5. ESTRELLAS/MULTITUD: THREE.Points (PointsMaterial) o THREE.InstancedMesh. NUNCA miles de Mesh individuales.\n' +
                            '6. LINEAS: BufferGeometry.setFromPoints() + THREE.Line. JAMAS RingGeometry para orbitas.\n' +
                            '7. CANNON (solo colisiones/cuerpos rigidos): var world=new CANNON.World(); world.gravity.set(0,-9.82,0); world.allowSleep=true;\n' +
                            '8. HUD: hud.innerHTML="..." al inicio (UNA vez). document.getElementById("id").textContent=valor en animate().\n' +
                            '9. DELTA TIME: usa dt en animate(). Math.min(clock.getDelta(), 0.05) evita explosiones de fisica.\n' +
                            '10. DATOS CIENTIFICOS: valores reales, NO Math.random() para masa/temperatura/gravedad.\n' +
                            '11. NO uses CANNON en simulaciones orbitales/astronomicas (modela con matematicas puras).\n' +
                            '12. Performance: evita crear geometrias nuevas cada frame; reusa con .position/rotation/scale.\n' +
                            '\n' +
                            'IMPORTANTE — SIMULACIONES DE SISTEMA SOLAR / MULTIPLES CUERPOS:\n' +
                            'A. GENERA SIEMPRE TODOS LOS 8 PLANETAS: Mercurio, Venus, Tierra, Marte, Jupiter, Saturno, Urano, Neptuno.\n' +
                            'B. USA un array de objetos con datos cientificos REALES (masa, radio, gravedad, temperatura, distancia del Sol, lunas).\n' +
                            'C. INCLUYE raycaster + evento click para seleccionar planetas y mostrar datos en HUD.\n' +
                            'D. INCLUYE anillos de Saturno con THREE.RingGeometry + THREE.DoubleSide.\n' +
                            'E. INCLUYE etiquetas de nombre con THREE.Sprite + CanvasTexture sobre cada planeta.\n' +
                            'F. INCLUYE toggle de visibilidad de orbitas con tecla [O] (document.addEventListener keydown).\n' +
                            'G. INCLUYE linea orbital para CADA planeta (BufferGeometry.setFromPoints + THREE.Line).\n' +
                            'H. INCLUYE Sol con material emissive + PointLight para iluminacion realista.\n' +
                            'I. REPOSICIONA camara al seleccionar planeta: camera.position.set() + controls.target.set().\n' +
                            'J. Los radios y distancias deben tener ESCALA VISUAL COHERENTE (radio/distancia relacionados).\n' +
                            'K. Opcional: distribucion esferica de estrellas de fondo (no cubica).\n' +
                            'CERO texto de explicacion fuera del codigo JavaScript puro.';
                }
            }
            else {
                extension = langChoice === 'py' ? '.py' : '.ts';
                langKey = langChoice === 'py' ? 'python' : 'typescript';
                if (langChoice === 'py') {
                    systemInstruction = 'Eres un interprete de Python 3. Tu salida DEBE ser SOLO codigo Python puro.\nREGLAS ABSOLUTAS:\n- CERO texto, cero explicaciones.\n- Usa type hints.\n- EVITA dependencias externas.';
                }
                else {
                    systemInstruction = 'Eres un compilador de TypeScript. Tu salida DEBE ser SOLO codigo TypeScript puro.\nREGLAS ABSOLUTAS:\n- NUNCA uses la palabra any.\n- Asigna tipos explicitos.\n- CERO texto, cero explicaciones.\n- EVITA dependencias externas.';
                }
            }
            const sandboxFile = isSimulation ? 'sandbox.js' : 'sandbox' + extension;
            onLog('Requesting code to cloud AI...', 'info');
            if (isSimulation && solarSystemTemplates) {
                // Generación chunked: 2 llamadas para evitar truncamiento TPM
                currentJsCode = await this.generateSolarSystemChunked(userPrompt, systemInstruction, solarSystemTemplates, onLog, imageBase64, mimeType);
                onLog('Código generado en 2 fases (chunked).', 'success');
            }
            else {
                let rawCode = await this.aiManager.ask(systemInstruction, userPrompt, imageBase64, mimeType);
                currentJsCode = this.extractCode(rawCode);
                onLog('Initial code received.', 'success');
            }
            // --- Paso 0: bucle separado de correccion de simulacion (no consume reintentos de validacion) ---
            if (isSimulation) {
                for (let simFix = 0; simFix < 3; simFix++) {
                    const simErrors = this.validateSimulationCode(currentJsCode);
                    if (simErrors.length === 0)
                        break;
                    onLog(`[SIM-CHECK] ${simErrors.length} error(es) de simulacion detectados. Enviando a la IA para correccion...`, 'warn');
                    simErrors.forEach(e => onLog(`  ↳ ${e.substring(0, 100)}`, 'error'));
                    const repairPrompt = `MANTENIENDO el proposito original de la simulacion.\n\n` +
                        `Tu codigo JavaScript tiene los siguientes errores criticos que causaran pantalla negra:\n` +
                        simErrors.map((e, i) => `${i + 1}. ${e}`).join('\n') +
                        `\n\nReescribe el codigo COMPLETO corrigiendo TODOS los errores anteriores, ` +
                        `MANTENIENDO el proposito original. ` +
                        `La plantilla ya tiene bucle animate() por defecto. Si sobreescribes animate() incluye requestAnimationFrame, controls.update() y renderer.render(). ` +
                        `Devuelve SOLO codigo JavaScript puro, sin markdown, sin backticks, sin TypeScript.`;
                    onLog('[REACT] Solicitando correccion a la IA...', 'warn');
                    // Pequeña pausa entre repairs para no saturar rate limit de Groq (6000 TPM)
                    if (simFix > 0)
                        await new Promise(r => setTimeout(r, 2500));
                    let rawRepairedCode = await this.aiManager.ask(systemInstruction, repairPrompt, imageBase64, mimeType);
                    currentJsCode = this.extractCode(rawRepairedCode);
                    // Eliminar CANNON del codigo automaticamente si la simulacion es orbital (la IA es reincidente)
                    if (/\b(orbita|solar|planeta|satelite|estrella|galaxia|astronomia)\b/i.test(userPrompt) && currentJsCode.includes('CANNON')) {
                        currentJsCode = currentJsCode
                            .replace(/var\s+\w+\s*=\s*new\s+CANNON\.\w+[^;]+;/g, '')
                            .replace(/world\.\w+[^;]*;/g, '')
                            .replace(/ballBody[^;]*;/g, '')
                            .replace(/groundBody[^;]*;/g, '')
                            .replace(/CANNON\.\w+/g, 'null')
                            .replace(/world\s*=\s*null/g, '');
                        onLog('[AUTO] CANNON eliminado automaticamente del codigo.', 'warn');
                    }
                    onLog('Codigo corregido. Revalidando...', 'success');
                }
                onLog('[SIM-CHECK] Verificacion de simulacion: OK', 'success');
            }
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                onLog(`[SECURITY] Running analysis (Attempt ${attempt}/${MAX_RETRIES})...`, 'info');
                const securityResult = await this.security.analyze(currentJsCode, langKey);
                if (!securityResult.success) {
                    isSecure = false;
                    const secErrors = securityResult.errors.join(' | ');
                    onLog(`[BLOCKED] Security issue: ${secErrors.substring(0, 100)}`, 'error');
                    if (attempt < MAX_RETRIES) {
                        onLog('[REACT] Sending issue back to AI...', 'warn');
                        const repairPrompt = `Tu codigo tiene problemas de seguridad: "${secErrors}". Reescribe el codigo eliminando vulnerabilidades pero MANTENIENDO el proposito original. Devuelve SOLO codigo puro.`;
                        let rawRepairedCode = await this.aiManager.ask(systemInstruction, repairPrompt, imageBase64, mimeType);
                        currentJsCode = this.extractCode(rawRepairedCode);
                        onLog('Code patched. Retrying scan...', 'success');
                        continue;
                    }
                    else {
                        onLog('[FATAL] Max retries reached on security.', 'error');
                        break;
                    }
                }
                onLog('[VALIDATION] Running structural/compilation analysis...', 'info');
                securityResult.warnings.forEach(w => onLog(`[WARNING] ${w}`, 'warn'));
                const tempFilePath = await this.fileManager.writeCode(sandboxFile, currentJsCode);
                const result = this.router.validate(tempFilePath);
                if (result.success) {
                    isSecure = true;
                    onLog('[SECURE] Code passed security and compilation.', 'success');
                    break;
                }
                else if (attempt < MAX_RETRIES) {
                    const rawError = result.errors[0].substring(0, 300);
                    const cleanError = rawError.replace(/^.*?sandbox\.(ts|py|js)\(\d+,\d+\):\s*/gm, '') || 'Error estructural.';
                    onLog(`[BLOCKED] Validation failed: ${cleanError.substring(0, 80)}`, 'error');
                    onLog('[REACT] Sending error back to AI...', 'warn');
                    let repairPrompt = `El validador rechazó tu codigo. Error: "${cleanError}". Corrigelo MANTENIENDO el proposito original y asegurate de incluir TODA la logica necesaria. Devuelve SOLO codigo puro.`;
                    let rawRepairedCode = await this.aiManager.ask(systemInstruction, repairPrompt, imageBase64, mimeType);
                    currentJsCode = this.extractCode(rawRepairedCode);
                    onLog('Code repaired. Retrying validation...', 'success');
                }
                else {
                    onLog('[FATAL] Max retries reached.', 'error');
                    onLog(result.errors[0].substring(0, 100), 'error');
                }
            }
            const VISUAL_RETRIES = 2;
            if (isSimulation && isSecure) {
                // Chequeo de sintaxis local: atrapa SyntaxError en milisegundos, sin gastar Chromium ni
                // una llamada al LLM en algo que no parsea.
                const jsToCheck = solarSystemTemplates
                    ? solarSystemTemplates + '\n\n' + currentJsCode
                    : currentJsCode;
                try {
                    new Function(jsToCheck);
                }
                catch (e) {
                    onLog(`[SYNTAX] El codigo final tiene un error de sintaxis: ${e.message}. No se renderiza.`, 'error');
                }
                for (let vAttempt = 1; vAttempt <= VISUAL_RETRIES; vAttempt++) {
                    let finalJs = solarSystemTemplates
                        ? solarSystemTemplates + '\n\n' + currentJsCode
                        : currentJsCode;
                    // Colapsar duplicados del codigo FINAL (templates + IA) antes de renderizar.
                    const collapsed = this.collapseDuplicateTopLevelFunctions(finalJs);
                    if (collapsed.removed.length > 0) {
                        onLog(`[DEDUP] Colapsadas ${collapsed.removed.length} funcion(es) duplicada(s) (se conservo la 1ra): ${collapsed.removed.join(', ')}`, 'warn');
                        finalJs = collapsed.code;
                    }
                    const finalHtml = generateHtmlBoilerplate(finalJs);
                    const tempHtmlPath = path.join(process.cwd(), 'safevibe_output', `_visual_check_${Date.now()}.html`);
                    await fs.writeFile(tempHtmlPath, finalHtml);
                    onLog(`[VISUAL] Validando renderizado (intento ${vAttempt}/${VISUAL_RETRIES})...`, 'info');
                    const visualResult = await this.visualValidator.validate(tempHtmlPath);
                    // await fs.unlink(tempHtmlPath).catch(() => {});
                    onLog(`[VISUAL] Score: ${visualResult.score}/100 | Meshes: ${visualResult.meshCount} | Pantalla negra: ${visualResult.isBlackScreen}`, visualResult.pass ? 'success' : 'warn');
                    visualResult.reasons.forEach(r => onLog(`  ↳ ${r}`, visualResult.pass ? 'success' : 'error'));
                    if (visualResult.pass || vAttempt >= VISUAL_RETRIES) {
                        if (visualResult.pass) {
                            onLog('[VISUAL] Validación visual: OK', 'success');
                        }
                        else {
                            onLog(`[VISUAL] Falló tras ${VISUAL_RETRIES} intentos. Usando último resultado.`, 'warn');
                        }
                        // Guardar log de la sesión para diagnóstico
                        const logPath = path.join(process.cwd(), 'safevibe_output', 'last-session.log');
                        const logContent = [
                            '=== SafeVibe Session Log ===',
                            'Date: ' + new Date().toISOString(),
                            'Prompt: ' + userPrompt,
                            'Visual score: ' + visualResult.score + '/100',
                            'Meshes: ' + visualResult.meshCount,
                            'Black screen: ' + visualResult.isBlackScreen,
                            'Reasons: ' + visualResult.reasons.join(' | '),
                            'Console errors: ' + visualResult.consoleErrors.join(' | '),
                            'Runtime errors: ' + visualResult.runtimeErrors.join(' | '),
                            'Screenshot: ' + visualResult.screenshotPath,
                            '',
                            '=== GENERATED CODE ===',
                            currentJsCode,
                        ].join('\n');
                        try {
                            await fs.writeFile(logPath, logContent);
                        }
                        catch (e) { }
                        return { success: visualResult.pass, code: finalHtml, extension: '.html' };
                    }
                    const vErrors = [
                        ...visualResult.reasons,
                        ...visualResult.consoleErrors.slice(0, 2),
                        ...visualResult.runtimeErrors.slice(0, 2),
                    ].join(' | ');
                    onLog('[VISUAL] Reenviando a la IA con feedback visual...', 'warn');
                    const visualRepairPrompt = `Tu simulacion 3D falló validación visual.\n` +
                        `Score: ${visualResult.score}/100\n` +
                        `Problemas: ${vErrors}\n\n` +
                        `Reescribe el codigo COMPLETO corrigiendo estos problemas visuales. ` +
                        `Asegúrate de que scene.add() tenga objetos, los materiales sean visibles, ` +
                        `y no haya errores de JavaScript. Devuelve SOLO codigo JavaScript puro.`;
                    let rawRepairedCode = await this.aiManager.ask(systemInstruction, visualRepairPrompt, imageBase64, mimeType);
                    currentJsCode = this.extractCode(rawRepairedCode);
                }
            }
            return { success: isSecure, code: currentJsCode, extension };
        }
        finally {
            await this.fileManager.cleanup();
        }
    }
    /**
     * Detecta si un prompt de simulación es demasiado complejo para Llama 3.3.
     * Si es complejo, usa Claude 3.5 Sonnet que tiene mayor ventana de contexto
     * y mejor capacidad de generación de código largo.
     */
    isComplexSimulation(prompt) {
        const wordCount = prompt.trim().split(/\s+/).length;
        // Prompts con más de 60 palabras son complejos para Llama 3.3
        if (wordCount > 60)
            return true;
        // Palabras clave de simulaciones que requieren mucho código
        const complexKeywords = [
            'sistema solar', 'solar system', 'planetas', 'planets', 'orbita', 'orbit',
            'atractor', 'attractor', 'lorenz', 'caos', 'chaos',
            'fourier', 'epiciclo', 'epicycle', 'serie de fourier',
            'n-body', 'n cuerpos', 'gravitacion', 'gravitation',
            'difraccion', 'difracción', 'interferencia', 'interference',
            'pendulo doble', 'doble pendulo', 'double pendulum',
            'fluid', 'fluido', 'particulas', 'particles',
            'campo electrico', 'campo magnetico', 'electric field', 'magnetic field',
            'fractal', 'mandelbrot', 'julia',
            'onda', 'wave', 'ondas', 'waves',
            'luna', 'moon', 'satelite', 'satellite',
            '8 planetas', 'ocho planetas', 'eight planets',
            'estrella', 'star', 'estrellas', 'stars',
            'raycasting', 'raycast'
        ];
        const lowerPrompt = prompt.toLowerCase();
        return complexKeywords.some(kw => lowerPrompt.includes(kw));
    }
}
