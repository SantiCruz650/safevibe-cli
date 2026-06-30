import { AIProvider } from './types.js';

export class OllamaProvider implements AIProvider {
  private baseUrl: string;
  private model: string;

  constructor(model: string = 'qwen2.5-coder:3b') {
    this.baseUrl = 'http://localhost:11434/api/generate';
    this.model = model;
  }

  async sendPrompt(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: `${systemPrompt}\n\nUsuario: ${userPrompt}\nAsistente:`,
          stream: false
        })
      });

      if (!response.ok) throw new Error(`Error de Ollama: HTTP ${response.status}`);

      const data = await response.json();
      return data.response.trim();
      
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Ollama no está ejecutándose. Ejecuta "ollama serve" en otra terminal.');
      }
      throw new Error(`Falló la conexión con la IA local: ${error.message}`);
    }
  }
}
