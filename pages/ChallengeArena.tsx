
import React, { useState, useEffect, useRef } from 'react';
import { User, SkillDomain, ChallengeParticipant, ChallengeCheckpoint } from '../types';
import { generateChallengeScenario, validateChallengeStep, analyzeEnvironmentSnapshot } from '../services/gemini';
import { challengeService, ChallengeSession } from '../services/challenge';
import { Zap, Users, Code, CheckCircle, Clock, Play, Loader2, Trophy, AlertTriangle, Share2, Copy, Lock, Eye, EyeOff, Video, VideoOff, ShieldCheck, Sun, User as UserIcon, Smartphone, RotateCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  user: User;
}

const BOTS = [
  { name: "Dev_Slayer", avatar: "DS" },
  { name: "NullPtr_Ex", avatar: "NP" },
  { name: "Algo_Rhythm", avatar: "AR" },
  { name: "Git_Push_Force", avatar: "GP" }
];

export const ChallengeArena: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  // Modes: lobby, waiting (private host), queue (public), race, results
  const [mode, setMode] = useState<'lobby' | 'waiting' | 'queue' | 'race' | 'results'>('lobby');
  
  // Public Selection
  const [publicDomain, setPublicDomain] = useState<SkillDomain>(SkillDomain.ALGORITHMS);
  
  // Private Session State
  const [privateDomain, setPrivateDomain] = useState<SkillDomain>(SkillDomain.ALGORITHMS);
  const [sessionCode, setSessionCode] = useState<string>("");
  const [joinInput, setJoinInput] = useState<string>("");
  const [isHost, setIsHost] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [sessionData, setSessionData] = useState<ChallengeSession | null>(null);
  
  // Proctoring & Media
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [envCheck, setEnvCheck] = useState<{lighting: boolean; singlePerson: boolean; noDevices: boolean; feedback: string} | null>(null);
  const [isAnalyzingEnv, setIsAnalyzingEnv] = useState(false);

  // Host Generation State
  const [isGeneratingTask, setIsGeneratingTask] = useState(false);
  const [generatedTaskReady, setGeneratedTaskReady] = useState(false);

  // Race State
  const [task, setTask] = useState<string>("");
  const [checkpoints, setCheckpoints] = useState<ChallengeCheckpoint[]>([]);
  const [participants, setParticipants] = useState<ChallengeParticipant[]>([]);
  const [timeLeft, setTimeLeft] = useState(600); // 10 mins
  const [code, setCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [feed, setFeed] = useState<string[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);

  // Anti-Cheat / Monitoring State
  const [violationCount, setViolationCount] = useState(0);
  const [lastViolationMsg, setLastViolationMsg] = useState("");

  // --- MEDIA HANDLING ---
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setStream(mediaStream);
      setHasPermissions(true);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch (err) {
      alert("Camera permission is needed to use the Arena.");
    }
  };

  const analyzeEnv = async () => {
    if (!videoRef.current || !hasPermissions) return;
    setIsAnalyzingEnv(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        const result = await analyzeEnvironmentSnapshot(base64);
        setEnvCheck(result);
        if (!result.lighting || !result.singlePerson || !result.noDevices) {
           handleViolation(result.feedback || "Environmental Security Alert");
        }
      }
    } catch (e) {
      setEnvCheck({ lighting: false, singlePerson: false, noDevices: false, feedback: "Neural analysis failed." });
    } finally {
      setIsAnalyzingEnv(false);
    }
  };

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, mode]);

  // --- PRIVATE SESSION SYNC ---
  useEffect(() => {
    if (sessionCode) {
      const unsubscribe = challengeService.subscribeToSession(sessionCode, (data) => {
        if (data) {
          setSessionData(data);
          setParticipants(prev => {
             return data.participants.map(serverP => {
                const localP = prev.find(p => p.id === serverP.id);
                return {
                   ...serverP,
                   name: serverP.name || localP?.name || 'Unknown User',
                   avatar: serverP.avatar || localP?.avatar || '?',
                };
             });
          });

          if (mode === 'waiting' && data.status === 'active') {
            setTask(data.taskDescription || "");
            setCheckpoints(data.checkpoints || []);
            setMode('race');
            setIsPrivate(true);
            setGeneratedTaskReady(true);
            addFeed("Private Session Started!");
          }
        } else {
          if (mode === 'waiting' || mode === 'race') {
             handleLeaveLobby(); 
          }
        }
      });
      return () => unsubscribe();
    }
  }, [sessionCode, mode]);

  // Handle Tab Closing or Refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionCode && user.id && (mode === 'waiting' || mode === 'race')) {
         challengeService.leaveSession(sessionCode, user.id);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionCode, mode, user.id]);

  useEffect(() => {
    return () => {
       if (sessionCode && user.id && (mode === 'waiting' || mode === 'race')) {
          challengeService.leaveSession(sessionCode, user.id);
       }
    };
  }, [sessionCode, mode, user.id]);

  // --- ANTI-CHEAT MONITORING ---
  useEffect(() => {
    if (mode !== 'race') return;

    const handleVisibility = () => { if (document.hidden) handleViolation("Tab Switch Detected"); };
    const handleBlur = () => { handleViolation("Focus Lost (Window Blur)"); };
    const preventCopy = (e: ClipboardEvent) => { e.preventDefault(); handleViolation("Copy Attempt Blocked"); };
    const preventPaste = (e: ClipboardEvent) => { e.preventDefault(); handleViolation("Paste Attempt Blocked"); };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("copy", preventCopy);
    document.addEventListener("cut", preventCopy);
    document.addEventListener("paste", preventPaste);

    // Heartbeat Proctoring (Every 10 seconds)
    const proctorInterval = setInterval(() => {
       if (videoRef.current && hasPermissions) {
          analyzeEnv();
       }
    }, 10000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("copy", preventCopy);
      document.removeEventListener("cut", preventCopy);
      document.removeEventListener("paste", preventPaste);
      clearInterval(proctorInterval);
    };
  }, [mode, hasPermissions]);

  const handleViolation = (msg: string) => {
    setViolationCount(prev => prev + 1);
    setLastViolationMsg(msg);
    addFeed(`⚠️ Alert: ${msg}`);
    setTimeout(() => { setLastViolationMsg(""); }, 3000);
  };

  // --- GAME LOOP ---
  useEffect(() => {
    if (mode === 'queue') {
      const timer = setTimeout(() => {
        startPublicRace(publicDomain);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [mode, publicDomain]);

  useEffect(() => {
    if (mode !== 'race') return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 0) {
          setMode('results');
          return 0;
        }
        return t - 1;
      });

      if (!isPrivate) {
        setParticipants(prev => prev.map(p => {
          if (!p.isBot || p.status === 'finished') return p;
          
          /** 
           * Realistic Bot Simulation for Public Matches
           * Target completion: ~600 seconds (10 minutes)
           * Average progress per second: 100/600 = 0.16%
           * Implementation: 8% chance per second to jump 1-3% progress.
           * Avg jump: 2. Avg freq: 0.08. Expected inc/s: 0.16.
           */
          if (Math.random() > 0.92) {
            const jump = Math.floor(Math.random() * 3) + 1;
            const newProgress = Math.min(100, p.progress + jump);
            
            if (newProgress >= 33 && p.progress < 33) addFeed(`${p.name} completed Checkpoint 1!`);
            if (newProgress >= 66 && p.progress < 66) addFeed(`${p.name} completed Checkpoint 2!`);
            
            if (newProgress >= 100 && p.progress < 100) {
              addFeed(`${p.name} finished the race!`);
              return { ...p, progress: 100, status: 'finished' };
            }
            return { ...p, progress: newProgress };
          }
          return p;
        }));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [mode, isPrivate]);

  // --- ACTIONS ---
  const addFeed = (msg: string) => {
    setFeed(prev => [msg, ...prev].slice(0, 5));
  };

  const handleCreatePrivateSession = async () => {
    if (!hasPermissions) {
        alert("Please enable the camera to start a private match.");
        return;
    }
    const code = await challengeService.createSession(user, privateDomain);
    if (code === "OFFLINE") {
      alert("Online mode is not ready. Switching to offline mode.");
      return;
    }
    setSessionCode(code);
    setIsHost(true);
    setIsPrivate(true);
    setMode('waiting');
    setIsGeneratingTask(true);
    setGeneratedTaskReady(false);
    try {
      const scenario = await generateChallengeScenario(privateDomain);
      await challengeService.setSessionScenario(code, scenario.taskDescription, scenario.checkpoints);
      setTask(scenario.taskDescription);
      setCheckpoints(scenario.checkpoints);
      setGeneratedTaskReady(true);
    } catch (e) {
      console.error("Generation failed", e);
      const fallbackTask = `Solve this ${privateDomain} challenge. Make sure your code works for edge cases.`;
      const fallbackCheckpoints = [
         { id: 1, title: "Initialize Structure", description: "Setup the basic class or function", completed: false },
         { id: 2, title: "Core Logic", description: "Implement the main algorithm", completed: false },
         { id: 3, title: "Edge Cases", description: "Handle invalid inputs", completed: false }
      ];
      await challengeService.setSessionScenario(code, fallbackTask, fallbackCheckpoints);
      setTask(fallbackTask);
      setCheckpoints(fallbackCheckpoints);
      setGeneratedTaskReady(true);
    } finally {
      setIsGeneratingTask(false);
    }
  };

  const handleJoinSession = async () => {
    if (!joinInput) return;
    if (!hasPermissions) {
        alert("Please enable the camera to join.");
        return;
    }
    const result = await challengeService.joinSession(joinInput.toUpperCase(), user);
    if (result.success) {
      setSessionCode(joinInput.toUpperCase());
      setIsHost(false);
      setIsPrivate(true);
      setMode('waiting');
    } else {
      alert(result.message || "Failed to join session.");
    }
  };

  const handleStartPrivateRace = async () => {
    if (!isHost || !sessionCode) return;
    if (!generatedTaskReady) {
      alert("Please wait for the challenge generation to complete.");
      return;
    }
    await challengeService.startSession(sessionCode);
  };

  const handleLeaveLobby = () => {
    if (sessionCode && user.id) {
       challengeService.leaveSession(sessionCode, user.id);
    }
    setSessionCode("");
    setIsHost(false);
    setIsPrivate(false);
    setSessionData(null);
    setParticipants([]);
    setMode('lobby');
    setGeneratedTaskReady(false);
    setIsGeneratingTask(false);
  };

  const startPublicRace = async (domain: SkillDomain) => {
    const scenario = await generateChallengeScenario(domain);
    setTask(scenario.taskDescription);
    setCheckpoints(scenario.checkpoints);
    setIsPrivate(false);
    setViolationCount(0);
    const bots = BOTS.slice(0, 3).map((b, i) => ({
      id: `bot-${i}`,
      name: b.name,
      avatar: b.avatar,
      progress: 0,
      score: 0,
      status: 'coding' as const,
      isBot: true
    }));
    const me: ChallengeParticipant = {
      id: user.id,
      name: user.name || "You",
      avatar: "ME",
      progress: 0,
      score: 0,
      status: 'coding',
      isBot: false
    };
    setParticipants([me, ...bots]);
    setMode('race');
    addFeed("Race Started! Good luck!");
  };

  const handleValidateCheckpoint = async (checkpointId: number) => {
    if (validating) return;
    setValidating(true);
    const cp = checkpoints.find(c => c.id === checkpointId);
    if (!cp) return;
    const domainToUse = isPrivate ? privateDomain : publicDomain;
    const result = await validateChallengeStep(domainToUse, cp.title, code);
    setValidating(false);
    if (result.success && result.score > 60) {
       const nextCheckpoints = checkpoints.map(c => c.id === checkpointId ? { ...c, completed: true } : c);
       setCheckpoints(nextCheckpoints);
       const stepsCompleted = nextCheckpoints.filter(c => c.completed).length;
       const total = nextCheckpoints.length;
       const newProgress = Math.floor((stepsCompleted / total) * 100);
       setParticipants(prev => prev.map(p => {
         if (p.isBot || p.id !== user.id) return p;
         return { ...p, progress: newProgress };
       }));
       if (isPrivate && sessionCode) {
         challengeService.updateProgress(sessionCode, user.id, newProgress, newProgress === 100 ? 'finished' : 'coding');
       }
       if (newProgress === 100) {
           setTimeout(() => setMode('results'), 1000);
       }
       addFeed(`AI Judge: Your solution for "${cp.title}" passed! (+${Math.floor(100/checkpoints.length)}%)`);
    } else {
       addFeed(`AI Judge: Checkpoint failed. ${result.feedback}`);
    }
  };

  const copyCodeToClipboard = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  if (mode === 'lobby') {
    const isReady = hasPermissions && envCheck?.lighting && envCheck?.singlePerson && envCheck?.noDevices;
    return (
      <div className="max-w-6xl mx-auto py-12 animate-fade-in">
        <div className="text-center mb-12">
           <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-purple-900/30 border border-purple-500 mb-6 text-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
             <Zap size={48} />
           </div>
           <h1 className="text-4xl font-bold text-white mb-4">Arena</h1>
           <p className="text-purple-200 text-lg max-w-2xl mx-auto mb-8">
             Quick coding races with other people.
             Turn on your camera so matches stay fair.
           </p>

           <div className="max-w-lg mx-auto bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-xl mb-12">
              <div className="flex gap-4 items-center mb-4">
                  <div className="aspect-video w-32 bg-black rounded-lg overflow-hidden border border-slate-600 relative">
                     <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                     {!hasPermissions && <div className="absolute inset-0 flex items-center justify-center"><Video size={16} className="text-slate-700"/></div>}
                  </div>
                  <div className="flex-1 text-left">
                     <div className="text-sm font-bold text-white mb-1">Quick camera check</div>
                     <div className="flex gap-2">
                        <div className={`w-3 h-3 rounded-full ${envCheck?.lighting ? 'bg-green-500' : 'bg-slate-700'}`} title="Lighting"></div>
                        <div className={`w-3 h-3 rounded-full ${envCheck?.singlePerson ? 'bg-green-500' : 'bg-slate-700'}`} title="Identity"></div>
                        <div className={`w-3 h-3 rounded-full ${envCheck?.noDevices ? 'bg-green-500' : 'bg-slate-700'}`} title="Security"></div>
                     </div>
                  </div>
                  {!hasPermissions ? (
                    <button onClick={startCamera} className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-4 py-2 rounded-lg font-bold">Turn on camera</button>
                  ) : (
                    <button onClick={analyzeEnv} disabled={isAnalyzingEnv} className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-4 py-2 rounded-lg font-bold">
                       {isAnalyzingEnv ? <Loader2 size={12} className="animate-spin"/> : "Run check"}
                    </button>
                  )}
              </div>
              {envCheck && !isReady && <p className="text-[10px] text-red-400 text-left leading-tight italic">{envCheck.feedback}</p>}
           </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Users className="text-cyan-400" /> Public match
            </h2>
            <div className="space-y-4">
              <label className="text-sm text-slate-400 block mb-2">Pick a domain</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar border border-slate-700/50 rounded-lg p-2 bg-slate-900/30">
                {Object.values(SkillDomain).map(d => (
                  <button key={d} onClick={() => setPublicDomain(d)} className={`p-2 rounded-lg text-xs text-left border transition-all truncate ${publicDomain === d ? 'bg-purple-900/40 border-purple-500 text-purple-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`} title={d}>{d}</button>
                ))}
              </div>
              <button 
                onClick={() => setMode('queue')}
                disabled={!isReady}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-purple-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Zap size={20} /> Find a match
              </button>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Share2 className="text-green-400" /> Private match
            </h2>
            <div className="space-y-6">
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                <label className="text-sm text-slate-400 block mb-2">Enter code</label>
                <div className="flex gap-2">
                  <input type="text" value={joinInput} onChange={(e) => setJoinInput(e.target.value.toUpperCase())} placeholder="ENTER CODE" className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white font-mono tracking-widest placeholder-slate-600 focus:border-green-500 outline-none" maxLength={6} />
                  <button onClick={handleJoinSession} disabled={joinInput.length < 6 || !isReady} className="bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 rounded-lg font-bold transition-colors">Join</button>
                </div>
              </div>
              <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-slate-800 text-slate-500">or</span></div></div>
              <div className="space-y-2">
                 <label className="text-sm text-slate-400 block">Start a new one</label>
                 <select value={privateDomain} onChange={(e) => setPrivateDomain(e.target.value as SkillDomain)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-green-500 outline-none">
                    {Object.values(SkillDomain).map(d => <option key={d} value={d}>{d}</option>)}
                 </select>
              </div>
              <button onClick={handleCreatePrivateSession} disabled={!isReady} className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl border border-slate-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">Create session</button>
            </div>
          </div>
        </div>
        <button onClick={() => navigate('/')} className="text-slate-500 hover:text-white block mx-auto transition-colors">&larr; Back to dashboard</button>
      </div>
    );
  }

  if (mode === 'waiting') {
    return (
      <div className="max-w-4xl mx-auto py-12 animate-fade-in text-center relative overflow-hidden rounded-3xl mt-8">
        <div className="absolute inset-0 bg-slate-900"><div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/40 via-slate-900 to-slate-950"></div></div>
        <div className="relative z-10 p-8">
            <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">Lobby</h2>
            <div className="bg-black/40 backdrop-blur-md p-8 rounded-2xl border border-purple-500/30 mb-8 max-w-lg mx-auto shadow-2xl">
               <div className="text-xs text-purple-400 mb-3 uppercase tracking-[0.2em] font-bold">Code</div>
               <div onClick={copyCodeToClipboard} className="inline-flex items-center gap-6 bg-purple-900/20 px-10 py-6 rounded-xl border border-dashed border-purple-400/50 cursor-pointer hover:bg-purple-900/30 transition-all group hover:scale-105">
                 <span className="text-5xl font-mono font-bold text-white tracking-[0.2em]">{sessionCode}</span>
                 <Copy size={24} className="text-purple-400 group-hover:text-white" />
               </div>
            </div>
            <div className="bg-slate-800/60 backdrop-blur p-6 rounded-2xl border border-slate-700/50 mb-12 max-w-2xl mx-auto">
               <h3 className="text-white font-bold mb-6 flex items-center justify-center gap-2 border-b border-slate-700 pb-4"><Users size={20} className="text-cyan-400" /> Players ({participants?.length || 0})</h3>
               <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                 {participants.map(p => (
                   <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg border border-slate-600/50">
                     <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">{p.name.charAt(0)}</div>
                     <span className="text-white font-medium truncate">{p.name} {p.id === user.id ? "(You)" : ""}</span>
                   </div>
                 ))}
               </div>
            </div>
            {isHost ? (
               <div className="space-y-4">
                 {isGeneratingTask ? (
                    <div className="flex items-center justify-center gap-3 text-purple-400 animate-pulse font-medium"><Loader2 size={20} className="animate-spin" /> Making a challenge...</div>
                 ) : (
                    <button onClick={handleStartPrivateRace} disabled={!generatedTaskReady} className="px-12 py-5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-xl font-bold rounded-2xl shadow-xl shadow-green-900/40 transition-all flex items-center justify-center gap-3 mx-auto transform hover:scale-105 active:scale-95 disabled:opacity-50">
                      <Play size={24} fill="currentColor" /> Start
                    </button>
                 )}
               </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 text-slate-400 animate-pulse"><Loader2 size={32} className="animate-spin text-purple-500" /> <span className="font-medium">Waiting for the host to start...</span></div>
            )}
            <button onClick={handleLeaveLobby} className="mt-12 text-slate-500 hover:text-white text-sm font-medium transition-colors border-b border-transparent hover:border-white pb-1">Leave</button>
        </div>
      </div>
    );
  }

  if (mode === 'queue') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
        <Loader2 size={64} className="text-purple-500 animate-spin" />
        <h2 className="text-2xl font-bold text-white">Finding someone...</h2>
        <p className="text-slate-400">Hold on a sec.</p>
      </div>
    );
  }
  
  if (mode === 'results') {
     const myRank = participants.sort((a,b) => b.progress - a.progress).findIndex(p => p.id === user.id) + 1;
     return (
        <div className="max-w-2xl mx-auto py-12 text-center animate-fade-in">
           <Trophy size={80} className="text-yellow-400 mx-auto mb-6" />
           <h1 className="text-4xl font-bold text-white mb-2">Done!</h1>
           <p className="text-2xl text-purple-400 font-bold mb-8">You placed #{myRank}</p>
           <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 mb-8">
              {participants.sort((a,b) => b.progress - a.progress).map((p, i) => (
                 <div key={p.id} className={`flex items-center justify-between p-3 border-b border-slate-700 last:border-0 ${p.id === user.id ? 'bg-purple-900/20' : ''}`}>
                    <div className="flex items-center gap-3"><span className="font-mono text-slate-500 w-6">#{i+1}</span><span className={p.id === user.id ? "text-white font-bold" : "text-slate-300"}>{p.name}</span>{p.isBot && <span className="text-[10px] bg-slate-700 text-slate-400 px-1 rounded">BOT</span>}</div>
                    <div className="font-mono text-purple-400">{p.progress}%</div>
                 </div>
              ))}
           </div>
           <button onClick={() => setMode('lobby')} className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl font-bold">Return to Lobby</button>
        </div>
     )
  }

  const currentDomain = isPrivate ? privateDomain : publicDomain;

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col gap-4">
      <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-4">
           <span className="text-sm font-bold text-purple-400 uppercase tracking-widest border border-purple-500/30 px-2 py-1 rounded bg-purple-900/20">{isPrivate ? 'PRIVATE DUEL' : 'LIVE RACE'}</span>
           <span className="text-slate-300 font-medium hidden sm:inline">{currentDomain} Challenge</span>
        </div>
        <div className="flex items-center gap-4">
            {violationCount > 0 && (
              <div className="flex items-center gap-1 text-red-400 animate-pulse text-xs font-bold border border-red-500/30 px-2 py-1 rounded bg-red-900/20"><AlertTriangle size={14} /> {violationCount} Violations</div>
            )}
            <div className="flex items-center gap-2 font-mono text-2xl font-bold text-white"><Clock size={24} className="text-purple-500" />{formatTime(timeLeft)}</div>
        </div>
        <button className="bg-red-900/30 text-red-400 text-sm px-4 py-2 rounded hover:bg-red-900/50" onClick={handleLeaveLobby}>Forfeit</button>
      </div>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
         <div className="lg:col-span-3 bg-slate-800 rounded-xl border border-slate-700 flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-900/50 border-b border-slate-700"><h3 className="font-bold text-white">Mission Objectives</h3></div>
            <div className="p-4 flex-1 overflow-y-auto select-none" onContextMenu={(e) => e.preventDefault()}>
               <p className="text-sm text-slate-300 mb-6 font-medium leading-relaxed">{task}</p>
               <div className="space-y-4">
                  {checkpoints.map((cp) => (
                    <div key={cp.id} className={`p-3 rounded-lg border ${cp.completed ? 'bg-green-900/20 border-green-500/50' : 'bg-slate-700/30 border-slate-600'}`}>
                       <div className="flex items-start justify-between mb-1"><span className={`text-xs font-bold ${cp.completed ? 'text-green-400' : 'text-slate-400'}`}>STEP {cp.id}</span>{cp.completed && <CheckCircle size={14} className="text-green-400" />}</div>
                       <div className="text-sm font-medium text-white mb-1">{cp.title}</div>
                       {!cp.completed && (
                         <button disabled={validating} onClick={() => handleValidateCheckpoint(cp.id)} className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded flex items-center justify-center gap-2 disabled:opacity-50">
                            {validating ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Validate Code
                         </button>
                       )}
                    </div>
                  ))}
               </div>
            </div>
            {/* PROCTOR PIP */}
            <div className="p-4 bg-slate-900/80 border-t border-slate-700 flex items-center gap-4">
              <div className="w-24 aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 relative">
                 <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                 <div className="absolute top-1 left-1 bg-red-600 w-1.5 h-1.5 rounded-full animate-pulse"></div>
              </div>
              <div className="flex-1">
                 <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Robotic Proctoring</div>
                 <div className="grid grid-cols-3 gap-1">
                    <Sun size={10} className={envCheck?.lighting ? 'text-green-400' : 'text-slate-600'} />
                    <UserIcon size={10} className={envCheck?.singlePerson ? 'text-green-400' : 'text-slate-600'} />
                    <Smartphone size={10} className={envCheck?.noDevices ? 'text-green-400' : 'text-slate-600'} />
                 </div>
              </div>
           </div>
         </div>
         <div className="lg:col-span-6 bg-slate-900 rounded-xl border border-slate-700 flex flex-col overflow-hidden relative">
            <div className="p-2 bg-[#1e293b] flex items-center justify-between border-b border-slate-700"><div className="flex gap-1.5 px-2"><div className="w-3 h-3 rounded-full bg-red-500"></div><div className="w-3 h-3 rounded-full bg-yellow-500"></div><div className="w-3 h-3 rounded-full bg-green-500"></div></div><span className="text-xs text-slate-400 font-mono">race_solution.ts</span></div>
            <textarea value={code} onChange={(e) => setCode(e.target.value)} className="flex-1 w-full bg-[#0f172a] text-slate-200 p-4 font-mono text-sm outline-none resize-none" placeholder="// Write your solution here...&#10;// Click 'Validate' on the left to score points." spellCheck={false} />
            {lastViolationMsg && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600/90 text-white px-6 py-4 rounded-xl shadow-2xl z-20 animate-bounce font-bold border-2 border-red-400 flex flex-col items-center gap-2"><AlertTriangle size={32} /><span>{lastViolationMsg}</span></div>
            )}
            <div className="absolute bottom-4 left-4 right-4 pointer-events-none"><div className="flex flex-col gap-2 items-start">{feed.map((msg, i) => (<div key={i} className="bg-black/60 backdrop-blur text-purple-200 text-xs px-3 py-1.5 rounded-full border border-purple-500/20 animate-fade-in shadow-lg">{msg}</div>))}</div></div>
         </div>
         <div className="lg:col-span-3 bg-slate-800 rounded-xl border border-slate-700 flex flex-col overflow-hidden">
             <div className="p-4 bg-slate-900/50 border-b border-slate-700 flex items-center gap-2"><Users size={16} className="text-purple-400" /><h3 className="font-bold text-white">Live Rankings</h3></div>
            <div className="p-2 space-y-2 overflow-y-auto">
               {participants.sort((a,b) => b.progress - a.progress).map((p, i) => (
                  <div key={p.id} className="bg-slate-700/30 p-3 rounded-lg">
                     <div className="flex justify-between text-sm mb-1"><span className={`font-bold ${p.id === user.id ? 'text-purple-400' : 'text-slate-300'}`}>#{i+1} {p.name}</span><span className="text-slate-400 font-mono">{p.progress}%</span></div>
                     <div className="h-2 bg-slate-700 rounded-full overflow-hidden"><div className={`h-full transition-all duration-500 ${p.id === user.id ? 'bg-purple-500' : 'bg-slate-500'}`} style={{ width: `${p.progress}%` }}></div></div>
                  </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
};
