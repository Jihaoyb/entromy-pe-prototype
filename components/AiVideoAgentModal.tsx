'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react';
import { trackDemoEvent } from '@/lib/client/trackEvent';
import {
  addSessionSystemNote,
  appendSessionMessage,
  createTranscriptMessage,
  ensureSessionIntroMessage,
  getRecentTranscriptEntries,
  setAgentSessionMode,
  type AgentSessionContext,
  type AgentSessionMode,
  type AgentTranscriptRole,
  type AgentTranscriptSource
} from '@/lib/shared/agentSession';

interface AiVideoAgentModalProps {
  open: boolean;
  session: AgentSessionContext;
  onSessionChange: Dispatch<SetStateAction<AgentSessionContext>>;
  onClose: () => void;
  onEscalateToSpecialist: () => void;
}

const followUpOptions = ['Show me a 30-day plan', 'What should I validate first?', 'When should I escalate this?'] as const;
const realtimeFeatureEnabled = process.env.NEXT_PUBLIC_ENABLE_REALTIME_AGENT === 'true';
const tavusFeatureEnabled = process.env.NEXT_PUBLIC_ENABLE_TAVUS_VIDEO_AGENT === 'true';
const initialAssistantLine = 'I can help triage this quickly and suggest a practical next step for your deal or operating team.';

const followUpResponses: Record<(typeof followUpOptions)[number], string> = {
  'Show me a 30-day plan':
    'Weeks 1-2: lock role clarity and decision rights. Weeks 3-4: run weekly cadence reviews tied to the top two value-creation priorities.',
  'What should I validate first?':
    'Validate ownership for critical milestones, leadership coverage in high-risk functions, and dependency risk across teams before adding new initiatives.',
  'When should I escalate this?':
    'Escalate when two cadence cycles slip, decision latency increases, or key leaders are blocked on cross-functional dependencies.'
};

interface TriageApiSuccess {
  ok: true;
  answer: string;
  recommendedNextStep: string;
  mode: 'live' | 'fallback';
}

interface TriageApiFailure {
  ok: false;
  error: string;
}

interface RealtimeSessionSuccess {
  ok: true;
  clientSecret: string;
  model: string;
  voice: string;
}

interface RealtimeSessionFailure {
  ok: false;
  error: string;
  stage?: 'env' | 'session_setup' | 'token_parse';
}

interface TavusSessionSuccess {
  ok: true;
  conversationId: string;
  conversationUrl: string;
  mode: 'live';
}

interface TavusSessionFailure {
  ok: false;
  error: string;
  stage?: 'env' | 'session_setup' | 'response_parse';
}

type RealtimeStatus = 'prototype' | 'connecting' | 'live' | 'fallback';
type TavusStatus = 'idle' | 'connecting' | 'live' | 'fallback';
type SessionPhase = 'connecting' | 'listening' | 'thinking' | 'responding' | 'fallback' | 'prototype';
type RealtimeFailureStage =
  | 'feature flag disabled'
  | 'browser unsupported'
  | 'microphone permission denied'
  | 'session setup failed'
  | 'token parse failed'
  | 'webrtc setup failed'
  | 'sdp handshake failed'
  | 'data channel failed'
  | 'unknown';

interface SessionStateBadge {
  key: SessionPhase;
  label: string;
}

const sessionStateBadges: SessionStateBadge[] = [
  { key: 'connecting', label: 'Connecting' },
  { key: 'listening', label: 'Listening' },
  { key: 'thinking', label: 'Thinking' },
  { key: 'responding', label: 'Responding' },
  { key: 'fallback', label: 'Fallback mode' }
];

class RealtimeFlowError extends Error {
  stageHint: RealtimeFailureStage;
  uiDetail?: string;

  constructor(stageHint: RealtimeFailureStage, message: string, uiDetail?: string) {
    super(message);
    this.stageHint = stageHint;
    this.uiDetail = uiDetail;
  }
}

function sanitizeDetail(value?: string) {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, 120);
}

