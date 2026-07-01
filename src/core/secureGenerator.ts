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
    const codeBlockMatch = aiResponse.match(/```(?:typescript|javascript|python|py)?\s*\n([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1]) return codeBlockMatch[1].trim();
    const functionMatch = aiResponse.match(/(function\s+.*\{[\s\S]*\})/);
    if (functionMatch && functionMatch[1]) return functionMatch[1].trim();
    return aiResponse.trim();
  }

  public async generate(
    langChoice: 'ts' | 'py',
    userPrompt: string,
    onLog: (msg: string, type: LogType) => void
  ): Promise<{ success: boolean; code: string; extension: string }> {
    const MAX_RETRIES = 3;
    let currentCode = '';
    let isSecure = false;
    let extension = '';
    let systemInstruction = '';
    let langKey = '';

    if (langChoice === 'py') {
      extension = '.py';
      langKey = 'python';
      systemInstruction = 'Eres un interprete de Python 3. Tu salida DEBE ser SOLO codigo Python puro.\nREGLAS ABSOLUTAS:\n- CERO texto, cero explicaciones, cero marcadores de bloque.\n- Usa type hints (ej: def suma(a: int, b: int) -> int:).\n- EVITA dependencias externas. Usa SOLO la libreria estandar de Python.';
    } else {
      extension = '.ts';
      langKey = 'typescript';
      systemInstruction = 'Eres un compilador de TypeScript. Tu salida DEBE ser SOLO codigo TypeScript puro.\nREGLAS ABSOLUTAS:\n- NUNCA uses la palabra any.\n- Asigna tipos explicitos (number, string) a TODOS los parametros y retornos.\n- CERO texto, cero explicaciones, cero marcadores de bloque.\n- EVITA dependencias externas (npm). Usa SOLO modulos nativos de Node.js (ej: node:fs, node:path) o TypeScript puro.';
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
        onLog(`[BLOCKED] Security/Dependency issue: ${secErrors.substring(0, 100)}`, 'error');

        if (attempt < MAX_RETRIES) {
          onLog('[REACT] Sending issue back to AI...', 'warn');
          const repairPrompt = `Tu codigo tiene problemas: "${secErrors}". Reescribe el codigo eliminando vulnerabilidades o dependencias falsas. Devuelve SOLO codigo puro.`;
          let rawRepairedCode = await this.aiManager.ask(systemInstruction, repairPrompt);
          currentCode = this.extractCode(rawRepairedCode);
          onLog('Code patched. Retrying scan...', 'success');
          continue;
        } else {
          onLog('[FATAL] Max retries reached on security.', 'error');
          break;
        }
      }

      onLog('[VALIDATION] Running compilation analysis...', 'info');
      securityResult.warnings.forEach(w => onLog(`[WARNING] ${w}`, 'warn'));

      const tempFilePath = await this.fileManager.writeCode(sandboxFile, currentCode);
      const result = this.router.validate(tempFilePath);

      if (result.success) {
        isSecure = true;
        onLog('[SECURE] Code passed security and compilation.', 'success');
        break;
      } else if (attempt < MAX_RETRIES) {
        const rawError = result.errors[0].substring(0, 300);
        const cleanError = rawError.replace(/^.*?sandbox\.(ts|py)\(\d+,\d+\):\s*/gm, '') || 'Error de sintaxis o tipado.';
        onLog(`[BLOCKED] Compilation failed: ${cleanError.substring(0, 80)}`, 'error');

        onLog('[REACT] Sending error back to AI...', 'warn');
        let repairPrompt = `El compilador rechazó tu codigo. Error: "${cleanError}". Corrigelo. Devuelve SOLO codigo puro.`;
        if (cleanError.includes('Cannot find module') || cleanError.includes('not found')) {
          repairPrompt = 'El compilador rechazó tu codigo porque falta un modulo. NO tienes permiso para usar librerias externas. Reescribe el codigo eliminando el import y usando SOLO APIs nativas de Node.js o TypeScript puro. Devuelve SOLO codigo puro.';
        }

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
