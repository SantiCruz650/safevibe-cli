import { AIProvider } from './providers/types.js';
import { StandardProvider } from './providers/standardProvider.js'; // Usamos el estándar universal
import { loadConfig, SafeVibeConfig } from '../config/configHandler.js';

export class AIManager {
  private provider: AIProvider | null = null;

  async initialize(): Promise<void> {
    const config: SafeVibeConfig = await loadConfig();

    switch (config.ai.provider) {
      case 'groq-cloud':
        // Si en el futuro cambias a otra API, solo cambias la URL y el modelo aquí.
        this.provider = new StandardProvider(
          config.ai.apiKey!,
          'https://api.groq.com/openai/v1/chat/completions', // URL de Groq
          config.ai.model
        );
        break;
      case 'ollama-local':
        // Nota: Ollama tiene su propio formato, por eso tiene su propio proveedor
        const { OllamaProvider } = await import('./providers/ollamaProvider.js');
        this.provider = new OllamaProvider(config.ai.model);
        break;
      default:
        throw new Error(`Proveedor desconocido: ${config.ai.provider}`);
    }
  }

  async ask(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.provider) await this.initialize();
    return this.provider!.sendPrompt(systemPrompt, userPrompt);
  }
}
