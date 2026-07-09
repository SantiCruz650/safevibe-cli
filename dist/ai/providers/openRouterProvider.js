export class OpenRouterProvider {
    apiKey;
    codeModel;
    visionModel;
    baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
    constructor(apiKey, codeModel, visionModel) {
        if (!apiKey)
            throw new Error('Se requiere una API Key válida para OpenRouter.');
        this.apiKey = apiKey;
        this.codeModel = codeModel;
        this.visionModel = visionModel;
    }
    async sendPrompt(systemPrompt, userPrompt, imageBase64, mimeType) {
        try {
            const model = imageBase64 ? this.visionModel : this.codeModel;
            const messages = [
                { role: 'system', content: systemPrompt },
            ];
            if (imageBase64 && mimeType) {
                messages.push({
                    role: 'user',
                    content: [
                        { type: 'text', text: userPrompt },
                        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
                    ],
                });
            }
            else {
                messages.push({ role: 'user', content: userPrompt });
            }
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': 'https://safevibe-cli.local',
                    'X-Title': 'SafeVibe CLI',
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: 0.5,
                    max_tokens: 8192,
                    stream: false,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                const detail = errorData.error?.metadata?.raw || errorData.error?.message || 'Desconocido';
                throw new Error(`Error API OpenRouter (${response.status}): ${detail}`);
            }
            const data = await response.json();
            return data.choices[0].message.content.trim();
        }
        catch (error) {
            throw new Error(`Fallo de conexión con OpenRouter: ${error.message}`);
        }
    }
}
