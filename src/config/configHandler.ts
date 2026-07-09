import fs from 'node:fs/promises';
import path from 'node:path';

// 1. DEFINICIÓN DE LA ESTRUCTURA (Interfaces)
// Esto actúa como un "contrato". Si algo no cumple esto, TypeScript lanza un error.
export interface SafeVibeConfig {
  ai: {
    provider: 'openai' | 'anthropic' | 'ollama-local' | 'groq-cloud' | 'openrouter';
    model: string;
    apiKey?: string; // Opcional porque Ollama local no necesita clave
    anthropicApiKey?: string; // Clave para Claude 3.5 Sonnet (Vision)
    openRouterApiKey?: string; // Clave para OpenRouter
    codeModel?: string;       // Modelo de código
    visionProvider?: 'openrouter' | 'none'; // Proveedor separado para visión
    visionApiKey?: string;    // API key para el proveedor de visión
    visionModel?: string;     // Modelo de visión
  };
  voice: {
    enabled: boolean;
    sttEngine: 'whisper-cpp';
    ttsEngine: 'piper';
  };
  graphics: {
    asciiRenderFps: number;
  };
  security: {
    autoFixLoop: boolean; // El bucle ReAct de corrección automática
  }
}

// 2. CONFIGURACIÓN POR DEFECTO
// Si el archivo no existe, usamos esta para no romper el sistema.
const DEFAULT_CONFIG: SafeVibeConfig = {
  ai: {
    provider: 'groq-cloud',
    model: 'openai/gpt-oss-120b',
    apiKey: undefined,
    visionProvider: 'openrouter',
    visionApiKey: undefined,
    visionModel: 'google/gemma-4-31b-it:free'
  },
  voice: {
    enabled: false, // Desactivado por defecto para ahorrar batería y CPU en tu Chromebook
    sttEngine: 'whisper-cpp',
    ttsEngine: 'piper'
  },
  graphics: {
    asciiRenderFps: 30
  },
  security: {
    autoFixLoop: true
  }
};

// Ruta donde vivirá el archivo config.json (fuera de src, en la raíz del proyecto)
const CONFIG_PATH = path.join(process.cwd(), 'config.json');

// 3. FUNCIONES DE MANEJO (CRUD)

// Leer configuración
export async function loadConfig(): Promise<SafeVibeConfig> {
  try {
    const fileContent = await fs.readFile(CONFIG_PATH, 'utf-8');
    const parsedData = JSON.parse(fileContent);
    
    // Validación básica: asegurarnos de que las propiedades principales existan
    if (!parsedData.ai || !parsedData.voice) {
      throw new Error('Estructura de config.json inválida');
    }
    
    // Prioridad a variables de entorno para no exponer keys en config.json
    if (process.env.GROQ_API_KEY) parsedData.ai.apiKey = process.env.GROQ_API_KEY;
    if (process.env.OPENROUTER_API_KEY) {
      parsedData.ai.openRouterApiKey = process.env.OPENROUTER_API_KEY;
      parsedData.ai.visionApiKey = process.env.OPENROUTER_API_KEY;
    }
    if (process.env.ANTHROPIC_API_KEY) parsedData.ai.anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    return parsedData as SafeVibeConfig;
  } catch (error) {
    // Si el archivo no existe o está corrupto, devolvemos la configuración por defecto
    // y lo guardamos para que el usuario lo tenga visible.
    const envDefault = { ...DEFAULT_CONFIG, ai: { ...DEFAULT_CONFIG.ai } };
    if (process.env.GROQ_API_KEY) envDefault.ai.apiKey = process.env.GROQ_API_KEY;
    if (process.env.OPENROUTER_API_KEY) {
      envDefault.ai.openRouterApiKey = process.env.OPENROUTER_API_KEY;
      envDefault.ai.visionApiKey = process.env.OPENROUTER_API_KEY;
    }
    if (process.env.ANTHROPIC_API_KEY) envDefault.ai.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    await saveConfig(envDefault);
    return envDefault;
  }
}

// Guardar configuración
export async function saveConfig(newConfig: SafeVibeConfig): Promise<void> {
  // JSON.stringify con "null, 2" hace que el archivo se vea ordenado e indentado
  const jsonString = JSON.stringify(newConfig, null, 2);
  await fs.writeFile(CONFIG_PATH, jsonString, 'utf-8');
}
