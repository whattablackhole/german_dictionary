export const environment = {
  // OpenRouter AI Configuration
  // The API key is NOT hardcoded here - it's loaded from localStorage (set via the app UI)
  // Default values are documented in the .env file at project root
  openRouterApiKey: '',
  openRouterModel: 'deepseek/deepseek-v4-flash',
  openRouterApiUrl: 'https://openrouter.ai/api/v1/chat/completions',

  // LibreTranslate Configuration
  libreTranslateUrl: 'http://localhost:5000/translate',
};
