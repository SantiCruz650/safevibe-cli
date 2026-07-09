# Próximos Pasos

## 1. Rate limiting & truncamiento

### Problema
- Groq free tier: 6000 TPM, 500k TPD
- `max_tokens: 4096` → el LLM trunca código de sistema solar (~4000+ tokens)
- Código truncado → SIM-CHECK detecta paréntesis/llaves faltantes → repair → truncado otra vez

### Posibles soluciones

| Opción | Pros | Contras |
|--------|------|---------|
| **A)** Subir a Groq Dev Tier ($5/mes, 4M TPD) | Sin límites, max_tokens 8192+ | Costo mensual |
| **B)** Usar OpenRouter para código | Sin TPM restrictivo | Dependencia adicional |
| **C)** Cachear templates en provider (compresión) | Reduce tokens | Complejidad |
| **D)** Prompt más corto (menos reglas) | Menos tokens de prompt → más para respuesta | Pierde calidad |

**Recomendación**: A largo plazo, opción A (Dev Tier). A corto plazo, acortar el prompt quitando reglas redundantes.

## 2. Bug de nombres dinámicos

El LLM genera `window["create" + planet.textureType + "Texture"]` pero `textureType` es `'sun'` (minúscula) y la función es `createSunTexture` (PascalCase).

### Fix posible
Agregar un mapper en el template `data.ts`:
```javascript
var textureFnMap = {
  sun: createSunTexture,
  mercury: createMercuryTexture,
  ...
};
```

## 3. Visual validation

### Estado actual
- Score 80/100 internamente (SecureGenerator)
- 11 meshes detectados, pantalla no negra
- Validación standalone crashea por WebGL en flags hardcodeadas (YA FIXED)

### Mejoras pendientes
- [ ] Agregar timeout de 30s a page.evaluate (previene cuelgues)
- [ ] Agregar detección de `renderer.domElement` en DOM (confirma WebGL activo)
- [ ] Screenshot automático en docs/ con timestamp

## 4. Seguridad y robustez

- [ ] `fetch()` sin `AbortController` — riesgo de cuelgue
- [ ] Regex de seguridad incompleta (no capta `execSync`, `spawn`, `@ts-expect-error`)
- [ ] Security y Validation comparten MAX_RETRIES=5 — deberían ser independientes

## 5. Testing E2E

Para reproducir: esperar reinicio de TPD de Groq (~1-2 horas desde último uso), luego:

```bash
node test_e2e.mjs 2>&1 | tee e2e_result.log
```

El test verifica:
1. Generación exitosa (success: true)
2. Sin errores de sintaxis TS en output
3. WebGL context creado sin errores
4. meshCount >= 8 (8 planetas visibles)
5. Score visual >= 70

## 6. Mantenimiento

- [ ] Eliminar `isComplexSimulation()` (definida, nunca llamada)
- [ ] Limpiar dependencias no usadas (`@clack/prompts`, `base64-img`, `ink-box`)
- [ ] Reemplazar `xdg-open` con solución cross-platform
- [ ] Agregar SRI hashes a CDNs en htmlTemplate.ts
