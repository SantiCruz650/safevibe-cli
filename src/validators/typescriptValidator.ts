import { spawnSync } from 'node:child_process';
import path from 'node:path';
import type { IValidator, ValidationResult } from './types.js';

export class TypescriptValidator implements IValidator {
  public language = 'typescript';

  validate(filePath: string): ValidationResult {
    const tscBinary = path.join(process.cwd(), 'node_modules', '.bin', 'tsc');

    const result = spawnSync(tscBinary, ['--noEmit', '--strict', filePath], {
      encoding: 'utf-8',
      timeout: 30000
    });

    if (result.error) {
      return { success: false, errors: ['SYSTEM_CRASH: ' + result.error.message] };
    }

    if (result.status === 0) {
      return { success: true, errors: [] };
    }

    const errorText = (result.stdout || '') + (result.stderr || '');
    return { 
      success: false, 
      errors: [errorText.trim() || 'Error silencioso.']
    };
  }
}
