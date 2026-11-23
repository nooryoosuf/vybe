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

  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<string>('default');
  const [selectedVideoId, setSelectedVideoId] = useState<string>('default');

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(list.filter((d) => d.kind === 'audioinput'));
      setVideoDevices(list.filter((d) => d.kind === 'videoinput'));
    } catch {
      // Ignore
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
    <div className="relative flex items-center gap-1.5 shrink-0">
      {/* Compact Avatar Stack on Desktop */}
      <div className="hidden md:flex items-center -space-x-1.5 mr-1">
        {activeParticipants.slice(0, 4).map((p) => {
          const isMe = p.userId === currentUserId;
          const speaking = isMe ? isSpeaking : p.isSpeaking;
          return (
            <div
              key={p.userId}
              title={`${p.displayName} (${p.role})`}
              className={`relative h-6 w-6 rounded-full overflow-hidden ring-2 ${
                speaking ? 'ring-emerald-400' : 'ring-[#07080D]'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.avatarUrl}
                alt={p.displayName}
                className="h-full w-full object-cover"
              />
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleToggleMic}
        aria-label={isVoiceMuted ? 'Unmute microphone' : 'Mute microphone'}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold border transition ${
          !isVoiceMuted
            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            : 'vybe-glass-pill text-slate-300'
        }`}
      >
        {isVoiceMuted ? (
          <MicOff className="h-3 w-3 text-slate-400" />
        ) : (
          <Volume2 className="h-3 w-3 text-emerald-400 animate-pulse" />
        )}
        <span className="hidden sm:inline">{isVoiceMuted ? 'Mic' : 'Live'}</span>
      </button>

      <button
        type="button"
        onClick={handleToggleCamera}
        aria-label={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold border transition ${
          isCameraOn
            ? 'bg-vybe-accent/25 border-vybe-accent text-white'
            : 'vybe-glass-pill text-slate-300'
        }`}
      >
        {isCameraOn ? (
          <Video className="h-3 w-3 text-vybe-accentLight" />
        ) : (
          <VideoOff className="h-3 w-3 text-slate-400" />
        )}
        <span className="hidden sm:inline">Cam</span>
      </button>

      <button
        type="button"
        onClick={() => setShowDeviceSelector((v) => !v)}
        className="rounded-full vybe-glass-pill p-1.5 text-slate-300 hover:text-white transition"
        title="Audio & Video Devices"
        aria-label="Audio and Video Device Selection"
      >
        <Settings2 className="h-3 w-3" />
      </button>

      {isCameraOn && (
        <div className="fixed bottom-16 left-4 z-40 w-36 overflow-hidden rounded-2xl bg-[#0D0F18] border border-vybe-accent shadow-vybe-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="h-24 w-full object-cover bg-[#131624]"
          />
          <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold text-white bg-[#07080D]/90">
            <span className="truncate">{currentUserName}</span>
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          </div>
        </div>
      )}

      {showDeviceSelector && (
        <div className="absolute right-0 bottom-10 z-50 w-64 rounded-2xl bg-[#131624] border border-white/15 p-3.5 shadow-vybe-lg space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">Media Devices</span>
            <button
              type="button"
              onClick={() => setShowDeviceSelector(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-slate-400 mb-1">
              Microphone
            </label>
            <select
              value={selectedAudioId}
              onChange={(e) => setSelectedAudioId(e.target.value)}
              className="w-full rounded-lg bg-[#07080D] border border-white/10 px-2 py-1 text-xs text-white"
            >
              <option value="default">Default Microphone</option>
              {audioDevices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Microphone #${i + 1}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-slate-400 mb-1">
              Camera
            </label>
            <select
              value={selectedVideoId}
              onChange={(e) => setSelectedVideoId(e.target.value)}
              className="w-full rounded-lg bg-[#07080D] border border-white/10 px-2 py-1 text-xs text-white"
            >
              <option value="default">Default Camera</option>
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
