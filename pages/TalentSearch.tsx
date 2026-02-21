
import React, { useState, useEffect, useMemo } from 'react';
import { User, SkillDomain } from '../types';
import { userService, CandidateFilter, getSkillTier } from '../services/userService';
import { SkillRadar } from '../components/SkillRadar';
import { Search, Filter, ShieldCheck, Briefcase, Zap, ChevronDown, ChevronUp, MapPin, Mail, Download, MessageSquare, UserPlus, X, Award } from 'lucide-react';

export const TalentSearch: React.FC = () => {
  // State
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<User[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<User | null>(null);

  // Filters
  const [domain, setDomain] = useState<string>('All');
  const [minDNA, setMinDNA] = useState<number>(0);
  const [minTrials, setMinTrials] = useState<number>(0);
  const [minWins, setMinWins] = useState<number>(0);

  // Load Data
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const filters: CandidateFilter = {
        query,
        domain: domain === 'All' ? undefined : domain,
        minSkillDNA: minDNA > 0 ? minDNA : undefined,
        minTrials: minTrials > 0 ? minTrials : undefined,
        minArenaWins: minWins > 0 ? minWins : undefined,
      };
      
      // Artificial delay for realism
      await new Promise(r => setTimeout(r, 400));
      const results = await userService.searchCandidates(filters);
      setCandidates(results);
      setLoading(false);
    };

    // Debounce typing
    const timer = setTimeout(fetch, 300);
    return () => clearTimeout(timer);
  }, [query, domain, minDNA, minTrials, minWins]);

  // Helpers
  const getAvgScore = (u: User) => {
    if (!u.history || u.history.length === 0) return 0;
    const total = u.history.reduce((sum, h) => sum + (h.score?.average || 0), 0);
    return Math.round(total / u.history.length);
  };

  const getRecentDomain = (u: User) => {
    return u.history?.[0]?.domain || u.skills?.[0] || 'General';
  };

  // Render
  return (
    <div className="max-w-7xl mx-auto py-8 animate-fade-in relative">
      
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Talent Operations</h1>
        <p className="text-slate-400">Search and verify engineering candidates using Skill DNA™ metrics.</p>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-6 shadow-xl sticky top-20 z-10 backdrop-blur-md bg-slate-800/90">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-3.5 text-slate-500" size={20} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, username, or skill keyword..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`px-6 py-3 rounded-xl font-medium border flex items-center gap-2 transition-all ${showFilters ? 'bg-cyan-900/30 border-cyan-500 text-cyan-400' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
          >
            <Filter size={18} /> Filters {showFilters ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </button>
        </div>

        {/* Expandable Filter Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">Skill Domain</label>
              <select 
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-cyan-500 outline-none"
              >
                <option value="All">All Domains</option>
                {Object.values(SkillDomain).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">Min Skill DNA ({minDNA})</label>
              <input 
                type="range" min="0" max="100" value={minDNA} onChange={(e) => setMinDNA(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-xs text-slate-500"><span>0</span><span>100</span></div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">Trials Completed ({minTrials}+)</label>
               <input 
                type="range" min="0" max="50" value={minTrials} onChange={(e) => setMinTrials(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between text-xs text-slate-500"><span>0</span><span>50+</span></div>
            </div>

             <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">Arena Wins ({minWins}+)</label>
               <input 
                type="range" min="0" max="20" value={minWins} onChange={(e) => setMinWins(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
              <div className="flex justify-between text-xs text-slate-500"><span>0</span><span>20+</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Candidate Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-20 text-slate-500 border border-dashed border-slate-700 rounded-2xl">
          <p className="text-lg">No candidates found matching criteria.</p>
          <button onClick={() => {setQuery(''); setDomain('All'); setMinDNA(0);}} className="text-cyan-400 text-sm mt-2 hover:underline">Clear Filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {candidates.map(candidate => {
            const avgScore = getAvgScore(candidate);
            const mainSkill = getRecentDomain(candidate);
            
            return (
              <div 
                key={candidate.id} 
                onClick={() => setSelectedCandidate(candidate)}
                className="group bg-slate-800 border border-slate-700 hover:border-cyan-500/50 rounded-xl p-5 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 relative overflow-hidden"
              >
                {/* Verified Badge */}
                {candidate.isCertified ? (
                   <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[10px] font-bold px-2 py-1 rounded-bl-lg flex items-center gap-1">
                      <Award size={10} /> CERTIFIED
                   </div>
                ) : avgScore > 80 && (
                   <div className="absolute top-0 right-0 bg-cyan-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">VERIFIED</div>
                )}

                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-slate-700 overflow-hidden border-2 border-slate-600 group-hover:border-cyan-400 transition-colors">
                     {candidate.avatar ? <img src={candidate.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">{candidate.name.charAt(0)}</div>}
                  </div>
                  <div>
                    <h3 className="font-bold text-white group-hover:text-cyan-400 transition-colors flex items-center gap-1">
                       {candidate.name}
                       {candidate.isCertified && <Award size={14} className="text-yellow-400 fill-yellow-400/20" />}
                    </h3>
                    <p className="text-sm text-slate-400">@{candidate.username}</p>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin size={10} /> Remote / Global
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Skill DNA</span>
                    <span className={`text-xl font-bold ${avgScore >= 80 ? 'text-cyan-400' : 'text-white'}`}>{avgScore}</span>
                  </div>
                  <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${avgScore}%` }}></div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                   <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300 border border-slate-600">{mainSkill}</span>
                   {candidate.stats?.arenaWins ? (
                     <span className="px-2 py-1 bg-purple-900/30 rounded text-xs text-purple-300 border border-purple-500/30 flex items-center gap-1">
                        <Zap size={10} /> {candidate.stats.arenaWins} Wins
                     </span>
                   ) : null}
                </div>
                
                <div className="pt-4 border-t border-slate-700/50 flex justify-between items-center">
                   <span className="text-xs text-slate-500">{candidate.stats?.trialsCompleted || 0} Trials Completed</span>
                   <span className="text-xs text-cyan-400 font-medium group-hover:underline">View Profile &rarr;</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Candidate Profile Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-800 border border-slate-700 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row relative">
            <button 
              onClick={() => setSelectedCandidate(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white transition-colors"
            >
              <X size={20} />
            </button>

            {/* Left Panel: Overview */}
            <div className="md:w-1/3 bg-slate-900 p-8 flex flex-col border-r border-slate-700 overflow-y-auto">
               <div className="flex flex-col items-center text-center mb-8">
                  <div className="w-24 h-24 rounded-full border-4 border-slate-700 overflow-hidden mb-4 shadow-xl">
                     {selectedCandidate.avatar ? <img src={selectedCandidate.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center bg-slate-800 text-2xl font-bold">{selectedCandidate.name.charAt(0)}</div>}
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                     {selectedCandidate.name}
                     {selectedCandidate.isCertified && <Award size={20} className="text-yellow-400 fill-yellow-400" />}
                  </h2>
                  <p className="text-cyan-400 text-sm font-mono mb-4">@{selectedCandidate.username}</p>
                  
                  <div className="flex gap-2">
                     <button className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-lg transition-colors">
                        <MessageSquare size={16} /> Contact
                     </button>
                     <button className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded-lg transition-colors">
                        <UserPlus size={16} /> Save
                     </button>
                  </div>
               </div>

               <div className="space-y-6">
                  {selectedCandidate.isCertified && (
                    <div className="bg-yellow-900/20 text-yellow-400 p-3 rounded-lg border border-yellow-500/30 text-center font-bold text-sm flex items-center justify-center gap-2">
                       <Award size={16} /> Certified Engineer
                    </div>
                  )}

                  <div>
                     <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">About</h3>
                     <p className="text-sm text-slate-300 leading-relaxed">{selectedCandidate.bio || "No bio available."}</p>
                  </div>
                  
                  <div>
                     <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Verified Stats</h3>
                     <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 text-center">
                           <div className="text-xl font-bold text-white">{selectedCandidate.stats?.trialsCompleted || 0}</div>
                           <div className="text-[10px] text-slate-400">Trials</div>
                        </div>
                        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 text-center">
                           <div className="text-xl font-bold text-purple-400">{selectedCandidate.stats?.arenaWins || 0}</div>
                           <div className="text-[10px] text-slate-400">Wins</div>
                        </div>
                        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 text-center col-span-2">
                           <div className="text-xl font-bold text-green-400">Top {selectedCandidate.stats?.topPercentile || 100}%</div>
                           <div className="text-[10px] text-slate-400">Global Ranking</div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            {/* Right Panel: Deep Dive */}
            <div className="flex-1 p-8 bg-slate-800 overflow-y-auto">
               <div className="mb-8">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                     <ShieldCheck className="text-cyan-400" /> Skill DNA Analysis
                  </h3>
                  <div className="flex flex-col md:flex-row items-center gap-8 bg-slate-900/50 p-6 rounded-xl border border-slate-700">
                     <div className="w-full md:w-1/2">
                        {/* We construct a temporary Aggregate DNA object if pre-calc isn't available, or use history */}
                        <SkillRadar 
                          data={selectedCandidate.history?.[0]?.score || { problemSolving: 0, executionSpeed: 0, conceptualDepth: 0, aiLeverage: 0, riskAwareness: 0, average: 0 }} 
                        />
                     </div>
                     <div className="w-full md:w-1/2 space-y-3">
                        <div className="text-sm text-slate-300">
                           <span className="text-slate-500">Primary Strength:</span> <span className="text-white font-bold">{getRecentDomain(selectedCandidate)}</span>
                        </div>
                        <div className="text-sm text-slate-300">
                           <span className="text-slate-500">Tier Classification:</span> <span className="text-white font-bold">{getSkillTier(getRecentDomain(selectedCandidate) as SkillDomain)}</span>
                        </div>
                        <button className="w-full mt-4 py-2 bg-slate-700 hover:bg-slate-600 text-xs text-white rounded border border-slate-600 flex items-center justify-center gap-2">
                           <Download size={14} /> Download Full Technical Report
                        </button>
                     </div>
                  </div>
               </div>

               <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                     <Briefcase className="text-purple-400" /> Trial History & Projects
                  </h3>
                  <div className="space-y-3">
                     {selectedCandidate.history && selectedCandidate.history.length > 0 ? (
                        selectedCandidate.history.map(h => (
                           <div key={h.id} className="bg-slate-700/30 p-4 rounded-xl border border-slate-700 flex justify-between items-center hover:bg-slate-700/50 transition-colors">
                              <div>
                                 <div className="font-bold text-white text-sm">{h.domain}</div>
                                 <div className="text-xs text-slate-500">{new Date(h.startTime || Date.now()).toLocaleDateString()}</div>
                              </div>
                              <div className="text-right">
                                 <div className="text-lg font-mono font-bold text-cyan-400">{h.score?.average || 0}</div>
                                 <div className="text-[10px] text-slate-400">Score</div>
                              </div>
                           </div>
                        ))
                     ) : (
                        <div className="text-slate-500 text-sm italic">No public trial history available.</div>
                     )}
                  </div>
                  
                  <button className="w-full mt-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2">
                     <Zap size={18} /> Invite to Technical Screen
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
