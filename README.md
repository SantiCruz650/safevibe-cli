# SafeVibe CLI

> Un filtro científico para el "Vibe Coding". La IA escribe, SafeVibe valida, el humano recibe código seguro.

## Filosofía del Proyecto

Los desarrolladores usan IA para escribir código (Vibe Coding), pero los LLMs generan código basado en probabilidades, inyectando vulnerabilidades de seguridad ocultas, dependencias falsas y mala arquitectura. 

**SafeVibe CLI** es un asistente de terminal que actúa como un firewall de generación de código. La IA genera el código, SafeVibe lo guarda en un sandbox temporal, lo analiza estáticamente, verifica dependencias, y si hay errores (de sintaxis O de seguridad), se lo regresa a la IA en secreto para que lo arregle mediante un Bucle ReAct. El humano solo ve código validado y seguro.

> *Nota crucial del creador: "Código que compila no es código seguro. Necesitamos evolucionar hacia el análisis de seguridad real, no solo validación de tipado".*

## Arquitectura Actual (Fase 1 y Fase 2 Completadas)

- **Lenguaje Core:** TypeScript (Node.js v20) con módulos ES.
- **Interfaz Actual:** TUI minimalista basada en `@clack/prompts` (Estilo UNIX puro).
- **Motor de IA:** Conectado a Groq Cloud (`llama-3.3-70b-versatile`).
- **Patrón Adaptador:** Director de orquestación desacoplado de los proveedores de IA.
- **Validador Multi-Lenguaje:** Router de validadores (Patrón Estrategia) que soporta TypeScript y Python sin acoplar la lógica principal.
- **Motor de Seguridad Estática:** Heurística ligera que bloquea `eval()`, `exec()`, `os.system()`, `shell=True`, y `@ts-ignore`.
- **Verificador de Dependencias:** Consulta asíncrona a las APIs de `npm` y `PyPI` para bloquear alucinaciones de librerías falsas.
- **Bucle ReAct Silencioso:** Si la validación falla, el error se sanitiza y se envía de vuelta a la IA para su corrección automática (máx. 3 intentos) sin intervenir al usuario.
- **Editor Humano Integrado:** Apertura de `nano` con soporte para comentarios mágicos `// FIX: [instrucciones]` que re-disparan el ciclo de generación y validación.

## Roadmap

- [x] **FASE 1:** Conexión a IA, Bucle ReAct, Validación TypeScript, Editor Nano con `// FIX:`.
- [x] **FASE 2:** Multi-Lenguaje (Python) y Análisis de Seguridad Estática real.
- [ ] **FASE 3:** Migración a `Ink` (React para terminal) para interfaz tipo dashboard con paneles.
- [ ] **FASE 4:** Agente Autónomo (contexto de directorios), Multimodal (imágenes y PDFs).
- [ ] **FASE 5:** Voz Local (SoX + Whisper.cpp + Piper).
- [ ] **FASE 6:** Motor Físico 3D ASCII para simulaciones pedagógicas.
- [ ] **FASE 7:** Tool Calling (Integración con Git, Docker, herramientas de sistema).

## Reglas de Diseño Estrictas

1. Cero `npx` en ejecución de subprocesos (Uso de paths directos a `node_modules/.bin/` por compatibilidad con Linux Crostini).
2. Cero emojis en el código fuente. Estilo minimalista de hacking ético.
3. Manejo de errores gracioso (try/catch) para no romper la experiencia en terminal.
4. Soluciones ultraligeras optimizadas para hardware de bajos recursos (4GB-8GB RAM).
