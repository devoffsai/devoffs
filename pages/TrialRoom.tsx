
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TrialSession, SkillDomain, AntiCheatLog } from '../types';
import { generateSkillTrial, evaluatePerformance, analyzeEnvironmentSnapshot } from '../services/gemini';
import { AlertTriangle, Clock, Eye, Send, Code, Cpu, ShieldAlert, XCircle, CheckCircle, ChevronRight, ChevronLeft, Lock, Loader2, Video, VideoOff, RotateCw, ShieldCheck, Sun, User as UserIcon, Smartphone } from 'lucide-react';
import { SkillRadar } from '../components/SkillRadar';

interface Props {
  domain: SkillDomain;
  onComplete: (session: TrialSession) => void;
}

const TRIAL_DURATION = 3600; // 60 minutes
const EXACT_QUESTION_COUNT = 10;

// Strict thresholds for rejection
const MAX_TAB_SWITCHES = 2; 
const MAX_PASTES = 0; 
const MAX_FOCUS_LOST_TIME = 5000; 

export const TrialRoom: React.FC<Props> = ({ domain, onComplete }) => {
  const [session, setSession] = useState<TrialSession>({
    id: crypto.randomUUID(),
    domain,
    status: 'generating',
  });
  const [timeLeft, setTimeLeft] = useState(TRIAL_DURATION);
  
  const [questions, setQuestions] = useState<{id: number, text: string, category: 'Practical' | 'Concept'}[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  
  const [antiCheat, setAntiCheat] = useState<AntiCheatLog>({
    tabSwitchCount: 0,
    pasteCount: 0,
    focusLostTime: 0,
  });

  // Proctoring State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [envCheck, setEnvCheck] = useState<{lighting: boolean; singlePerson: boolean; noDevices: boolean; feedback: string} | null>(null);
  const [isAnalyzingEnv, setIsAnalyzingEnv] = useState(false);
  const blurTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const init = async () => {
      const data = await generateSkillTrial(domain);
      // Sort questions to ensure consistent experience (often grouped by category naturally by model)
      const exactQuestions = data.questions.slice(0, EXACT_QUESTION_COUNT);
      
      setQuestions(exactQuestions);
      setSession(prev => ({
        ...prev,
        status: 'setup',
        taskDescription: JSON.stringify(exactQuestions),
        constraints: data.constraints
      }));
    };
    init();
  }, [domain]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setStream(mediaStream);
      setHasPermissions(true);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch (err) {
      alert("Camera permission is needed to start this trial.");
    }
  };

  const analyzeEnvironment = async () => {
    if (!videoRef.current || !hasPermissions) return;
    setIsAnalyzingEnv(true);
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
      setEnvCheck({ lighting: false, singlePerson: false, noDevices: false, feedback: "Scan failed. Please check your connection." });
    } finally {
      setIsAnalyzingEnv(false);
    }
  };

  const beginActiveTrial = () => {
    setSession(prev => ({
      ...prev,
      status: 'active',
      startTime: Date.now()
    }));
  };

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, session.status]);

  useEffect(() => {
    if (session.status !== 'active') return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          handleSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    // Heartbeat Proctoring Check
    const proctorInterval = setInterval(async () => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0);
          const base64 = canvas.toDataURL('image/jpeg', 0.5);
          analyzeEnvironmentSnapshot(base64).then(result => {
             if (!result.lighting || !result.singlePerson || !result.noDevices) {
               setAntiCheat(prev => ({ 
                 ...prev, 
                 environmentViolations: [...(prev.environmentViolations || []), result.feedback]
               }));
             }
          });
        }
      }
    }, 12000);

    return () => {
      clearInterval(interval);
      clearInterval(proctorInterval);
    };
  }, [session.status]);

  useEffect(() => {
    if (session.status !== 'active') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        blurTimeRef.current = Date.now();
      } else {
        if (blurTimeRef.current) {
          const lostTime = Date.now() - blurTimeRef.current;
          setAntiCheat(prev => ({
            ...prev,
            tabSwitchCount: prev.tabSwitchCount + 1,
            focusLostTime: prev.focusLostTime + lostTime
          }));
          blurTimeRef.current = null;
        }
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
       e.preventDefault(); 
       setAntiCheat(prev => ({ ...prev, pasteCount: prev.pasteCount + 1 }));
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("paste", handlePaste); 
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("paste", handlePaste);
    };
  }, [session.status]);

  const handleSubmit = useCallback(async () => {
    // STRICT INTEGRITY CHECK
    const violations: string[] = [];
    if (antiCheat.pasteCount > MAX_PASTES) violations.push(`Copy/paste is not allowed.`);
    if (antiCheat.tabSwitchCount > MAX_TAB_SWITCHES) violations.push(`Too many tab switches.`);
    if (antiCheat.focusLostTime > MAX_FOCUS_LOST_TIME) violations.push(`You were away too long.`);
    if (antiCheat.environmentViolations && antiCheat.environmentViolations.length > 2) violations.push(`Too many environment warnings.`);

    if (violations.length > 0) {
      setSession(prev => ({
        ...prev,
        status: 'completed',
        endTime: Date.now(),
        score: {
           problemSolving: 0, executionSpeed: 0, conceptualDepth: 0, aiLeverage: 0, riskAwareness: 0, average: 0
        },
        feedback: `CHECK FAILED: ${violations.join(" ")}`
      }));
      return;
    }

    setSession(prev => ({ ...prev, status: 'analyzing', endTime: Date.now() }));
    
    const taskSummary = questions.map(q => `[${q.category}] Q${q.id}: ${q.text}`).join("\n");
    const solutionSummary = questions.map(q => `A${q.id}: ${answers[q.id] || "(No Answer)"}`).join("\n");

    const result = await evaluatePerformance(
      domain,
      taskSummary,
      solutionSummary,
      "N/A", 
      TRIAL_DURATION - timeLeft,
      antiCheat
    );

    setSession(prev => ({
      ...prev,
      status: 'completed',
      score: result.score,
      feedback: result.feedback
    }));

  }, [questions, answers, timeLeft, antiCheat, domain]);

  const handleAnswerChange = (text: string) => {
     setAnswers(prev => ({ ...prev, [questions[currentQuestionIdx].id]: text }));
  };

  const handleNext = () => {
    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx(prev => prev - 1);
    }
  };

  const preventCopy = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setAntiCheat(prev => ({ ...prev, pasteCount: prev.pasteCount + 1 })); 
  };

  if (session.status === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
        <Loader2 size={64} className="text-cyan-500 animate-spin" />
        <h2 className="text-2xl font-bold text-white">Making your 10 questions...</h2>
        <p className="text-slate-400 max-w-md">Hang tight. We're picking a mix of practical and concept questions for {domain}.</p>
      </div>
    );
  }

  if (session.status === 'setup') {
    const isReady = hasPermissions && envCheck?.lighting && envCheck?.singlePerson && envCheck?.noDevices;
    return (
      <div className="max-w-4xl mx-auto py-12 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Quick camera check</h1>
          <p className="text-slate-400">We just need a quick check before you start.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4">Camera</h3>
            <div className="aspect-video bg-black rounded-xl overflow-hidden relative border border-slate-700 shadow-2xl">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
              {!hasPermissions && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md">
                    <VideoOff size={32} className="text-slate-600 mb-2" />
                    <span className="text-slate-400 text-sm font-medium">Camera needed</span>
                </div>
              )}
            </div>
            {!hasPermissions ? (
              <button onClick={startCamera} className="w-full mt-6 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
                <Video size={18} /> Turn on camera
              </button>
            ) : (
              <button 
                onClick={analyzeEnvironment} 
                disabled={isAnalyzingEnv}
                className="w-full mt-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl border border-slate-600 transition-all flex items-center justify-center gap-2"
              >
                {isAnalyzingEnv ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                Run quick check
              </button>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
               <h3 className="text-lg font-bold text-white mb-4">What we're checking</h3>
               <div className="space-y-4">
                  <div className={`p-4 rounded-xl border flex items-center justify-between ${envCheck?.lighting ? 'bg-green-900/20 border-green-500 text-green-400' : 'bg-slate-900/40 border-slate-700 text-slate-500'}`}>
                    <div className="flex items-center gap-3"><Sun size={20}/> <span className="text-sm font-bold uppercase">Good lighting</span></div>
                    {envCheck?.lighting && <CheckCircle size={16}/>}
                  </div>
                  <div className={`p-4 rounded-xl border flex items-center justify-between ${envCheck?.singlePerson ? 'bg-green-900/20 border-green-500 text-green-400' : 'bg-slate-900/40 border-slate-700 text-slate-500'}`}>
                    <div className="flex items-center gap-3"><UserIcon size={20}/> <span className="text-sm font-bold uppercase">One person</span></div>
                    {envCheck?.singlePerson && <CheckCircle size={16}/>}
                  </div>
                  <div className={`p-4 rounded-xl border flex items-center justify-between ${envCheck?.noDevices ? 'bg-green-900/20 border-green-500 text-green-400' : 'bg-slate-900/40 border-slate-700 text-slate-500'}`}>
                    <div className="flex items-center gap-3"><Smartphone size={20}/> <span className="text-sm font-bold uppercase">No extra devices</span></div>
                    {envCheck?.noDevices && <CheckCircle size={16}/>}
                  </div>
               </div>
               {envCheck && !isReady && <p className="mt-4 text-xs text-red-400 leading-tight">{envCheck.feedback}</p>}
            </div>

            <button 
              disabled={!isReady} 
              onClick={beginActiveTrial}
              className="w-full py-5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xl font-bold rounded-2xl shadow-xl shadow-cyan-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Start trial
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (session.status === 'analyzing') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
         <div className="w-16 h-16 border-4 border-slate-700 border-t-purple-500 rounded-full animate-spin"></div>
         <h2 className="text-2xl font-bold text-white">Analyzing Skill DNA...</h2>
      </div>
    );
  }

  if (session.status === 'completed' && session.score) {
    const isRejected = session.score.average === 0;
    const isFailed = !isRejected && session.score.average < 60;

    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
        <div className="text-center space-y-2">
           <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
             isRejected ? 'bg-red-500/10 text-red-500' : 
             isFailed ? 'bg-orange-500/10 text-orange-500' :
             'bg-green-500/10 text-green-400'
           }`}>
              {isRejected ? <ShieldAlert size={32} /> : isFailed ? <AlertTriangle size={32} /> : <CheckCircle size={32} />}
           </div>
           <h1 className="text-3xl font-bold text-white">
             {isRejected ? 'Verification Rejected' : isFailed ? 'Skill Not Verified' : 'Trial Passed'}
           </h1>
           <p className="text-slate-400">
             {isRejected ? 'Integrity violation detected.' : 
              isFailed ? 'Score below 60% threshold.' :
              'Verified performance report.'}
           </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className={`bg-slate-800 p-6 rounded-2xl border ${isRejected ? 'border-red-900/50' : isFailed ? 'border-orange-900/50' : 'border-slate-700'}`}>
              <h3 className="text-lg font-bold text-white mb-4">Skill DNA™ Result</h3>
              
              {isRejected ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-center space-y-4">
                   <XCircle size={64} className="text-red-500/50" />
                   <div className="text-red-400 font-bold text-xl">VOID / 0</div>
                </div>
              ) : (
                <>
                  <SkillRadar data={session.score} fullSize />
                  <div className="mt-6 text-center">
                    <span className={`text-4xl font-bold ${isFailed ? 'text-orange-400' : 'text-cyan-400'}`}>{session.score.average.toFixed(1)}</span>
                  </div>
                </>
              )}
           </div>
           
           <div className="space-y-6">
              <div className={`p-6 rounded-2xl border ${
                  isRejected ? 'bg-red-950/20 border-red-900/50' : 
                  'bg-slate-800 border-slate-700'
                }`}>
                <h3 className="text-lg font-bold mb-2 text-white">Analysis</h3>
                <p className="text-slate-300 leading-relaxed">{session.feedback}</p>
              </div>

              <button 
                onClick={() => onComplete(session)}
                className={`w-full py-4 text-white font-bold rounded-xl transition-colors ${
                  isRejected ? 'bg-slate-700 hover:bg-slate-600' : 'bg-cyan-600 hover:bg-cyan-500'
                }`}
              >
                Return to Dashboard
              </button>
           </div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestionIdx];

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col gap-4">
      <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div className="flex items-center gap-3">
           <span className="text-sm font-mono text-cyan-400 px-2 py-1 bg-cyan-950 rounded border border-cyan-900">{domain.toUpperCase()}</span>
           <div className="h-6 w-px bg-slate-700"></div>
           <div className="flex items-center gap-1 text-xs font-bold text-slate-500 uppercase tracking-widest">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              Live Proctoring
           </div>
        </div>
        <div className={`flex items-center gap-2 font-mono text-xl font-bold ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
           <Clock size={20} />
           {Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2,'0')}
        </div>
        <div className="flex items-center gap-2">
           <span className="text-slate-400 text-sm mr-2">
             Question {currentQuestionIdx + 1} of {questions.length}
           </span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        
        {/* Left: Task Content (4 cols) */}
        <div className="lg:col-span-4 bg-slate-800 rounded-xl border border-slate-700 flex flex-col overflow-hidden">
           <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
             <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Category: {currentQ?.category}</span>
                <h2 className="text-lg font-bold text-white">Challenge #{currentQ?.id}</h2>
             </div>
             <div className="flex gap-2">
                <button onClick={handlePrev} disabled={currentQuestionIdx === 0} className="p-1 rounded hover:bg-slate-700 disabled:opacity-30"><ChevronLeft /></button>
                <button onClick={handleNext} disabled={currentQuestionIdx === questions.length - 1} className="p-1 rounded hover:bg-slate-700 disabled:opacity-30"><ChevronRight /></button>
             </div>
           </div>
           <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="prose prose-invert max-w-none select-none cursor-default" onCopy={preventCopy} onContextMenu={(e) => e.preventDefault()}>
                <p className="text-lg text-slate-200 leading-relaxed">{currentQ?.text}</p>
              </div>

              <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700 border-dashed">
                 <p className="text-xs text-slate-500">Provide architectural reasoning and implementation details. Avoid shallow summaries.</p>
              </div>
           </div>
           {/* PIP PROCTOR */}
           <div className="p-4 bg-slate-900/80 border-t border-slate-700 flex items-center gap-4">
              <div className="w-24 aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 relative">
                 <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                 <div className="absolute top-1 left-1 bg-red-600 w-1.5 h-1.5 rounded-full animate-pulse"></div>
              </div>
              <div className="flex-1">
                 <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Environmental Integrity</div>
                 <div className="flex items-center gap-2">
                    <div className="px-2 py-0.5 bg-green-900/20 text-green-400 text-[10px] font-bold rounded border border-green-500/20">SECURE</div>
                    {antiCheat.environmentViolations && antiCheat.environmentViolations.length > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-red-400 animate-pulse font-bold">
                         <AlertTriangle size={10} /> Alert
                      </div>
                    )}
                 </div>
              </div>
           </div>
        </div>

        {/* Right: Workspace (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900 rounded-xl border border-slate-700 flex flex-col overflow-hidden relative group">
           <div className="p-2 bg-[#1e293b] flex items-center justify-between border-b border-slate-700">
              <span className="text-xs text-slate-400 font-mono">workspace/solution_v1.ts</span>
              <div className="flex items-center gap-2">
                 <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{currentQ?.category} Engine Active</span>
              </div>
           </div>
           <textarea 
              value={answers[currentQ?.id] || ""}
              onChange={(e) => handleAnswerChange(e.target.value)}
              className="flex-1 w-full bg-[#0f172a] text-slate-200 p-4 font-mono text-sm outline-none resize-none leading-relaxed"
              placeholder={currentQ?.category === 'Practical' ? "// Implement the core logic and handle edge cases..." : "// Explain the theoretical trade-offs and architectural impact..."}
              spellCheck={false}
           />
           {currentQuestionIdx === questions.length - 1 && (
              <div className="absolute bottom-6 right-6 z-10">
                 <button onClick={handleSubmit} className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-green-900/30 flex items-center gap-2 transform active:scale-95 transition-transform">
                   Finalize Verified Solution <Send size={18} />
                 </button>
              </div>
           )}
        </div>
      </div>
    </div>
  );
};
