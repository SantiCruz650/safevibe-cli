export interface AIProvider {
  sendPrompt(systemPrompt: string, userPrompt: string): Promise<string>;
}
