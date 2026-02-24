export type AgentSessionMode = 'audio' | 'video' | 'fallback' | 'none';
export type AgentTranscriptRole = 'assistant' | 'user' | 'system';
export type AgentTranscriptSource = 'triage' | 'audio' | 'video' | 'fallback';

export interface AgentTranscriptMessage {
  id: string;
  role: AgentTranscriptRole;
  text: string;
  source?: AgentTranscriptSource;
  timestamp?: number;
}

export interface AgentSessionStatus {
  connected: boolean;
  fallbackReason?: string;
  lastUpdatedAt?: number;
}

export interface AgentSessionContext {
  sessionId: string;
  originalQuestion: string;
  triageAnswer?: string;
  recommendedNextStep?: string;
  transcript: AgentTranscriptMessage[];
  currentMode: AgentSessionMode;
  status: AgentSessionStatus;
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createTranscriptMessage(
  role: AgentTranscriptRole,
  text: string,
  source?: AgentTranscriptSource
): AgentTranscriptMessage {
  return {
    id: generateId(),
    role,
    text,
    source,
    timestamp: Date.now()
  };
}

// App state is the memory source of truth across triage, audio, and video modes.
export function createAgentSessionContext(originalQuestion = ''): AgentSessionContext {
  return {
    sessionId: generateId(),
    originalQuestion,
    triageAnswer: undefined,
    recommendedNextStep: undefined,
    transcript: [],
    currentMode: 'none',
    status: {
      connected: false,
      lastUpdatedAt: Date.now()
    }
  };
}

export function appendSessionMessage(session: AgentSessionContext, message: AgentTranscriptMessage): AgentSessionContext {
  return {
    ...session,
    transcript: [...session.transcript, message],
    status: {
      ...session.status,
      lastUpdatedAt: message.timestamp ?? Date.now()
    }
  };
}

export function addSessionSystemNote(
  session: AgentSessionContext,
  text: string,
  source: AgentTranscriptSource = 'fallback'
): AgentSessionContext {
  return appendSessionMessage(session, createTranscriptMessage('system', text, source));
}

export function ensureSessionIntroMessage(session: AgentSessionContext, introText: string): AgentSessionContext {
  if (session.transcript.length > 0) return session;
  return appendSessionMessage(session, createTranscriptMessage('assistant', introText, 'fallback'));
}

export function setAgentSessionMode(
  session: AgentSessionContext,
  mode: AgentSessionMode,
  statusPatch?: Partial<AgentSessionStatus>
): AgentSessionContext {
  return {
    ...session,
    currentMode: mode,
    status: {
      ...session.status,
      ...statusPatch,
      lastUpdatedAt: Date.now()
    }
  };
}

export function updateSessionTriageSummary(
  session: AgentSessionContext,
  payload: Pick<AgentSessionContext, 'originalQuestion'> & Partial<Pick<AgentSessionContext, 'triageAnswer' | 'recommendedNextStep'>>
): AgentSessionContext {
  return {
    ...session,
    originalQuestion: payload.originalQuestion,
    triageAnswer: payload.triageAnswer,
    recommendedNextStep: payload.recommendedNextStep,
    status: {
      ...session.status,
      lastUpdatedAt: Date.now()
    }
  };
}

export function getRecentTranscriptEntries(session: AgentSessionContext, count = 8): AgentTranscriptMessage[] {
  if (count <= 0) return [];
  return session.transcript.slice(-count);
}
