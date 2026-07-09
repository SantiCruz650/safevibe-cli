import { AIProvider } from './providers/types.js';
import { StandardProvider } from './providers/standardProvider.js';
import { loadConfig, SafeVibeConfig } from '../config/configHandler.js';

export class AIManager {
  private provider: AIProvider | null = null;
  private visionProvider: AIProvider | null = null;
  private initPromise: Promise<void> | null = null;
  private initialized = false;

  private async initMainProvider(config: SafeVibeConfig): Promise<AIProvider> {
    switch (config.ai.provider) {
      case 'groq-cloud':
        return new StandardProvider(
          config.ai.apiKey!,
          'https://api.groq.com/openai/v1/chat/completions',
          config.ai.model
        );
      case 'anthropic': {
        const { AnthropicProvider } = await import('./providers/anthropicProvider.js');
        return new AnthropicProvider(config.ai.apiKey!, config.ai.model);
      }
      case 'ollama-local': {
        const { OllamaProvider } = await import('./providers/ollamaProvider.js');
        return new OllamaProvider(config.ai.model);
      }
      case 'openrouter': {
        const { OpenRouterProvider } = await import('./providers/openRouterProvider.js');
        return new OpenRouterProvider(
          config.ai.openRouterApiKey!,
          config.ai.codeModel || config.ai.model,
          config.ai.visionModel || 'google/gemma-4-31b-it:free'
        );
      }
      default:
        throw new Error(`Proveedor desconocido: ${config.ai.provider}`);
    }
  }

  private async initVisionProvider(config: SafeVibeConfig): Promise<AIProvider | null> {
    if (!config.ai.visionProvider || config.ai.visionProvider === 'none') return null;

    switch (config.ai.visionProvider) {
      case 'openrouter': {
        const { OpenRouterProvider } = await import('./providers/openRouterProvider.js');
        return new OpenRouterProvider(
          config.ai.visionApiKey || config.ai.openRouterApiKey!,
          config.ai.model,
          config.ai.visionModel || 'google/gemma-4-31b-it:free'
        );
      }
      default:
        return null;
    }
  }

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    if (this.initialized) return;
    const config: SafeVibeConfig = await loadConfig();
    this.provider = await this.initMainProvider(config);
    this.visionProvider = await this.initVisionProvider(config);
    this.initialized = true;
  }

  async ask(systemPrompt: string, userPrompt: string, imageBase64?: string, mimeType?: string): Promise<string> {
    await this.initialize();

    if (imageBase64 && this.visionProvider) {
      return this.visionProvider!.sendPrompt(systemPrompt, userPrompt, imageBase64, mimeType);
    }
    return this.provider!.sendPrompt(systemPrompt, userPrompt, imageBase64, mimeType);
  }
}
