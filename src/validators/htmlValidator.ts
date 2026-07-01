import { readFileSync } from 'node:fs';
import type { IValidator, ValidationResult } from './types.js';

export class HtmlValidator implements IValidator {
  public language = 'html';

  validate(filePath: string): ValidationResult {
    const code = readFileSync(filePath, 'utf-8');
    const errors: string[] = [];

    if (!code.includes('three.min.js')) errors.push('Falta incluir la libreria Three.js.');
    if (!code.includes('cannon.min.js')) errors.push('Falta incluir la libreria Cannon.js.');
    if (!code.includes('requestAnimationFrame')) errors.push('Falta el bucle de animacion requestAnimationFrame.');
    if (!code.includes('THREE.WebGLRenderer') && !code.includes('THREE.Scene')) errors.push('Falta la inicializacion del motor 3D.');
    if (!code.includes('CANNON.World')) errors.push('Falta la inicializacion del mundo fisico CANNON.World.');
    if (!code.includes('controls.update()')) errors.push('Falta llamar a controls.update() dentro del bucle.');
    if (!code.includes('document.body.appendChild')) errors.push('Falta agregar el HUD al DOM usando document.body.appendChild.');
    
    // Reglas anti-bugs de renderizado y física
    if (!code.includes('DoubleSide')) errors.push('El material del suelo debe tener side: THREE.DoubleSide para no desaparecer.');
    if (!code.includes('GridHelper')) errors.push('Falta agregar un THREE.GridHelper para el suelo visual.');
    if (!code.includes('defaultContactMaterial.restitution')) errors.push('Falta configurar world.defaultContactMaterial.restitution para el rebote fisico.');

    return { 
      success: errors.length === 0, 
      errors 
    };
  }
}
