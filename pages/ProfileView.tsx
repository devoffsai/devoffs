
import React, { useMemo } from 'react';
import { User } from '../types';
import { SkillRadar } from '../components/SkillRadar';
import { MapPin, Link as LinkIcon, Calendar, ShieldCheck, Mail, Edit2, Award, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  user: User;
}

export const ProfileView: React.FC<Props> = ({ user }) => {
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

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-fade-in">
      {/* Banner & Header */}
      <div className="relative mb-20">
        {user.banner ? (
          <div className="h-48 rounded-t-3xl border-x border-t border-slate-700 overflow-hidden">
             <img src={user.banner} alt="Profile Banner" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="h-48 bg-gradient-to-r from-slate-800 to-cyan-900/40 rounded-t-3xl border-x border-t border-slate-700"></div>
        )}
        
        <div className="absolute -bottom-16 left-8 flex items-end">
          <div className="w-32 h-32 rounded-full border-4 border-[#0f172a] bg-slate-800 overflow-hidden shadow-2xl relative">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-slate-500">
                {user.name ? user.name.charAt(0) : '?'}
              </div>
            )}
            {/* Certification Badge on Avatar */}
            {user.isCertified && (
               <div className="absolute bottom-0 right-0 bg-[#0f172a] rounded-full p-1 z-10">
                  <Award size={24} className="text-yellow-400 fill-yellow-400" />
               </div>
            )}
          </div>
          <div className="mb-4 ml-6 hidden md:block">
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              {user.name} 
            </h1>
            <p className="text-slate-400 font-mono">@{user.username || 'user'}</p>
          </div>
        </div>

        <div className="absolute bottom-4 right-6">
           <Link to="/setup" className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium">
             <Edit2 size={16} /> Edit Profile
           </Link>
        </div>
      </div>

      {/* Mobile Name (visible only on small screens) */}
      <div className="md:hidden px-4 mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          {user.name}
        </h1>
        <p className="text-slate-400 font-mono">@{user.username || 'user'}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-4">
        
        {/* Left Column: Info & Stats */}
        <div className="space-y-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">About</h3>
            <p className="text-slate-300 leading-relaxed mb-6 text-sm">
              {user.bio || "No bio provided yet."}
            </p>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Mail size={16} />
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <MapPin size={16} />
                <span>{user.country || "Remote / Global"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Calendar size={16} />
                <span>Joined Oct 2023</span>
              </div>
              {user.isCertified && (
                <div className="flex items-center gap-3 text-sm text-yellow-400 font-bold bg-yellow-900/10 p-2 rounded border border-yellow-500/20">
                   <Award size={16} /> Certified Engineer
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
             <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Skills</h3>
             <div className="flex flex-wrap gap-2">
               {user.skills && user.skills.length > 0 ? (
                 user.skills.map(skill => (
                   <span key={skill} className="px-3 py-1 bg-cyan-950 text-cyan-400 rounded-full text-xs font-medium border border-cyan-900/50">
                     {skill}
                   </span>
                 ))
               ) : (
                 <span className="text-slate-500 italic text-sm">No skills listed</span>
               )}
             </div>
          </div>
        </div>

        {/* Middle/Right Column: DNA & History */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-bold text-white">Skill DNA™ Verified</h2>
               <div className="text-right">
                 <div className="text-2xl font-bold text-cyan-400">
                    {hasHistory ? "Top " + (100 - (aggregateDNA.average > 0 ? Math.floor(aggregateDNA.average / 2) : 99)) + "%" : "N/A"}
                 </div>
                 <div className="text-xs text-slate-500">Global Rank</div>
               </div>
            </div>
            
            {!hasHistory ? (
              <div className="flex items-center justify-center py-12 text-slate-500 text-sm bg-slate-900/50 rounded-lg border border-slate-700 border-dashed">
                 No verified skills yet. Complete trials to generate your DNA.
              </div>
            ) : (
              <div className="flex flex-col md:flex-row items-center gap-8">
                 <div className="w-full md:w-1/2">
                   <SkillRadar data={aggregateDNA} fullSize />
                 </div>
                 <div className="w-full md:w-1/2 grid grid-cols-2 gap-4">
                    <StatCard label="Problem Solving" score={aggregateDNA.problemSolving} color="text-green-400" />
                    <StatCard label="Execution" score={aggregateDNA.executionSpeed} color="text-blue-400" />
                    <StatCard label="Architecture" score={aggregateDNA.conceptualDepth} color="text-purple-400" />
                    <StatCard label="AI Leverage" score={aggregateDNA.aiLeverage} color="text-amber-400" />
                 </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Recent Verified Trials</h3>
            <div className="space-y-3">
              {!hasHistory ? (
                 <div className="text-slate-500 text-sm">No activity recorded.</div>
              ) : (
                user.history?.map((h) => (
                  <div key={h.id} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 hover:bg-slate-800/80 transition-colors">
                     <div>
                       <div className="font-medium text-slate-200">{h.domain}</div>
                       <div className="text-xs text-slate-500">{new Date(h.startTime || Date.now()).toLocaleDateString()}</div>
                     </div>
                     <div className="flex items-center gap-4">
                       {h.score && h.score.average >= 60 ? (
                         <span className="px-2 py-1 bg-green-900/20 text-green-400 text-xs font-bold rounded border border-green-900/30">PASSED</span>
                       ) : (
                         <span className="px-2 py-1 bg-red-900/20 text-red-400 text-xs font-bold rounded border border-red-900/30">FAILED</span>
                       )}
                       <span className={`font-mono font-bold ${h.score && h.score.average >= 60 ? 'text-cyan-400' : 'text-slate-500'}`}>{h.score?.average.toFixed(0)}</span>
                     </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

const StatCard = ({ label, score, color }: { label: string, score: number, color: string }) => (
  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-700">
    <div className="text-xs text-slate-500 mb-1">{label}</div>
    <div className={`text-xl font-bold ${color}`}>{score}</div>
  </div>
);
