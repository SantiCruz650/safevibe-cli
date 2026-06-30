import * as p from '@clack/prompts';
import pc from 'picocolors';
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig, saveConfig } from './config/configHandler.js';
import { AIManager } from './ai/aiManager.js';
import { FileManager } from './system/fileManager.js';
import { ValidatorRouter } from './validators/validatorRouter.js';
import { SecurityAnalyzer } from './validators/securityAnalyzer.js';

function extractCode(aiResponse: string): string {
  const codeBlockMatch = aiResponse.match(/```(?:typescript|javascript|python|py)?\s*\n([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) return codeBlockMatch[1].trim();
  const functionMatch = aiResponse.match(/(function\s+.*\{[\s\S]*\})/);
  if (functionMatch && functionMatch[1]) return functionMatch[1].trim();
  return aiResponse.trim();
}

async function main() {
  let currentConfig = await loadConfig();
  const aiManager = new AIManager();
  const fileManager = new FileManager();
  const router = new ValidatorRouter();
  const security = new SecurityAnalyzer();
  const outputDir = path.join(process.cwd(), 'safevibe_output');

  await fileManager.initSandbox();
  await fs.mkdir(outputDir, { recursive: true });

  p.intro(pc.bgCyan(pc.black(' SAFEVIBE CLI // PROTOCOL ACTIVE ')));

  const mainAction = await p.select({
    message: 'Select operation:',
    options: [
      { value: 'generate', label: '[>] Generate Secure Code', hint: 'Describe, validate, edit, and save' },
      { value: 'test_ai', label: '[*] Test AI Connection', hint: 'Ping cloud model' },
      { value: 'config', label: '[#] System Configuration', hint: 'Providers, security flags' },
      { value: 'exit', label: '[x] Exit Protocol' }
    ]
  });

  if (p.isCancel(mainAction)) process.exit(0);

  if (mainAction === 'generate') {
    const MAX_RETRIES = 3;
    let currentCode = '';
    let isSecure = false;

    const langChoice = await p.select({
      message: 'Select target language:',
      options: [
        { value: 'ts', label: '[TS] TypeScript' },
        { value: 'py', label: '[PY] Python' }
      ]
    });

    if (p.isCancel(langChoice)) process.exit(0);

    let extension = '';
    let systemInstruction = '';
    let langKey = '';

    if (langChoice === 'py') {
      extension = '.py';
      langKey = 'python';
      systemInstruction = 'Eres un interprete de Python 3. Tu salida DEBE ser SOLO codigo Python puro.' +
        '\nREGLAS ABSOLUTAS:' +
        '\n- CERO texto, cero explicaciones, cero marcadores de bloque.' +
        '\n- Usa type hints (ej: def suma(a: int, b: int) -> int:).' +
        '\n- EVITA dependencias externas. Usa SOLO la libreria estandar de Python.';
    } else {
      extension = '.ts';
      langKey = 'typescript';
      systemInstruction = 'Eres un compilador de TypeScript. Tu salida DEBE ser SOLO codigo TypeScript puro.' +
        '\nREGLAS ABSOLUTAS:' +
        '\n- NUNCA uses la palabra any.' +
        '\n- Asigna tipos explicitos (number, string) a TODOS los parametros y retornos.' +
        '\n- CERO texto, cero explicaciones, cero marcadores de bloque.' +
        '\n- EVITA dependencias externas (npm). Usa SOLO modulos nativos de Node.js (ej: node:fs, node:path) o TypeScript puro.';
    }

    const userPrompt = await p.text({
      message: '>',
      placeholder: 'Describe el codigo que necesitas...'
    });

    if (p.isCancel(userPrompt)) { p.cancel('Aborted.'); process.exit(0); }

    const sandboxFile = 'sandbox' + extension;

    try {
      const s = p.spinner();
      s.start('Requesting code to cloud AI...');
      let rawCode = await aiManager.ask(systemInstruction, userPrompt);
      currentCode = extractCode(rawCode);
      s.stop('Initial code received.');

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        p.log.info('[SECURITY] Running static & dependency analysis (Attempt ' + attempt + '/' + MAX_RETRIES + ')...');
        
        const securityResult = await security.analyze(currentCode, langKey);
        
        if (!securityResult.success) {
          isSecure = false;
          p.log.error(pc.red('[BLOCKED] Security or Dependency issue detected!'));
          const secErrors = securityResult.errors.join(' | ');
          p.log.info(pc.bgRed(pc.white("[DEBUG] Security Error: " + secErrors.substring(0, 300))));
          
          if (attempt < MAX_RETRIES) {
            p.log.warn(pc.yellow('[REACT] Sending issue back to AI...'));
            const s2 = p.spinner();
            s2.start('AI is patching issue...');
            const repairPrompt = 'Tu codigo tiene problemas: "' + secErrors + '". Reescribe el codigo eliminando vulnerabilidades o dependencias falsas. Devuelve SOLO codigo puro.';
            let rawRepairedCode = await aiManager.ask(systemInstruction, repairPrompt);
            currentCode = extractCode(rawRepairedCode);
            s2.stop('Code patched. Retrying scan...');
            continue; 
          } else {
            p.log.error(pc.red('[FATAL] Max retries reached on security.'));
            break;
          }
        }

        p.log.info('[VALIDATION] Running compilation analysis...');
        securityResult.warnings.forEach(w => p.log.warn(pc.yellow('[SECURITY WARNING] ' + w)));
        
        const tempFilePath = await fileManager.writeCode(sandboxFile, currentCode);
        const result = router.validate(tempFilePath);

        if (result.success) {
          isSecure = true;
          p.log.success(pc.green('[SECURE] Code passed security and compilation.'));
          break; 
        } 
        else if (attempt < MAX_RETRIES) {
          const rawError = result.errors[0].substring(0, 300);
          p.log.info(pc.bgRed(pc.white("[DEBUG] Compile Error: " + rawError)));
          const cleanError = rawError.replace(/^.*?sandbox\.(ts|py)\(\d+,\d+\):\s*/gm, '') || 'Error de sintaxis o tipado.';
          
          p.log.error(pc.red('[BLOCKED] Compilation failed.'));
          p.log.warn(pc.yellow('[REACT] Sending error back to AI...'));
          const s2 = p.spinner();
          s2.start('AI is reasoning...');
          
          // MEJORA CLAVE: Si el error es de modulo no encontrado, obligamos a la IA a usar APIs nativas
          let repairPrompt = 'El compilador rechazó tu codigo. Error: "' + cleanError + '". Corrigelo. Devuelve SOLO codigo puro.';
          if (cleanError.includes('Cannot find module') || cleanError.includes('not found')) {
            repairPrompt = 'El compilador rechazó tu codigo porque falta un modulo. NO tienes permiso para usar librerias externas. Reescribe el codigo eliminando el import y usando SOLO APIs nativas de Node.js o TypeScript puro. Devuelve SOLO codigo puro.';
          }
          
          let rawRepairedCode = await aiManager.ask(systemInstruction, repairPrompt);
          currentCode = extractCode(rawRepairedCode);
          s2.stop('Code repaired. Retrying validation...');
        } 
        else {
          p.log.error(pc.red('[FATAL] Max retries reached.'));
          p.log.error(pc.dim(result.errors[0].substring(0, 250)));
        }
      }

      if (isSecure) {
        const tempFilePath = await fileManager.writeCode(sandboxFile, currentCode);
        
        const action = await p.select({
          message: 'Code is secure. What do you want to do?',
          options: [
            { value: 'save', label: '[S] Save to disk', hint: 'Export to safevibe_output/' },
            { value: 'edit', label: '[E] Open in editor (nano)', hint: 'Add // FIX: comments to modify via AI' },
            { value: 'discard', label: '[X] Discard', hint: 'Do not save' }
          ]
        });

        if (p.isCancel(action)) process.exit(0);

        if (action === 'edit') {
          p.log.step(pc.dim('Opening nano. Add "// FIX: your instructions". Press Ctrl+X to exit.'));
          execSync('nano "' + tempFilePath + '"', { stdio: 'inherit' });
          
          const editedCode = await fs.readFile(tempFilePath, 'utf-8');
          const fixMatch = editedCode.match(/\/\/\s*FIX:\s*(.*)$/m);
          
          if (fixMatch && fixMatch[1]) {
            const userFixInstruction = fixMatch[1];
            p.log.warn(pc.yellow('[HUMAN FEEDBACK] Detected FIX: "' + userFixInstruction + '"'));
            
            const s3 = p.spinner();
            s3.start('Sending fix request to AI...');
            const fixPrompt = 'El usuario pide esta correccion: "' + userFixInstruction + '". Aplicalas. Devuelve SOLO codigo puro.';
            let rawFixedCode = await aiManager.ask(systemInstruction, fixPrompt);
            currentCode = extractCode(rawFixedCode);
            s3.stop('AI applied the fix.');
            
            const finalTempPath = await fileManager.writeCode('final_check' + extension, currentCode);
            const finalValidation = router.validate(finalTempPath);
            
            if (finalValidation.success) {
              p.log.success(pc.green('[SECURE] Fix applied successfully.'));
            } else {
              p.log.error(pc.red('[WARNING] Fix broke the code. Using your manual edit.'));
              currentCode = editedCode; 
            }
          } else {
            p.log.info('No // FIX: comment found. Saving manual edits.');
            currentCode = editedCode;
          }
          
          const finalFileName = 'manual_edit_' + Date.now() + extension;
          await fs.writeFile(path.join(outputDir, finalFileName), currentCode);
          p.log.success(pc.green('Saved to: safevibe_output/' + finalFileName));
        } 
        else if (action === 'save') {
          const finalFileName = 'safevibe_' + Date.now() + extension;
          await fs.writeFile(path.join(outputDir, finalFileName), currentCode);
          p.log.success(pc.green('Saved to: safevibe_output/' + finalFileName));
          console.log(pc.dim('---------------------------------------------'));
          console.log(pc.cyan(currentCode));
          console.log(pc.dim('---------------------------------------------'));
        }
      }

    } catch (error: any) {
      p.log.error(pc.red('Protocol aborted: ' + error.message));
    } finally {
      await fileManager.cleanup();
    }
  } 
  else if (mainAction === 'test_ai') {
    const s = p.spinner(); s.start('Pinging AI...');
    try { const ans = await aiManager.ask('Ping.', 'PONG.'); s.stop('Response:'); p.log.success(pc.green(ans)); } 
    catch (e: any) { s.stop('Failed'); p.log.error(pc.red(e.message)); }
  }
  else if (mainAction === 'config') {
    const cAction = await p.select({ message: 'Configuration:', options: [
      { value: 'voice', label: currentConfig.voice.enabled ? '[ON] Voice Engine' : '[OFF] Voice Engine' },
      { value: 'back', label: '<- Back' }
    ]});
    if (!p.isCancel(cAction) && cAction === 'voice') {
      const toggle = await p.confirm({ message: 'Toggle voice?', initialValue: currentConfig.voice.enabled });
      if (!p.isCancel(toggle)) { currentConfig.voice.enabled = toggle; await saveConfig(currentConfig); p.log.success(pc.green('Voice ' + (toggle ? 'on' : 'off') + '.')); }
    }
  }
  else if (mainAction === 'exit') { p.outro(pc.green('Terminating session.')); }
}

main().catch(console.error);
