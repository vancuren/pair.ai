import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ControlBar } from './components/ControlBar';
import { ChatSidebar } from './components/ChatSidebar';
import { Message, AppState } from './types';
import { generateAIResponse, generateSpeech } from './services/geminiService';
import { Sparkles, Mic, User } from 'lucide-react';

// Web Speech API Type Definition
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

export default function App() {
  // State
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isMicOn, setIsMicOn] = useState(false); // Controls logical mic state (permission + intent)
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const messagesRef = useRef<Message[]>([]); // Ref to access latest messages in closures

  // Sync ref with state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // --- Audio Context Setup ---
  useEffect(() => {
    // Initialize AudioContext on user interaction if needed, or immediately
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    audioContextRef.current = new AudioContextClass();
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  // --- Speech Recognition Setup ---
  const startRecognition = useCallback(() => {
    const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
    const SpeechRecognitionClass = SpeechRecognition || webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert("Browser not supported. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false; // Capture one sentence/command at a time
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      if (appState !== AppState.SPEAKING) {
          setAppState(AppState.LISTENING);
      }
    };

    recognition.onend = () => {
      // If mic is on and we are not processing/speaking, restart listening
      // We rely on the `handleResult` to change state to PROCESSING, which stops this auto-restart loop logic temporarily
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript.trim().length > 0) {
        handleUserSpeech(transcript);
      }
    };

    recognitionRef.current = recognition;
  }, [appState]);

  // Restart recognition when state goes back to LISTENING or IDLE if mic is on
  useEffect(() => {
    if (isMicOn && appState === AppState.LISTENING && recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Already started
      }
    } else if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Already stopped
      }
    }
  }, [isMicOn, appState]);


  // --- Logic ---

  const captureScreen = (): string | null => {
    if (!videoRef.current) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const handleUserSpeech = async (text: string) => {
    // 1. Update UI with User Message
    setAppState(AppState.PROCESSING);
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // 2. Capture Screen
    let imageBase64 = '';
    if (stream) {
      const capture = captureScreen();
      if (capture) imageBase64 = capture;
    }

    // 3. Send to Gemini
    // If no screen share, we send a blank placeholder or handle gracefully in service
    // For this demo, we assume screen share is active or image is optional. 
    // If stream is null, imageBase64 is empty.
    
    // Slight artificial delay for UX "thinking" feel if API is too fast
    await new Promise(r => setTimeout(r, 600));

    const aiText = await generateAIResponse(text, imageBase64);

    // 4. Update UI with AI Message
    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'ai',
      text: aiText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, aiMsg]);
    setAppState(AppState.SPEAKING);

    // 5. Generate and Play Audio
    if (audioContextRef.current) {
        const audioBuffer = await generateSpeech(aiText, audioContextRef.current);
        if (audioBuffer) {
            playAudioResponse(audioBuffer);
        } else {
            // Fallback or just return to listening
            setAppState(AppState.LISTENING);
        }
    } else {
        setAppState(AppState.LISTENING);
    }
  };

  const playAudioResponse = (buffer: AudioBuffer) => {
    if (!audioContextRef.current) return;
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    
    source.onended = () => {
       setAppState(AppState.LISTENING); // Go back to listening after speech ends
    };
    
    source.start(0);
  };

  // --- Handlers ---

  const toggleScreenShare = async () => {
    if (stream) {
      // Stop sharing
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      if (videoRef.current) videoRef.current.srcObject = null;
      setAppState(AppState.IDLE);
    } else {
      // Start sharing
      try {
        const displayMedia = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" } as any,
          audio: false
        });
        setStream(displayMedia);
        if (videoRef.current) {
          videoRef.current.srcObject = displayMedia;
        }
        setAppState(AppState.SHARING);
        
        // Auto-enable mic if not on
        if (!isMicOn) {
            setIsMicOn(true);
            // Trigger recognition setup
            startRecognition();
        }
      } catch (err) {
        console.error("Error sharing screen:", err);
        alert("Failed to share screen. Please ensure permission is granted.");
      }
    }
  };

  const toggleMic = () => {
    if (!isMicOn) {
        // Check permissions or start
        setIsMicOn(true);
        startRecognition();
    } else {
        setIsMicOn(false);
        setAppState(AppState.IDLE);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#202124] overflow-hidden">
      {/* Main Stage */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Video Area */}
        <div className={`flex-1 p-4 flex items-center justify-center transition-all duration-300 ${isChatOpen ? 'pr-0' : ''}`}>
          
          {/* Active Screen Share Tile */}
          <div className="relative w-full h-full max-h-[calc(100vh-160px)] bg-[#3c4043] rounded-xl overflow-hidden flex items-center justify-center border border-[#5f6368] shadow-2xl group">
            
            {stream ? (
              <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                muted // Mute local playback of screen audio
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-400">
                <div className="bg-[#5f6368] p-8 rounded-full mb-4 opacity-50">
                   <MonitorPlaceholder />
                </div>
                <h3 className="text-xl font-medium mb-2">No screen is being shared</h3>
                <p className="text-sm opacity-70 mb-6">Click the present button below to share your code.</p>
                <button 
                    onClick={toggleScreenShare}
                    className="bg-[#8ab4f8] text-[#202124] px-6 py-2 rounded-full font-medium hover:bg-[#aecbfa] transition"
                >
                    Present Screen
                </button>
              </div>
            )}

            {/* AI Participant Overlay (simulating PIP) */}
            <div className="absolute top-4 right-4 bg-[#202124] bg-opacity-90 backdrop-blur-md rounded-lg p-3 shadow-lg border border-gray-700 w-48 flex flex-col items-center gap-2 transition-all">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${appState === AppState.SPEAKING ? 'bg-blue-600 animate-pulse' : 'bg-purple-600'}`}>
                    <Sparkles size={20} className="text-white" />
                </div>
                <div className="text-center">
                    <div className="text-sm font-medium text-white">Gemini Agent</div>
                    <div className="text-xs text-blue-300">
                        {appState === AppState.PROCESSING ? 'Thinking...' : 
                         appState === AppState.SPEAKING ? 'Speaking...' : 
                         appState === AppState.LISTENING ? 'Listening...' : 'Ready'}
                    </div>
                </div>
                {appState === AppState.SPEAKING && (
                    <div className="flex gap-1 h-3 items-center">
                        <div className="w-1 h-2 bg-white animate-pulse"></div>
                        <div className="w-1 h-3 bg-white animate-pulse delay-75"></div>
                        <div className="w-1 h-2 bg-white animate-pulse delay-150"></div>
                    </div>
                )}
            </div>

             {/* User Audio Status Overlay */}
             <div className="absolute bottom-4 left-4 flex items-center gap-2">
                 <div className="bg-[#202124] bg-opacity-60 backdrop-blur rounded-full px-3 py-1.5 flex items-center gap-2 text-white text-sm border border-white/10">
                    <div className={`p-1 rounded-full ${isMicOn ? 'bg-blue-500' : 'bg-red-500'}`}>
                        <Mic size={12} />
                    </div>
                    <span>You</span>
                 </div>
             </div>

          </div>
        </div>

        {/* Right: Chat Sidebar */}
        <div className={`transition-all duration-300 ease-in-out ${isChatOpen ? 'w-96 mr-4 my-4' : 'w-0 opacity-0 overflow-hidden'}`}>
             <ChatSidebar 
                isOpen={isChatOpen} 
                onClose={() => setIsChatOpen(false)} 
                messages={messages}
                isProcessing={appState === AppState.PROCESSING}
             />
        </div>
      </div>

      {/* Bottom Controls */}
      <ControlBar 
        isMicOn={isMicOn}
        isScreenSharing={!!stream}
        isChatOpen={isChatOpen}
        onToggleMic={toggleMic}
        onToggleScreenShare={toggleScreenShare}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
      />
    </div>
  );
}

const MonitorPlaceholder = () => (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
        <line x1="8" y1="21" x2="16" y2="21"></line>
        <line x1="12" y1="17" x2="12" y2="21"></line>
    </svg>
);