function buildRealtimeFallbackMessage(stage: RealtimeFailureStage, detail?: string) {
  const safeDetail = sanitizeDetail(detail);
  if (!safeDetail) return `Realtime unavailable (${stage}). Using prototype mode.`;
  return `Realtime unavailable (${stage}: ${safeDetail}). Using prototype mode.`;
}

function waitForDataChannelOpen(channel: RTCDataChannel, timeoutMs = 8000) {
  if (channel.readyState === 'open') return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      channel.removeEventListener('open', onOpen);
      channel.removeEventListener('error', onError);
      reject(new RealtimeFlowError('data channel failed', 'Realtime data channel did not open before timeout.'));
    }, timeoutMs);

    const onOpen = () => {
      window.clearTimeout(timeout);
      channel.removeEventListener('error', onError);
      resolve();
    };

    const onError = () => {
      window.clearTimeout(timeout);
      channel.removeEventListener('open', onOpen);
      reject(new RealtimeFlowError('data channel failed', 'Realtime data channel emitted an error.'));
    };

    channel.addEventListener('open', onOpen, { once: true });
    channel.addEventListener('error', onError, { once: true });
  });
}

function extractRealtimeText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as Record<string, unknown>;

  if (typeof data.transcript === 'string' && data.transcript.trim()) return data.transcript.trim();
  if (typeof data.text === 'string' && data.text.trim()) return data.text.trim();

  const response = data.response as Record<string, unknown> | undefined;
  const output = response?.output;
  if (!Array.isArray(output)) return null;

  for (const outputItem of output) {
    if (!outputItem || typeof outputItem !== 'object') continue;
    const content = (outputItem as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;

    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      const text = (part as Record<string, unknown>).text;
      const transcript = (part as Record<string, unknown>).transcript;
      if (typeof text === 'string' && text.trim()) return text.trim();
      if (typeof transcript === 'string' && transcript.trim()) return transcript.trim();
    }
  }

  return null;
}

function sourceFromMode(mode: AgentSessionMode): AgentTranscriptSource {
  if (mode === 'audio') return 'audio';
  if (mode === 'video') return 'video';
  return 'fallback';
}

