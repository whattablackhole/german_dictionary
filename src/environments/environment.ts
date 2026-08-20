export const environment = {
  // OpenRouter AI Configuration
  // The API key is NOT hardcoded here - it's loaded from localStorage (set via the app UI)
  // Default values are documented in the .env file at project root
  openRouterApiKey: '',
  openRouterModel: 'google/gemma-4-31b-it:free',
  openRouterApiUrl: 'https://openrouter.ai/api/v1/chat/completions',
  openRouterImageUrl: 'https://openrouter.ai/api/v1/images/generations',

  // LibreTranslate Configuration
  libreTranslateUrl: 'http://localhost:5000/translate',
};