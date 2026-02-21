
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SkillDomain } from '../types';
import { generateInterviewQuestion, evaluateInterviewResponse, analyzeEnvironmentSnapshot } from '../services/gemini';
import { Video, VideoOff, Timer, ShieldAlert, CheckCircle, ChevronRight, BarChart2, Cpu, Mic, Sun, User as UserIcon, Smartphone, Loader2, XCircle, RotateCw, ShieldCheck } from 'lucide-react';

interface Props {
  onComplete: (data: any) => void;
}

const QUESTIONS_COUNT = 20; // STRICT REQUIREMENT

export const InterviewRoom: React.FC<Props> = ({ onComplete }) => {
  const navigate = useNavigate();
  
  // Setup State
  const [domain, setDomain] = useState<SkillDomain>(SkillDomain.ALGORITHMS);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<'setup' | 'intro' | 'active' | 'evaluating' | 'summary'>('setup');
  
  // Environment Check State
  const [isAnalyzingEnv, setIsAnalyzingEnv] = useState(false);
  const [envCheck, setEnvCheck] = useState<{lighting: boolean; singlePerson: boolean; noDevices: boolean; feedback: string} | null>(null);
  const [currentRoundViolations, setCurrentRoundViolations] = useState<string[]>([]);

  // AI State
  const [aiState, setAiState] = useState<'idle' | 'speaking_question' | 'listening' | 'processing' | 'speaking_feedback'>('idle');
  
  // Interview State
  const [round, setRound] = useState(0); 
  const [currentQuestionText, setCurrentQuestionText] = useState<string>(""); 
  const [timeLeft, setTimeLeft] = useState(0);
  const [maxTime, setMaxTime] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recognition, setRecognition] = useState<any>(null);
  
  // Data State
  const [history, setHistory] = useState<any[]>([]);
  const [lastScore, setLastScore] = useState(0); 
  
  // Voice State
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);

  // --- UTILS: Text To Speech ---
  useEffect(() => {
    const loadVoices = () => {
      const vs = window.speechSynthesis.getVoices();
      setVoices(vs);
    };
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const speak = (text: string, onEnd?: () => void) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); 
      const utterance = new SpeechSynthesisUtterance(text);
      const preferredVoice = 
        voices.find(v => v.name.includes("Google US English")) || 
        voices.find(v => v.name.includes("Samantha")) || 
        voices.find(v => v.lang.startsWith("en-"));
      if (preferredVoice) utterance.voice = preferredVoice;
      utterance.rate = 0.95; 
      utterance.pitch = 1.0;
      utterance.onend = () => { if (onEnd) onEnd(); };
      utterance.onerror = () => { if (onEnd) onEnd(); };
      window.speechSynthesis.speak(utterance);
    } else {
      if (onEnd) onEnd();
    }
  };

  // 1. SETUP & PERMISSIONS
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(mediaStream);
      setHasPermissions(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      alert("Camera and Microphone permissions are required for the AI Proctor to function.");
    }
  };

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, status]);

  const analyzeEnvironment = async () => {
    if (!videoRef.current || !hasPermissions) return;
    setIsAnalyzingEnv(true);
    setEnvCheck(null);
    try {
       const canvas = document.createElement('canvas');
       canvas.width = videoRef.current.videoWidth;
       canvas.height = videoRef.current.videoHeight;
       const ctx = canvas.getContext('2d');
       if (ctx) {
         ctx.drawImage(videoRef.current, 0, 0);
         const base64 = canvas.toDataURL('image/jpeg', 0.9);
         const result = await analyzeEnvironmentSnapshot(base64);
         setEnvCheck(result);
       }
    } catch (e) {
       setEnvCheck({ lighting: false, singlePerson: false, noDevices: false, feedback: "Neural analysis system encountered an error. Please retry." });
    } finally {
       setIsAnalyzingEnv(false);
    }
  };

  // 1.5 CONTINUOUS MONITORING (EVERY 4 SECONDS)
  useEffect(() => {
    let monitorInterval: any;
    const performCheck = async () => {
      if (status !== 'active' && status !== 'evaluating') return;
      if (!videoRef.current) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0);
          const base64 = canvas.toDataURL('image/jpeg', 0.6); 
          analyzeEnvironmentSnapshot(base64).then(result => {
             const violations: string[] = [];
             if (!result.lighting) violations.push("Lighting Violation: Facial features obscured.");
             if (!result.singlePerson) violations.push("Identity Violation: Multiple persons or absence detected.");
             if (!result.noDevices) violations.push("Device Violation: Unauthorized electronic device in frame.");
             if (violations.length > 0) {
                 setCurrentRoundViolations(prev => Array.from(new Set([...prev, ...violations])));
             }
          }).catch(e => console.warn("Proctor heartbeat failed:", e));
        }
      } catch (e) {}
    };

    if (status === 'active' || status === 'evaluating') {
       monitorInterval = setInterval(performCheck, 4000);
    }
    return () => clearInterval(monitorInterval);
  }, [status]);

  // Enforce Anti-Cheat (Global Listeners)
  useEffect(() => {
    const handleContext = (e: Event) => e.preventDefault();
    const handleCopyPaste = (e: ClipboardEvent) => e.preventDefault();
    const handleVisibility = () => {
      if (document.hidden && status === 'active') {
         speak("INTEGRITY ALERT. Return to the interview window immediately.");
         setCurrentRoundViolations(prev => [...prev, "Navigation Violation: Tab switching detected."]);
      }
    };
    if (status !== 'setup' && status !== 'summary') {
      document.addEventListener('contextmenu', handleContext);
      document.addEventListener('copy', handleCopyPaste);
      document.addEventListener('paste', handleCopyPaste);
      document.addEventListener('visibilitychange', handleVisibility);
    }
    return () => {
      document.removeEventListener('contextmenu', handleContext);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [status]);

  // 2. SPEECH RECOGNITION SETUP
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recog = new SpeechRecognition();
      recog.continuous = true;
      recog.interimResults = true;
      recog.lang = 'en-US';
      recog.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        }
        setTranscript(prev => finalTranscript || prev);
      };
      recognitionRef.current = recog;
      setRecognition(recog);
    } else {
      alert("Speech recognition is not supported in this browser. Please use a Chromium-based browser.");
    }
  }, []);

  // 3. GAME FLOW
  const startInterview = async () => {
    setStatus('intro');
    speak(`Initiating ${domain} assessment. You will be asked ${QUESTIONS_COUNT} technical questions. The AI Proctor is active and monitoring for integrity violations. Let us begin.`, () => {
       nextQuestion(1);
    });
  };

  const nextQuestion = async (roundNum: number) => {
    setCurrentRoundViolations([]); 
    if (roundNum > QUESTIONS_COUNT) {
      finishInterview();
      return;
    }

    setTranscript(""); 
    setRound(roundNum);
    setAiState('processing'); 

    const qData = await generateInterviewQuestion(domain, lastScore, roundNum);
    setCurrentQuestionText(qData.text);
    setMaxTime(qData.timeLimit);
    setTimeLeft(qData.timeLimit);
    
    setStatus('active');
    setAiState('speaking_question');
    
    speak(qData.text, () => {
      startListeningPhase();
    });
  };

  const startListeningPhase = () => {
    setAiState('listening');
    setIsRecording(true);
    try { recognitionRef.current?.start(); } catch(e) {}
  };

  const stopListeningPhase = () => {
    setIsRecording(false);
    try { recognitionRef.current?.stop(); } catch(e) {}
  };

  const submitAnswer = async () => {
    stopListeningPhase();
    setAiState('processing');
    
    const finalTranscript = transcript.trim() || "(System: No spoken input detected)";
    let result = await evaluateInterviewResponse(domain, currentQuestionText, finalTranscript);
    
    if (currentRoundViolations.length > 0) {
       result = {
          score: 0,
          feedback: `SECURITY VOID: Multiple integrity violations recorded: ${currentRoundViolations.join(" | ")}`,
          spokenFeedback: "Integrity alert. This response has been invalidated due to security violations."
       };
    }
    
    const newHistory = [...history, {
        round,
        question: currentQuestionText,
        answer: finalTranscript,
        score: result.score,
        feedback: result.feedback
    }];
    setHistory(newHistory);
    setLastScore(result.score); 

    setAiState('speaking_feedback');
    speak(result.spokenFeedback || "Response recorded.", () => {
       setTimeout(() => nextQuestion(round + 1), 500);
    });
  };

  const finishInterview = () => {
    setStatus('summary');
    setAiState('idle');
    speak("Assessment concluded. The AI is finalizing your Skill DNA report based on your verbal performance and proctor logs.");
  };

  const handleReturn = () => {
     const avgScore = Math.round(history.reduce((a, b) => a + b.score, 0) / Math.max(history.length, 1));
     onComplete({
        domain,
        score: avgScore,
        history
     });
  };

  useEffect(() => {
    if (aiState !== 'listening') return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          submitAnswer();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [aiState]);

  // --- RENDER ---
  if (status === 'setup') {
    const isReady = hasPermissions && envCheck?.lighting && envCheck?.singlePerson && envCheck?.noDevices;

    return (
      <div className="max-w-4xl mx-auto py-12 animate-fade-in">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">AI Voice Interview Protocol</h1>
          <p className="text-slate-400">Environment verification and proctoring synchronization required.</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
               <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                 <Cpu size={20} className="text-cyan-400" /> Assessment Focus
               </h3>
               <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {Object.values(SkillDomain).map(d => (
                    <button 
                      key={d} 
                      onClick={() => setDomain(d)} 
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all border ${domain === d ? 'bg-cyan-900/40 border-cyan-500 text-cyan-400' : 'bg-slate-700/50 border-transparent hover:bg-slate-700 text-slate-300'}`}
                    >
                        {d}
                    </button>
                  ))}
               </div>
            </div>

            <div className="space-y-6">
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 flex flex-col items-center shadow-xl">
                    <h3 className="text-xl font-bold text-white mb-4">AI Vision Proctor</h3>
                    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden mb-4 border-2 border-slate-700 shadow-2xl group">
                        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                        {!hasPermissions && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md">
                                <VideoOff size={32} className="text-slate-600 mb-2" />
                                <span className="text-slate-400 text-sm font-medium">Camera Sync Required</span>
                            </div>
                        )}
                        {hasPermissions && (
                           <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-red-600/20 text-red-500 rounded border border-red-500/30 text-[10px] font-bold animate-pulse">
                              <RotateCw size={10} /> PROCTOR LIVE
                           </div>
                        )}
                    </div>
                    
                    {!hasPermissions ? (
                        <button onClick={startCamera} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2">
                            <Video size={18} /> Initiate Hardware Sync
                        </button>
                    ) : (
                      <div className="w-full space-y-4">
                         <div className="grid grid-cols-3 gap-2">
                            <div className={`p-3 rounded-xl border flex flex-col items-center text-center gap-1.5 transition-all ${envCheck?.lighting ? 'bg-green-900/20 border-green-500 text-green-400' : 'bg-slate-900/40 border-slate-700 text-slate-500'}`}>
                               <Sun size={20} /> <span className="text-[10px] font-bold uppercase tracking-wider">Lighting</span>
                               {envCheck?.lighting && <CheckCircle size={14}/>}
                            </div>
                            <div className={`p-3 rounded-xl border flex flex-col items-center text-center gap-1.5 transition-all ${envCheck?.singlePerson ? 'bg-green-900/20 border-green-500 text-green-400' : 'bg-slate-900/40 border-slate-700 text-slate-500'}`}>
                               <UserIcon size={20} /> <span className="text-[10px] font-bold uppercase tracking-wider">Identity</span>
                               {envCheck?.singlePerson && <CheckCircle size={14}/>}
                            </div>
                            <div className={`p-3 rounded-xl border flex flex-col items-center text-center gap-1.5 transition-all ${envCheck?.noDevices ? 'bg-green-900/20 border-green-500 text-green-400' : 'bg-slate-900/40 border-slate-700 text-slate-500'}`}>
                               <Smartphone size={20} /> <span className="text-[10px] font-bold uppercase tracking-wider">Devices</span>
                               {envCheck?.noDevices && <CheckCircle size={14}/>}
                            </div>
                         </div>
                         
                         <button 
                            onClick={analyzeEnvironment} 
                            disabled={isAnalyzingEnv} 
                            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all ${isReady ? 'bg-slate-800 border-green-500/50 text-green-400 hover:bg-slate-700' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-white'}`}
                         >
                           {isAnalyzingEnv ? <Loader2 size={18} className="animate-spin" /> : envCheck ? <RotateCw size={18} /> : <ShieldCheck size={18} />}
                           {envCheck ? "Recalibrate Proctor" : "Perform Security Scan"}
                         </button>

                         {envCheck && !isReady && (
                            <div className="p-3 bg-red-900/10 border border-red-900/40 rounded-lg text-xs text-red-300 flex gap-2">
                               <ShieldAlert size={16} className="shrink-0" />
                               <p>{envCheck.feedback}</p>
                            </div>
                         )}
                      </div>
                    )}
                </div>

                <button 
                  disabled={!isReady} 
                  onClick={startInterview} 
                  className="w-full py-5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-lg font-bold rounded-2xl shadow-xl shadow-cyan-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
                >
                    <Mic size={24} /> Enter Assessment Chamber
                </button>
                <p className="text-[10px] text-slate-500 text-center uppercase tracking-widest font-bold">
                  Zero-Tolerance Anti-Cheat Protocols Active
                </p>
            </div>
        </div>
      </div>
    );
  }

  if (status === 'intro') {
      return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-8 animate-fade-in">
              <div className="relative">
                  <div className="w-40 h-40 rounded-full bg-cyan-900/10 border-4 border-cyan-500 flex items-center justify-center shadow-[0_0_50px_rgba(6,182,212,0.3)]">
                      <Mic size={64} className="text-cyan-400" />
                  </div>
                  <div className="absolute inset-0 border-8 border-cyan-500/20 rounded-full animate-ping"></div>
              </div>
              <div className="space-y-2">
                  <h2 className="text-4xl font-bold text-white tracking-tight">Syncing Neural Interface...</h2>
                  <p className="text-slate-400 text-lg">AI Voice Engine is calibrating for ${domain}.</p>
              </div>
          </div>
      );
  }

  if (status === 'active' || status === 'evaluating') {
    return (
      <div className="h-[calc(100vh-90px)] flex flex-col gap-4 animate-fade-in max-w-6xl mx-auto w-full px-4">
         <div className="flex items-center justify-between bg-slate-800 p-4 rounded-2xl border border-slate-700 shrink-0 shadow-lg">
             <div className="flex items-center gap-4">
                 <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Question Progression</span>
                    <span className="text-sm font-bold text-white">{round} / {QUESTIONS_COUNT}</span>
                 </div>
                 <div className="h-8 w-px bg-slate-700 mx-2"></div>
                 <span className="px-3 py-1 bg-cyan-950 rounded-lg text-xs text-cyan-400 font-mono border border-cyan-900">{domain}</span>
             </div>
             <div className="flex-1 mx-12 relative h-3 bg-slate-700 rounded-full overflow-hidden shadow-inner">
                <div className={`absolute top-0 bottom-0 left-0 transition-all duration-1000 ${timeLeft < 10 ? 'bg-red-500' : 'bg-cyan-500'}`} style={{ width: `${(timeLeft / (maxTime || 60)) * 100}%` }}></div>
             </div>
             <div className={`flex items-center gap-3 font-mono text-3xl font-bold ${timeLeft < 15 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                 <Timer size={28} className={timeLeft < 15 ? 'text-red-500' : 'text-cyan-500'} /> 
                 {timeLeft < 10 ? '0:0' : '0:'}{timeLeft}
             </div>
         </div>

         <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0 pb-4">
             {/* AI Side */}
             <div className="bg-slate-800 rounded-3xl border border-slate-700 flex flex-col overflow-hidden relative h-full shadow-2xl">
                 <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-slate-800 to-slate-900">
                     <div className={`w-40 h-40 rounded-full mb-10 flex items-center justify-center shadow-2xl border-4 transition-all duration-700 ${aiState === 'speaking_question' || aiState === 'speaking_feedback' ? 'border-cyan-400 bg-cyan-900/30 scale-110 shadow-cyan-500/40' : aiState === 'processing' ? 'border-purple-500 bg-purple-900/30 animate-pulse' : aiState === 'listening' ? 'border-red-500 bg-red-900/10' : 'border-slate-700 bg-slate-800'}`}>
                         <Cpu size={80} className={`${aiState === 'processing' ? 'text-purple-400 animate-spin' : aiState === 'listening' ? 'text-red-500 animate-bounce' : aiState === 'speaking_question' ? 'text-cyan-400' : 'text-slate-600'}`} />
                     </div>
                     <div className="space-y-4">
                        <h2 className="text-3xl font-bold text-white">
                           {aiState === 'speaking_question' && "AI Voice Active"}
                           {aiState === 'listening' && "Listening Mode"}
                           {aiState === 'processing' && "Analyzing Response"}
                           {aiState === 'speaking_feedback' && "Reviewing Logic"}
                           {aiState === 'idle' && "Standby"}
                        </h2>
                        <div className="h-1 w-20 bg-cyan-500/20 mx-auto rounded-full"></div>
                        <p className="text-slate-400 text-sm max-w-xs mx-auto italic">
                           {aiState === 'listening' ? "Speak clearly and concisely. Time is remaining." : "Wait for the AI to finish its turn."}
                        </p>
                     </div>
                 </div>
             </div>

             {/* User Side */}
             <div className="flex flex-col gap-6 h-full">
                 <div className="flex-1 bg-black rounded-3xl overflow-hidden border-2 border-slate-700 relative shadow-[0_0_40px_rgba(0,0,0,0.5)] group">
                     <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                     
                     <div className="absolute top-4 left-4 flex gap-2">
                        <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-full border border-slate-700 text-[10px] text-white font-mono flex items-center gap-1.5">
                           <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                           SECURE FEED
                        </div>
                     </div>

                     {currentRoundViolations.length > 0 && (
                        <div className="absolute inset-0 bg-red-900/20 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
                           <ShieldAlert size={64} className="text-red-500 mb-4 animate-bounce" />
                           <div className="bg-red-600 text-white px-6 py-3 rounded-xl shadow-2xl font-bold border-2 border-red-400 mb-4">
                              INTEGRITY VIOLATION DETECTED
                           </div>
                           <div className="space-y-1">
                              {currentRoundViolations.map((v, i) => (
                                 <p key={i} className="text-red-200 text-xs font-medium">{v}</p>
                              ))}
                           </div>
                        </div>
                     )}
                 </div>

                 <button 
                    onClick={submitAnswer} 
                    disabled={aiState !== 'listening'} 
                    className={`w-full py-8 rounded-2xl font-black text-2xl shadow-2xl transition-all flex items-center justify-center gap-4 shrink-0 transform active:scale-95 ${aiState === 'listening' ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/40' : 'bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed opacity-50'}`}
                 >
                    {aiState === 'listening' ? <><Mic size={28} /> FINISH ANSWER</> : 'AWAITING SYSTEM...'}
                 </button>
             </div>
         </div>
      </div>
    );
  }

  if (status === 'summary') {
      const avgScore = Math.round(history.reduce((a, b) => a + b.score, 0) / Math.max(history.length, 1));
      return (
        <div className="max-w-3xl mx-auto py-12 animate-fade-in">
            <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-green-950/20 border-4 border-green-500/50 mb-8 text-green-400 shadow-[0_0_40px_rgba(34,197,94,0.2)]">
                    <BarChart2 size={64} />
                </div>
                <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">Assessment Certified</h1>
                <div className="flex items-center justify-center gap-3 mb-6">
                   <span className="text-7xl font-black text-white">{avgScore}</span>
                   <span className="text-2xl text-slate-500 font-bold self-end mb-4">/ 100</span>
                </div>
                <div className="px-4 py-2 bg-slate-800 rounded-full inline-block border border-slate-700 text-slate-400 text-sm font-medium">
                  Verified Skill DNA: {domain}
                </div>
            </div>
            
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-8">
               <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Security Log Summary</h3>
               <div className="flex items-center gap-3 text-green-400 text-sm">
                  <CheckCircle size={18} />
                  <span>AI Proctor validation session complete. No disqualifying violations persisted.</span>
               </div>
            </div>

            <button onClick={handleReturn} className="w-full py-5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-2xl shadow-2xl shadow-cyan-900/30 transition-all flex items-center justify-center gap-3 text-xl">
               Update My Profile <ChevronRight size={24} />
            </button>
        </div>
      );
  }

  return null;
};
