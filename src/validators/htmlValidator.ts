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
    
    // Reglas Físicas
    if (!code.includes('fixedTimeStep')) errors.push('Falta definir fixedTimeStep para evitar el tunneling.');
    if (!code.includes('world.step(fixedTimeStep')) errors.push('Falta llamar a world.step con fixedTimeStep y maxSubSteps.');
    if (!code.includes('allowSleep')) errors.push('Falta activar allowSleep para optimizacion.');
    if (!code.includes('solver.iterations')) errors.push('Falta aumentar solver.iterations para resolucion de restricciones.');
    if (!code.includes('ContactMaterial')) errors.push('Falta usar CANNON.ContactMaterial explicito.');
    
    // Reglas Visuales (Investigacion del usuario)
    if (!code.includes('MeshBasicMaterial')) errors.push('Falta usar THREE.MeshBasicMaterial para garantizar visibilidad sin luces.');
    if (!code.includes('camera.position.set(0, 5, 15)') && !code.includes('camera.position.set(0,5,15)')) errors.push('La camara debe estar en (0, 5, 15) para encuadrar objetos grandes.');
    if (!code.includes('DoubleSide')) errors.push('El material del suelo debe tener side: THREE.DoubleSide.');
    if (!code.includes('GridHelper')) errors.push('Falta agregar un THREE.GridHelper.');
    if (!code.includes('document.body.appendChild')) errors.push('Falta agregar el HUD al DOM.');
    if (!code.includes('DistanceConstraint') && code.includes('pendulo')) errors.push('Si es un pendulo, usa CANNON.DistanceConstraint.');

    return { 
      success: errors.length === 0, 
      errors 
    };
  }
}
