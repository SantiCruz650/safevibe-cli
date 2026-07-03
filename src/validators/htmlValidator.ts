import { readFileSync } from 'node:fs';
import type { IValidator, ValidationResult } from './types.js';

export class HtmlValidator implements IValidator {
  public language = 'javascript';

  validate(filePath: string): ValidationResult {
    const code = readFileSync(filePath, 'utf-8');
    const errors: string[] = [];

    // Validaciones 3D básicas obligatorias para todos los modos
    if (!code.includes('THREE.WebGLRenderer') && !code.includes('new THREE.Scene')) {
      errors.push('Falta la inicializacion del motor 3D (THREE.Scene o WebGLRenderer).');
    }
    if (!code.includes('requestAnimationFrame')) {
      errors.push('Falta el bucle de animacion requestAnimationFrame.');
    }

    const usesPhysics = code.includes('CANNON');

    if (usesPhysics) {
      // Reglas Físicas de Cannon.js (Solo si el código implementa física multi-cuerpo)
      if (!code.includes('fixedTimeStep')) errors.push('Falta definir fixedTimeStep.');
      if (!code.includes('world.step(fixedTimeStep') && !code.includes('world.step(')) {
        errors.push('Falta llamar a world.step para actualizar el mundo físico.');
      }
      if (!code.includes('allowSleep')) errors.push('Falta activar allowSleep en el mundo físico.');
      if (!code.includes('solver.iterations')) errors.push('Falta aumentar solver.iterations en el resolvedor.');
    }

    // Reglas Visuales Generales (flexibilizadas para no bloquear setups de cámara u objetos avanzados)
    if (!code.includes('MeshBasicMaterial') && !code.includes('MeshStandardMaterial') && !code.includes('LineBasicMaterial') && !code.includes('MeshPhongMaterial')) {
      errors.push('Falta usar un material compatible de Three.js.');
    }
    if (!code.includes('camera.position.set') && !code.includes('camera.position.x') && !code.includes('camera.position.z')) {
      errors.push('Falta definir la posicion de la camara.');
    }

    // Reglas HUD
    if (!code.includes('hud.innerText') && !code.includes('hud.innerHTML')) {
      errors.push('Falta actualizar el HUD en el bucle para mostrar datos en tiempo real.');
    }

    return { 
      success: errors.length === 0, 
      errors 
    };
  }
}
