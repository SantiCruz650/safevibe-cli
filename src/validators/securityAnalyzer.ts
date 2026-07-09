import { POPULAR_NPM, POPULAR_PYPI } from './popularPackages.js';

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
            // Typosquatting primero: es mas informativo que "no existe".
            const squat = this.detectTyposquatting(pkg, POPULAR_PYPI);
            if (squat && squat.distance === 1) {
              errors.push(`Posible typosquatting: '${pkg}' se parece a '${squat.target}' (distancia 1). Verifica el nombre antes de instalar.`);
            } else if (squat) {
              warnings.push(`Nombre sospechoso: '${pkg}' se parece a '${squat.target}' (distancia ${squat.distance}).`);
            }

            try {
              const res = await fetch(`https://pypi.org/pypi/${pkg}/json`);
              if (!res.ok && !squat) errors.push(`Dependencia falsa detectada: '${pkg}' no existe en el registro de PyPI.`);
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
            
            // Los paquetes con scope (@scope/name) rara vez son typosquatting; se omiten.
            const squat = pkg.startsWith('@') ? null : this.detectTyposquatting(pkg, POPULAR_NPM);
            if (squat && squat.distance === 1) {
              errors.push(`Posible typosquatting: '${pkg}' se parece a '${squat.target}' (distancia 1). Verifica el nombre antes de instalar.`);
            } else if (squat) {
              warnings.push(`Nombre sospechoso: '${pkg}' se parece a '${squat.target}' (distancia ${squat.distance}).`);
            }

            try {
              const res = await fetch(`https://registry.npmjs.org/${pkg}`);
              if (!res.ok && !squat) errors.push(`Dependencia falsa detectada: '${pkg}' no existe en el registro de npm.`);
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

  /**
   * Distancia de Damerau-Levenshtein (Optimal String Alignment).
   * Igual que Levenshtein pero cuenta la transposicion de dos caracteres
   * adyacentes como UNA edicion. Es lo apropiado para typosquatting:
   * 'lodahs' vs 'lodash' = 1 (no 2).
   */
  private levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    // Matriz completa: OSA necesita mirar dos filas atras para la transposicion.
    const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) d[i][0] = i;
    for (let j = 0; j <= n; j++) d[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(
          d[i - 1][j] + 1,        // borrado
          d[i][j - 1] + 1,        // insercion
          d[i - 1][j - 1] + cost  // sustitucion
        );
        // transposicion de caracteres adyacentes
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[m][n];
  }

  /**
   * Detecta typosquatting: nombre que imita a un paquete popular.
   * Devuelve el paquete popular imitado y la distancia, o null si no hay sospecha.
   * Evita falsos positivos con variantes legitimas (lodash-es, fs-extra-promise).
   */
  private detectTyposquatting(pkg: string, popular: string[]): { target: string; distance: number } | null {
    const name = pkg.toLowerCase();
    let best: { target: string; distance: number } | null = null;

    for (const target of popular) {
      if (name === target) return null; // es el paquete real

      // Variante legitima: el nombre CONTIENE al popular separado por - . _ /
      // ej. lodash-es, fs-extra-promise, @types/react
      const isVariant = new RegExp('(^|[-._/])' + target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[-._/])').test(name);
      if (isVariant) return null;

      const d = this.levenshtein(name, target);
      if (d > 0 && d <= 2) {
        if (!best || d < best.distance) best = { target, distance: d };
      }
    }
    return best;
  }
}
