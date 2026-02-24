'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { trackDemoEvent } from '@/lib/client/trackEvent';

interface AiVideoAgentModalProps {
  open: boolean;
  question: string;
  onClose: () => void;
  onEscalateToSpecialist: () => void;
}

const followUpOptions = ['Show me a 30-day plan', 'What should I validate first?', 'When should I escalate this?'] as const;
const realtimeFeatureEnabled = process.env.NEXT_PUBLIC_ENABLE_REALTIME_AGENT === 'true';

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

type RealtimeStatus = 'prototype' | 'connecting' | 'live' | 'fallback';
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

type TranscriptRole = 'assistant' | 'user' | 'system';

interface TranscriptMessage {
  id: string;
  role: TranscriptRole;
  text: string;
}

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

const initialAssistantLine = 'I can help triage this quickly and suggest a practical next step for your deal or operating team.';

class RealtimeFlowError extends Error {
  stageHint: RealtimeFailureStage;
  uiDetail?: string;

  constructor(stageHint: RealtimeFailureStage, message: string, uiDetail?: string) {
    super(message);
    this.stageHint = stageHint;
    this.uiDetail = uiDetail;
  }
}

function createMessage(role: TranscriptRole, text: string): TranscriptMessage {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return { id, role, text };
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

  if (typeof data.transcript === 'string' && data.transcript.trim()) {
    return data.transcript.trim();
  }
  if (typeof data.text === 'string' && data.text.trim()) {
    return data.text.trim();
  }

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

export function AiVideoAgentModal({ open, question, onClose, onEscalateToSpecialist }: AiVideoAgentModalProps) {
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([createMessage('assistant', initialAssistantLine)]);
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('prototype');
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('prototype');
  const [realtimeMessage, setRealtimeMessage] = useState('Prototype transcript mode is active.');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [hasCameraPreview, setHasCameraPreview] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);

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

  const appendMessage = (role: TranscriptRole, text: string) => {
    setTranscript((prev) => [...prev, createMessage(role, text)]);
  };

  const clearTranscript = () => {
    setTranscript([createMessage('assistant', initialAssistantLine)]);
  };

  const cleanupRealtime = () => {
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
  };

  const switchToFallbackMode = (stage: RealtimeFailureStage, detail?: string) => {
    cleanupRealtime();
    setRealtimeStatus('fallback');
    setSessionPhase('fallback');
    setRealtimeMessage(buildRealtimeFallbackMessage(stage, detail));
    trackDemoEvent('fallback_triggered', { stage });
  };

  const handleCloseModal = () => {
    cleanupRealtime();
    onClose();
  };

  const handleStartRealtimeSession = async () => {
    if (realtimeStatus === 'connecting' || realtimeStatus === 'live') return;

    if (!realtimeFeatureEnabled) {
      console.info('[AiVideoAgentModal][realtime] feature flag disabled');
      switchToFallbackMode('feature flag disabled');
      return;
    }

    if (typeof window === 'undefined' || !window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
      console.info('[AiVideoAgentModal][realtime] browser unsupported');
      switchToFallbackMode('browser unsupported');
      return;
    }

    console.info('[AiVideoAgentModal][realtime] connect requested');
    trackDemoEvent('agent_started', { source: 'ai-video-modal' });
    setRealtimeStatus('connecting');
    setSessionPhase('connecting');
    setRealtimeMessage('Requesting microphone access and connecting to AI...');

    try {
      console.info('[AiVideoAgentModal][realtime] requesting microphone permission');
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
      console.info('[AiVideoAgentModal][realtime] microphone stream acquired', {
        audioTracks: micStream.getAudioTracks().length
      });

      console.info('[AiVideoAgentModal][realtime] requesting ephemeral session');
      const sessionResponse = await fetch('/api/realtime-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() })
      });
      const sessionData = (await sessionResponse.json()) as RealtimeSessionSuccess | RealtimeSessionFailure;

      if (!sessionResponse.ok || !sessionData.ok) {
        const stageHint =
          !sessionData.ok && sessionData.stage === 'token_parse'
            ? 'token parse failed'
            : !sessionData.ok && sessionData.stage === 'session_setup'
              ? 'session setup failed'
              : !sessionData.ok && sessionData.stage === 'env'
                ? 'session setup failed'
                : 'session setup failed';
        const detail = !sessionData.ok ? sessionData.error : 'Session endpoint returned an unexpected payload.';
        throw new RealtimeFlowError(stageHint, `Realtime session endpoint failed with status ${sessionResponse.status}.`, detail);
      }

      if (!sessionData.clientSecret || !sessionData.model) {
        throw new RealtimeFlowError('token parse failed', 'Realtime session payload did not include required fields.');
      }

      console.info('[AiVideoAgentModal][realtime] session received', {
        hasClientSecret: Boolean(sessionData.clientSecret),
        model: sessionData.model,
        voice: sessionData.voice
      });

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
      console.info('[AiVideoAgentModal][realtime] microphone track attached to peer connection', {
        audioTracks: audioTracks.length
      });

      peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        console.info('[AiVideoAgentModal][realtime] received remote track', {
          hasStream: Boolean(remoteStream),
          trackCount: remoteStream?.getTracks().length ?? 0
        });
        if (remoteStream && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.play().catch(() => undefined);
        }
      };

      peerConnection.onconnectionstatechange = () => {
        console.info('[AiVideoAgentModal][realtime] connection state changed', {
          state: peerConnection.connectionState
        });
        if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
          switchToFallbackMode('webrtc setup failed', 'Connection dropped.');
        }
      };

      const dataChannel = peerConnection.createDataChannel('oai-events');
      dataChannelRef.current = dataChannel;
      console.info('[AiVideoAgentModal][realtime] data channel created');

      dataChannel.onopen = () => {
        console.info('[AiVideoAgentModal][realtime] data channel open');
        setRealtimeStatus('live');
        setSessionPhase('listening');
        setRealtimeMessage('Live audio connected. Speak naturally to the AI agent.');
        appendMessage('assistant', 'Live audio is connected. I am ready for your follow-up.');
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
            appendMessage('assistant', text);
            setSessionPhase('listening');
          }
        } catch {
          // Ignore non-JSON realtime events.
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      console.info('[AiVideoAgentModal][realtime] local offer created');

      // WebRTC handshake remains sensitive to model/account/browser compatibility, so transcript fallback stays enabled.
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
      console.info('[AiVideoAgentModal][realtime] remote SDP applied');

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
    if (isCameraLoading || hasCameraPreview || !navigator.mediaDevices?.getUserMedia) return;

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

    appendMessage('user', option);

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
      const combinedQuestion = question.trim() ? `${question.trim()} Follow-up: ${option}` : option;

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
      appendMessage('assistant', data.answer);
      appendMessage('system', `Next step: ${data.recommendedNextStep}`);
      setSessionPhase(realtimeStatus === 'live' ? 'listening' : realtimeStatus === 'fallback' ? 'fallback' : 'prototype');
    } catch (error) {
      console.error('[AiVideoAgentModal] Failed to fetch follow-up response:', error);
      setSessionPhase('responding');
      appendMessage('assistant', followUpResponses[option]);
      setSessionPhase(realtimeStatus === 'fallback' ? 'fallback' : 'prototype');
    } finally {
      setIsFollowUpLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      cleanupRealtime();
      setTranscript([createMessage('assistant', initialAssistantLine)]);
      setIsFollowUpLoading(false);
      setRealtimeStatus('prototype');
      setSessionPhase('prototype');
      setRealtimeMessage('Prototype transcript mode is active.');
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseModal();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    const container = transcriptScrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [transcript, isFollowUpLoading]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4" onClick={handleCloseModal} role="presentation">
      <div
        className="flex w-full max-w-4xl max-h-[92vh] flex-col overflow-hidden rounded-xl border border-brand-line bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-video-title"
      >
        <div className="shrink-0 border-b border-brand-line bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 id="ai-video-title" className="text-xl font-medium text-brand-ink">
                Start AI video agent (2 min)
              </h3>
              <p className="mt-1.5 text-sm leading-[1.5] text-brand-muted">
                Ask a quick follow-up and get a guided PE-focused recommendation before escalating to a specialist.
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
                    isActive
                      ? 'border-brand-green bg-brand-greenTint text-brand-ink'
                      : 'border-brand-line bg-white text-brand-muted'
                  }`}
                >
                  {badge.label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <div className="grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
            <div className="rounded-md border border-brand-line bg-brand-panel p-4">
              <div className="relative overflow-hidden rounded-md border border-brand-line bg-[#1f2520] aspect-[16/10]">
                {hasCameraPreview ? <video ref={videoElementRef} className="h-full w-full object-cover" autoPlay muted playsInline /> : null}
                <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      realtimeStatus === 'live' ? 'bg-[#71e440] animate-pulse' : realtimeStatus === 'connecting' ? 'bg-[#d9e85f]' : 'bg-slate-300'
                    }`}
                  />
                  <span>
                    {realtimeStatus === 'live'
                      ? 'AI Agent • Live'
                      : realtimeStatus === 'connecting'
                        ? 'AI Agent • Connecting'
                        : realtimeStatus === 'fallback'
                          ? 'AI Agent • Fallback'
                          : 'AI Agent • Prototype'}
                  </span>
                </div>
                <div className="absolute left-3 top-10 text-[11px] text-slate-200">
                  {isAiSpeaking ? 'PE triage mode • Responding' : 'PE triage mode'}
                </div>
                <div className="absolute bottom-3 left-3 flex items-end gap-1.5">
                  <span className={`h-2 w-1 rounded ${realtimeStatus === 'live' ? 'bg-[#9fd67b] animate-pulse' : 'bg-[#5f6f62]'}`} />
                  <span className={`h-4 w-1 rounded ${realtimeStatus === 'live' ? 'bg-[#9fd67b] animate-pulse [animation-delay:120ms]' : 'bg-[#5f6f62]'}`} />
                  <span className={`h-3 w-1 rounded ${realtimeStatus === 'live' ? 'bg-[#9fd67b] animate-pulse [animation-delay:240ms]' : 'bg-[#5f6f62]'}`} />
                  <span className={`h-5 w-1 rounded ${realtimeStatus === 'live' ? 'bg-[#9fd67b] animate-pulse [animation-delay:360ms]' : 'bg-[#5f6f62]'}`} />
                </div>
              </div>

              <div className="mt-3 rounded-md border border-brand-line bg-white p-3">
                <p className="text-xs font-medium uppercase tracking-[0.1em] text-brand-muted">Original question</p>
                <p className="mt-1 text-sm leading-[1.5] text-brand-ink">
                  {question.trim() || 'No question provided. Return to the triage panel to add context.'}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleStartRealtimeSession}
                  disabled={realtimeStatus === 'connecting' || realtimeStatus === 'live'}
                  className="rounded-md bg-brand-green px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-greenHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:bg-[#89b86a]"
                >
                  {realtimeStatus === 'live'
                    ? 'Audio connected'
                    : realtimeStatus === 'connecting'
                      ? 'Connecting audio...'
                      : 'Connect audio'}
                </button>
                <button
                  type="button"
                  onClick={handleEnableCameraPreview}
                  disabled={isCameraLoading || hasCameraPreview}
                  className="rounded-md border border-brand-line bg-white px-3.5 py-2 text-xs font-medium text-brand-muted transition-colors hover:bg-brand-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {hasCameraPreview ? 'Camera preview on' : isCameraLoading ? 'Enabling camera...' : 'Enable camera preview'}
                </button>
              </div>
              <p className="mt-2 text-xs text-brand-muted">{realtimeMessage}</p>
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
                className="mt-3 flex-1 min-h-[220px] max-h-[40vh] overflow-y-auto rounded-md border border-dashed border-brand-line bg-brand-panel p-3"
                aria-live="polite"
              >
                {transcript.map((message) => (
                  <div key={message.id} className={`mb-2.5 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[92%] rounded-md px-3 py-2 text-sm leading-[1.5] ${
                        message.role === 'user'
                          ? 'border border-brand-greenLine bg-brand-greenTint text-brand-ink'
                          : message.role === 'system'
                            ? 'border border-brand-line bg-white text-brand-muted text-[13px]'
                            : 'border border-brand-line bg-white text-brand-ink'
                      }`}
                    >
                      {message.role === 'system' ? <span className="font-medium">Note: </span> : null}
                      {message.text}
                    </div>
                  </div>
                ))}
                {isFollowUpLoading ? (
                  <p className="mt-1 text-sm text-brand-muted">AI Agent: Reviewing your follow-up...</p>
                ) : null}
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
