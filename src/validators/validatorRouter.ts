import path from 'node:path';
import type { IValidator, ValidationResult } from './types.js';
import { TypescriptValidator } from './typescriptValidator.js';
import { PythonValidator } from './pythonValidator.js';
import { HtmlValidator } from './htmlValidator.js';

export class ValidatorRouter {
  private validators: Map<string, IValidator>;

  constructor() {
    this.validators = new Map();
    this.register('.ts', new TypescriptValidator());
    this.register('.py', new PythonValidator());
    this.register('.html', new HtmlValidator());
    this.register('.js', new HtmlValidator()); // Usamos el mismo validador para JS puro
  }

  private register(extension: string, validator: IValidator) {
    this.validators.set(extension.toLowerCase(), validator);
  }

  public validate(filePath: string): ValidationResult {
    const ext = path.extname(filePath).toLowerCase();
    const validator = this.validators.get(ext);

    if (!validator) {
      return { 
        success: false, 
        errors: [`No hay validador registrado para la extension: ${ext}`] 
      };
    }

    return validator.validate(filePath);
  }
}
