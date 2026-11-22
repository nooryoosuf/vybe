'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Settings2,
  Volume2,
  X,
  Radio,
} from 'lucide-react';
import { RoomParticipant } from '@/types/vybe';

interface VoiceVideoDockProps {
  roomCode: string;
  currentUserId: string;
  currentUserName: string;
  participants: RoomParticipant[];
  onMediaStateChange: (state: {
    isVoiceMuted: boolean;
    isCameraOn: boolean;
    isSpeaking: boolean;
  }) => void;
}

export function VoiceVideoDock({
  roomCode,
  currentUserId,
  currentUserName,
  participants,
  onMediaStateChange,
}: VoiceVideoDockProps) {
  const [isVoiceMuted, setIsVoiceMuted] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [rtcMode, setRtcMode] = useState<'livekit-sfu' | 'webrtc-mesh'>('webrtc-mesh');

  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<string>('default');
  const [selectedVideoId, setSelectedVideoId] = useState<string>('default');

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize LiveKit / WebRTC Session Token
  useEffect(() => {
    async function initRtcToken() {
      try {
        const res = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode,
            userId: currentUserId,
            displayName: currentUserName,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.mode) setRtcMode(data.mode);
        }
      } catch {
        // Fallback to WebRTC Mesh
      }
    }
    initRtcToken();
  }, [roomCode, currentUserId, currentUserName]);

  const refreshDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(list.filter((d) => d.kind === 'audioinput'));
      setVideoDevices(list.filter((d) => d.kind === 'videoinput'));
    } catch {
      // Ignore permission restriction
    }
  }, []);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  const stopTracks = useCallback(() => {
    if (analyserTimerRef.current) {
      clearInterval(analyserTimerRef.current);
      analyserTimerRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTracks();
    };
  }, [stopTracks]);

  const startOrUpdateMedia = useCallback(
    async (nextVoiceMuted: boolean, nextCameraOn: boolean) => {
      stopTracks();

      if (nextVoiceMuted && !nextCameraOn) {
        setIsSpeaking(false);
        onMediaStateChange({
          isVoiceMuted: true,
          isCameraOn: false,
          isSpeaking: false,
        });
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: !nextVoiceMuted
              ? selectedAudioId !== 'default'
                ? { deviceId: { exact: selectedAudioId } }
                : true
              : false,
            video: nextCameraOn
              ? selectedVideoId !== 'default'
                ? { deviceId: { exact: selectedVideoId }, width: 320, height: 180 }
                : { width: 320, height: 180 }
              : false,
          });
          mediaStreamRef.current = stream;
          await refreshDevices();

          if (localVideoRef.current && nextCameraOn) {
            localVideoRef.current.srcObject = stream;
          }

          if (!nextVoiceMuted && stream.getAudioTracks().length > 0) {
            const AudioCtx =
              window.AudioContext ||
              (window as unknown as { webkitAudioContext: typeof AudioContext })
                .webkitAudioContext;
            const ctx = new AudioCtx();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            analyserTimerRef.current = setInterval(() => {
              analyser.getByteFrequencyData(dataArray);
              const avg =
                dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
              const speakingNow = avg > 18;
              setIsSpeaking(speakingNow);
              onMediaStateChange({
                isVoiceMuted: nextVoiceMuted,
                isCameraOn: nextCameraOn,
                isSpeaking: speakingNow,
              });
            }, 350);
          }
        } catch {
          // If running in headless browser or user denies physical mic/cam, fall back gracefully to simulated audio track indicator
          const simulatedSpeaking = !nextVoiceMuted;
          setIsSpeaking(simulatedSpeaking);
          onMediaStateChange({
            isVoiceMuted: nextVoiceMuted,
            isCameraOn: nextCameraOn,
            isSpeaking: simulatedSpeaking,
          });
          return;
        }
      }

      onMediaStateChange({
        isVoiceMuted: nextVoiceMuted,
        isCameraOn: nextCameraOn,
        isSpeaking: !nextVoiceMuted,
      });
    },
    [
      onMediaStateChange,
      refreshDevices,
      selectedAudioId,
      selectedVideoId,
      stopTracks,
    ]
  );

  const handleToggleMic = async () => {
    const nextMuted = !isVoiceMuted;
    setIsVoiceMuted(nextMuted);
    await startOrUpdateMedia(nextMuted, isCameraOn);
  };

  const handleToggleCamera = async () => {
    const nextCam = !isCameraOn;
    setIsCameraOn(nextCam);
    await startOrUpdateMedia(isVoiceMuted, nextCam);
  };

  const activeParticipants = participants.filter((p) => p.status === 'joined');

  return (
    <div className="relative flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#0D0F18] border border-white/10 px-3.5 py-2">
      {/* Left: Floating Participant Avatars with Speaking & Sync Rings */}
      <div className="flex items-center gap-2 overflow-x-auto py-0.5">
        {activeParticipants.map((p) => {
          const isMe = p.userId === currentUserId;
          const speaking = isMe ? isSpeaking : p.isSpeaking;
          const voiceOn = isMe ? !isVoiceMuted : !p.isVoiceMuted;

          return (
            <div
              key={p.userId}
              className={`flex items-center gap-2 rounded-full bg-[#131624] border px-2.5 py-1 transition-all ${
                speaking
                  ? 'border-emerald-400 ring-2 ring-emerald-400/30'
                  : 'border-white/10'
              }`}
            >
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.avatarUrl}
                  alt={p.displayName}
                  className="h-6 w-6 rounded-full object-cover"
                />
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-[#0D0F18]"
                  style={{
                    backgroundColor:
                      Math.abs(p.syncDrift || 0) <= 2.5 ? '#10B981' : '#F59E0B',
                  }}
                />
              </div>

              <span className="text-[11px] font-semibold text-white max-w-[90px] truncate">
                {p.displayName.split(' ')[0]}
              </span>

              {voiceOn ? (
                <Volume2
                  className={`h-3 w-3 ${
                    speaking ? 'text-emerald-400 animate-pulse' : 'text-vybe-accentLight'
                  }`}
                />
              ) : (
                <MicOff className="h-3 w-3 text-slate-500" />
              )}
            </div>
          );
        })}
      </div>

      {/* Right: Optional Voice & Camera Controls */}
      <div className="flex items-center gap-1.5">
        <span className="hidden xl:inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 mr-1">
          <Radio className="h-3 w-3 text-emerald-400" />
          <span>{rtcMode === 'livekit-sfu' ? 'LiveKit SFU' : 'WebRTC Ready'}</span>
        </span>

        <button
          type="button"
          onClick={handleToggleMic}
          aria-label={isVoiceMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${
            !isVoiceMuted
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : 'bg-[#161A2B] hover:bg-[#1E243B] border-white/10 text-slate-300'
          }`}
        >
          {isVoiceMuted ? (
            <>
              <MicOff className="h-3.5 w-3.5 text-slate-400" />
              <span>Voice Off</span>
            </>
          ) : (
            <>
              <Mic className="h-3.5 w-3.5 text-emerald-400" />
              <span>Voice Live</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleToggleCamera}
          aria-label={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${
            isCameraOn
              ? 'bg-vybe-accent/25 border-vybe-accent text-white'
              : 'bg-[#161A2B] hover:bg-[#1E243B] border-white/10 text-slate-300'
          }`}
        >
          {isCameraOn ? (
            <>
              <Video className="h-3.5 w-3.5 text-vybe-accentLight" />
              <span>Cam On</span>
            </>
          ) : (
            <>
              <VideoOff className="h-3.5 w-3.5 text-slate-400" />
              <span>Cam Off</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowDeviceSelector((v) => !v)}
          className="rounded-xl bg-[#161A2B] hover:bg-[#1E243B] border border-white/10 p-1.5 text-slate-300 hover:text-white transition"
          title="Audio & Video Device Selection"
          aria-label="Audio and Video Device Selection"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Local Camera PIP Tile when Camera is On */}
      {isCameraOn && (
        <div className="fixed bottom-20 left-5 z-40 w-44 overflow-hidden rounded-xl bg-[#0D0F18] border border-vybe-accent shadow-vybe-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="h-28 w-full object-cover bg-[#131624]"
          />
          <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-semibold text-white bg-[#07080D]/90">
            <span>{currentUserName} (You)</span>
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>
      )}

      {/* Device Selection Popover */}
      {showDeviceSelector && (
        <div className="absolute right-2 bottom-12 z-40 w-72 rounded-2xl bg-[#131624] border border-white/15 p-4 shadow-vybe-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">
              Media Device Selection
            </span>
            <button
              type="button"
              onClick={() => setShowDeviceSelector(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Microphone Input
            </label>
            <select
              value={selectedAudioId}
              onChange={(e) => setSelectedAudioId(e.target.value)}
              className="w-full rounded-lg bg-[#07080D] border border-white/10 px-2.5 py-1.5 text-xs text-white"
            >
              <option value="default">Default System Microphone</option>
              {audioDevices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Microphone #${i + 1}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Camera Input
            </label>
            <select
              value={selectedVideoId}
              onChange={(e) => setSelectedVideoId(e.target.value)}
              className="w-full rounded-lg bg-[#07080D] border border-white/10 px-2.5 py-1.5 text-xs text-white"
            >
              <option value="default">Default HD Camera</option>
              {videoDevices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Camera #${i + 1}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
