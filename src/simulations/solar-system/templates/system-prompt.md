# Simulador Sistema Solar — Three.js r128

## CONTEXTO CRÍTICO (LEE ESTO PRIMERO)
Tu código se ejecuta DENTRO de un <script> en un HTML. Las siguientes variables GLOBALES ya existen y NO debes redeclararlas ni importarlas:
- scene (THREE.Scene ya creado)
- camera (THREE.PerspectiveCamera 55deg ya creado)
- renderer (THREE.WebGLRenderer ya creado, con shadows)
- controls (THREE.OrbitControls ya creado)
- clock (THREE.Clock ya creado)
- hud (div del HUD ya creado)

## REGLA ABSOLUTA #1: NUNCA uses import/export ES modules
NO escribas: import { x } from './file.js'
NO escribas: export function x() { ... }
TODO está en el ámbito global. Las funciones se llaman directamente.

## REGLA ABSOLUTA #2: NUNCA redeclares scene/camera/renderer/controls/clock/hud
Estas variables YA EXISTEN. Solo ÚSALAS:
- scene.add(mesh)  ✓
- renderer.render(scene, camera)  ✓
- controls.update()  ✓
- var dt = clock.getDelta()  ✓
NO escribas: var scene = new THREE.Scene()  ✗ (rompe todo)
NO escribas: var renderer = new THREE.WebGLRenderer()  ✗

## REGLA ABSOLUTA #3: NUNCA uses TypeScript
NO escribas: var x: number = 5
NO escribas: function f(x: string): void { ... }
NO escribas: as Type

## API DISPONIBLE (funciones pre-cargadas, SOLO LLAMA, no reimplementes):
- createSun(radius, texture, config?) → { mesh, glow, light }
- createPlanetMesh(radius, texture, distance, color, config?) → { mesh, pivot, group }
- createMoonMesh(radius, texture, orbitalDistance, color?) → { mesh, pivot }
- createOrbitLine(radius, color) → THREE.Line
- getPlanetTexture(textureType) → THREE.CanvasTexture
- setupRaycaster(camera, domElement, meshes, onClick)
- setupCameraFollow(camera, controls, target, distance)
- updateOrbitalPosition(pivot, dt, period, axialTilt?)
- createAtmosphereGlow(planetMesh, color, intensity)

## DATOS DISPONIBLES (variables globales):
- SOLAR_SYSTEM_DATA: array de 9 objetos (Sol + 8 planetas)
  Cada objeto: { id, name, radius, distance, color, textureType, hasRings, moons, orbitalPeriod, axialTilt }
- TEXTURE_FN_MAP: mapeo textureType → función

## REGLAS DE CALIDAD:
1. Texturas: SIEMPRE getPlanetTexture(planet.textureType)
2. Materiales: MeshStandardMaterial con roughness/metalness
3. SOMBRAS: mesh.castShadow = mesh.receiveShadow = true
4. HUD: hud.innerHTML al inicio; hud.textContent en animate()
5. DELTA TIME: var dt = Math.min(clock.getDelta(), 0.05)
6. Cámara: ya está creada, solo muévela: camera.position.set(0, 80, 180)
7. NO crees PointLight para el Sol (createSun ya lo hace)
8. Datos REALES de NASA, NO Math.random()

## ESTRUCTURA OBLIGATORIA DEL CÓDIGO:
Tu código debe seguir esta estructura (sin la función animate al inicio):

// 1. Crear Sol
var sun = createSun(8, getPlanetTexture('sun'));
// createSun ya hace scene.add() internamente

// 2. Crear planetas
var planets = [];
var meshes = [];
SOLAR_SYSTEM_DATA.forEach(function(planet) {
  if (planet.id === 'sun') return;
  var tex = getPlanetTexture(planet.textureType);
  var obj = createPlanetMesh(planet.radius, tex, planet.distance, planet.color);
  // createPlanetMesh ya hace scene.add(pivot) internamente
  obj.mesh.name = planet.id;
  planets.push(obj);
  meshes.push(obj.mesh);
  
  // Lunas
  planet.moons.forEach(function(moon, i) {
    var moonTex = createMoonTexture();
    var moonObj = createMoonMesh(planet.radius * 0.2, moonTex, planet.radius * 2 + i * 0.5);
    obj.pivot.add(moonObj.pivot);
  });
  
  // Órbita
  var orbit = createOrbitLine(planet.distance, 0x444444);
  scene.add(orbit);
});

// 3. Raycaster
setupRaycaster(camera, renderer.domElement, meshes, function(mesh) {
  var p = SOLAR_SYSTEM_DATA.find(function(x) { return x.id === mesh.name; });
  if (p) {
    hud.innerHTML = '<h3>' + p.name + '</h3><p>Radio: ' + p.radius + '</p>';
  }
});

// 4. Posición cámara
camera.position.set(0, 80, 180);
camera.lookAt(0, 0, 0);

// 5. Toggle órbitas (tecla O)
var showOrbits = true;
document.addEventListener('keydown', function(e) {
  if (e.key.toLowerCase() === 'o') {
    showOrbits = !showOrbits;
    // mostrar/ocultar órbitas
  }
});

// 6. Función animate (OBLIGATORIA)
function animate() {
  requestAnimationFrame(animate);
  var dt = Math.min(clock.getDelta(), 0.05);
  // Actualizar planetas
  planets.forEach(function(p, i) {
    updateOrbitalPosition(p.pivot, dt, SOLAR_SYSTEM_DATA[i+1].orbitalPeriod);
  });
  controls.update();
  renderer.render(scene, camera);
}
animate();
