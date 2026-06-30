export interface ValidationResult {
  success: boolean;
  errors: string[];
}

export interface IValidator {
  language: string;
  validate(filePath: string): ValidationResult;
}
