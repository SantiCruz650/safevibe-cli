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
      systemInstruction = 'Eres un motor de simulacion fisica 3D web. Tu salida DEBE ser SOLO codigo HTML puro en un solo archivo.\n' +
        'REGLAS ESTRICTAS DE SIMULACION:\n' +
        '- Incluye Three.js: <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n' +
        '- Incluye Cannon.js: <script src="https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js"></script>\n' +
        '- Incluye OrbitControls: <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>\n' +
        '- NUNCA uses import ni export.\n' +
        'ARQUITECTURA OBLIGATORIA (ANTI-BUGS):\n' +
        '1. Escena, Camara (PerspectiveCamera en (0, 10, 20)) y Renderer.\n' +
        '2. LUCES: AmbientLight y DirectionalLight.\n' +
        '3. FISICA: const world = new CANNON.World(); world.gravity.set(0, -9.82, 0);\n' +
        '4. REBOTE GLOBAL (CRITICO): Justo despues de world.gravity, escribe: world.defaultContactMaterial.restitution = 0.8; world.defaultContactMaterial.friction = 0.1;\n' +
        '5. SUELO FISICO: const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() }); groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2); world.addBody(groundBody);\n' +
        '6. SUELO VISUAL: Usa new THREE.PlaneGeometry(100, 100) con material MeshStandardMaterial que OBLIGATORIAMENTE tenga { side: THREE.DoubleSide }. Rotalo -Math.PI/2 en X. Añade tambien un THREE.GridHelper(100, 100) en y=0.\n' +
        '7. OBJETO: Esfera visual en THREE y CANNON.Body (Sphere) con masa 2. Posicion inicial en (0, 10, 0).\n' +
        '8. CAMARA: const controls = new THREE.OrbitControls(camera, renderer.domElement);\n' +
        '9. HUD (CRITICO): Crea un div con document.createElement. Estilizado EN LINEA (position absolute, top 10px, left 10px, color white, backgroundColor rgba(0,0,0,0.7)). AGREGALO al DOM con document.body.appendChild(hudDiv) ANTES del bucle. \n' +
        '   En el bucle actualiza: hudDiv.innerText = "Velocidad: " + (ballBody.velocity.length()).toFixed(2) + " m/s\\nAltura: " + ballBody.position.y.toFixed(2) + " m\\nEnergia: " + (0.5 * 2 * ballBody.velocity.lengthSquared()).toFixed(2) + " J";\n' +
        '10. BUCLE: requestAnimationFrame. Llama a world.step(1/60). Copia posiciones (ballMesh.position.copy(ballBody.position)). Llama a controls.update(). Llama a renderer.render(scene, camera).\n' +
        '- CERO texto fuera del codigo HTML.';
    } else {
      extension = langChoice === 'py' ? '.py' : '.ts';
      langKey = langChoice === 'py' ? 'python' : 'typescript';
      if (langChoice === 'py') {
        systemInstruction = 'Eres un interprete de Python 3. Tu salida DEBE ser SOLO codigo Python puro.\nREGLAS ABSOLUTAS:\n- CERO texto, cero explicaciones, cero marcadores de bloque.\n- Usa type hints.\n- EVITA dependencias externas.';
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
