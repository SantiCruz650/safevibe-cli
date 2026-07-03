import { AIManager } from '../ai/aiManager.js';
import { FileManager } from '../system/fileManager.js';
import { ValidatorRouter } from '../validators/validatorRouter.js';
import { SecurityAnalyzer } from '../validators/securityAnalyzer.js';
import { generateHtmlBoilerplate } from './htmlTemplate.js';
import path from 'node:path';
import fs from 'node:fs/promises';

export type LogType = 'info' | 'success' | 'error' | 'warn';

export class SecureGenerator {
  private aiManager = new AIManager();
  private fileManager = new FileManager();
  private router = new ValidatorRouter();
  private security = new SecurityAnalyzer();
  private outputDir = path.join(process.cwd(), 'safevibe_output');

  public async init() {
    await this.fileManager.initSandbox();
    await fs.mkdir(this.outputDir, { recursive: true });
  }

  private extractCode(aiResponse: string): string {
    // Intento 1: bloque markdown completo (con cierre ```)
    const fullBlock = aiResponse.match(/```(?:javascript|js|typescript|html|ts|py)?[ \t]*\r?\n([\s\S]*?)```/);
    if (fullBlock && fullBlock[1]) return this.stripMarkdownArtifacts(fullBlock[1].trim());

    // Intento 2: bloque sin cierre (IA truncó la respuesta) — toma todo lo que sigue al opening ```
    const openBlock = aiResponse.match(/```(?:javascript|js|typescript|html|ts|py)?[ \t]*\r?\n([\s\S]+)$/);
    if (openBlock && openBlock[1]) return this.stripMarkdownArtifacts(openBlock[1].trim());

    // Intento 3: respuesta plana sin bloques
    return this.stripMarkdownArtifacts(aiResponse.trim());
  }

  /** Elimina líneas que son solo backticks de markdown que quedaron en el código */
  private stripMarkdownArtifacts(code: string): string {
    return code
      .split('\n')
      .filter(line => !/^```/.test(line.trimStart()))  // elimina líneas ``` javascript, ``` etc.
      .join('\n')
      .trim();
  }

