import React, { useEffect, useRef } from 'react';
import { Message } from '../types';
import { X, Send, Sparkles, Copy } from 'lucide-react';

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  isProcessing: boolean;
  onSendMessage: (text: string) => void;
  inputValue: string;
  onInputChange: (value: string) => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({ 
  isOpen, 
  onClose, 
  messages, 
  isProcessing,
  onSendMessage,
  inputValue,
  onInputChange
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  const handleSend = () => {
    if (inputValue.trim() && !isProcessing) {
      onSendMessage(inputValue);
      onInputChange(""); // Clear input after manual send
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Simple parser to render Code Blocks nicely
  const formatMessage = (text: string) => {
    // Split text by markdown code blocks (```...```)
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      // Check if this part is a code block
      if (part.startsWith('```') && part.endsWith('```')) {
        // Remove the backticks and optional language identifier (e.g. ```typescript\n)
        const content = part.slice(3, -3).replace(/^[a-zA-Z0-9]*\n/, ''); 
        
        return (
          <div key={index} className="my-3 rounded-lg overflow-hidden border border-gray-700 bg-[#1e1e1e] shadow-sm">
            <div className="bg-[#2d2d2d] px-3 py-1 text-[10px] text-gray-400 flex justify-between items-center border-b border-gray-700">
               <span className="font-mono">CODE</span>
               <Copy size={12} className="cursor-pointer hover:text-white" onClick={() => navigator.clipboard.writeText(content.trim())}/>
            </div>
            <pre className="p-3 overflow-x-auto">
              <code className="font-mono text-xs text-blue-300 whitespace-pre">{content.trim()}</code>
            </pre>
          </div>
        );
      }
      
      // Regular text with basic newline handling
      return <span key={index} className="whitespace-pre-wrap">{part}</span>;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="w-96 bg-white flex flex-col h-full rounded-l-2xl shadow-xl overflow-hidden shrink-0 animate-in slide-in-from-right duration-300 border-l border-gray-200">
      <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 bg-white z-10">
        <h2 className="text-gray-800 font-medium text-lg">In-call messages</h2>
        <button onClick={onClose} className="text-gray-500 hover:bg-gray-100 p-2 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50" ref={scrollRef}>
        <div className="text-center text-xs text-gray-500 my-4 bg-gray-200 py-1 px-3 rounded-full mx-auto w-fit">
          Messages are only visible to participants in the call
        </div>

        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-sm text-gray-700">
                {msg.sender === 'user' ? 'You' : 'Gemini AI'}
              </span>
              <span className="text-xs text-gray-500">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div 
              className={`max-w-[95%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.sender === 'user' 
                  ? 'bg-[#e8f0fe] text-gray-800 rounded-tr-none' 
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
              }`}
            >
              {formatMessage(msg.text)}
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex flex-col items-start animate-pulse">
            <div className="flex items-center gap-2 mb-1">
               <span className="font-bold text-sm text-gray-700 flex items-center gap-1">
                  Gemini AI <Sparkles size={12} className="text-blue-500"/>
               </span>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-75"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-150"></div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-gray-200">
        <div className={`bg-gray-100 rounded-full px-4 py-2 flex items-center gap-2 border transition-colors ${isProcessing ? 'opacity-50' : 'border-transparent focus-within:border-blue-400 focus-within:bg-white'}`}>
           <input 
             type="text" 
             value={inputValue}
             onChange={(e) => onInputChange(e.target.value)}
             onKeyDown={handleKeyDown}
             disabled={isProcessing}
             placeholder={isProcessing ? "Gemini is thinking..." : "Type or speak..."}
             className="bg-transparent flex-1 outline-none text-sm py-2 disabled:cursor-not-allowed text-gray-900 placeholder-gray-500"
           />
           <button 
             onClick={handleSend}
             disabled={!inputValue.trim() || isProcessing}
             className={`p-2 rounded-full transition-colors ${inputValue.trim() && !isProcessing ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400'}`}
           >
             <Send size={18} />
           </button>
        </div>
        <p className="text-xs text-center text-gray-400 mt-2">
           Type a message or use voice to interact
        </p>
      </div>
    </div>
  );
};