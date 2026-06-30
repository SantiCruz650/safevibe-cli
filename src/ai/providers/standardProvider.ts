import { AIProvider } from './types.js';

// Este proveedor sirve para Groq, Nvidia, Together AI, DeepInfra, etc.
// Todos usan el mismo formato JSON gracias al estándar de la industria.
export class StandardProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string, model: string) {
    if (!apiKey) throw new Error('Se requiere una API Key válida.');
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async sendPrompt(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.5,
          max_tokens: 1024,
          stream: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error API (${response.status}): ${errorData.error?.message || 'Desconocido'}`);
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();

    } catch (error: any) {
      throw new Error(`Fallo de conexión: ${error.message}`);
    }
  }
}
