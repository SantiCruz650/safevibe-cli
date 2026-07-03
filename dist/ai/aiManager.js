import { StandardProvider } from './providers/standardProvider.js'; // Usamos el estándar universal
import { loadConfig } from '../config/configHandler.js';
export class AIManager {
    provider = null;
    async initialize() {
        const config = await loadConfig();
        switch (config.ai.provider) {
            case 'groq-cloud':
                this.provider = new StandardProvider(config.ai.apiKey, 'https://api.groq.com/openai/v1/chat/completions', // URL de Groq
                config.ai.model);
                break;
            case 'anthropic':
                const { AnthropicProvider } = await import('./providers/anthropicProvider.js');
                this.provider = new AnthropicProvider(config.ai.apiKey, config.ai.model);
                break;
            case 'ollama-local':
                const { OllamaProvider } = await import('./providers/ollamaProvider.js');
                this.provider = new OllamaProvider(config.ai.model);
                break;
            default:
                throw new Error(`Proveedor desconocido: ${config.ai.provider}`);
        }
    }
    async ask(systemPrompt, userPrompt, imageBase64, mimeType) {
        if (!this.provider)
            await this.initialize();
        return this.provider.sendPrompt(systemPrompt, userPrompt, imageBase64, mimeType);
    }
}
