import { SecurityAnalyzer } from '../validators/securityAnalyzer.js';
import { ValidatorRouter } from '../validators/validatorRouter.js';
import { VisualValidator } from '../validators/visualValidator.js';
import { FileManager } from '../system/fileManager.js';
import { generateHtmlBoilerplate } from '../core/htmlTemplate.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

export interface CheckResult {
  layer: string;
  passed: boolean;
  errors: string[];
}

export interface ValidationPipelineResult {
  success: boolean;
  language: string;
  checks: CheckResult[];
  finalCode: string | null;
}

const SECURITY_PATTERNS = [
  'eval()', 'exec()', 'os.system', 'child_process',
  '@ts-ignore', 'dangerouslySetInnerHTML',
];

function isSecurityError(msg: string): boolean {
  return SECURITY_PATTERNS.some(p => msg.includes(p));
}

function isDependencyError(msg: string): boolean {
  return (
    msg.includes('typosquatting') ||
    msg.includes('Dependencia falsa') ||
    msg.includes('Nombre sospechoso') ||
    msg.includes('no existe')
  );
}

function categorizeSecurityResult(
  result: { success: boolean; errors: string[]; warnings: string[] }
): { security: { passed: boolean; errors: string[] }; dependencies: { passed: boolean; errors: string[] } } {
  const secErrors: string[] = [];
  const depErrors: string[] = [];

  for (const e of result.errors) {
    if (isDependencyError(e)) {
      depErrors.push(e);
    } else {
      secErrors.push(e);
    }
  }

  for (const w of result.warnings) {
    if (isDependencyError(w)) {
      depErrors.push(w);
    } else {
      secErrors.push(w);
    }
  }

  return {
    security: { passed: secErrors.length === 0, errors: secErrors },
    dependencies: { passed: depErrors.length === 0, errors: depErrors },
  };
}

function isWebLanguage(language: string): boolean {
  return language === 'javascript' || language === 'html' || language === 'web';
}

export async function runValidationPipeline(
  code: string,
  language: string
): Promise<ValidationPipelineResult> {
  const checks: CheckResult[] = [];
  const fileManager = new FileManager();
  let finalCode: string | null = null;
  let allPassed = true;

  try {
    await fileManager.initSandbox();

    // Layer 1: Security
    const securityCheck: CheckResult = { layer: 'security', passed: true, errors: [] };
    try {
      const securityAnalyzer = new SecurityAnalyzer();
      const rawResult = await securityAnalyzer.analyze(code, language);
      const categorized = categorizeSecurityResult(rawResult);
      securityCheck.passed = categorized.security.passed;
      securityCheck.errors = categorized.security.errors;
      if (!securityCheck.passed) allPassed = false;
    } catch (err: any) {
      securityCheck.passed = false;
      securityCheck.errors = [`Security analyzer crashed: ${err?.message ?? String(err)}`];
      allPassed = false;
    }
    checks.push(securityCheck);

    // Layer 2: Dependencies
    const depCheck: CheckResult = { layer: 'dependencies', passed: true, errors: [] };
    try {
      const securityAnalyzer = new SecurityAnalyzer();
      const rawResult = await securityAnalyzer.analyze(code, language);
      const categorized = categorizeSecurityResult(rawResult);
      depCheck.passed = categorized.dependencies.passed;
      depCheck.errors = categorized.dependencies.errors;
      if (!depCheck.passed) allPassed = false;
    } catch (err: any) {
      depCheck.passed = false;
      depCheck.errors = [`Dependency analyzer crashed: ${err?.message ?? String(err)}`];
      allPassed = false;
    }
    checks.push(depCheck);

    // Layer 3: Compilation
    const compCheck: CheckResult = { layer: 'compilation', passed: true, errors: [] };
    try {
      const ext = language === 'python' ? '.py' : language === 'javascript' || language === 'html' ? '.js' : '.ts';
      const tempPath = await fileManager.writeCode(`sandbox${ext}`, code);
      const router = new ValidatorRouter();
      const result = router.validate(tempPath);
      compCheck.passed = result.success;
      compCheck.errors = result.errors;
      if (!compCheck.passed) allPassed = false;
    } catch (err: any) {
      compCheck.passed = false;
      compCheck.errors = [`Compilation validator crashed: ${err?.message ?? String(err)}`];
      allPassed = false;
    }
    checks.push(compCheck);

    // Layer 4: Visual (only applicable for web languages)
    const visualCheck: CheckResult = { layer: 'visual', passed: true, errors: [] };
    if (isWebLanguage(language)) {
      try {
        const finalHtml = generateHtmlBoilerplate(code);
        const tempDir = path.join(os.tmpdir(), 'safevibe-visual');
        await fs.mkdir(tempDir, { recursive: true });
        const htmlPath = path.join(tempDir, `visual-check-${Date.now()}.html`);
        await fs.writeFile(htmlPath, finalHtml);

        const visualValidator = new VisualValidator();
        const visualResult = await visualValidator.validate(htmlPath);

        visualCheck.passed = visualResult.pass;
        visualCheck.errors = [
          ...visualResult.reasons,
          ...visualResult.consoleErrors.slice(0, 3),
          ...visualResult.runtimeErrors.slice(0, 3),
        ];
        if (!visualCheck.passed) allPassed = false;

        await fs.unlink(htmlPath).catch(() => {});
      } catch (err: any) {
        visualCheck.passed = false;
        visualCheck.errors = [`Visual validator crashed: ${err?.message ?? String(err)}`];
        allPassed = false;
      }
    } else {
      visualCheck.passed = true;
      visualCheck.errors = [];
    }
    checks.push(visualCheck);

    if (allPassed) {
      finalCode = code;
    }

    return {
      success: allPassed,
      language,
      checks,
      finalCode,
    };
  } finally {
    await fileManager.cleanup().catch(() => {});
  }
}
