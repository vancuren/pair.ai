import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ControlBar } from './components/ControlBar';
import { ChatSidebar } from './components/ChatSidebar';
import { Message, AppState } from './types';
import { generateAIResponse, generateSpeech } from './services/geminiService';
import { Sparkles, Mic, User, AlertCircle } from 'lucide-react';

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
  const [error, setError] = useState<string | null>(null);
  
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
    if (AudioContextClass) {
      audioContextRef.current = new AudioContextClass();
    }
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  // --- Speech Recognition Setup ---
  const startRecognition = useCallback(() => {
    const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
    const SpeechRecognitionClass = SpeechRecognition || webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setError("Speech recognition not supported in this browser. Please use Chrome or Edge.");
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
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (e) {
      console.error("Error capturing screen frame:", e);
      return null;
    }
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
    await new Promise(r => setTimeout(r, 600)); // UI delay

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
    // Resume context if suspended (browser policy)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

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
    setError(null);
    if (stream) {
      // Stop sharing
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      if (videoRef.current) videoRef.current.srcObject = null;
      setAppState(AppState.IDLE);
    } else {
      // Start sharing
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          throw new Error("Screen sharing is not supported in this environment (requires secure context/HTTPS).");
        }

        const displayMedia = await navigator.mediaDevices.getDisplayMedia({
          video: true, // Use simple default constraints for maximum compatibility
          audio: false
        });

        // Handle user clicking "Stop sharing" from the browser native UI
        displayMedia.getVideoTracks()[0].onended = () => {
          setStream(null);
          if (videoRef.current) videoRef.current.srcObject = null;
          setAppState(AppState.IDLE);
        };

        setStream(displayMedia);
        if (videoRef.current) {
          videoRef.current.srcObject = displayMedia;
        }
        setAppState(AppState.SHARING);
        
        // Auto-enable mic if not on
        if (!isMicOn) {
            setIsMicOn(true);
            startRecognition();
        }
      } catch (err: any) {
        console.error("Error sharing screen:", err);
        if (err.name === 'NotAllowedError') {
             setError("Permission denied. If you didn't cancel, check OS Screen Recording permissions.");
        } else if (err.message && err.message.includes('display-capture')) {
             setError("Screen sharing disabled by policy. Check browser permissions.");
        } else {
             setError("Failed to share screen: " + (err.message || "Unknown error"));
        }
      }
    }
  };

  const toggleMic = () => {
    if (!isMicOn) {
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
              <div className="flex flex-col items-center justify-center text-gray-400 max-w-md text-center px-6">
                <div className="bg-[#5f6368] p-8 rounded-full mb-4 opacity-50">
                   <MonitorPlaceholder />
                </div>
                <h3 className="text-xl font-medium mb-2">No screen is being shared</h3>
                <p className="text-sm opacity-70 mb-6">Click the present button below to share your code.</p>
                
                <button 
                    onClick={toggleScreenShare}
                    className="bg-[#8ab4f8] text-[#202124] px-6 py-2 rounded-full font-medium hover:bg-[#aecbfa] transition mb-4"
                >
                    Present Screen
                </button>

                {error && (
                  <div className="flex items-center gap-2 text-red-300 bg-red-900/30 border border-red-500/30 px-4 py-3 rounded-lg text-sm text-left">
                    <AlertCircle size={20} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
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
                 <