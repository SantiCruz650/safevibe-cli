import { readFileSync } from 'node:fs';
import type { IValidator, ValidationResult } from './types.js';

export class HtmlValidator implements IValidator {
  public language = 'javascript';

  validate(filePath: string): ValidationResult {
    const code = readFileSync(filePath, 'utf-8');
    const errors: string[] = [];

    if (!code.includes('THREE.WebGLRenderer') && !code.includes('new THREE.Scene')) errors.push('Falta la inicializacion del motor 3D.');
    if (!code.includes('requestAnimationFrame')) errors.push('Falta el bucle de animacion requestAnimationFrame.');
    
    // Reglas Físicas
    if (!code.includes('fixedTimeStep')) errors.push('Falta definir fixedTimeStep.');
    if (!code.includes('world.step(fixedTimeStep')) errors.push('Falta llamar a world.step con fixedTimeStep y maxSubSteps.');
    if (!code.includes('allowSleep')) errors.push('Falta activar allowSleep.');
    if (!code.includes('solver.iterations')) errors.push('Falta aumentar solver.iterations.');
    if (!code.includes('ContactMaterial')) errors.push('Falta usar CANNON.ContactMaterial.');
    
    // Reglas Visuales
    if (!code.includes('MeshBasicMaterial')) errors.push('Falta usar THREE.MeshBasicMaterial.');
    if (!code.includes('camera.position.set(0, 5, 15)') && !code.includes('camera.position.set(0,5,15)')) errors.push('La camara debe estar en (0, 5, 15).');
    if (!code.includes('DoubleSide')) errors.push('El material del suelo debe tener side: THREE.DoubleSide.');
    if (!code.includes('GridHelper')) errors.push('Falta agregar un THREE.GridHelper.');
    
    // Reglas HUD
    if (!code.includes('hud.innerText')) errors.push('Falta actualizar el HUD en el bucle.');

    return { 
      success: errors.length === 0, 
      errors 
    };
  }
}
