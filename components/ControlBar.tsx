import React from 'react';
import { Mic, MicOff, Monitor, MonitorOff, PhoneOff, MessageSquare, MoreVertical, Info } from 'lucide-react';

interface ControlBarProps {
  isMicOn: boolean;
  isScreenSharing: boolean;
  isChatOpen: boolean;
  onToggleMic: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isMicOn,
  isScreenSharing,
  isChatOpen,
  onToggleMic,
  onToggleScreenShare,
  onToggleChat,
}) => {
  return (
    <div className="h-20 bg-[#202124] flex items-center justify-between px-6 shrink-0 relative z-50">
      {/* Left info (Time/Code) */}
      <div className="hidden md:flex items-center text-white min-w-[200px]">
        <span className="font-medium text-lg">Gemini Pair</span>
        <span className="mx-2 text-gray-400">|</span>
        <span className="text-gray-400 text-sm">gem-ini-dev</span>
      </div>

      {/* Center Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleMic}
          className={`p-4 rounded-full transition-colors ${
            isMicOn ? 'bg-[#3c4043] hover:bg-[#4a4f54] text-white' : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
          title={isMicOn ? "Turn off microphone" : "Turn on microphone"}
        >
          {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
        </button>

        <button
          onClick={onToggleScreenShare}
          className={`p-4 rounded-full transition-colors ${
            isScreenSharing ? 'bg-[#8ab4f8] text-gray-900 hover:bg-[#aecbfa]' : 'bg-[#3c4043] hover:bg-[#4a4f54] text-white'
          }`}
          title="Present now"
        >
          {isScreenSharing ? <Monitor size={24} /> : <MonitorOff size={24} />}
        </button>

        <button className="p-4 rounded-full bg-[#3c4043] hover:bg-[#4a4f54] text-white hidden sm:block">
          <MoreVertical size={24} />
        </button>

        <button
          className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white px-6 w-16 flex justify-center items-center ml-2"
          title="Leave call"
        >
          <PhoneOff size={24} fill="currentColor" />
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center justify-end gap-3 min-w-[200px]">
        <button className="p-3 rounded-full hover:bg-[#3c4043] text-white hidden sm:block">
          <Info size={24} />
        </button>
        <button
          onClick={onToggleChat}
          className={`p-3 rounded-full hover:bg-[#3c4043] text-white ${isChatOpen ? 'text-[#8ab4f8]' : ''}`}
          title="Chat with everyone"
        >
          <MessageSquare size={24} fill={isChatOpen ? "currentColor" : "none"} />
        </button>
      </div>
    </div>
  );
};
