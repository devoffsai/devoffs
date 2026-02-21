
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SkillDomain, ExamSession, ExamMCQ, ExamTheory, ExamPractical, User } from '../types';
import { generateExamMCQs, generateExamTheory, generateExamPractical, gradeExamSections, analyzeEnvironmentSnapshot } from '../services/gemini';
import { Clock, ShieldAlert, CheckCircle, AlertTriangle, FileText, Code, CheckSquare, Loader2, Lock, Eye, Video, XCircle, Award, ShieldCheck, Sun, User as UserIcon, Smartphone, RotateCw } from 'lucide-react';

interface Props {
  user?: User;
  onUpdateUser?: (user: User) => void;
}

const MCQ_TIME = 1800; // 30m
const THEORY_TIME = 5400; // 90m
const PRACTICAL_TIME = 3600; // 60m

const MAX_VIOLATIONS = 5;

export const ExamRoom: React.FC<Props> = ({ user, onUpdateUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // State
  const [domain, setDomain] = useState<SkillDomain | null>(null);
  const [status, setStatus] = useState<'setup' | 'loading' | 'mcq' | 'theory' | 'practical' | 'grading' | 'results' | 'failed'>('setup');

  // Data
  const [mcqs, setMcqs] = useState<ExamMCQ[]>([]);
  const [theory, setTheory] = useState<ExamTheory[]>([]);
  const [practical, setPractical] = useState<ExamPractical[]>([]);
  
  // Timers
  const [timeLeft, setTimeLeft] = useState(0);

  // Proctoring
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [violations, setViolations] = useState<string[]>([]);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isAnalyzingEnv, setIsAnalyzingEnv] = useState(false);
  const [envCheck, setEnvCheck] = useState<{lighting: boolean; singlePerson: boolean; noDevices: boolean; feedback: string} | null>(null);
  const lastViolationRef = useRef<number>(0);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const success = searchParams.get('payment_success');
    const canceled = searchParams.get('payment_canceled');
    if (success === 'true' || canceled === 'true') {
      navigate('/exam', { replace: true });
    }
  }, [user, location.search, navigate, onUpdateUser]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setStream(mediaStream);
      setHasPermissions(true);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch (e) {
      alert("Please allow camera access to start the exam.");
    }
  };

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
      setEnvCheck({ lighting: false, singlePerson: false, noDevices: false, feedback: "Scan failed. Please check your camera." });
    } finally {
      setIsAnalyzingEnv(false);
    }
  };

  useEffect(() => {
    if (stream && videoRef.current) videoRef.current.srcObject = stream;
  }, [stream, status]);

  useEffect(() => {
    if (!['mcq', 'theory', 'practical'].includes(status)) return;
    const handleFocusLoss = () => addViolation("You left the exam window.");
    const handleVisibility = () => { if (document.hidden) addViolation("You switched tabs."); };
    const preventCopy = (e: any) => { e.preventDefault(); addViolation("Copy/paste isn't allowed."); };
    
    const camInterval = setInterval(async () => {
      if (videoRef.current && videoRef.current.readyState === 4) {
         try {
           const canvas = document.createElement('canvas');
           canvas.width = videoRef.current.videoWidth;
           canvas.height = videoRef.current.videoHeight;
           const ctx = canvas.getContext('2d');
           if (ctx) {
             ctx.drawImage(videoRef.current, 0, 0);
             const base64 = canvas.toDataURL('image/jpeg', 0.5); 
             analyzeEnvironmentSnapshot(base64).then(result => {
                if (!result.lighting || !result.singlePerson || !result.noDevices) {
                   addViolation(result.feedback || "Camera check failed.");
                }
             });
           }
         } catch(e) {}
      }
    }, 10000);

    window.addEventListener("blur", handleFocusLoss);
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("copy", preventCopy);
    document.addEventListener("paste", preventCopy);
    return () => {
      window.removeEventListener("blur", handleFocusLoss);
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("copy", preventCopy);
      document.removeEventListener("paste", preventCopy);
      clearInterval(camInterval);
    };
  }, [status]);

  const addViolation = (msg: string) => {
    const now = Date.now();
    if (now - lastViolationRef.current < 3000) return;
    lastViolationRef.current = now;
    setViolations(prev => {
       const newV = [...prev, msg];
       if (newV.length >= MAX_VIOLATIONS) setStatus('failed');
       return newV;
    });
  };

  const startExam = async () => {
     if (!domain) return;
     setStatus('loading');
     
     const [mcqData, theoryData, practicalData] = await Promise.all([
        generateExamMCQs(domain),
        generateExamTheory(domain),
        generateExamPractical(domain)
     ]);
     
     setMcqs(mcqData);
     setTheory(theoryData);
     setPractical(practicalData);
     
     setStatus('mcq');
     setTimeLeft(MCQ_TIME);
  };

  useEffect(() => {
    if (!['mcq', 'theory', 'practical'].includes(status)) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
           handleSectionSubmit();
           return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  const handleSectionSubmit = () => {
     if (status === 'mcq') {
       setStatus('theory');
       setTimeLeft(THEORY_TIME);
     } else if (status === 'theory') {
       setStatus('practical');
       setTimeLeft(PRACTICAL_TIME);
     } else if (status === 'practical') {
       finishExam();
     }
  };

  const [finalScore, setFinalScore] = useState({ mcq: 0, theory: 0, practical: 0, total: 0, feedback: "" });

  const finishExam = async () => {
     setStatus('grading');
     let mcqScore = 0;
     mcqs.forEach(q => { if (q.userAnswer === q.correctIndex) mcqScore++; });
     const mcqPerc = Math.round((mcqScore / mcqs.length) * 100);

     const result = await gradeExamSections(domain!, theory, practical);
     const total = Math.round((mcqPerc + result.theoryScore + result.practicalScore) / 3);

     setFinalScore({ mcq: mcqPerc, theory: result.theoryScore, practical: result.practicalScore, total, feedback: result.feedback });
     
     if (total >= 60 && user && onUpdateUser) {
        onUpdateUser({ ...user, isCertified: true, stats: { ...user.stats, examsPassed: (user.stats?.examsPassed || 0) + 1, trialsCompleted: user.stats?.trialsCompleted || 0, arenaWins: user.stats?.arenaWins || 0, globalRank: user.stats?.globalRank || 0, topPercentile: user.stats?.topPercentile || 0 } });
     }
     setStatus('results');
  };

  if (status === 'setup') {
    const isReady = hasPermissions && envCheck?.lighting && envCheck?.singlePerson && envCheck?.noDevices;

    return (
      <div className="max-w-6xl mx-auto py-12 animate-fade-in">
         <h1 className="text-3xl font-bold text-white mb-8 flex items-center gap-3"><Award className="text-yellow-500" /> Quick camera check</h1>
         <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6">
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
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
                            <div className="flex items-center gap-3"><Smartphone size={20}/> <span className="text-sm font-bold uppercase">No Devices</span></div>
                            {envCheck?.noDevices && <CheckCircle size={16}/>}
                        </div>
                    </div>
                    {envCheck && !isReady && <p className="mt-4 text-xs text-red-400 leading-tight p-2 bg-red-900/10 border border-red-900/30 rounded">{envCheck.feedback}</p>}
                </div>

                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                   <label className="block text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3">PICK A DOMAIN</label>
                   <select className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 text-white focus:border-yellow-500 outline-none transition-all" onChange={(e) => setDomain(e.target.value as SkillDomain)} value={domain || ""}>
                     <option value="" disabled>Choose Domain...</option>
                     {Object.values(SkillDomain).map(d => <option key={d} value={d}>{d}</option>)}
                   </select>
                </div>
            </div>

            <div className="flex flex-col gap-6">
               <div className="aspect-video bg-black rounded-2xl overflow-hidden relative border-2 border-slate-700 shadow-2xl">
                   <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                   {!hasPermissions && (
                       <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md">
                           <Video size={32} className="text-slate-600 mb-2" />
                           <span className="text-slate-400 text-sm font-medium uppercase tracking-widest">Camera needed</span>
                       </div>
                   )}
                   {hasPermissions && (
                       <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-red-600/20 text-red-500 rounded border border-red-500/30 text-[10px] font-bold animate-pulse">
                          <RotateCw size={10} /> LIVE
                       </div>
                   )}
               </div>

               <div className="space-y-4">
                  {!hasPermissions ? (
                      <button onClick={startCamera} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2">
                          <Video size={18} /> Turn on camera
                      </button>
                  ) : (
                      <button 
                         onClick={analyzeEnvironment} 
                         disabled={isAnalyzingEnv}
                         className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl border border-slate-600 transition-all flex items-center justify-center gap-2"
                      >
                        {isAnalyzingEnv ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                        {envCheck ? "Run check again" : "Run quick check"}
                      </button>
                  )}

                  <button 
                    disabled={!isReady || !domain} 
                    onClick={startExam} 
                    className="w-full py-6 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white text-xl font-bold rounded-2xl shadow-xl shadow-orange-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-95"
                  >
                      Start exam
                  </button>
                  <p className="text-[10px] text-slate-500 text-center uppercase tracking-[0.2em] font-bold">
                    Rules are strict (no tabs, no copy/paste)
                  </p>
               </div>
            </div>
         </div>
      </div>
    );
  }

  if (status === 'loading' || status === 'grading') {
     return (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-6">
           <Loader2 size={64} className="text-yellow-500 animate-spin" />
           <h2 className="text-2xl font-bold text-white tracking-tight">{status === 'loading' ? "Loading the exam..." : "Grading your answers..."}</h2>
        </div>
     );
  }

  if (status === 'failed') {
     return (
        <div className="max-w-2xl mx-auto py-20 text-center animate-fade-in">
           <ShieldAlert size={80} className="text-red-500 mx-auto mb-6" />
           <h1 className="text-4xl font-bold text-white mb-4">Exam stopped</h1>
           <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-2xl mb-8 text-left">
              <h3 className="text-red-400 font-bold mb-4 uppercase text-xs tracking-widest border-b border-red-900/50 pb-2">What went wrong</h3>
              {violations.map((v, i) => <div key={i} className="text-red-200 text-sm mb-2 flex items-center gap-3"><XCircle size={14} className="shrink-0"/> {v}</div>)}
           </div>
           <p className="text-slate-500 text-sm mb-8">Too many rule breaks, so the exam was stopped.</p>
           <button onClick={() => navigate('/')} className="bg-slate-700 hover:bg-slate-600 text-white px-10 py-3 rounded-xl font-bold transition-colors">Return to Dashboard</button>
        </div>
     );
  }

  if (status === 'results') {
     const passed = finalScore.total >= 60;
     return (
        <div className="max-w-3xl mx-auto py-12 animate-fade-in">
           <div className="text-center mb-12">
              <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-6 border-4 shadow-2xl ${passed ? 'border-green-500 text-green-400 shadow-green-900/20' : 'border-red-500 text-red-400 shadow-red-900/20'}`}>
                 {passed ? <Award size={48} /> : <XCircle size={48} />}
              </div>
              <h1 className="text-4xl font-bold text-white mb-1">{passed ? "You passed" : "You didn't pass"}</h1>
              <p className="text-slate-500 text-lg">{domain}</p>
           </div>
           <div className="grid grid-cols-3 gap-6 mb-12">
              <ScoreCard label="MCQ" score={finalScore.mcq} />
              <ScoreCard label="Theory" score={finalScore.theory} />
              <ScoreCard label="Practical" score={finalScore.practical} />
           </div>
           <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 mb-8 relative">
              <div className="absolute top-0 right-0 p-4 opacity-5"><ShieldCheck size={100} /></div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Board Evaluation Summary</h3>
              <p className="text-slate-200 leading-relaxed italic relative z-10">"{finalScore.feedback}"</p>
           </div>
           <button onClick={() => navigate('/')} className="w-full py-5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-lg transition-all shadow-xl shadow-cyan-900/20">Return to Dashboard</button>
        </div>
     );
  }

  return (
     <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <div className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 shrink-0">
           <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                 <span className="text-yellow-500 font-bold uppercase tracking-widest text-[10px]">Exam Session Live</span>
              </div>
              <div className="flex items-center gap-4 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                <span className={status === 'mcq' ? 'text-cyan-400' : 'text-green-500'}>PART 1: MCQ</span>
                <span className={status === 'theory' ? 'text-cyan-400' : status === 'mcq' ? 'text-slate-700' : 'text-green-500'}>PART 2: THEORY</span>
                <span className={status === 'practical' ? 'text-cyan-400' : 'text-slate-700'}>PART 3: PRACTICAL</span>
              </div>
           </div>
           <div className={`flex items-center gap-3 font-mono text-2xl font-bold ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
              <Clock size={24} className={timeLeft < 300 ? 'text-red-500' : 'text-slate-500'} /> {Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2,'0')}
           </div>
        </div>
        <div className="flex-1 flex overflow-hidden">
           <div className="flex-1 overflow-y-auto p-12 bg-[#0f172a]">
              {status === 'mcq' && <MCQSection questions={mcqs} setQuestions={setMcqs} />}
              {status === 'theory' && <TheorySection questions={theory} setQuestions={setTheory} />}
              {status === 'practical' && <PracticalSection tasks={practical} setTasks={setPractical} />}
           </div>
           <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col">
              <div className="aspect-video relative bg-black shadow-inner">
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                  <div className="absolute top-2 left-2 flex gap-1 items-center bg-black/40 px-2 py-0.5 rounded-full border border-white/10">
                     <div className="w-1 h-1 bg-red-600 rounded-full animate-pulse"></div>
                     <span className="text-[8px] text-white font-black uppercase tracking-tighter">Secure Link</span>
                  </div>
              </div>
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                 <div>
                    <h3 className="text-[10px] font-bold text-slate-600 uppercase mb-3 tracking-widest">Environmental Sensors</h3>
                    <div className="grid grid-cols-3 gap-2">
                       <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700 flex flex-col items-center">
                          <Sun size={14} className="text-green-400 mb-1" />
                          <span className="text-[8px] text-slate-500 font-bold uppercase">Light</span>
                       </div>
                       <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700 flex flex-col items-center">
                          <UserIcon size={14} className="text-green-400 mb-1" />
                          <span className="text-[8px] text-slate-500 font-bold uppercase">ID</span>
                       </div>
                       <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700 flex flex-col items-center">
                          <Smartphone size={14} className="text-green-400 mb-1" />
                          <span className="text-[8px] text-slate-500 font-bold uppercase">Safe</span>
                       </div>
                    </div>
                 </div>

                 <div>
                    <h3 className="text-[10px] font-bold text-slate-600 uppercase mb-3 tracking-widest">Integrity Violation Log</h3>
                    <div className="space-y-1.5">
                       {violations.length === 0 ? (
                         <div className="text-[9px] text-green-500 flex items-center gap-2 bg-green-500/5 p-3 rounded-lg border border-green-500/20 font-bold">
                            <ShieldCheck size={12}/> CHANNEL SECURE
                         </div>
                       ) : (
                         violations.map((v, i) => (
                           <div key={i} className="text-[9px] text-red-400 bg-red-500/5 p-2 rounded border border-red-500/20 flex gap-2">
                             <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                             {v}
                           </div>
                         ))
                       )}
                    </div>
                 </div>
              </div>
              <div className="p-6 bg-slate-900 border-t border-slate-800">
                 <button onClick={handleSectionSubmit} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-cyan-900/20 transform active:scale-95">
                    Submit Part &rarr;
                 </button>
              </div>
           </div>
        </div>
     </div>
  );
};

const MCQSection = ({ questions, setQuestions }: { questions: ExamMCQ[], setQuestions: any }) => (
  <div className="max-w-3xl mx-auto space-y-12 pb-20">
     <div className="border-b border-slate-800 pb-6"><h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Part 1: Nuance Retrieval</h2><p className="text-slate-500">20 Technical MCQs with focus on obscure internals and edge cases.</p></div>
     {questions.map((q, i) => (
        <div key={q.id} className="bg-slate-800/40 p-8 rounded-3xl border border-slate-800/50 backdrop-blur-sm">
           <h3 className="text-xl font-medium text-white mb-6 leading-relaxed"><span className="text-slate-600 font-mono mr-3 text-sm">{i+1}.</span> {q.question}</h3>
           <div className="space-y-3">
              {q.options.map((opt, idx) => (
                 <label key={idx} className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${q.userAnswer === idx ? 'bg-cyan-950/20 border-cyan-500 text-cyan-200' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-400'}`}>
                    <input type="radio" name={`mcq-${q.id}`} className="hidden" checked={q.userAnswer === idx} onChange={() => { const newQ = [...questions]; newQ[i].userAnswer = idx; setQuestions(newQ); }} />
                    <span className="text-sm font-medium">{opt}</span>
                 </label>
              ))}
           </div>
        </div>
     ))}
  </div>
);

const TheorySection = ({ questions, setQuestions }: { questions: ExamTheory[], setQuestions: any }) => (
  <div className="max-w-3xl mx-auto space-y-12 pb-20">
     <div className="border-b border-slate-800 pb-6"><h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Part 2: Architectural Defense</h2><p className="text-slate-500">30 Subjective Technical Response Prompts requiring architectural depth.</p></div>
     {questions.map((q, i) => (
        <div key={q.id} className="bg-slate-800/40 p-8 rounded-3xl border border-slate-800/50">
           <h3 className="text-lg font-medium text-white mb-6 leading-relaxed"><span className="text-slate-600 font-mono mr-3 text-sm">{i+1}.</span> {q.question}</h3>
           <textarea className="w-full h-40 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white focus:border-cyan-500 outline-none resize-none font-mono text-sm shadow-inner" placeholder="Provide detailed architectural reasoning and trade-off analysis..." value={q.userAnswer || ""} onChange={(e) => { const newQ = [...questions]; newQ[i].userAnswer = e.target.value; setQuestions(newQ); }} />
        </div>
     ))}
  </div>
);

const PracticalSection = ({ tasks, setTasks }: { tasks: ExamPractical[], setTasks: any }) => (
  <div className="max-w-4xl mx-auto space-y-12 pb-20">
     <div className="border-b border-slate-800 pb-6"><h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Part 3: Production Realism</h2><p className="text-slate-500">10 Complex System Implementation Tasks evaluated on correctness and performance.</p></div>
     {tasks.map((t, i) => (
        <div key={t.id} className="bg-slate-800 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
           <div className="p-6 bg-slate-900/80 border-b border-slate-800"><h3 className="text-xl font-bold text-white mb-4"><span className="text-slate-600 font-mono mr-3 text-sm">{i+1}.</span> {t.task}</h3><div className="flex gap-2 flex-wrap">{t.constraints.map((c, idx) => <span key={idx} className="text-[10px] bg-red-950 text-red-400 px-3 py-1 rounded-full border border-red-500/20 uppercase font-black tracking-widest">{c}</span>)}</div></div>
           <textarea className="w-full h-96 bg-[#0a0f1e] text-cyan-100 font-mono text-sm p-8 outline-none resize-y shadow-inner leading-relaxed" placeholder="// Implement industrial-grade solution here...&#10;// Handle concurrency, memory safety, and edge cases." spellCheck={false} value={t.userAnswer || ""} onChange={(e) => { const newT = [...tasks]; newT[i].userAnswer = e.target.value; setTasks(newT); }} />
        </div>
     ))}
  </div>
);

const ScoreCard = ({ label, score }: { label: string, score: number }) => (
   <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 text-center shadow-xl group hover:border-cyan-500/50 transition-all">
      <div className="text-4xl font-black text-white mb-2 group-hover:text-cyan-400 transition-colors">{score}%</div>
      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">{label} Grade</div>
   </div>
);
