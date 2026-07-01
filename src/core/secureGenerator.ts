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
    const codeBlockMatch = aiResponse.match(/```(?:javascript|js|typescript|html)?\s*\n([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1]) return codeBlockMatch[1].trim();
    return aiResponse.trim();
  }

  public async generate(
    langChoice: 'ts' | 'py' | 'web',
    userPrompt: string,
    onLog: (msg: string, type: LogType) => void,
    isSimulation: boolean = false
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
      systemInstruction = 'Eres un motor de simulacion fisica 3D. Escribe SOLO codigo JavaScript puro. No escribas HTML, no escribas <script>, no escribas import.\n' +
        'El codigo se ejecutara en un navegador donde THREE, CANNON y THREE.OrbitControls ya estan cargados globalmente.\n' +
        'Hay un div con id="hud" ya creado en el DOM.\n' +
        'REGLAS OBLIGATORIAS:\n' +
        '1. MUNDO FISICO: const world = new CANNON.World(); world.gravity.set(0, -9.82, 0); world.allowSleep = true; world.solver.iterations = 20;\n' +
        '2. MATERIALES FISICOS: Crea CANNON.Material y CANNON.ContactMaterial con friccion y restitucion.\n' +
        '3. SUELO: Plano estatico (mass: 0) rotado -Math.PI/2 en X. Visual con THREE.DoubleSide y THREE.GridHelper(30, 30).\n' +
        '4. CAMARA: PerspectiveCamera. Posicion inicial en (0, 5, 15).\n' +
        '5. OBJETOS: Usa THREE.MeshBasicMaterial para que sean visibles sin luces.\n' +
        '6. PENDULOS: Usa new CANNON.DistanceConstraint(anchorBody, ballBody, distance). Visual usa THREE.Line con BufferGeometry.\n' +
        '   ANTI-BUG: Para actualizar la linea en el bucle: const positions = line.geometry.attributes.position.array; positions[0] = anchorBody.position.x; positions[1] = anchorBody.position.y; etc. NUNCA uses positions = valor;\n' +
        '7. BUCLE: const fixedTimeStep = 1 / 60; const clock = new THREE.Clock();\n' +
        '   En requestAnimationFrame: const dt = clock.getDelta(); world.step(fixedTimeStep, dt, 10);\n' +
        '8. HUD: En el bucle, actualiza hud.innerText con: Altura, Velocidad, Tension (N).\n' +
        '   Formula Tension: (masa * 9.82 * (ballBody.position.y / anchorHeight)) + (masa * ballBody.velocity.lengthSquared() / ropeLength)\n' +
        '9. SYNC Y RENDER: mesh.position.copy(body.position); controls.update(); renderer.render(scene, camera);\n' +
        '- CERO texto fuera del codigo JavaScript.';
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
    let rawCode = await this.aiManager.ask(systemInstruction, userPrompt);
    currentJsCode = this.extractCode(rawCode);
    onLog('Initial code received.', 'success');

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      onLog(`[SECURITY] Running analysis (Attempt ${attempt}/${MAX_RETRIES})...`, 'info');
      const securityResult = await this.security.analyze(currentJsCode, langKey);

      if (!securityResult.success) {
        isSecure = false;
        const secErrors = securityResult.errors.join(' | ');
        onLog(`[BLOCKED] Security issue: ${secErrors.substring(0, 100)}`, 'error');

        if (attempt < MAX_RETRIES) {
          onLog('[REACT] Sending issue back to AI...', 'warn');
          const repairPrompt = `Tu codigo tiene problemas: "${secErrors}". Reescribe el codigo eliminando vulnerabilidades. Devuelve SOLO codigo puro.`;
          let rawRepairedCode = await this.aiManager.ask(systemInstruction, repairPrompt);
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

        let rawRepairedCode = await this.aiManager.ask(systemInstruction, repairPrompt);
        currentJsCode = this.extractCode(rawRepairedCode);
        onLog('Code repaired. Retrying validation...', 'success');
      } else {
        onLog('[FATAL] Max retries reached.', 'error');
        onLog(result.errors[0].substring(0, 100), 'error');
      }
    }

    await this.fileManager.cleanup();
    
    // Si es simulacion, inyectamos el JS validado en la plantilla HTML inmutable
    if (isSimulation && isSecure) {
      const finalHtml = generateHtmlBoilerplate(currentJsCode);
      return { success: true, code: finalHtml, extension: '.html' };
    }

    return { success: isSecure, code: currentJsCode, extension };
  }
}
