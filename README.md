SafeVibe CLI
Codigo que compila no es codigo seguro.

Los LLMs escriben codigo plausible, no correcto. Inventan paquetes que no existen, dejan eval() donde no debe haberlo, y producen archivos que compilan perfecto pero no funcionan. SafeVibe es el filtro.

SafeVibe es un motor de validacion headless disenado para integrarse en pipelines de CI/CD. Intercepta el codigo generado por IA, lo pasa por un sandbox de 4 capas de seguridad y compilacion, y solo devuelve el codigo si pasa todas las pruebas. Si algo falla, el error se devuelve al LLM en silencio para que lo corrija (Bucle ReAct).

Por que SafeVibe
Con la adopcion masiva de herramientas como GitHub Copilot y ChatGPT, las empresas enfrentan un nuevo riesgo critico: el Slopsquatting. Los LLMs alucinan nombres de paquetes, y los atacantes registran esos nombres falsos con codigo malicioso. SafeVibe detiene esto en tiempo real.

Las 4 Capas de Verificacion
Analisis Estatico de Seguridad: Bloquea eval(), exec(), os.system(), child_process.exec() y @ts-ignore.
Verificacion de Dependencias Anti-Slopsquatting: Consulta registros npm/PyPI en tiempo real. Usa distancia de Damerau-Levenshtein para detectar paquetes falsos por transposicion de letras (ej. reqeusts en lugar de requests).
Compilacion Real: TypeScript pasa por tsc --noEmit --strict. Python por py_compile. Sin atajos.
Validacion Visual Headless: Para codigo web, usa Playwright + Chromium para renderizar, contar meshes y hacer pixel readback para detectar pantallas negras o errores de runtime.
Uso (Integracion CI/CD)
SafeVibe esta disenado para ejecutarse sin friccion en entornos de integracion continua.

# Validar un archivo localnpx safevibe --file ./codigo.ts --lang typescript# Validar desde stdin (Ideal para pipes en CI/CD)cat generated_code.py | npx safevibe --stdin --lang python
Salida JSON estructurada:
El CLI devuelve un JSON estricto y codigos de salida estandar (0 para exito, 1 para fallo), perfecto para automatizacion.

{
  "success": false,
  "language": "typescript",
  "checks": [
    { "layer": "security", "passed": true, "errors": [] },
    { "layer": "dependencies", "passed": false, "errors": ["Posible typosquatting detectado: 'lodahs'"] },
    { "layer": "compilation", "passed": true, "errors": [] },
    { "layer": "visual", "passed": true, "errors": [] }
  ],
  "finalCode": null
}

Arquitectura
Construido con un enfoque en cero dependencias innecesarias. El motor esta separado de la interfaz y disenado para escalabilidad.

src/
├── cli.ts                     # Entry point headless (parseo de argv)
├── engine/validatorEngine.ts  # Orquestador del pipeline (Headless)
├── validators/                # Logica de cada capa (Seguridad, Compilacion, Visual)
├── ai/providers/              # Patron adaptador (Groq, OpenRouter, Anthropic, Ollama)
└── system/fileManager.ts      # Sandbox temporal aislado

Roadmap Enterprise
GitHub Action Oficial: Bloqueo automatico de Pull Requests.
Dashboard SaaS: Visualizacion de metricas de seguridad para CISOs.
Reglas Custom: Permitir a las empresas definir sus propias heuristicas de bloqueo.

Licencia
MIT - Libre uso para la comunidad. Para implementaciones Enterprise y soporte, contacta al autor.
