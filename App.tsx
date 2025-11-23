import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ControlBar } from './components/ControlBar';
import { ChatSidebar } from './components/ChatSidebar';
import { GitHubModal } from './components/GitHubModal';
import { Message, AppState, GitHubConfig } from './types';
import { generateAIResponse, generateSpeech } from './services/geminiService';
import { getFileTree, getFileContent, createPullRequest } from './services/githubService';
import { Sparkles, Mic, AlertCircle, Github, GitBranch, FileCode } from 'lucide-react';

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
  const [isMicOn, setIsMicOn] = useState(false);
  const [chatInput, setChatInput] = useState<string>("");
  
  // Screen Share State
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // GitHub State
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const [gitConfig, setGitConfig] = useState<GitHubConfig | null>(null);
  const [currentFileContext, setCurrentFileContext] = useState<string>(''); // Stores content of file currently being discussed
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gitConfigRef = useRef<GitHubConfig | null>(null); // Ref for closure access
  
  // State Refs for Event Listeners to avoid stale closures
  const appStateRef = useRef(appState);
  const isMicOnRef = useRef(isMicOn);

  useEffect(() => {
    gitConfigRef.current = gitConfig;
  }, [gitConfig]);

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  useEffect(() => {
    isMicOnRef.current = isMicOn;
  }, [isMicOn]);

  // --- Fix for Video Not Showing ---
  // We must set the srcObject inside a useEffect that triggers when 'stream' changes.
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // --- Audio Context Setup ---
  useEffect(() => {
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
      setError("Speech recognition not supported in this browser.");
      return;
    }

    // prevent multiple instances
    if (recognitionRef.current) return;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false; // We handle restart manually for better control
    recognition.interimResults = true; // Enable interim results for real-time UI updates
    recognition.lang = 'en-US';

    recognition.onstart = () => {
       console.log("Speech recognition started");
    };

    recognition.onend = () => {
       console.log("Speech recognition ended. State:", appStateRef.current, "Mic:", isMicOnRef.current);

       // Auto-restart if we are still in LISTENING mode and Mic is ON
       if (isMicOnRef.current && appStateRef.current === AppState.LISTENING) {
         // Add a small delay to prevent rapid restart loops and allow browser to clean up
         setTimeout(() => {
            if (isMicOnRef.current && appStateRef.current === AppState.LISTENING) {
                try {
                    recognition.start();
                } catch (e) {
                    console.error("Failed to restart recognition:", e);
                }
            }
         }, 50);
       }
    };

    recognition.onerror = (event: any) => {
      // 'no-speech' is common when the user just doesn't say anything for a while.
      // We ignore it so the onend handler can restart the listener quietly.
      if (event.error === 'no-speech') {
        return;
      }
      
      console.error("Speech recognition error", event.error);
      
      if (event.error === 'not-allowed') {
        setIsMicOn(false);
        setError("Microphone access denied.");
      }
    };

    recognition.onresult = async (event: any) => {
      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      // Update UI Input with speech
      // If we have interim text, show it in the input
      if (interim) {
        setChatInput(interim);
      }

      // Process complete sentence (Reasonable Pause detected by browser)
      if (finalTranscript.trim().length > 0) {
        setChatInput(finalTranscript); // Ensure final text is seen briefly or captured
        handleUserSpeech(finalTranscript);
        setChatInput(""); // Clear input after sending
      }
    };

    recognitionRef.current = recognition;
  }, []);

  // Manage Recognition Lifecycle
  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (isMicOn && appState === AppState.LISTENING) {
      try { 
        recognition.start(); 
      } catch (e) {
        // Already started or other error, ignore
      }
    } else {
      try { 
        recognition.stop(); 
      } catch (e) {}
    }
  }, [isMicOn, appState]);


  // --- Logic ---

  const captureScreen = (): string | null => {
    if (!videoRef.current || !stream) return null;
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
    if (!text.trim()) return;
    
    setAppState(AppState.PROCESSING);
    
    // 1. Add User Message
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // 2. Determine Context (Screen or GitHub)
    let imageBase64: string | null = null;
    const isGitHubMode = !!gitConfig;

    if (stream && !isGitHubMode) {
      imageBase64 = captureScreen();
    }

    // 3. Call Gemini
    await processGeminiTurn(text, imageBase64, isGitHubMode);
  };

  /**
   * Recursive/Loop function to handle tool calls (Read File -> Fix -> Create PR)
   */
  const processGeminiTurn = async (userPrompt: string, imageBase64: string | null, isGitHubMode: boolean, fileContext = '') => {
      const aiResponse = await generateAIResponse(
        userPrompt, 
        imageBase64, 
        isGitHubMode,
        fileContext
      );

      // Handle Function Calls (Tools)
      if (aiResponse.functionCalls && aiResponse.functionCalls.length > 0) {
        for (const call of aiResponse.functionCalls) {
           const { name, args } = call;
           
           if (name === 'list_files' && gitConfigRef.current) {
             addSystemMessage("Fetching file list...");
             const files = await getFileTree(gitConfigRef.current);
             // Recursive call with file list injected as context
             await processGeminiTurn(userPrompt, null, true, `File List: ${files.join('\n')}`);
             return;
           }
           
           if (name === 'read_file' && gitConfigRef.current) {
             addSystemMessage(`Reading ${args.path}...`);
             try {
               const content = await getFileContent(gitConfigRef.current, args.path);
               setCurrentFileContext(content); // Store for UI visualization potentially
               // Recursive call with file content
               await processGeminiTurn(userPrompt, null, true, content); 
             } catch (e) {
               await processGeminiTurn(userPrompt, null, true, "Error: Could not read file. It might not exist.");
             }
             return;
           }

           if (name === 'create_pull_request' && gitConfigRef.current) {
             addSystemMessage(`Creating PR for ${args.path}...`);
             try {
               const prUrl = await createPullRequest(gitConfigRef.current, args.path, args.content, args.description);
               // Final speech response
               handleFinalResponse(`I've created a pull request. You can review it here: ${prUrl}`);
             } catch (e) {
               handleFinalResponse("I failed to create the pull request due to an API error.");
             }
             return;
           }
        }
      }

      // Default: Just Text Response
      handleFinalResponse(aiResponse.text || "I processed that.");
  };

  const handleFinalResponse = async (text: string) => {
    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'ai',
      text: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, aiMsg]);
    setAppState(AppState.SPEAKING);

    if (audioContextRef.current) {
        const audioBuffer = await generateSpeech(text, audioContextRef.current);
        if (audioBuffer) {
            playAudioResponse(audioBuffer);
        } else {
            setAppState(AppState.LISTENING);
        }
    } else {
        setAppState(AppState.LISTENING);
    }
  };

  const addSystemMessage = (text: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      sender: 'ai',
      text: `[System] ${text}`,
      timestamp: new Date()
    }]);
  };

  const playAudioResponse = (buffer: AudioBuffer) => {
    if (!audioContextRef.current) return;
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      // Audio finished, go back to listening
      setAppState(AppState.LISTENING);
    };
    source.start(0);
  };

  // --- Toggle Handlers ---

  const toggleScreenShare = async () => {
    setError(null);
    
    // Disable Git Mode if active
    if (gitConfig) setGitConfig(null);

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      if (videoRef.current) videoRef.current.srcObject = null;
      setAppState(AppState.IDLE);
    } else {
      try {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          throw new Error("Screen sharing requires a secure context (HTTPS/localhost).");
        }
        const displayMedia = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        
        displayMedia.getVideoTracks()[0].onended = () => {
          setStream(null);
          setAppState(AppState.IDLE);
        };

        setStream(displayMedia);
        setAppState(AppState.SHARING);
        
        // Auto-enable mic for convenience
        if (!isMicOn) {
            startRecognition();
            setIsMicOn(true);
            setAppState(AppState.LISTENING);
        } else {
            // Ensure we are listening if mic was already on
            setAppState(AppState.LISTENING);
        }

      } catch (err: any) {
        console.error(err);
        setError(err.name === 'NotAllowedError' ? "Permission denied." : "Screen sharing failed.");
      }
    }
  };

  const toggleGitHub = () => {
    if (gitConfig) {
      // Disconnect
      setGitConfig(null);
      setAppState(AppState.IDLE);
    } else {
      // Open Connect Modal
      // If sharing screen, stop it
      if (stream) {
         stream.getTracks().forEach(t => t.stop());
         setStream(null);
      }
      setIsGitHubModalOpen(true);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#202124] overflow-hidden">
      <GitHubModal 
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
        onConnect={(config) => {
          setGitConfig(config);
          setAppState(AppState.GITHUB_MODE);
          
          // Auto-start mic
          startRecognition();
          setIsMicOn(true);
          setAppState(AppState.LISTENING);
        }}
      />

      {/* Main Stage */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className={`flex-1 p-4 flex items-center justify-center transition-all duration-300 ${isChatOpen ? 'pr-0' : ''}`}>
          
          <div className="relative w-full h-full max-h-[calc(100vh-160px)] bg-[#3c4043] rounded-xl overflow-hidden flex items-center justify-center border border-[#5f6368] shadow-2xl group">
            
            {/* VIEW 1: SCREEN SHARE */}
            {stream && (
               <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-contain absolute inset-0 z-10"
              />
            )}

            {/* VIEW 2: GITHUB MODE */}
            {gitConfig && !stream && (
               <div className="flex flex-col items-center justify-center text-gray-300 w-full h-full bg-[#1e1e1e]">
                  <GitBranch size={64} className="mb-4 text-green-500" />
                  <h2 className="text-2xl font-light text-white mb-2">Connected to {gitConfig.owner}/{gitConfig.repo}</h2>
                  <p className="max-w-md text-center text-gray-400 mb-8">
                    I can see your file structure. Ask me to "Fix a bug in [filename]" or "Add a feature".
                  </p>
                  <div className="bg-[#2d2d2d] p-4 rounded-lg border border-gray-700 w-[600px] h-[300px] overflow-auto font-mono text-xs">
                     <div className="text-gray-500 mb-2">// Repository Context</div>
                     {currentFileContext ? (
                        <pre className="text-green-300 whitespace-pre-wrap">{currentFileContext.substring(0, 1000)}... (truncated)</pre>
                     ) : (
                        <div className="text-gray-600 italic flex items-center gap-2">
                           <FileCode size={16}/> Waiting for file read...
                        </div>
                     )}
                  </div>
               </div>
            )}

            {/* VIEW 3: IDLE / PLACEHOLDER */}
            {!stream && !gitConfig && (
              <div className="flex flex-col items-center justify-center text-gray-400 max-w-md text-center px-6">
                <div className="bg-[#5f6368] p-8 rounded-full mb-4 opacity-50">
                   <MonitorPlaceholder />
                </div>
                <h3 className="text-xl font-medium mb-2">Ready to Collaborate</h3>
                <p className="text-sm opacity-70 mb-6">Share your screen or connect a GitHub repository.</p>
                
                <div className="flex gap-4">
                  <button onClick={toggleScreenShare} className="bg-[#8ab4f8] text-[#202124] px-6 py-2 rounded-full font-medium hover:bg-[#aecbfa] transition">
                      Present Screen
                  </button>
                  <button onClick={toggleGitHub} className="bg-[#34a853] text-white px-6 py-2 rounded-full font-medium hover:bg-[#46bd65] transition flex items-center gap-2">
                      <Github size={18}/> Connect Repo
                  </button>
                </div>
                {error && <div className="mt-4 text-red-300 bg-red-900/30 px-4 py-2 rounded border border-red-500/30">{error}</div>}
              </div>
            )}

            {/* AI Participant Overlay */}
            <div className="absolute top-4 right-4 z-50 bg-[#202124] bg-opacity-90 backdrop-blur-md rounded-lg p-3 shadow-lg border border-gray-700 w-48 flex flex-col items-center gap-2 transition-all">
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
            </div>

             {/* User Audio Status */}
             <div className="absolute bottom-4 left-4 z-50 flex items-center gap-2">
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
                onSendMessage={handleUserSpeech}
                inputValue={chatInput}
                onInputChange={setChatInput}
             />
        </div>
      </div>

      {/* Bottom Controls */}
      <ControlBar 
        isMicOn={isMicOn}
        isScreenSharing={!!stream}
        isGitHubConnected={!!gitConfig}
        isChatOpen={isChatOpen}
        onToggleMic={() => {
           if (!isMicOn) { 
               startRecognition(); 
               setIsMicOn(true); 
               setAppState(AppState.LISTENING);
           } else { 
               setIsMicOn(false); 
               setAppState(AppState.IDLE); 
           }
        }}
        onToggleScreenShare={toggleScreenShare}
        onToggleGitHub={toggleGitHub}
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