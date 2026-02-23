import 'server-only';

interface ServerConfig {
  openAiApiKey: string;
  openAiModel: string;
  openAiRealtimeModel: string;
  openAiRealtimeVoice: string;
  subscribeMode: 'log' | 'noop' | string;
}

// Centralized server-only env access for API routes.
export function getServerConfig(): ServerConfig {
  return {
    openAiApiKey: process.env.OPENAI_API_KEY ?? '',
    openAiModel: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
    openAiRealtimeModel: process.env.OPENAI_REALTIME_MODEL ?? 'gpt-realtime',
    openAiRealtimeVoice: process.env.OPENAI_REALTIME_VOICE ?? 'marin',
    subscribeMode: process.env.SUBSCRIBE_MODE ?? 'log'
  };
}
