export class StandardProvider {
    apiKey;
    model;
    baseUrl;
    maxRetries = 5;
    constructor(apiKey, baseUrl, model) {
        if (!apiKey)
            throw new Error('Se requiere una API Key válida.');
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.model = model;
    }
    retryDelay(attempt, errorMessage) {
        // Si el servidor dice "try again in Xs", respetamos ese tiempo
        if (errorMessage) {
            const match = errorMessage.match(/try again in (\d+(?:\.\d+)?)s/);
            if (match)
                return Math.ceil(parseFloat(match[1])) + 2;
        }
        // Fallback: backoff exponencial
        return Math.min(2 * attempt + 3, 30);
    }
    async sendPrompt(systemPrompt, userPrompt, imageBase64, mimeType) {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
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
                        max_tokens: 2048,
                        stream: false
                    })
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
                    if (attempt < this.maxRetries) {
                        const delay = this.retryDelay(attempt, errorMsg);
                        await new Promise(r => setTimeout(r, delay * 1000));
                        continue;
                    }
                    throw new Error(`Error API (${response.status}): ${errorMsg}`);
                }
                const data = await response.json();
                return data.choices[0].message.content.trim();
            }
            catch (error) {
                if (attempt < this.maxRetries) {
                    const delay = this.retryDelay(attempt, error.message);
                    await new Promise(r => setTimeout(r, delay * 1000));
                    continue;
                }
                throw new Error(`Fallo de conexión: ${error.message}`);
            }
        }
        throw new Error(`Fallo de conexión: máximo de reintentos alcanzado para ${this.model}`);
    }
}
