'use client';

import { useEffect, useRef, useState } from 'react';

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
}

type RealtimeStatus = 'prototype' | 'connecting' | 'live' | 'fallback';

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
  const [transcript, setTranscript] = useState<string[]>([
    'AI Agent: I can help triage this quickly and suggest a practical next step for your deal or operating team.'
  ]);
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('prototype');
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

  const appendTranscript = (line: string) => {
    setTranscript((prev) => [...prev, line]);
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

  const switchToFallbackMode = (message: string) => {
    cleanupRealtime();
    setRealtimeStatus('fallback');
    setRealtimeMessage(message);
  };

  const handleStartRealtimeSession = async () => {
    if (realtimeStatus === 'connecting' || realtimeStatus === 'live') return;

    if (!realtimeFeatureEnabled) {
      switchToFallbackMode('Realtime mode is disabled by feature flag. Using prototype mode.');
      return;
    }

    if (typeof window === 'undefined' || !window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
      switchToFallbackMode('Realtime mode is unavailable in this browser. Using prototype mode.');
      return;
    }

    setRealtimeStatus('connecting');
    setRealtimeMessage('Requesting microphone access and connecting to AI...');

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneStreamRef.current = micStream;

      const sessionResponse = await fetch('/api/realtime-session', { method: 'POST' });
      const sessionData = (await sessionResponse.json()) as RealtimeSessionSuccess | RealtimeSessionFailure;

      if (!sessionResponse.ok || !sessionData.ok) {
        throw new Error(sessionData.ok ? 'Realtime session request failed.' : sessionData.error);
      }

      const peerConnection = new RTCPeerConnection();
      peerConnectionRef.current = peerConnection;

      const remoteAudio = new Audio();
      remoteAudio.autoplay = true;
      remoteAudioRef.current = remoteAudio;

      micStream.getAudioTracks().forEach((track) => peerConnection.addTrack(track, micStream));

      peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.play().catch(() => undefined);
        }
      };

      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
          switchToFallbackMode('Realtime connection dropped. Continuing in prototype mode.');
        }
      };

      const dataChannel = peerConnection.createDataChannel('oai-events');
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        setRealtimeStatus('live');
        setRealtimeMessage('Live audio connected. Speak naturally to the AI agent.');
        appendTranscript('AI Agent: Live audio is connected. I am ready for your follow-up.');
      };

      dataChannel.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as Record<string, unknown>;
          const eventType = typeof payload.type === 'string' ? payload.type : '';

          if (eventType.includes('audio')) {
            setIsAiSpeaking(true);
            if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
            speakingTimerRef.current = setTimeout(() => setIsAiSpeaking(false), 400);
          }

          const text = extractRealtimeText(payload);
          if (text && (eventType.endsWith('.done') || eventType === 'response.done')) {
            appendTranscript(`AI Agent: ${text}`);
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
        throw new Error(`Realtime SDP handshake failed: ${errorText.slice(0, 160)}`);
      }

      const answerSdp = await sdpResponse.text();
      await peerConnection.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    } catch (error) {
      console.error('[AiVideoAgentModal] Realtime session failed:', error);
      switchToFallbackMode('Realtime mode unavailable, using prototype mode.');
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

    setTranscript((prev) => [...prev, `You: ${option}`]);

    if (realtimeStatus === 'live' && dataChannelRef.current?.readyState === 'open') {
      try {
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

      setTranscript((prev) => [...prev, `AI Agent: ${data.answer}`, `AI Agent Next step: ${data.recommendedNextStep}`]);
    } catch (error) {
      console.error('[AiVideoAgentModal] Failed to fetch follow-up response:', error);
      setTranscript((prev) => [...prev, `AI Agent: ${followUpResponses[option]}`]);
    } finally {
      setIsFollowUpLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      cleanupRealtime();
      setTranscript(['AI Agent: I can help triage this quickly and suggest a practical next step for your deal or operating team.']);
      setIsFollowUpLoading(false);
      setRealtimeStatus('prototype');
      setRealtimeMessage('Prototype transcript mode is active.');
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4"
      onClick={() => {
        cleanupRealtime();
        onClose();
      }}
      role="presentation"
    >
      <div
        className="w-full max-w-3xl rounded-xl border border-brand-line bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-video-title"
      >
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
            onClick={() => {
              cleanupRealtime();
              onClose();
            }}
            className="rounded-sm border border-brand-line px-2 py-1 text-xs text-brand-muted transition hover:bg-brand-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
            aria-label="Close AI video agent modal"
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-md border border-brand-line bg-brand-panel p-4">
            <div className="relative overflow-hidden rounded-md border border-brand-line bg-[#1f2520] aspect-[16/10]">
              {hasCameraPreview ? (
                <video ref={videoElementRef} className="h-full w-full object-cover" autoPlay muted playsInline />
              ) : null}
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
                      : 'AI Agent • Prototype'}
                </span>
              </div>
              <div className="absolute left-3 top-10 text-[11px] text-slate-200">
                {isAiSpeaking ? 'PE triage mode • Speaking' : 'PE triage mode'}
              </div>
              <div className="absolute bottom-3 left-3 flex items-end gap-1.5">
                <span className={`h-2 w-1 rounded ${realtimeStatus === 'live' ? 'bg-[#9fd67b] animate-pulse' : 'bg-[#5f6f62]'}`} />
                <span
                  className={`h-4 w-1 rounded ${realtimeStatus === 'live' ? 'bg-[#9fd67b] animate-pulse [animation-delay:120ms]' : 'bg-[#5f6f62]'}`}
                />
                <span
                  className={`h-3 w-1 rounded ${realtimeStatus === 'live' ? 'bg-[#9fd67b] animate-pulse [animation-delay:240ms]' : 'bg-[#5f6f62]'}`}
                />
                <span
                  className={`h-5 w-1 rounded ${realtimeStatus === 'live' ? 'bg-[#9fd67b] animate-pulse [animation-delay:360ms]' : 'bg-[#5f6f62]'}`}
                />
              </div>
            </div>

            <div className="mt-3 rounded-md border border-brand-line bg-white p-3">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-brand-muted">Your question</p>
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
            {realtimeStatus === 'fallback' ? (
              <p className="mt-1 text-[11px] text-brand-muted">Realtime mode unavailable, continuing in prototype transcript mode.</p>
            ) : null}
          </div>

          <div className="rounded-md border border-brand-line bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-brand-muted">Suggested follow-ups</p>
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

            <div className="mt-3 min-h-[170px] rounded-md border border-dashed border-brand-line bg-brand-panel p-3 text-sm leading-[1.55] text-brand-muted" aria-live="polite">
              {transcript.map((line, index) => (
                <p key={`${line}-${index}`} className={index > 0 ? 'mt-2' : undefined}>
                  {line}
                </p>
              ))}
              {isFollowUpLoading ? <p className="mt-2 text-brand-muted/90">AI Agent: Reviewing your follow-up...</p> : null}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => {
              cleanupRealtime();
              onClose();
            }}
            className="rounded-md border border-brand-line px-4 py-2.5 text-[13px] font-medium text-brand-muted transition-colors hover:bg-brand-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
          >
            End session
          </button>
          <button
            type="button"
            onClick={onEscalateToSpecialist}
            className="rounded-md bg-brand-green px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-greenHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
          >
            Escalate to specialist
          </button>
        </div>
      </div>
    </div>
  );
}
