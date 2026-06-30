import { AIProvider } from './types.js';

export class NvidiaProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';

  // Por defecto usaremos el MiniMax M3 que encontraste
  constructor(apiKey: string, model: string = 'minimaxai/minimax-m3') {
    if (!apiKey) throw new Error('Se requiere una API Key válida para NVIDIA.');
    this.apiKey = apiKey;
    this.model = model;
  }

  async sendPrompt(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      // USAMOS FETCH NATIVO EN LUGAR DE AXIOS PARA AHORRAR RAM EN TU CHROMEBOOK
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json' // Stream en false porque necesitamos validar el código entero
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt }, // Nuestra personalidad de SafeVibe
            { role: 'user', content: userPrompt }      // Lo que pide el usuario
          ],
          max_tokens: 8192,  // Configuración óptima de MiniMax M3
          temperature: 1.00, 
          top_p: 0.95,
          stream: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error API NVIDIA (${response.status}): ${errorData.detail || errorData.message}`);
      }

      const data = await response.json();
      
      // Extraemos la respuesta del formato específico de la API de NVIDIA
      return data.choices[0].message.content.trim();

    } catch (error: any) {
      throw new Error(`Fallo la conexión con NVIDIA (MiniMax-M3): ${error.message}`);
    }
  }
}