export function AiVideoAgentModal({ open, session, onSessionChange, onClose, onEscalateToSpecialist }: AiVideoAgentModalProps) {
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('prototype');
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('prototype');
  const [realtimeMessage, setRealtimeMessage] = useState('Prototype transcript mode is active.');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [hasCameraPreview, setHasCameraPreview] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [tavusStatus, setTavusStatus] = useState<TavusStatus>('idle');
  const [tavusMessage, setTavusMessage] = useState('Video avatar is available when Tavus is enabled.');
  const [tavusConversationUrl, setTavusConversationUrl] = useState('');
  const [tavusConversationId, setTavusConversationId] = useState('');

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const speakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

  const activeBadgeKey = useMemo<SessionPhase | null>(() => {
    if (sessionPhase === 'prototype') return null;
    return sessionPhase;
  }, [sessionPhase]);

  const showingTavusFrame = tavusStatus === 'live' && Boolean(tavusConversationUrl);

  const updateSession = useCallback(
    (updater: (previous: AgentSessionContext) => AgentSessionContext) => {
      onSessionChange((previous) => updater(previous));
    },
    [onSessionChange]
  );

  const appendSharedMessage = useCallback(
    (role: AgentTranscriptRole, text: string, source: AgentTranscriptSource) => {
      updateSession((previous) => appendSessionMessage(previous, createTranscriptMessage(role, text, source)));
    },
    [updateSession]
  );

  const appendSystemNote = useCallback(
    (text: string, source: AgentTranscriptSource = 'fallback') => {
      updateSession((previous) => addSessionSystemNote(previous, text, source));
    },
    [updateSession]
  );

  const updateSessionMode = useCallback(
    (mode: AgentSessionMode, fallbackReason?: string) => {
      updateSession((previous) =>
        setAgentSessionMode(previous, mode, {
          connected: mode === 'audio' || mode === 'video',
          fallbackReason
        })
      );
    },
    [updateSession]
  );

  const clearTranscript = () => {
    const introMessage = createTranscriptMessage('assistant', initialAssistantLine, 'fallback');
    updateSession((previous) => ({
      ...previous,
      transcript: [introMessage],
      status: {
        ...previous.status,
        lastUpdatedAt: introMessage.timestamp
      }
    }));
  };

  const resetTavusState = useCallback(() => {
    setTavusStatus('idle');
    setTavusMessage('Video avatar is available when Tavus is enabled.');
    setTavusConversationUrl('');
    setTavusConversationId('');
  }, []);

  const cleanupRealtime = useCallback(() => {
    if (speakingTimerRef.current) {
      clearTimeout(speakingTimerRef.current);
      speakingTimerRef.current = null;
    }

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach((track) => track.stop());
      microphoneStreamRef.current = null;
    }

    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }

    if (videoElementRef.current) {
      videoElementRef.current.srcObject = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }

    setIsAiSpeaking(false);
    setHasCameraPreview(false);
  }, []);

  const switchToFallbackMode = (stage: RealtimeFailureStage, detail?: string) => {
    cleanupRealtime();
    setRealtimeStatus('fallback');
    setSessionPhase('fallback');
    const fallbackMessage = buildRealtimeFallbackMessage(stage, detail);
    setRealtimeMessage(fallbackMessage);
    updateSessionMode('fallback', stage);
    appendSystemNote(`Audio mode unavailable (${stage}). Continuing in prototype mode.`, 'fallback');
    trackDemoEvent('fallback_triggered', { stage });
  };

  const switchVideoFallbackMode = (stage: string, detail?: string) => {
    const safeStage = sanitizeDetail(stage);
    const safeDetail = sanitizeDetail(detail);

    setTavusStatus('fallback');
    setTavusMessage(`Video agent unavailable (${safeStage}${safeDetail ? `: ${safeDetail}` : ''}). Using current prototype/audio mode.`);

    if (realtimeStatus === 'live') {
      updateSessionMode('audio', safeStage);
      appendSystemNote('Video avatar unavailable. Continuing in audio mode.', 'fallback');
      setSessionPhase('listening');
    } else {
      updateSessionMode('fallback', safeStage);
      appendSystemNote('Video avatar unavailable. Continuing in prototype mode.', 'fallback');
      setSessionPhase('fallback');
    }

    trackDemoEvent('video_agent_fallback_triggered', { stage: safeStage });
  };

  const handleCloseModal = useCallback(() => {
    cleanupRealtime();
    resetTavusState();
    updateSessionMode('none');
    onClose();
  }, [cleanupRealtime, onClose, resetTavusState, updateSessionMode]);

  const handleConnectVideoAgent = async () => {
    if (tavusStatus === 'connecting' || tavusStatus === 'live') return;

    if (!tavusFeatureEnabled) {
      switchVideoFallbackMode('feature flag disabled');
      return;
    }

    trackDemoEvent('video_agent_connect_requested', { source: 'ai-video-modal' });
    setTavusStatus('connecting');
    setSessionPhase('connecting');
    setTavusMessage('Starting Tavus video agent session...');

    try {
      const response = await fetch('/api/tavus-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalQuestion: session.originalQuestion,
          triageAnswer: session.triageAnswer,
          recommendedNextStep: session.recommendedNextStep,
          recentTranscript: getRecentTranscriptEntries(session, 8).map((entry) => ({
            role: entry.role,
            text: entry.text,
            source: entry.source,
            timestamp: entry.timestamp
          })),
          context: {
            source: 'ai-video-modal',
            currentMode: session.currentMode,
            sessionId: session.sessionId
          }
        })
      });

      const data = (await response.json()) as TavusSessionSuccess | TavusSessionFailure;
      if (!response.ok || !data.ok) {
        const stage = !data.ok && data.stage ? data.stage : 'session_setup';
        const detail = !data.ok ? data.error : 'Unexpected Tavus response.';
        switchVideoFallbackMode(stage, detail);
        return;
      }

      setTavusStatus('live');
      setTavusConversationUrl(data.conversationUrl);
      setTavusConversationId(data.conversationId);
      setTavusMessage('Video avatar connected. Continue your session below.');
      setSessionPhase('listening');
      updateSessionMode('video');

      if (session.currentMode === 'audio') {
        appendSystemNote('Switched to video avatar mode. Context preserved.', 'video');
      } else {
        appendSystemNote('Video avatar mode connected. Context preserved.', 'video');
      }

      trackDemoEvent('video_agent_connected', { source: 'ai-video-modal', hasConversationId: Boolean(data.conversationId) });
    } catch (error) {
      console.error('[AiVideoAgentModal][tavus] failed to connect:', error);
      switchVideoFallbackMode('session_setup', 'Unexpected network error');
    }
  };

  const handleStartRealtimeSession = async () => {
    if (realtimeStatus === 'connecting' || realtimeStatus === 'live') return;

    if (!realtimeFeatureEnabled) {
      switchToFallbackMode('feature flag disabled');
      return;
    }

    if (typeof window === 'undefined' || !window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
      switchToFallbackMode('browser unsupported');
      return;
    }

    trackDemoEvent('agent_started', { source: 'ai-video-modal' });
    setRealtimeStatus('connecting');
    setSessionPhase('connecting');
    setRealtimeMessage('Requesting microphone access and connecting to AI...');

    try {
      let micStream: MediaStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error) {
        const permissionError = error as DOMException;
        if (permissionError?.name === 'NotAllowedError' || permissionError?.name === 'PermissionDeniedError') {
          throw new RealtimeFlowError('microphone permission denied', 'User denied microphone permission.');
        }
        throw new RealtimeFlowError('microphone permission denied', 'Unable to acquire microphone stream.');
      }

      microphoneStreamRef.current = micStream;

      const sessionResponse = await fetch('/api/realtime-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: session.originalQuestion.trim() })
      });
      const sessionData = (await sessionResponse.json()) as RealtimeSessionSuccess | RealtimeSessionFailure;

      if (!sessionResponse.ok || !sessionData.ok) {
        const stageHint =
          !sessionData.ok && sessionData.stage === 'token_parse'
            ? 'token parse failed'
            : !sessionData.ok && (sessionData.stage === 'session_setup' || sessionData.stage === 'env')
              ? 'session setup failed'
              : 'session setup failed';

        const detail = !sessionData.ok ? sessionData.error : 'Session endpoint returned an unexpected payload.';
        throw new RealtimeFlowError(stageHint, `Realtime session endpoint failed with status ${sessionResponse.status}.`, detail);
      }

      if (!sessionData.clientSecret || !sessionData.model) {
        throw new RealtimeFlowError('token parse failed', 'Realtime session payload did not include required fields.');
      }

      let peerConnection: RTCPeerConnection;
      try {
        peerConnection = new RTCPeerConnection();
      } catch {
        throw new RealtimeFlowError('webrtc setup failed', 'Unable to initialize RTCPeerConnection.');
      }
      peerConnectionRef.current = peerConnection;

      const remoteAudio = new Audio();
      remoteAudio.autoplay = true;
      remoteAudioRef.current = remoteAudio;

      const audioTracks = micStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new RealtimeFlowError('webrtc setup failed', 'No microphone tracks available after permission grant.');
      }

      audioTracks.forEach((track) => peerConnection.addTrack(track, micStream));

      peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.play().catch(() => undefined);
        }
      };

      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
          switchToFallbackMode('webrtc setup failed', 'Connection dropped.');
        }
      };

      const dataChannel = peerConnection.createDataChannel('oai-events');
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        setRealtimeStatus('live');
        setSessionPhase('listening');
        setRealtimeMessage('Live audio connected. Speak naturally to the AI agent.');
        updateSessionMode('audio');

        if (session.currentMode === 'video') {
          appendSystemNote('Switched to audio mode. Context preserved.', 'audio');
        } else {
          appendSystemNote('AI agent session started in audio mode.', 'audio');
        }

        trackDemoEvent('audio_connected', { source: 'ai-video-modal' });
      };

      dataChannel.onerror = () => {
        console.error('[AiVideoAgentModal][realtime] data channel error');
      };

      dataChannel.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as Record<string, unknown>;
          const eventType = typeof payload.type === 'string' ? payload.type : '';

          if (eventType.includes('audio')) {
            setIsAiSpeaking(true);
            setSessionPhase('responding');
            if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
            speakingTimerRef.current = setTimeout(() => {
              setIsAiSpeaking(false);
              setSessionPhase('listening');
            }, 400);
          }

          const text = extractRealtimeText(payload);
          if (text && (eventType.endsWith('.done') || eventType === 'response.done')) {
            appendSharedMessage('assistant', text, 'audio');
            setSessionPhase('listening');
          }
        } catch {
          // Ignore non-JSON realtime events.
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(sessionData.model)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionData.clientSecret}`,
          'Content-Type': 'application/sdp'
        },
        body: offer.sdp
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        throw new RealtimeFlowError('sdp handshake failed', 'Realtime SDP handshake failed.', errorText);
      }

      const answerSdp = await sdpResponse.text();
      await peerConnection.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      await waitForDataChannelOpen(dataChannel);
    } catch (error) {
      if (error instanceof RealtimeFlowError) {
        console.error('[AiVideoAgentModal][realtime] failed', {
          stage: error.stageHint,
          message: error.message
        });
        switchToFallbackMode(error.stageHint, error.uiDetail);
        return;
      }

      console.error('[AiVideoAgentModal][realtime] failed with unknown error', error);
      switchToFallbackMode('unknown');
    }
  };

  const handleEnableCameraPreview = async () => {
    if (isCameraLoading || hasCameraPreview || !navigator.mediaDevices?.getUserMedia || showingTavusFrame) return;

    setIsCameraLoading(true);

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraStreamRef.current = cameraStream;
      if (videoElementRef.current) {
        videoElementRef.current.srcObject = cameraStream;
      }
      setHasCameraPreview(true);
    } catch (error) {
      console.error('[AiVideoAgentModal] Camera preview request failed:', error);
      setRealtimeMessage('Camera preview is unavailable. Audio session can still continue.');
    } finally {
      setIsCameraLoading(false);
    }
  };

  const handleFollowUp = async (option: (typeof followUpOptions)[number]) => {
    if (isFollowUpLoading) return;

    const activeSource = sourceFromMode(session.currentMode);
    appendSharedMessage('user', option, activeSource);

    if (realtimeStatus === 'live' && dataChannelRef.current?.readyState === 'open') {
      try {
        setSessionPhase('thinking');
        dataChannelRef.current.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'user',
              content: [{ type: 'input_text', text: option }]
            }
          })
        );
        dataChannelRef.current.send(JSON.stringify({ type: 'response.create' }));
        return;
      } catch (error) {
        console.error('[AiVideoAgentModal] Failed to send follow-up over realtime channel:', error);
      }
    }

    setIsFollowUpLoading(true);
    setSessionPhase('thinking');

    try {
      const baseQuestion = session.originalQuestion.trim();
      const combinedQuestion = baseQuestion ? `${baseQuestion} Follow-up: ${option}` : option;

      const response = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: combinedQuestion,
          context: { source: 'ai-video-modal' }
        })
      });

      const data = (await response.json()) as TriageApiSuccess | TriageApiFailure;
      if (!response.ok || !data.ok) {
        throw new Error('AI video follow-up request failed.');
      }

      setSessionPhase('responding');
      appendSharedMessage('assistant', data.answer, data.mode === 'fallback' ? 'fallback' : activeSource);
      appendSystemNote(`Next step: ${data.recommendedNextStep}`, data.mode === 'fallback' ? 'fallback' : activeSource);
      setSessionPhase(realtimeStatus === 'live' ? 'listening' : realtimeStatus === 'fallback' ? 'fallback' : 'prototype');
    } catch (error) {
      console.error('[AiVideoAgentModal] Failed to fetch follow-up response:', error);
      setSessionPhase('responding');
      appendSharedMessage('assistant', followUpResponses[option], 'fallback');
      setSessionPhase(realtimeStatus === 'fallback' ? 'fallback' : 'prototype');
    } finally {
      setIsFollowUpLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      cleanupRealtime();
      setIsFollowUpLoading(false);
      setRealtimeStatus('prototype');
      setSessionPhase('prototype');
      setRealtimeMessage('Prototype transcript mode is active.');
      resetTavusState();
      return;
    }

    updateSession((previous) => ensureSessionIntroMessage(previous, initialAssistantLine));

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleCloseModal();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cleanupRealtime, handleCloseModal, open, resetTavusState, updateSession]);

  useEffect(() => {
    const container = transcriptScrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [session.transcript, isFollowUpLoading]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4" onClick={handleCloseModal} role="presentation">
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-brand-line bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-video-title"
      >
        <div className="shrink-0 border-b border-brand-line bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 id="ai-video-title" className="text-xl font-medium text-brand-ink">
                Continue AI agent session
              </h3>
              <p className="mt-1.5 text-sm leading-[1.5] text-brand-muted">
                Use audio or video avatar mode in the same session. Context and transcript stay shared.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCloseModal}
              className="rounded-sm border border-brand-line px-2 py-1 text-xs text-brand-muted transition hover:bg-brand-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
              aria-label="Close AI video agent modal"
            >
              Close
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {sessionStateBadges.map((badge) => {
              const isActive = badge.key === activeBadgeKey;
              return (
                <span
                  key={badge.key}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    isActive ? 'border-brand-green bg-brand-greenTint text-brand-ink' : 'border-brand-line bg-white text-brand-muted'
                  }`}
                >
                  {badge.label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
            <div className="rounded-md border border-brand-line bg-brand-panel p-4">
              <div className="relative aspect-[16/10] overflow-hidden rounded-md border border-brand-line bg-[#1f2520]">
                {showingTavusFrame ? (
                  <iframe
                    src={tavusConversationUrl}
                    title="Tavus Video Agent"
                    className="h-full w-full border-0"
                    allow="camera; microphone; autoplay; clipboard-write"
                  />
                ) : hasCameraPreview ? (
                  <video ref={videoElementRef} className="h-full w-full object-cover" autoPlay muted playsInline />
                ) : null}
                <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      tavusStatus === 'live'
                        ? 'animate-pulse bg-[#71e440]'
                        : realtimeStatus === 'live'
                          ? 'animate-pulse bg-[#71e440]'
                          : realtimeStatus === 'connecting' || tavusStatus === 'connecting'
                            ? 'bg-[#d9e85f]'
                            : 'bg-slate-300'
                    }`}
                  />
                  <span>
                    {tavusStatus === 'live'
                      ? 'AI Agent • Video mode'
                      : realtimeStatus === 'live'
                        ? 'AI Agent • Audio mode'
                        : tavusStatus === 'connecting' || realtimeStatus === 'connecting'
                          ? 'AI Agent • Connecting'
                          : tavusStatus === 'fallback'
                            ? 'AI Agent • Fallback'
                            : 'AI Agent • Prototype'}
                  </span>
                </div>
                <div className="absolute left-3 top-10 text-[11px] text-slate-200">{isAiSpeaking ? 'PE triage mode • Responding' : 'PE triage mode'}</div>
                <div className="absolute bottom-3 left-3 flex items-end gap-1.5">
                  <span className={`h-2 w-1 rounded ${realtimeStatus === 'live' || tavusStatus === 'live' ? 'animate-pulse bg-[#9fd67b]' : 'bg-[#5f6f62]'}`} />
                  <span
                    className={`h-4 w-1 rounded ${
                      realtimeStatus === 'live' || tavusStatus === 'live' ? 'animate-pulse bg-[#9fd67b] [animation-delay:120ms]' : 'bg-[#5f6f62]'
                    }`}
                  />
                  <span
                    className={`h-3 w-1 rounded ${
                      realtimeStatus === 'live' || tavusStatus === 'live' ? 'animate-pulse bg-[#9fd67b] [animation-delay:240ms]' : 'bg-[#5f6f62]'
                    }`}
                  />
                  <span
                    className={`h-5 w-1 rounded ${
                      realtimeStatus === 'live' || tavusStatus === 'live' ? 'animate-pulse bg-[#9fd67b] [animation-delay:360ms]' : 'bg-[#5f6f62]'
                    }`}
                  />
                </div>
              </div>

              <div className="mt-3 rounded-md border border-brand-line bg-white p-3">
                <p className="text-xs font-medium uppercase tracking-[0.1em] text-brand-muted">Original question</p>
                <p className="mt-1 text-sm leading-[1.5] text-brand-ink">
                  {session.originalQuestion.trim() || 'No question provided. Return to the triage panel to add context.'}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleConnectVideoAgent}
                  disabled={tavusStatus === 'connecting' || tavusStatus === 'live'}
                  className="rounded-md bg-brand-green px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-greenHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:bg-[#89b86a]"
                >
                  {tavusStatus === 'live' ? 'Video mode connected' : tavusStatus === 'connecting' ? 'Connecting video mode...' : 'Connect video agent'}
                </button>
                <button
                  type="button"
                  onClick={handleStartRealtimeSession}
                  disabled={realtimeStatus === 'connecting' || realtimeStatus === 'live'}
                  className="rounded-md border border-brand-line bg-white px-3.5 py-2 text-xs font-medium text-brand-muted transition-colors hover:bg-brand-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {realtimeStatus === 'live' ? 'Audio mode connected' : realtimeStatus === 'connecting' ? 'Connecting audio mode...' : 'Connect audio'}
                </button>
                <button
                  type="button"
                  onClick={handleEnableCameraPreview}
                  disabled={isCameraLoading || hasCameraPreview || showingTavusFrame}
                  className="rounded-md border border-brand-line bg-white px-3.5 py-2 text-xs font-medium text-brand-muted transition-colors hover:bg-brand-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {hasCameraPreview ? 'Camera preview on' : isCameraLoading ? 'Enabling camera...' : 'Enable camera preview'}
                </button>
              </div>
              <p className="mt-2 text-xs text-brand-muted">{tavusStatus === 'fallback' ? tavusMessage : realtimeMessage}</p>
              {tavusConversationId ? <p className="mt-1 text-[11px] text-brand-muted">Tavus session active.</p> : null}
            </div>

            <div className="flex min-h-[390px] flex-col rounded-md border border-brand-line bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-[0.1em] text-brand-muted">Suggested follow-ups</p>
                <button
                  type="button"
                  onClick={clearTranscript}
                  className="text-xs text-brand-muted underline-offset-2 transition-colors hover:text-brand-ink hover:underline"
                >
                  Clear transcript
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {followUpOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleFollowUp(option)}
                    disabled={isFollowUpLoading}
                    className="rounded-full border border-brand-line bg-white px-3 py-1.5 text-xs text-brand-muted transition-colors hover:bg-brand-greenTint hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {option}
                  </button>
                ))}
              </div>

              <div
                ref={transcriptScrollRef}
                className="mt-3 max-h-[40vh] min-h-[220px] flex-1 overflow-y-auto rounded-md border border-dashed border-brand-line bg-brand-panel p-3"
                aria-live="polite"
              >
                {session.transcript.map((message) => (
                  <div key={message.id} className={`mb-2.5 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[92%] rounded-md px-3 py-2 text-sm leading-[1.5] ${
                        message.role === 'user'
                          ? 'border border-brand-greenLine bg-brand-greenTint text-brand-ink'
                          : message.role === 'system'
                            ? 'border border-brand-line bg-white text-[13px] text-brand-muted'
                            : 'border border-brand-line bg-white text-brand-ink'
                      }`}
                    >
                      {message.role === 'system' ? <span className="font-medium">Note: </span> : null}
                      {message.text}
                    </div>
                  </div>
                ))}
                {isFollowUpLoading ? <p className="mt-1 text-sm text-brand-muted">AI Agent: Reviewing your follow-up...</p> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-brand-line bg-white/95 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-brand-muted">Use specialist escalation for deal-specific decisions and urgent portfolio context.</p>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-md border border-brand-line px-4 py-2.5 text-[13px] font-medium text-brand-muted transition-colors hover:bg-brand-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
              >
                End session
              </button>
              <button
                type="button"
                onClick={() => {
                  trackDemoEvent('escalated_to_specialist', { source: 'ai-video-modal' });
                  onEscalateToSpecialist();
                }}
                className="rounded-md bg-brand-green px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-greenHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
              >
                Escalate to specialist
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
