export interface SecurityResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

export class SecurityAnalyzer {
  public async analyze(code: string, language: string): Promise<SecurityResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Análisis Heurístico de Seguridad
    if (language === 'python') {
      if (/\beval\s*\(/.test(code)) errors.push("Uso de eval() detectado. Riesgo de ejecucion de codigo arbitrario.");
      if (/\bexec\s*\(/.test(code)) errors.push("Uso de exec() detectado. Riesgo de ejecucion de codigo arbitrario.");
      if (/os\.system\s*\(/.test(code)) errors.push("Uso de os.system() detectado. Usa subprocess en su lugar.");
      if (/subprocess\.call\(.*shell\s*=\s*True/.test(code)) errors.push("subprocess con shell=True detectado. Vulnerable a inyeccion de comandos.");
    } 
    
    if (language === 'typescript' || language === 'javascript') {
      if (/child_process\.exec\s*\(/.test(code)) errors.push("Uso de child_process.exec sin sanitizar. Riesgo de ejecucion remota.");
      if (/@ts-ignore/.test(code)) errors.push("Uso de @ts-ignore detectado. Los LLMs usan esto para engañar al compilador. Eliminalo.");
      if (/dangerouslySetInnerHTML/.test(code)) warnings.push("dangerouslySetInnerHTML detectado. Riesgo de XSS.");
      if (/\beval\s*\(/.test(code)) errors.push("Uso de eval() detectado. Riesgo de seguridad critico.");
    }

    // 2. Detección de Dependencias Falsas (Alucinaciones de IA)
    if (language === 'python') {
      const imports = code.match(/^\s*(?:import|from)\s+([a-zA-Z0-9_]+)/gm) || [];
      for (let line of imports) {
        const pkgMatch = line.match(/(?:import|from)\s+([a-zA-Z0-9_]+)/);
        if (pkgMatch && pkgMatch[1]) {
          const pkg = pkgMatch[1];
          // Ignoramos librerías estándar comunes de Python para no saturar la red
          const stdLib = ['os', 'sys', 'math', 'random', 'json', 'datetime', 'time', 'subprocess', 'typing', 'pathlib', 're'];
          if (!stdLib.includes(pkg)) {
            try {
              const res = await fetch(`https://pypi.org/pypi/${pkg}/json`);
              if (!res.ok) errors.push(`Dependencia falsa detectada: '${pkg}' no existe en el registro de PyPI.`);
            } catch (e) {
              warnings.push(`No se pudo verificar la dependencia '${pkg}' (sin conexion).`);
            }
          }
        }
      }
    }

    if (language === 'typescript') {
      const imports = code.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g) || [];
      for (let line of imports) {
        const pkgMatch = line.match(/from\s+['"]([^'"]+)['"]/);
        if (pkgMatch && pkgMatch[1]) {
          let pkg = pkgMatch[1];
          // Ignoramos imports relativos y nativos de Node
          if (!pkg.startsWith('.') && !pkg.startsWith('node:')) {
            if (pkg.startsWith('@')) pkg = pkg.split('/').slice(0, 2).join('/');
            else pkg = pkg.split('/')[0];
            
            try {
              const res = await fetch(`https://registry.npmjs.org/${pkg}`);
              if (!res.ok) errors.push(`Dependencia falsa detectada: '${pkg}' no existe en el registro de npm.`);
            } catch (e) {
              warnings.push(`No se pudo verificar la dependencia '${pkg}' (sin conexion).`);
            }
          }
        }
      }
    }

    return {
      success: errors.length === 0,
      errors,
      warnings
    };
  }
}
