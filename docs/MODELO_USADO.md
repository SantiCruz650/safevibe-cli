# Modelo de IA usado

## Generación de código

| Atributo | Valor |
|----------|-------|
| **Proveedor** | Groq Cloud |
| **Modelo** | `qwen/qwen3-32b` |
| **Parámetros** | temperature: 0.5, max_tokens: 4096 |
| **Prompt** | ~4200 caracteres (system prompt + templates) |

### Por qué Qwen 3 32B
- 32B parámetros — mejor razonamiento que Llama 3.3 70B para código 3D
- Disponible en Groq free tier (sin costo)
- Ventana de contexto grande (max_completion_tokens: 40960)

### Límite free tier (Groq)
- **TPM** (tokens por minuto): 6000
- **TPD** (tokens por día): 500,000
- **TPM límite**: Forzó max_tokens de 8192 → 4096 porque `prompt (2000t) + max_tokens (8192)` > 6000
- **TPD límite**: ~70 requests/día, alcanzado durante pruebas E2E intensivas

## Visión (imagen → código)

| Atributo | Valor |
|----------|-------|
| **Proveedor** | OpenRouter |
| **Modelo** | `google/gemma-4-31b-it:free` |
| **Parámetros** | temperature: 0.5, max_tokens: 4096 |

## Providers inactivos

| Proveedor | Modelo | Estado |
|-----------|--------|--------|
| Anthropic | Claude 3.5 Sonnet | Implementado, no usado |
| NVIDIA | nvidia/llama-3.1-nemotron-70b-instruct | Implementado, no usado |
| Ollama | Local (cualquier modelo) | Implementado, no usado |
