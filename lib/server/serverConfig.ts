import 'server-only';

interface ServerConfig {
  openAiApiKey: string;
  openAiModel: string;
  openAiRealtimeModel: string;
  openAiRealtimeVoice: string;
  tavusApiKey: string;
  tavusBaseUrl: string;
  tavusPersonaId: string;
  tavusReplicaId: string;
  subscribeMode: 'log' | 'noop' | string;
}

export interface TavusConfigValidation {
  ok: boolean;
  missing: string[];
}

// Centralized server-only env access for API routes.
export function getServerConfig(): ServerConfig {
  return {
    openAiApiKey: process.env.OPENAI_API_KEY ?? '',
    openAiModel: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
    openAiRealtimeModel: process.env.OPENAI_REALTIME_MODEL ?? 'gpt-realtime',
    openAiRealtimeVoice: process.env.OPENAI_REALTIME_VOICE ?? 'marin',
    tavusApiKey: process.env.TAVUS_API_KEY ?? '',
    tavusBaseUrl: process.env.TAVUS_BASE_URL ?? 'https://tavusapi.com',
    tavusPersonaId: process.env.TAVUS_PERSONA_ID ?? '',
    tavusReplicaId: process.env.TAVUS_REPLICA_ID ?? '',
    subscribeMode: process.env.SUBSCRIBE_MODE ?? 'log'
  };
}

export function validateTavusConfig(config: Pick<ServerConfig, 'tavusApiKey' | 'tavusPersonaId'>): TavusConfigValidation {
  const missing: string[] = [];

  if (!config.tavusApiKey) missing.push('TAVUS_API_KEY');
  if (!config.tavusPersonaId) missing.push('TAVUS_PERSONA_ID');

  return { ok: missing.length === 0, missing };
}
