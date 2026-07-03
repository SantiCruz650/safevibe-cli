export interface AIProvider {
  sendPrompt(systemPrompt: string, userPrompt: string, imageBase64?: string, mimeType?: string): Promise<string>;
}