  /** Valida errores recurrentes específicos de simulaciones browser/THREE.js */
  private validateSimulationCode(code: string): string[] {
    const errors: string[] = [];

    // Bug recurrente #1: IA redeclara 'var hud' siendo que el bootstrap ya lo declara
    const hudDeclarations = (code.match(/\bvar\s+hud\s*=/g) || []).length
                          + (code.match(/\bconst\s+hud\s*=/g) || []).length
                          + (code.match(/\blet\s+hud\s*=/g) || []).length;
    if (hudDeclarations > 0) {
      errors.push(
        'ANTI-BUG: La variable "hud" YA ESTA declarada en el bootstrap del runtime. ' +
        'NO la redeclares con var/const/let. Usa directamente: hud.innerHTML = ...; ' +
        'Reescribe el codigo eliminando cualquier declaracion de hud.'
      );
    }

    // Bug recurrente #2: Float32BufferAttribute con array de 2 valores por punto declarado como 3
    // Detecta: push(x); push(y); sin push(z); antes de Float32BufferAttribute(..., 3)
    if (/Float32BufferAttribute\s*\(/.test(code)) {
      // Busca patrones donde solo se pushean 2 valores por iteración pero se pasa componentes=3
      const bad2d = code.match(/\.push\([^)]+\);\s*\n\s*[\w.]+\.push\([^)]+\);\s*\n(?!\s*[\w.]+\.push)[\s\S]{0,200}Float32BufferAttribute[^,]+,\s*3\s*\)/);
      if (bad2d) {
        errors.push(
          'ANTI-BUG: Float32BufferAttribute requiere exactamente 3 componentes por punto (x, y, z). ' +
          'Si tu bucle solo hace push de x e y, agrega tambien push(0) para z antes de crear el atributo. ' +
          'Reescribe para que cada punto tenga 3 valores: array.push(x, y, 0);'
        );
      }
    }

    // Bug recurrente #3: código truncado — termina sin llamar a animate()
    if (!/animate\s*\(\s*\)/.test(code)) {
      errors.push(
        'ANTI-BUG: El codigo no contiene la llamada animate() para iniciar el bucle de renderizado. ' +
        'El codigo parece truncado o incompleto. Asegurate de incluir la funcion animate() completa ' +
        'y llamarla al final: function animate(){ requestAnimationFrame(animate); ... renderer.render(scene, camera); } animate();'
      );
    }

    // Bug recurrente #4: TypeScript syntax en HTML puro
    if (/\bas\s+[A-Z][a-zA-Z]+\b/.test(code) || /:\s*(?:number|string|boolean|HTMLElement|any)\b/.test(code)) {
      errors.push(
        'ANTI-BUG: Se detectó sintaxis de TypeScript en código JavaScript puro ("as Type" o anotaciones de tipo). ' +
        'Este código se ejecuta directamente en el navegador. Elimina todos los tipos TypeScript y usa JavaScript puro.'
      );
    }

    return errors;
  }

  public async generate(
    langChoice: 'ts' | 'py' | 'web',
    userPrompt: string,
    onLog: (msg: string, type: LogType) => void,
    isSimulation: boolean = false,
    imageBase64?: string,
    mimeType?: string
  ): Promise<{ success: boolean; code: string; extension: string }> {
    const MAX_RETRIES = 3;
    let currentJsCode = '';
    let isSecure = false;
    let extension = '.ts';
    let langKey = 'typescript';
    
    let systemInstruction = '';

    if (isSimulation) {
      extension = '.html';
      langKey = 'javascript';
      systemInstruction =
        'Eres un motor y simulador experto de laboratorios fisicos y matematicos interactivos.\n' +
        'CRITICO: Escribe SOLO codigo JavaScript PURO (ES5/ES6). JAMAS uses TypeScript, no uses "as any", no uses tipos como "number|string", no uses interfaces, no uses import/export.\n' +
        'El codigo se ejecutara directamente en un navegador donde THREE (r128), CANNON (0.6.2) y THREE.OrbitControls ya estan cargados como variables globales.\n' +
        '\n' +
        'REGLAS ABSOLUTAS:\n' +
        '1. USA "var" para declaraciones de variables globales. Evita "const" y "let" para variables de nivel superior para evitar re-declaraciones.\n' +
        '2. DECISION DE ENGINE: Si el problema requiere colisiones/dinamica de cuerpos rigidos (resortes, poleas, pendulos, choque), usa CANNON.js. Si es matematico, geometrico, de ondas, optico o de campo, NO uses CANNON, modela las ecuaciones directamente en el bucle de THREE.js.\n' +
        '3. HUD (CRITICO): La variable global "hud" YA ESTA DECLARADA (apunta al div#hud del DOM). NO la redeclares. Usa directamente:\n' +
        '   - hud.innerHTML = "..." (configura la maqueta del HUD al inicio una sola vez, NUNCA en el bucle animate ya que borraria los inputs o sliders)\n' +
        '   - Para actualizar valores en el bucle usa: document.getElementById("miSpan").textContent = valor;\n' +
        '   - Los inputs/botones dentro del HUD ya tienen pointer-events activos, puedes agregar event listeners.\n' +
        '4. FISICA CANNON (si aplica): var world = new CANNON.World(); world.gravity.set(0,-9.82,0); world.allowSleep=true; world.solver.iterations=20;\n' +
        '   Agrega formas a cada Body con body.addShape(new CANNON.Sphere(r)) y agrega al mundo con world.addBody(body).\n' +
        '5. ILUMINACION: Usa THREE.AmbientLight + THREE.DirectionalLight. Materiales: THREE.MeshStandardMaterial o THREE.MeshPhongMaterial.\n' +
        '6. CAMARA: var camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000); camera.position.set(x,y,z);\n' +
        '   Almacenala tambien en window._svCamera = camera; para que el resize handler del runtime funcione.\n' +
        '7. RENDERER: var renderer = new THREE.WebGLRenderer({antialias:true}); renderer.setSize(window.innerWidth, window.innerHeight); document.body.appendChild(renderer.domElement);\n' +
        '   Almacenalo en window._svRenderer = renderer;\n' +
        '8. CONTROLES: var controls = new THREE.OrbitControls(camera, renderer.domElement); controls.enableDamping=true; -- Llama controls.update() en cada frame.\n' +
        '9. LINEAS/CUERDAS: Usa THREE.LineBasicMaterial (NO MeshBasicMaterial). Despues de actualizar posiciones de geometria de linea, llama: line.geometry.computeBoundingSphere(); line.geometry.computeBoundingBox();\n' +
        '10. SIMULACIONES ESPACIALES/ORBITALES: \n' +
        '    - Dibuja y calcula las orbitas coplanares en el mismo plano XZ (usando formulas: x = r * cos(a), z = r * sin(a)).\n' +
        '    - Para las lineas orbitales, crea un anillo ordenado usando THREE.BufferGeometry().setFromPoints(puntos) de un circulo, alineado en el mismo plano. NO rotes de forma aleatoria las orbitas si los planetas se mueven planos.\n' +
        '    - No crees miles de meshes individuales para estrellas (provoca caida de FPS). Para fondos estelares de miles de puntos, usa THREE.Points con THREE.PointsMaterial.\n' +
        '11. BUCLE: function animate(){ requestAnimationFrame(animate); /* paso de fisica, actualizacion de meshes, render */ controls.update(); renderer.render(scene,camera); } animate();\n' +
        '12. HUD INTERACTIVO: Al inicio (no en el bucle) configura hud.innerHTML con controles (inputs, sliders, botones). En el bucle lee sus valores con document.getElementById("id").value.\n' +
        'CERO texto de explicacion fuera del codigo JavaScript puro.';
    } else {
      extension = langChoice === 'py' ? '.py' : '.ts';
      langKey = langChoice === 'py' ? 'python' : 'typescript';
      if (langChoice === 'py') {
        systemInstruction = 'Eres un interprete de Python 3. Tu salida DEBE ser SOLO codigo Python puro.\nREGLAS ABSOLUTAS:\n- CERO texto, cero explicaciones.\n- Usa type hints.\n- EVITA dependencias externas.';
      } else {
        systemInstruction = 'Eres un compilador de TypeScript. Tu salida DEBE ser SOLO codigo TypeScript puro.\nREGLAS ABSOLUTAS:\n- NUNCA uses la palabra any.\n- Asigna tipos explicitos.\n- CERO texto, cero explicaciones.\n- EVITA dependencias externas.';
      }
    }

    const sandboxFile = isSimulation ? 'sandbox.js' : 'sandbox' + extension;

    onLog('Requesting code to cloud AI...', 'info');
    let rawCode = await this.aiManager.ask(systemInstruction, userPrompt, imageBase64, mimeType);
    currentJsCode = this.extractCode(rawCode);
    onLog('Initial code received.', 'success');

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // --- Paso 0: validación específica de simulaciones Three.js (antes de seguridad) ---
      if (isSimulation) {
        const simErrors = this.validateSimulationCode(currentJsCode);
        if (simErrors.length > 0) {
          onLog(`[SIM-CHECK] ${simErrors.length} error(es) de simulacion detectados. Enviando a la IA para correccion...`, 'warn');
          simErrors.forEach(e => onLog(`  ↳ ${e.substring(0, 100)}`, 'error'));
          if (attempt < MAX_RETRIES) {
            const repairPrompt =
              `Tu codigo JavaScript tiene los siguientes errores criticos que causaran pantalla negra:\n` +
              simErrors.map((e, i) => `${i+1}. ${e}`).join('\n') +
              `\n\nReescribe el codigo COMPLETO corrigiendo TODOS los errores anteriores. ` +
              `Incluye la funcion animate() completa y la llamada animate() al final. ` +
              `Devuelve SOLO codigo JavaScript puro, sin markdown, sin backticks, sin TypeScript.`;
            onLog('[REACT] Solicitando correccion a la IA...', 'warn');
            let rawRepairedCode = await this.aiManager.ask(systemInstruction, repairPrompt, imageBase64, mimeType);
            currentJsCode = this.extractCode(rawRepairedCode);
            onLog('Codigo corregido. Revalidando...', 'success');
            continue;
          }
        } else {
          onLog('[SIM-CHECK] Verificacion de simulacion: OK', 'success');
        }
      }

      onLog(`[SECURITY] Running analysis (Attempt ${attempt}/${MAX_RETRIES})...`, 'info');
      const securityResult = await this.security.analyze(currentJsCode, langKey);

      if (!securityResult.success) {
        isSecure = false;
        const secErrors = securityResult.errors.join(' | ');
        onLog(`[BLOCKED] Security issue: ${secErrors.substring(0, 100)}`, 'error');

        if (attempt < MAX_RETRIES) {
          onLog('[REACT] Sending issue back to AI...', 'warn');
          const repairPrompt = `Tu codigo tiene problemas: "${secErrors}". Reescribe el codigo eliminando vulnerabilidades. Devuelve SOLO codigo puro.`;
          let rawRepairedCode = await this.aiManager.ask(systemInstruction, repairPrompt, imageBase64, mimeType);
          currentJsCode = this.extractCode(rawRepairedCode);
          onLog('Code patched. Retrying scan...', 'success');
          continue;
        } else {
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
      } else if (attempt < MAX_RETRIES) {
        const rawError = result.errors[0].substring(0, 300);
        const cleanError = rawError.replace(/^.*?sandbox\.(ts|py|js)\(\d+,\d+\):\s*/gm, '') || 'Error estructural.';
        onLog(`[BLOCKED] Validation failed: ${cleanError.substring(0, 80)}`, 'error');

        onLog('[REACT] Sending error back to AI...', 'warn');
        let repairPrompt = `El validador rechazó tu codigo. Error: "${cleanError}". Corrigelo y asegurate de incluir TODA la logica necesaria. Devuelve SOLO codigo puro.`;

        let rawRepairedCode = await this.aiManager.ask(systemInstruction, repairPrompt, imageBase64, mimeType);
        currentJsCode = this.extractCode(rawRepairedCode);
        onLog('Code repaired. Retrying validation...', 'success');
      } else {
        onLog('[FATAL] Max retries reached.', 'error');
        onLog(result.errors[0].substring(0, 100), 'error');
      }
    }

    await this.fileManager.cleanup();
    
    if (isSimulation && isSecure) {
      const finalHtml = generateHtmlBoilerplate(currentJsCode);
      return { success: true, code: finalHtml, extension: '.html' };
    }

    return { success: isSecure, code: currentJsCode, extension };
  }

  /**
   * Detecta si un prompt de simulación es demasiado complejo para Llama 3.3.
   * Si es complejo, usa Claude 3.5 Sonnet que tiene mayor ventana de contexto
   * y mejor capacidad de generación de código largo.
   */
  private isComplexSimulation(prompt: string): boolean {
    const wordCount = prompt.trim().split(/\s+/).length;

    // Prompts con más de 60 palabras son complejos para Llama 3.3
    if (wordCount > 60) return true;

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
