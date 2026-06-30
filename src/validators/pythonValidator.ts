import { spawnSync } from 'child_process';
import type { IValidator, ValidationResult } from './types.js';

export class PythonValidator implements IValidator {
  public language = 'python';

  public validate(filePath: string): ValidationResult {
    // py_compile devuelve código de salida 1 si hay error de sintaxis
    const result = spawnSync('python3', ['-m', 'py_compile', filePath], {
      encoding: 'utf-8'
    });

    if (result.status === 0) {
      return { success: true, errors: [] };
    }

    // Sanitizamos el error para que la IA lo entienda sin ruido del sistema
    const errorOutput = result.stderr || result.stdout;
    return {
      success: false,
      errors: [errorOutput]
    };
  }
}
