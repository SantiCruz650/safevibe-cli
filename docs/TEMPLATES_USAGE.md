# Templates de Sistema Solar — Uso

## Arquitectura

```
src/simulations/
├── solar-system/templates/
│   ├── data.ts              → Datos planetarios NASA
│   ├── textures.ts          → 13 texturas procedurales (JS puro)
│   ├── scene-snippet.ts     → 9 funciones helper 3D (JS puro)
│   └── system-prompt.md     → Instrucciones para el LLM
├── snippets/
│   ├── procedural-texture.ts
│   ├── orbital-mechanics.ts
│   ├── interaction.ts
│   ├── atmosphere.ts
│   └── lighting.ts
```

## Flujo de inyección

```
secureGenerator.ts
  → detecta keywords (sistema solar, planeta, órbita...)
  → lee 4 templates + 5 snippets
  → stripTSConstructs() elimina export/interface/declare/tipos TS
  → concatena todo en solarSystemTemplates (string único)
  → envía system-prompt.md + solarSystemTemplates al LLM
  → LLM genera código JS que usa las funciones de los templates
  → templates + código LLM se concatenan e inyectan en HTML
```

## Funciones disponibles para el LLM

### Texturas
`createSunTexture()`, `createMercuryTexture()`, `createVenusTexture()`, `createEarthTexture()`, `createEarthCloudsTexture()`, `createMarsTexture()`, `createJupiterTexture()`, `createSaturnTexture()`, `createSaturnRingsTexture()`, `createUranusTexture()`, `createNeptuneTexture()`, `createMoonTexture()`, `createStarfieldTexture()`

### Escena y órbitas
`createOrbitLine(radius, color)`, `createOrbitalPivot(distance, initialAngle)`, `updateOrbitalPosition(pivot, dt, period, axialTilt?)`, `createPlanetMesh(radius, texture, distance, color, config?)`, `createSun(radius, texture, config?)`, `createMoonMesh(radius, texture, orbitalDistance, color?)`, `setupRaycaster(camera, domElement, meshes, onClick)`, `setupCameraFollow(camera, controls, target, distance)`, `createAtmosphereGlow(mesh, color, intensity)`

### Snippets
`createGradientTexture(colors, w?, h?, vertical?)`, `createNoiseTexture(baseColor, opacity?, scale?)`, `createCraterTexture(baseColor?, craterColor?, count?)`, `createBandedTexture(colors, turbulence?)`, `createStarfieldTexture(starCount?)`, `createAtmosphereGlow(planetMesh, color?, intensity?, scale?)`, `createCloudLayer(planetMesh, texture, opacity?, scale?)`, `updateClouds(cloudMesh, dt, speed?)`, `setupHoverLabels(scene, meshes, fontSize?)`, `setupSolarLighting(scene, sunPosition?, intensity?)`, `setupPlanetLighting(scene)`, `createOrbitLine(radius, color?, segments?)`, `createOrbitalPivot(distance, initialAngle?)`, `updateOrbitalPosition(pivot, dt, period, axialTilt?)`, `createAxialTilt(mesh, degrees)`, `setupRaycaster(camera, domElement, meshes, onClick)`, `setupCameraFollow(camera, controls, target, distance?)`

## Datos planetarios
`SOLAR_SYSTEM_DATA` — Array con 8 planetas + Sol. Campos: `id`, `name`, `diameter`, `mass`, `gravity`, `temperature`, `distanceFromSun`, `orbitalPeriod`, `rotationPeriod`, `axialTilt`, `radius` (escala visual), `distance` (distancia visual), `color`, `textureType`, `hasRings`, `moons[]`.

## stripTSConstructs
Función que elimina TypeScript de los templates antes de inyectarlos en HTML. Operaciones:
1. Elimina `// @ts-nocheck`
2. Elimina `declare const/var/let/function...`
3. Elimina `export`
4. Elimina `import type`
5. Elimina `/// <reference`
6. Elimina bloques `interface`
7. Elimina anotaciones de tipo `: Tipo`
8. Elimina `!` (non-null assertion)
9. Elimina return types object `: { ... }`
