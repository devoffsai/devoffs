
import React, { useState, useEffect } from 'react';
import { User, LeaderboardEntry, LeaderboardMetric, LeaderboardTimeframe, SkillDomain } from '../types';
import { leaderboardService } from '../services/leaderboard';
import { Trophy, TrendingUp, Users, Filter, Medal, Crown, Star, ArrowUp, ArrowDown, Minus, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  user: User;
}

export const Leaderboard: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [metric, setMetric] = useState<LeaderboardMetric>('skill_dna');
  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>('weekly');
  const [domainFilter, setDomainFilter] = useState<string>('All');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      // Artificial delay for realism
      await new Promise(r => setTimeout(r, 600));
      const data = await leaderboardService.getLeaderboard(user, metric, timeframe, domainFilter === 'All' ? undefined : domainFilter);
      setEntries(data);
      setIsLoading(false);
    };
    fetchData();
  }, [user, metric, timeframe, domainFilter]);

  const getMetricLabel = (m: LeaderboardMetric) => {
    switch (m) {
      case 'skill_dna': return 'Skill DNA™';
      case 'arena_wins': return 'Arena Wins';
      case 'trials_completed': return 'Trials Done';
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={20} className="text-yellow-400 fill-yellow-400" />;
    if (rank === 2) return <Medal size={20} className="text-slate-300 fill-slate-300" />;
    if (rank === 3) return <Medal size={20} className="text-amber-700 fill-amber-700" />;
    return <span className="text-slate-500 font-mono w-5 text-center">{rank}</span>;
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <div className="flex items-center text-green-400 text-xs"><ArrowUp size={12} /> {change}</div>;
    if (change < 0) return <div className="flex items-center text-red-400 text-xs"><ArrowDown size={12} /> {Math.abs(change)}</div>;
    return <div className="flex items-center text-slate-600 text-xs"><Minus size={12} /></div>;
  };

  const userRank = entries.find(e => e.isCurrentUser)?.rank || '-';

  return (
    <div className="max-w-6xl mx-auto py-8 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
           <div className="flex items-center gap-3 mb-2">
             <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20 text-yellow-500">
               <Trophy size={28} />
             </div>
             <div>
               <h1 className="text-3xl font-bold text-white">Global Leaderboard</h1>
               <p className="text-slate-400">Top engineering talent ranked by verified proof.</p>
             </div>
           </div>
        </div>
        
        {/* User Rank Card */}
        <div className="bg-slate-800 border border-slate-700 px-6 py-3 rounded-xl flex items-center gap-4 shadow-lg">
           <div className="text-right">
             <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Your Rank</div>
             <div className="text-2xl font-bold text-white">#{userRank}</div>
           </div>
           <div className="h-10 w-px bg-slate-700"></div>
           <div className="text-right">
             <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Score</div>
             <div className="text-2xl font-bold text-cyan-400">{entries.find(e => e.isCurrentUser)?.score || 0}</div>
           </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center backdrop-blur-md sticky top-20 z-10">
         <div className="flex gap-2 p-1 bg-slate-900 rounded-lg border border-slate-700 overflow-x-auto max-w-full">
            {(['skill_dna', 'arena_wins', 'trials_completed'] as LeaderboardMetric[]).map(m => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${metric === m ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                {getMetricLabel(m)}
              </button>
            ))}
         </div>

         <div className="flex gap-4 w-full md:w-auto">
            <select 
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block p-2.5 outline-none"
            >
               <option value="All">All Domains</option>
               {Object.values(SkillDomain).map(d => (
                 <option key={d} value={d}>{d}</option>
               ))}
            </select>

            <select 
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as LeaderboardTimeframe)}
              className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block p-2.5 outline-none"
            >
               <option value="weekly">This Week</option>
               <option value="monthly">This Month</option>
               <option value="all-time">All Time</option>
            </select>
         </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
         <div className="overflow-x-auto">
           <table className="w-full text-left border-collapse">
             <thead>
               <tr className="bg-slate-900/50 border-b border-slate-700 text-xs text-slate-400 uppercase tracking-wider">
                 <th className="px-6 py-4 font-semibold w-24 text-center">Rank</th>
                 <th className="px-6 py-4 font-semibold">Engineer</th>
                 <th className="px-6 py-4 font-semibold hidden md:table-cell">Specialty</th>
                 <th className="px-6 py-4 font-semibold text-right">{getMetricLabel(metric)}</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-700/50">
               {isLoading ? (
                 [...Array(10)].map((_, i) => (
                   <tr key={i} className="animate-pulse">
                     <td className="px-6 py-4"><div className="h-4 w-8 bg-slate-700 rounded mx-auto"></div></td>
                     <td className="px-6 py-4 flex items-center gap-3">
                        <div className="h-10 w-10 bg-slate-700 rounded-full"></div>
                        <div className="h-4 w-32 bg-slate-700 rounded"></div>
                     </td>
                     <td className="px-6 py-4 hidden md:table-cell"><div className="h-4 w-24 bg-slate-700 rounded"></div></td>
                     <td className="px-6 py-4"><div className="h-4 w-12 bg-slate-700 rounded ml-auto"></div></td>
                   </tr>
                 ))
               ) : (
                 entries.map((entry) => (
                   <tr 
                     key={entry.id} 
                     className={`group transition-colors ${entry.isCurrentUser ? 'bg-cyan-900/10 hover:bg-cyan-900/20 border-l-4 border-l-cyan-500' : 'hover:bg-slate-700/30'}`}
                   >
                     <td className="px-6 py-4 text-center relative">
                        <div className="flex flex-col items-center justify-center">
                           {getRankIcon(entry.rank)}
                           <div className="mt-1">{getChangeIcon(entry.change)}</div>
                        </div>
                     </td>
                     <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                           <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 ${entry.isCurrentUser ? 'border-cyan-500 bg-cyan-900/20 text-cyan-400' : 'border-slate-600 bg-slate-700 text-slate-300'}`}>
                             {entry.avatar ? <img src={entry.avatar} className="w-full h-full rounded-full object-cover"/> : entry.name.charAt(0)}
                           </div>
                           <div>
                             <div className={`font-bold flex items-center gap-2 ${entry.isCurrentUser ? 'text-cyan-400' : 'text-white'}`}>
                               {entry.name} {entry.isCurrentUser && '(You)'}
                               {entry.isCertified && <Award size={14} className="text-yellow-400 fill-yellow-400" />}
                             </div>
                             {entry.rank <= 3 && (
                               <div className="text-xs text-yellow-500 flex items-center gap-1">
                                 <Star size={10} fill="currentColor" /> Top Talent
                               </div>
                             )}
                           </div>
                        </div>
                     </td>
                     <td className="px-6 py-4 hidden md:table-cell">
                        <span className="px-2 py-1 bg-slate-700/50 rounded text-xs text-slate-300 border border-slate-600">
                          {entry.domainSpecialty}
                        </span>
                     </td>
                     <td className="px-6 py-4 text-right">
                        <div className="font-mono text-xl font-bold text-white">
                           {entry.score}
                        </div>
                        {entry.secondaryScore !== undefined && (
                          <div className="text-xs text-slate-500">
                            {metric === 'skill_dna' ? `${entry.secondaryScore} trials` : ''}
                          </div>
                        )}
                     </td>
                   </tr>
                 ))
               )}
             </tbody>
           </table>
         </div>
      </div>
      
      <div className="mt-8 text-center">
         <button onClick={() => navigate('/arena')} className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center justify-center gap-2 mx-auto">
            Improve your rank in the Arena <TrendingUp size={16} />
         </button>
      </div>

    </div>
  );
};
