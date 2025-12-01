
import React, { useState, useEffect, useRef } from 'react';
import { CallState } from '../types';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, VolumeX, Lock, ChevronUp } from 'lucide-react';

interface CallOverlayProps {
  callState: CallState;
  onEndCall: () => void;
  onAnswerCall: () => void;
  remoteStream?: MediaStream | null;
}

const CallOverlay: React.FC<CallOverlayProps> = ({ callState, onEndCall, onAnswerCall, remoteStream }) => {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callState.type === 'video');
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Timer for connected calls
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (callState.status === 'connected') {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callState.status]);

  // Attach Remote Stream (Video & Audio)
  useEffect(() => {
      if (!remoteStream) return;

      // Attach to Video Element (if video available)
      if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
      }
      
      // Attach to Audio Element (Always for voice)
      if (audioRef.current) {
          audioRef.current.srcObject = remoteStream;
          
          // CRITICAL: Ensure audio tracks are enabled
          remoteStream.getAudioTracks().forEach(track => {
              track.enabled = true;
          });
          
          // Explicitly attempt play to bypass autoplay policies
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
              playPromise.catch(e => {
                  console.warn("Audio autoplay failed - User interaction needed or stream empty?", e);
              });
          }
      }
  }, [remoteStream, callState.status]);

  // Camera Access (Local)
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      // Start camera if Active OR Connected (for both caller and receiver if video is on)
      if (callState.status !== 'ended' && (callState.type === 'video' || isVideoEnabled)) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        } catch (e) {
          console.error("Camera access failed", e);
        }
      }
    };

    if (callState.isActive) {
        startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [callState.isActive, isVideoEnabled, callState.type, callState.status]);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!callState.contact || !callState.isActive) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0b141a] text-white flex flex-col items-center justify-between py-6 sm:py-12 animate-in fade-in zoom-in-95 duration-300">
      
      {/* 
         CRITICAL FIX: Do NOT use display:none. 
         Use opacity-0 + pointer-events-none to keep it in the render tree so the browser plays audio.
      */}
      <audio 
        ref={audioRef} 
        autoPlay 
        playsInline 
        controls={false}
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
      />

      {/* Background / Remote Video */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-black">
        {callState.status === 'connected' && remoteStream && remoteStream.getVideoTracks().length > 0 ? (
            <video 
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
            />
        ) : (
            // Blurred Avatar as BG when not connected or no video
            <>
                <img 
                    src={callState.contact.avatar} 
                    className="w-full h-full object-cover blur-2xl opacity-40 scale-125" 
                    alt="bg"
                />
                <div className="absolute inset-0 bg-black/40" />
            </>
        )}
      </div>

      {/* Encrypted Label */}
      <div className="z-10 w-full text-center pt-2">
          <div className="flex items-center justify-center gap-2 text-white/70 text-xs bg-black/20 py-1 px-3 rounded-full mx-auto w-fit backdrop-blur-md">
            <Lock size={10} /> End-to-end encrypted
        </div>
      </div>

      {/* Avatar & Info (Shown when calling or audio only) */}
      {(!remoteStream || remoteStream.getVideoTracks().length === 0 || callState.type === 'audio') && (
          <div className="z-10 flex flex-col items-center gap-4 mb-auto mt-10 animate-in slide-in-from-bottom-10">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-2 border-gray-700 shadow-2xl mb-4 relative">
                <img src={callState.contact.avatar} className="w-full h-full object-cover" alt="Profile" />
                {/* Pulse effect if connected audio */}
                {callState.type === 'audio' && callState.status === 'connected' && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <div className="w-full h-full bg-teal-500/20 animate-pulse rounded-full"></div>
                    </div>
                )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-medium tracking-wide text-center px-4 drop-shadow-md">{callState.contact.name}</h2>
            <p className="text-base sm:text-lg text-white/80 font-medium drop-shadow-md">
            {callState.status === 'outgoing' && "Calling..."}
            {callState.status === 'incoming' && (callState.type === 'video' ? "Incoming video call" : "Incoming voice call")}
            {callState.status === 'connected' && formatDuration(duration)}
            {callState.status === 'ended' && "Call ended"}
            </p>
        </div>
      )}

      {/* Local Video Preview (Picture in Picture) */}
      {isVideoEnabled && callState.status !== 'ended' && (
          <div className="z-20 absolute top-20 right-4 w-24 h-36 sm:w-28 sm:h-40 bg-black rounded-xl overflow-hidden border border-gray-700 shadow-2xl transition-all hover:scale-105">
              <video 
                ref={localVideoRef} 
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover transform -scale-x-100" 
              />
          </div>
      )}

      {/* CONTROLS SECTION */}
      <div className="z-20 w-full max-w-md px-6 mb-4 sm:mb-8">
        
        {/* --- INCOMING CALL STATE --- */}
        {callState.status === 'incoming' ? (
             <div className="flex flex-col items-center w-full pb-8">
                 
                 {/* Swipe indication (Visual only) */}
                 <div className="flex flex-col items-center gap-1 mb-8 opacity-60 animate-bounce">
                    <ChevronUp size={24} />
                    <span className="text-xs font-medium">Swipe up to accept</span>
                 </div>

                 <div className="flex justify-between items-center w-full px-8">
                     {/* DECLINE */}
                     <div className="flex flex-col items-center gap-2">
                         <button 
                            onClick={onEndCall}
                            className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-transform active:scale-95"
                         >
                             <PhoneOff size={28} fill="currentColor" />
                         </button>
                         <span className="text-sm font-medium drop-shadow-md">Decline</span>
                     </div>

                     {/* ACCEPT */}
                     <div className="flex flex-col items-center gap-2">
                         <button 
                            onClick={onAnswerCall}
                            className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:bg-green-600 transition-transform active:scale-95 animate-pulse"
                         >
                             {callState.type === 'video' ? <Video size={28} fill="currentColor"/> : <Phone size={28} fill="currentColor"/>}
                         </button>
                         <span className="text-sm font-medium drop-shadow-md">Accept</span>
                     </div>
                 </div>
             </div>
        ) : (
            /* --- CONNECTED / OUTGOING STATE --- */
            <div className="bg-[#1f2c34]/90 rounded-3xl px-6 py-6 flex flex-col gap-6 shadow-2xl border border-gray-800/50 backdrop-blur-md">
                
                {/* Quick Controls Row - Visible for connected/outgoing */}
                <div className="flex justify-around items-center">
                    <button 
                        onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${isSpeakerOn ? 'text-teal-400 bg-white/10' : 'text-white hover:bg-white/5'}`}
                    >
                        <Volume2 size={28} />
                        <span className="text-[10px]">Speaker</span>
                    </button>
                    
                    <button 
                        onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${isVideoEnabled ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/5'}`}
                    >
                        {isVideoEnabled ? <Video size={28} /> : <VideoOff size={28} />}
                         <span className="text-[10px]">Video</span>
                    </button>
                    
                    <button 
                        onClick={() => setIsMuted(!isMuted)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${isMuted ? 'text-teal-400 bg-white/10' : 'text-white hover:bg-white/5'}`}
                    >
                        {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
                        <span className="text-[10px]">Mute</span>
                    </button>
                </div>
                
                {/* Main End Call Button */}
                <div className="flex justify-center pt-2">
                    <button 
                        onClick={onEndCall}
                        className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-transform hover:scale-110 active:scale-95"
                    >
                        <PhoneOff size={32} fill="currentColor" />
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default CallOverlay;
