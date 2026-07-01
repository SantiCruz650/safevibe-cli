import { AIManager } from '../ai/aiManager.js';
import { FileManager } from '../system/fileManager.js';
import { ValidatorRouter } from '../validators/validatorRouter.js';
import { SecurityAnalyzer } from '../validators/securityAnalyzer.js';
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
    const codeBlockMatch = aiResponse.match(/```(?:html|javascript|typescript|python|py)?\s*\n([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1]) return codeBlockMatch[1].trim();
    
    const startIndex = aiResponse.indexOf('<!DOCTYPE html>');
    if (startIndex !== -1) {
      const endIndex = aiResponse.lastIndexOf('</html>');
      return aiResponse.substring(startIndex, endIndex !== -1 ? endIndex + 7 : undefined).trim();
    }
    
    return aiResponse.trim();
  }

  public async generate(
    langChoice: 'ts' | 'py' | 'web',
    userPrompt: string,
    onLog: (msg: string, type: LogType) => void,
    isSimulation: boolean = false
  ): Promise<{ success: boolean; code: string; extension: string }> {
    const MAX_RETRIES = 3;
    let currentCode = '';
    let isSecure = false;
    let extension = '.ts';
    let langKey = 'typescript';
    
    let systemInstruction = '';

    if (isSimulation) {
      extension = '.html';
      langKey = 'html';
      systemInstruction = 'Eres un motor de simulacion fisica 3D web de nivel cientifico. Tu salida DEBE ser SOLO codigo HTML en un solo archivo.\n' +
        '- Incluye Three.js: <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n' +
        '- Incluye Cannon.js: <script src="https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js"></script>\n' +
        '- Incluye OrbitControls: <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>\n' +
        'REGLAS CIENTIFICAS Y VISUALES OBLIGATORIAS:\n' +
        '1. MUNDO FISICO: const world = new CANNON.World(); world.gravity.set(0, -9.82, 0); world.allowSleep = true; world.solver.iterations = 20;\n' +
        '2. ESCALA Y CAMARA: 1 unidad = 1 metro. La camara DEBE estar en position.set(0, 5, 15).\n' +
        '3. MATERIALES VISUALES: Usa SIEMPRE THREE.MeshBasicMaterial para los objetos en movimiento.\n' +
        '4. MATERIALES FISICOS: Crea CANNON.Material y CANNON.ContactMaterial con friccion y restitucion.\n' +
        '5. SUELO: Plano estatico (mass: 0) rotado -Math.PI/2. Visual con THREE.DoubleSide y THREE.GridHelper(30, 30).\n' +
        '6. BUCLE DE TIEMPO FIJO: const fixedTimeStep = 1 / 60; const clock = new THREE.Clock(); \n' +
        '   En requestAnimationFrame: const deltaTime = clock.getDelta(); world.step(fixedTimeStep, deltaTime, 10);\n' +
        '7. PENDULOS/CUERDAS: Usa new CANNON.DistanceConstraint(anchorBody, ballBody, distance). Visual usa THREE.Line con BufferGeometry.\n' +
        '   ANTI-BUG (CRITICO): Para actualizar la linea en el bucle, usa const positions = line.geometry.attributes.position.array; Y LUEGO asigna positions[0] = anchorBody.position.x; positions[1] = ... NUNCA uses positions = valor;\n' +
        '8. TELEMETRIA HUD (CRITICO): div creado con document.createElement, estilos en linea, agregado al DOM con document.body.appendChild.\n' +
        '   En el bucle actualiza innerText con: \n' +
        '   - Altura (m): ballBody.position.y\n' +
        '   - Velocidad Lineal (m/s): ballBody.velocity.length()\n' +
        '   - Velocidad Angular (rad/s): ballBody.velocity.length() / distanciaCuerda\n' +
        '   - Tension Cuerda (N): (masa * 9.82 * (ballBody.position.y / alturaAncla)) + (masa * ballBody.velocity.lengthSquared() / distanciaCuerda)\n' +
        '9. SYNC: mesh.position.copy(body.position); controls.update(); renderer.render();\n' +
        '- NUNCA uses import ni export. Variables globales THREE y CANNON.\n' +
        '- CERO texto fuera del codigo HTML.';
    } else {
      extension = langChoice === 'py' ? '.py' : '.ts';
      langKey = langChoice === 'py' ? 'python' : 'typescript';
      if (langChoice === 'py') {
        systemInstruction = 'Eres un interprete de Python 3. Tu salida DEBE ser SOLO codigo Python puro.\nREGLAS ABSOLUTAS:\n- CERO texto, cero explicaciones.\n- Usa type hints.\n- EVITA dependencias externas.';
      } else {
        systemInstruction = 'Eres un compilador de TypeScript. Tu salida DEBE ser SOLO codigo TypeScript puro.\nREGLAS ABSOLUTAS:\n- NUNCA uses la palabra any.\n- Asigna tipos explicitos.\n- CERO texto, cero explicaciones.\n- EVITA dependencias externas.';
      }
    }

    const sandboxFile = 'sandbox' + extension;

    onLog('Requesting code to cloud AI...', 'info');
    let rawCode = await this.aiManager.ask(systemInstruction, userPrompt);
    currentCode = this.extractCode(rawCode);
    onLog('Initial code received.', 'success');

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      onLog(`[SECURITY] Running analysis (Attempt ${attempt}/${MAX_RETRIES})...`, 'info');
      const securityResult = await this.security.analyze(currentCode, langKey);

      if (!securityResult.success) {
        isSecure = false;
        const secErrors = securityResult.errors.join(' | ');
        onLog(`[BLOCKED] Security issue: ${secErrors.substring(0, 100)}`, 'error');

        if (attempt < MAX_RETRIES) {
          onLog('[REACT] Sending issue back to AI...', 'warn');
          const repairPrompt = `Tu codigo tiene problemas: "${secErrors}". Reescribe el codigo eliminando vulnerabilidades. Devuelve SOLO codigo puro.`;
          let rawRepairedCode = await this.aiManager.ask(systemInstruction, repairPrompt);
          currentCode = this.extractCode(rawRepairedCode);
          onLog('Code patched. Retrying scan...', 'success');
          continue;
        } else {
          onLog('[FATAL] Max retries reached on security.', 'error');
          break;
        }
      }

      onLog('[VALIDATION] Running structural/compilation analysis...', 'info');
      securityResult.warnings.forEach(w => onLog(`[WARNING] ${w}`, 'warn'));

      const tempFilePath = await this.fileManager.writeCode(sandboxFile, currentCode);
      const result = this.router.validate(tempFilePath);

      if (result.success) {
        isSecure = true;
        onLog('[SECURE] Code passed security and compilation.', 'success');
        break;
      } else if (attempt < MAX_RETRIES) {
        const rawError = result.errors[0].substring(0, 300);
        const cleanError = rawError.replace(/^.*?sandbox\.(ts|py|html)\(\d+,\d+\):\s*/gm, '') || 'Error estructural.';
        onLog(`[BLOCKED] Validation failed: ${cleanError.substring(0, 80)}`, 'error');

        onLog('[REACT] Sending error back to AI...', 'warn');
        let repairPrompt = `El validador rechazó tu codigo. Error: "${cleanError}". Corrigelo y asegurate de incluir TODA la logica necesaria. Devuelve SOLO codigo puro.`;

        let rawRepairedCode = await this.aiManager.ask(systemInstruction, repairPrompt);
        currentCode = this.extractCode(rawRepairedCode);
        onLog('Code repaired. Retrying validation...', 'success');
      } else {
        onLog('[FATAL] Max retries reached.', 'error');
        onLog(result.errors[0].substring(0, 100), 'error');
      }
    }

    await this.fileManager.cleanup();
    return { success: isSecure, code: currentCode, extension };
  }
}
