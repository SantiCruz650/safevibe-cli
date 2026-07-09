import { readFileSync } from 'node:fs';
import type { IValidator, ValidationResult } from './types.js';

export class HtmlValidator implements IValidator {
  public language = 'javascript';

  validate(filePath: string): ValidationResult {
    const code = readFileSync(filePath, 'utf-8');
    const errors: string[] = [];

    // El boilerplate ya provee scene, camera, renderer, controls, animate loop.
    // Solo validamos lo que la IA debe generar.

    // CANNON physics: si se usa, debe tener world.step
    const usesPhysics = code.includes('CANNON');
    if (usesPhysics && !code.includes('world.step')) {
      errors.push('Falta llamar a world.step para actualizar el mundo físico.');
    }

    // Debe usar al menos un material de Three.js
    const hasMaterial = /(?:Mesh|Line|Points|Sprite|Shadow)\w*Material\b/.test(code);
    if (!hasMaterial) {
      errors.push('Falta usar un material compatible de Three.js (MeshStandardMaterial, PointsMaterial, etc).');
    }

    // Debe agregar al menos un objeto a scene
    if (!code.includes('scene.add(')) {
      errors.push('No se agregan objetos a la escena. Usa scene.add(objeto) para mostrar algo.');
    }

    // HUD update
    if (!code.includes('hud.inner') && !/document\.getElementById\(/.test(code)) {
      errors.push('Falta actualizar el HUD o usar document.getElementById para mostrar datos.');
    }

    return { 
      success: errors.length === 0, 
      errors 
    };
  }
}
