import React, { useState, useRef } from 'react';
import { Message } from '../types';
import { Check, CheckCheck, Video, Phone, Play, Pause } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface MessageBubbleProps {
  message: Message;
  currentUserId: string;
  onLongPress: (message: Message, position: { x: number; y: number }) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, currentUserId, onLongPress }) => {
  // Check if sender is 'user-me' (legacy AI flow) OR the current real user's ID
  const isSelf = message.senderId === 'user-me' || message.senderId === currentUserId;
  
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const formatTime = (date?: Date) => {
    if (!date || isNaN(date.getTime())) return '';
    try {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    timerRef.current = setTimeout(() => {
      onLongPress(message, { x, y });
    }, 500);
  };

  const handleEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const toggleAudio = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!audioRef.current) return;
      
      if (isPlaying) {
          audioRef.current.pause();
      } else {
          audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
  };

  // --- Call Bubble ---
  if (message.type === 'video-call' || message.type === 'voice-call') {
    return (
      <div 
        className="flex justify-center mb-4 cursor-pointer select-none"
        onMouseDown={handleStart}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchEnd={handleEnd}
      >
        <div className="bg-panel-header text-text-secondary px-4 py-2 rounded-lg text-xs flex items-center gap-2 shadow-sm border border-gray-800 relative">
           {message.type === 'video-call' ? <Video size={14} /> : <Phone size={14} />}
           <span>{message.content}</span>
           <span className="opacity-60 text-[10px] ml-1">{formatTime(message.timestamp)}</span>
           {message.reaction && (
            <div className="absolute -bottom-2 -right-2 bg-panel-header rounded-full border border-app-bg px-1 shadow-md text-xs">{message.reaction}</div>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex mb-2 ${isSelf ? 'justify-end' : 'justify-start'} group`}>
      <div 
        className={`relative max-w-[85%] sm:max-w-[65%] rounded-lg shadow-sm text-sm select-none cursor-pointer transition-all active:scale-[0.98] ${
          isSelf 
            ? 'bg-outgoing-bg text-white rounded-tr-none' 
            : 'bg-incoming-bg text-text-primary rounded-tl-none'
        }`}
        onMouseDown={handleStart}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchEnd={handleEnd}
        onContextMenu={(e) => {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            onLongPress(message, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        }}
      >
        <div className="px-2 pt-1 pb-1">
             
             {/* CONTENT TYPES */}
             
             {/* IMAGE */}
             {message.type === 'image' && (
                 <div className="mb-1 rounded overflow-hidden max-h-64 max-w-full">
                     <img src={message.content} alt="Attachment" className="object-cover w-full h-full" />
                 </div>
             )}

             {/* AUDIO */}
             {message.type === 'audio' && (
                 <div className="flex items-center gap-3 min-w-[200px] py-2">
                     <button onClick={toggleAudio} className="p-2 bg-black/20 rounded-full hover:bg-black/30">
                         {isPlaying ? <Pause size={20}/> : <Play size={20}/>}
                     </button>
                     <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                         <div className={`h-full bg-white/80 ${isPlaying ? 'animate-pulse w-full' : 'w-1/2'}`}></div>
                     </div>
                     <audio 
                        ref={audioRef} 
                        src={message.content} 
                        onEnded={() => setIsPlaying(false)}
                        className="hidden"
                     />
                     <span className="text-xs opacity-70">Voice</span>
                 </div>
             )}

             {/* TEXT */}
             {message.type === 'text' && (
                 <div className="inline-block whitespace-pre-wrap break-words markdown-content align-middle">
                     <ReactMarkdown components={{
                        p: ({node, ...props}) => <span {...props} />,
                        a: ({node, ...props}) => <a className="text-blue-400 underline" target="_blank" {...props} />,
                        code: ({node, ...props}) => <code className="bg-black/20 rounded px-1" {...props} />,
                    }}>{message.content}</ReactMarkdown>
                 </div>
             )}
             
             {/* Timestamp */}
             <div className="float-right ml-3 mt-1 relative top-1 flex items-center space-x-1 h-4 select-none">
                <span className="text-[10px] text-white/60 whitespace-nowrap">{formatTime(message.timestamp)}</span>
                {isSelf && (
                    <span className={message.status === 'read' ? 'text-blue-300' : 'text-gray-300'}>
                    {message.status === 'read' ? <CheckCheck size={14} /> : <Check size={14} />}
                    </span>
                )}
             </div>
        </div>

        {/* Tail */}
        <div className={`absolute top-0 w-0 h-0 border-[6px] border-transparent ${
            isSelf 
                ? '-right-[10px] border-l-outgoing-bg border-t-outgoing-bg' 
                : '-left-[10px] border-r-incoming-bg border-t-incoming-bg'
        }`}></div>

        {/* Reaction */}
        {message.reaction && (
          <div className={`absolute -bottom-3 ${isSelf ? 'left-0' : 'right-0'} bg-panel-header rounded-full border-2 border-app-bg px-1.5 py-0.5 shadow-md text-xs z-10 scale-100 animate-in zoom-in duration-200`}>
            {message.reaction}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;