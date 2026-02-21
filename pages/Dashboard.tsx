
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, SkillDomain, SkillDNAScore } from '../types';
import { Play, TrendingUp, ShieldCheck, Lock, AlertCircle, Zap, Users, XCircle, Mic, Video, Award, Clock, FileText, ShieldAlert, CheckCircle, Brain, Swords } from 'lucide-react';
import { SkillRadar } from '../components/SkillRadar';

interface Props {
  user: User;
  onStartTrial: (domain: SkillDomain) => void;
}

export const Dashboard: React.FC<Props> = ({ user, onStartTrial }) => {
  const navigate = useNavigate();

  // Calculate Average Skill DNA from History
  const aggregateDNA = useMemo(() => {
    if (!user.history || user.history.length === 0) {
      return {
        problemSolving: 0,
        executionSpeed: 0,
        conceptualDepth: 0,
        aiLeverage: 0,
        riskAwareness: 0,
        average: 0
      };
    }

    const total = user.history.reduce((acc, session) => {
      const s = session.score || { problemSolving: 0, executionSpeed: 0, conceptualDepth: 0, aiLeverage: 0, riskAwareness: 0, average: 0 };
      return {
        problemSolving: acc.problemSolving + s.problemSolving,
        executionSpeed: acc.executionSpeed + s.executionSpeed,
        conceptualDepth: acc.conceptualDepth + s.conceptualDepth,
        aiLeverage: acc.aiLeverage + s.aiLeverage,
        riskAwareness: acc.riskAwareness + s.riskAwareness,
      };
    }, { problemSolving: 0, executionSpeed: 0, conceptualDepth: 0, aiLeverage: 0, riskAwareness: 0 });

    const count = user.history.length;
    return {
      problemSolving: Math.round(total.problemSolving / count),
      executionSpeed: Math.round(total.executionSpeed / count),
      conceptualDepth: Math.round(total.conceptualDepth / count),
      aiLeverage: Math.round(total.aiLeverage / count),
      riskAwareness: Math.round(total.riskAwareness / count),
      average: Math.round((total.problemSolving + total.executionSpeed + total.conceptualDepth + total.aiLeverage + total.riskAwareness) / (count * 5))
    };
  }, [user.history]);

  const hasHistory = user.history && user.history.length > 0;

  // --- NEW: Activity Categorization & Stats ---
  const { activities, activityStats } = useMemo(() => {
    const list: any[] = [];
    
    // 1. Process History (Trials & Interviews)
    user.history?.forEach(h => {
      const isInterview = h.feedback?.includes("VOICE INTERVIEW");
      list.push({
        type: isInterview ? 'interview' : 'trial',
        domain: h.domain,
        date: h.endTime || h.startTime || Date.now(),
        score: h.score?.average || 0,
        status: (h.score?.average || 0) >= 60 ? 'Passed' : 'Failed',
        id: h.id
      });
    });

    // 2. Process Exams (Check if array exists, else fallback to isCertified check for display)
    if (user.exams && user.exams.length > 0) {
       user.exams.forEach(e => {
         list.push({
            type: 'exam',
            domain: e.domain,
            date: e.endTime || e.startTime,
            score: e.overallScore,
            status: e.status === 'completed' ? 'Passed' : 'Failed',
            id: e.id
         });
       });
    } else if (user.isCertified) {
       // Mock entry if certified but no record present in current session
         list.push({
            type: 'exam',
            domain: 'Engineering Certification',
            date: Date.now(),
            score: 95, 
            status: 'Passed',
            id: 'cert-1'
         });
    }

    // Sort by Date Descending
    const sorted = list.sort((a,b) => b.date - a.date);

    return {
      activities: sorted,
      activityStats: {
        trials: list.filter(a => a.type === 'trial').length,
        interviews: list.filter(a => a.type === 'interview').length,
        exams: list.filter(a => a.type === 'exam').length,
        // Using available stats for wins. Assuming public for now as private aren't tracked separately in User type yet.
        arenaWinsPublic: user.stats?.arenaWins || 0,
        arenaWinsPrivate: 0 
      }
    };
  }, [user]);

  const getActivityIcon = (type: string) => {
    switch(type) {
      case 'interview': return <Mic size={16} className="text-cyan-400" />;
      case 'exam': return <Award size={16} className="text-yellow-400" />;
      default: return <FileText size={16} className="text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'Passed') return 'text-green-400 bg-green-900/20 border-green-500/30';
    return 'text-red-400 bg-red-900/20 border-red-500/30';
  };

  const handleStartTrialClick = (domain: SkillDomain) => {
    onStartTrial(domain);
  };

  const handleStartInterviewClick = () => {
    navigate('/interview');
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome back, {user.name}</h1>
          <p className="text-slate-400">Your live skill verification status is <span className="text-green-400 font-semibold">Active</span></p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Stats & DNA */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <TrendingUp className="text-cyan-400" />
                Your skill score
              </h2>
              <span className="text-xs font-mono text-cyan-400 bg-cyan-950 px-2 py-1 rounded">UPDATING</span>
            </div>
            
            {!hasHistory ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-900/50 rounded-xl border border-slate-700 border-dashed">
                 <div className="p-4 bg-slate-800 rounded-full mb-4">
                    <TrendingUp className="text-slate-500" size={32} />
                 </div>
                 <h3 className="text-lg font-medium text-white mb-2">No scores yet</h3>
                 <p className="text-slate-400 text-sm max-w-sm">Do your first trial and we'll show your score here.</p>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="w-full md:w-1/2">
                  <SkillRadar data={aggregateDNA} fullSize={true} />
                </div>
                <div className="w-full md:w-1/2 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-slate-300">
                      <span>Your rank</span>
                      <span className="text-white font-bold">Top {100 - (aggregateDNA.average > 0 ? Math.floor(aggregateDNA.average / 2) : 99)}%</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 transition-all duration-1000" style={{ width: `${aggregateDNA.average}%` }}></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-slate-300">
                      <span>Consistency</span>
                      <span className="text-white font-bold">{Math.min(100, 80 + (user.history?.length || 0) * 2)}/100</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                       <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${Math.min(100, 80 + (user.history?.length || 0) * 2)}%` }}></div>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                    <p className="text-sm text-slate-300 italic">
                      "Based on {user.history?.length} trials. Do a few more to get a better score."
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Verification & Activity Log (UPDATED) */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
               <ShieldCheck className="text-green-400" /> Your activity
            </h3>
            
            {/* Summary Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
               {/* Trials */}
               <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center">
                  <div className="text-slate-400 text-[10px] uppercase font-bold mb-1 tracking-wider">Skill Trials</div>
                  <div className="text-2xl font-bold text-white">{activityStats.trials}</div>
                  <div className="text-[10px] text-slate-500">Attended</div>
               </div>
               
               {/* Exams */}
                  <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center">
                    <div className="text-slate-400 text-[10px] uppercase font-bold mb-1 tracking-wider">Exams</div>
                    <div className={`text-2xl font-bold ${activityStats.exams > 0 ? 'text-yellow-400' : 'text-slate-600'}`}>{activityStats.exams}</div>
                    <div className="text-[10px] text-slate-500">{activityStats.exams > 0 ? 'Done' : 'Not yet'}</div>
                  </div>

               {/* Arena */}
                  <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center">
                    <div className="text-slate-400 text-[10px] uppercase font-bold mb-1 tracking-wider">Arena Wins</div>
                  <div className="flex items-baseline gap-1">
                     <span className="text-2xl font-bold text-purple-400">{activityStats.arenaWinsPublic}</span>
                     <span className="text-[10px] text-slate-500">Pub</span>
                     <span className="text-slate-600">/</span>
                     <span className="text-xl font-bold text-slate-500">{activityStats.arenaWinsPrivate}</span>
                     <span className="text-[10px] text-slate-500">Pvt</span>
                  </div>
                    <div className="text-[10px] text-slate-500">Wins</div>
                  </div>

               {/* Interviews */}
                  <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center">
                    <div className="text-slate-400 text-[10px] uppercase font-bold mb-1 tracking-wider">Interviews</div>
                    <div className="text-2xl font-bold text-cyan-400">{activityStats.interviews}</div>
                    <div className="text-[10px] text-slate-500">Done</div>
                  </div>
            </div>

            <div className="overflow-x-auto">
              {!activities.length ? (
                <div className="text-slate-500 text-sm text-center py-8">Nothing here yet. Start a trial or interview and it'll show up.</div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="pb-3 pl-2">Type</th>
                      <th className="pb-3">Domain</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-200">
                    {activities.map((item, i) => (
                      <tr key={item.id || i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                        <td className="py-4 pl-2">
                           <div className="p-2 bg-slate-800 rounded-lg inline-block border border-slate-700">
                             {getActivityIcon(item.type)}
                           </div>
                        </td>
                        <td className="py-4 font-medium">
                           <div>{item.domain}</div>
                           <div className="text-xs text-slate-500 capitalize">{item.type}</div>
                        </td>
                        <td className="py-4 text-slate-400 text-sm">{new Date(item.date).toLocaleDateString()}</td>
                        <td className="py-4">
                           <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border flex w-fit items-center gap-1 ${getStatusColor(item.status)}`}>
                              {item.status === 'Passed' ? <CheckCircle size={10} /> : <XCircle size={10} />}
                              {item.status}
                           </span>
                        </td>
                        <td className={`py-4 text-right font-mono font-bold ${item.score >= 60 ? 'text-cyan-400' : 'text-slate-500'}`}>
                           {item.score.toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Competitive Exams Section */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Award size={120} />
              </div>
              <div className="relative z-10">
                 <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                           <Award className="text-yellow-400" /> Competitive Certification Exams
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">Rigorous, 3-hour comprehensive assessments for elite certification.</p>
                    </div>
                    <span className="px-3 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs font-bold rounded-full animate-pulse">
                       HIGH STAKES
                    </span>
                 </div>

                 <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 text-center">
                        <Clock className="mx-auto text-blue-400 mb-2" size={24} />
                        <div className="text-xl font-bold text-white">30m</div>
                        <div className="text-xs text-slate-500 uppercase font-bold">MCQs</div>
                        <div className="text-[10px] text-slate-600 mt-1">20 Questions</div>
                    </div>
                    <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 text-center">
                        <FileText className="mx-auto text-purple-400 mb-2" size={24} />
                        <div className="text-xl font-bold text-white">90m</div>
                        <div className="text-xs text-slate-500 uppercase font-bold">Theory</div>
                        <div className="text-[10px] text-slate-600 mt-1">30 Questions</div>
                    </div>
                    <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 text-center">
                        <Zap className="mx-auto text-green-400 mb-2" size={24} />
                        <div className="text-xl font-bold text-white">60m</div>
                        <div className="text-xs text-slate-500 uppercase font-bold">Practical</div>
                        <div className="text-[10px] text-slate-600 mt-1">10 Tasks</div>
                    </div>
                 </div>

                 <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-xl mb-6 flex items-start gap-3">
                    <ShieldAlert className="text-red-400 shrink-0 mt-0.5" size={18} />
                    <div className="text-sm">
                       <strong className="text-red-300 block mb-1">Strict Proctoring Environment</strong>
                       <p className="text-red-200/70 text-xs">
                          Continuous AI Camera Monitoring. No tabs allowed. No copy-paste. 
                          Violations (focus loss, external devices, multiple people) result in immediate disqualification.
                       </p>
                    </div>
                 </div>

                 <button 
                    onClick={() => navigate('/exam')}
                    className="w-full py-4 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-900/20 transition-all flex items-center justify-center gap-2"
                 >
                    Enter Exam Hall <Award size={18} />
                 </button>
              </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="space-y-6">
          
          {/* Live Challenge Card */}
          <div 
             onClick={() => navigate('/arena')}
             className="cursor-pointer group relative overflow-hidden bg-gradient-to-br from-purple-900 to-indigo-900 border border-purple-500/50 rounded-2xl p-6 shadow-2xl hover:shadow-purple-500/20 transition-all"
          >
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Zap size={100} />
             </div>
             <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <span className="bg-purple-500/20 text-purple-300 text-xs font-bold px-2 py-1 rounded border border-purple-500/30 animate-pulse">LIVE NOW</span>
                  <Users size={20} className="text-purple-300" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">Open Race Arena</h2>
                <p className="text-purple-200 text-sm mb-4">Compete in real-time coding challenges against others.</p>
                <div className="flex items-center gap-2 text-white font-bold text-sm group-hover:translate-x-1 transition-transform">
                   Join Race Queue <Play size={16} fill="currentColor" />
                </div>
             </div>
          </div>

          {/* AI Voice Interview Box */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 hover:border-cyan-500 rounded-2xl p-6 shadow-xl transition-all group relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl group-hover:bg-cyan-500/10 transition-colors"></div>
             
             <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-cyan-400 group-hover:text-cyan-300 group-hover:border-cyan-500/50 transition-colors">
                   <Mic size={24} />
                </div>
                <div className="flex gap-1">
                   <Video size={16} className="text-slate-500" />
                   <ShieldCheck size={16} className="text-slate-500" />
                </div>
             </div>

             <h2 className="text-xl font-bold text-white mb-2">AI Voice Interview</h2>
             <p className="text-slate-400 text-sm mb-4">
               Real-time verbal assessment. 20 adaptive questions. 30 minutes.
               <span className="block mt-1 text-xs text-slate-500 font-mono">*Camera & Mic Required</span>
             </p>

             <button 
                onClick={handleStartInterviewClick}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-600 hover:border-cyan-500/50 transition-all flex items-center justify-center gap-2"
             >
                Start Interview <Mic size={16} />
             </button>
          </div>

          {/* Start New Trial Box */}
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-2">Start New Trial</h2>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {Object.values(SkillDomain).map((domain) => (
                <button
                  key={domain}
                  onClick={() => handleStartTrialClick(domain)}
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-700 hover:bg-cyan-900/30 hover:border-cyan-500 border border-transparent transition-all group shrink-0"
                >
                  <span className="text-slate-200 font-medium text-left group-hover:text-cyan-400">{domain}</span>
                  <Play size={18} className="text-slate-500 group-hover:text-cyan-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
             <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4">Recruiter Views</h3>
             <div className="text-3xl font-bold text-white mb-1">{hasHistory ? 12 : 0}</div>
             <p className="text-slate-500 text-sm mb-4">Companies viewed your profile this week.</p>
             <button className="text-cyan-400 text-sm hover:underline">View Analytics &rarr;</button>
          </div>
        </div>
      </div>
    </div>
  );
};
