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
    if (codeBlockMatch && codeMatch[1]) return codeBlockMatch[1].trim();
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
      systemInstruction = 'Eres un motor de simulacion fisica 3D web de nivel cientifico. Tu salida DEBE ser SOLO codigo HTML.\n' +
        '- Incluye Three.js: <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n' +
        '- Incluye Cannon.js: <script src="https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js"></script>\n' +
        '- Incluye OrbitControls: <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>\n' +
        'REGLAS CIENTIFICAS OBLIGATORIAS (MKS Y ANTIBUGS):\n' +
        '1. UNIDADES: 1 unidad = 1 metro. Masas en kg.\n' +
        '2. MUNDO FISICO: \n' +
        '   const world = new CANNON.World(); world.gravity.set(0, -9.82, 0);\n' +
        '   world.allowSleep = true; world.solver.iterations = 20;\n' +
        '3. MATERIALES EXPLICTOS: Crea CANNON.Material para suelo y objetos. Crea CANNON.ContactMaterial con friccion y restitucion exactas. Anadelos al world.\n' +
        '4. SUELO: CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: groundMaterial }). Rotado -Math.PI/2. Visual con THREE.DoubleSide y THREE.GridHelper(100, 100).\n' +
        '5. BUCLE DE TIEMPO FIJO (CRITICO): \n' +
        '   const fixedTimeStep = 1 / 60; const maxSubSteps = 10; const clock = new THREE.Clock();\n' +
        '   En requestAnimationFrame: const deltaTime = clock.getDelta(); world.step(fixedTimeStep, deltaTime, maxSubSteps);\n' +
        '6. DORMIR (SLEEPING): body.allowSleep = true; body.sleepSpeedLimit = 0.1; body.sleepTimeLimit = 1.0;\n' +
        '7. PENDULOS/CUERDAS: Usa new CANNON.PointToPointConstraint. Visual usa THREE.CylinderGeometry actualizado en el bucle con quaternion.setFromUnitVectors.\n' +
        '8. HUD: div estilizado en linea, agregado al DOM antes del bucle. Actualiza innerText con velocidad, altura y energia en cada frame.\n' +
        '9. SYNC: mesh.position.copy(body.position); mesh.quaternion.copy(body.quaternion); controls.update(); renderer.render();\n' +
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
