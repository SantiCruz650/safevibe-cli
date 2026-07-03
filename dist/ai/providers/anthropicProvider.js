export class AnthropicProvider {
    apiKey;
    model;
    baseUrl = 'https://api.anthropic.com/v1/messages';
    constructor(apiKey, model = 'claude-3-5-sonnet-20241022') {
        if (!apiKey)
            throw new Error('Se requiere una API Key válida para Anthropic (Claude).');
        this.apiKey = apiKey;
        this.model = model;
    }
    async sendPrompt(systemPrompt, userPrompt, imageBase64, mimeType) {
        try {
            const userContent = [];
            // Si se provee imagen, se agrega como contenido de tipo image
            if (imageBase64 && mimeType) {
                userContent.push({
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: mimeType,
                        data: imageBase64
                    }
                });
            }
            // Añadir el prompt de texto del usuario
            userContent.push({
                type: 'text',
                text: userPrompt
            });
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: this.model,
                    system: systemPrompt,
                    messages: [
                        {
                            role: 'user',
                            content: userContent
                        }
                    ],
                    max_tokens: 4096,
                    temperature: 0.5
                })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Error API Anthropic (${response.status}): ${errorData.error?.message || 'Desconocido'}`);
            }
            const data = await response.json();
            return data.content[0].text.trim();
        }
        catch (error) {
            throw new Error(`Fallo de conexión con Anthropic: ${error.message}`);
        }
    }
}
