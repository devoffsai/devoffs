
import { supabase } from './supabaseClient';
import { User, LeaderboardEntry, LeaderboardMetric, LeaderboardTimeframe, SkillDomain } from '../types';

// GLOBAL RANKING FORMULA IMPLEMENTATION
const calculateRankScore = (skillPoints: number, consistencyFactor: number, speed: number, difficulty: number): number => {
    // Avoid division by zero
    const safeDifficulty = Math.max(difficulty, 1);
    const speedBonus = speed > 0 ? (speed / safeDifficulty) : 0;
    // Weighted Formula
    return Math.round((skillPoints * consistencyFactor) + speedBonus);
};

export const leaderboardService = {
  
  async getLeaderboard(
    currentUser: User,
    metric: LeaderboardMetric = 'skill_dna',
    timeframe: LeaderboardTimeframe = 'weekly',
    domainFilter?: string
  ): Promise<LeaderboardEntry[]> {
    
    let allUsers: User[] = [];
    let fetchSuccess = false;

    try {
      const { data, error } = await supabase.from('profiles').select('*').limit(200);
      if (error) throw error;
      allUsers = (data || []).map((row: any) => ({
        id: row.id,
        email: row.email || '',
        name: row.name || '',
        username: row.username || (row.email ? row.email.split('@')[0] : 'user'),
        avatar: row.avatar || '',
        skills: row.skills || [],
        history: row.history || [],
        stats: row.stats || undefined,
        isCertified: !!row.is_certified
      } as User));
      fetchSuccess = true;
    } catch (error) {
      fetchSuccess = false;
    }
    
    if (!fetchSuccess) {
      const storageKey = 'devoffs_users_db_v1';
      const storedData = localStorage.getItem(storageKey);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        allUsers = Object.values(parsed);
      } else {
        allUsers = [currentUser]; 
      }
    }

    if (currentUser.id && !allUsers.find(u => u.id === currentUser.id)) {
      allUsers.push(currentUser);
    }

    let entries: LeaderboardEntry[] = allUsers.map(user => {
      let rawScore = 0;
      let secondaryScore = 0;
      let relevantHistory = user.history || [];

      if (timeframe !== 'all-time') {
        const now = Date.now();
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        const oneMonth = 30 * 24 * 60 * 60 * 1000;
        const cutoff = timeframe === 'weekly' ? now - oneWeek : now - oneMonth;
        relevantHistory = relevantHistory.filter(h => (h.endTime || 0) > cutoff);
      }

      if (domainFilter) {
        relevantHistory = relevantHistory.filter(h => h.domain === domainFilter);
      }

      if (metric === 'skill_dna') {
        if (relevantHistory.length > 0) {
          const totalAvg = relevantHistory.reduce((sum, h) => sum + (h.score?.average || 0), 0);
          const skillPoints = Math.round(totalAvg / relevantHistory.length);
          
          // Formula Vars
          // Consistency: 1.0 baseline, +0.1 for every 5 trials, max 2.0
          const consistency = Math.min(2.0, 1.0 + (relevantHistory.length * 0.02)); 
          // Speed: Inverse of average time (simulation) - higher score for faster execution
          // Difficulty: Assumed constant Level 5 for this formula simulation
          
          rawScore = calculateRankScore(skillPoints, consistency, 50, 5); 
        } else {
           rawScore = 0;
        }
        secondaryScore = relevantHistory.length; 
      } else if (metric === 'arena_wins') {
        rawScore = user.stats?.arenaWins || 0;
        secondaryScore = user.stats?.trialsCompleted || 0;
      } else if (metric === 'trials_completed') {
        rawScore = relevantHistory.length;
        secondaryScore = user.stats?.arenaWins || 0;
      }

      const domainCounts: Record<string, number> = {};
      (user.history || []).forEach(h => {
        domainCounts[h.domain] = (domainCounts[h.domain] || 0) + 1;
      });
      const topDomain = Object.entries(domainCounts).sort((a,b) => b[1] - a[1])[0];
      const domainSpecialty = topDomain ? topDomain[0] : (user.skills?.[0] || 'Generalist');

      return {
        id: user.id,
        rank: 0,
        name: user.name || user.username || 'Anonymous',
        avatar: user.avatar,
        domainSpecialty,
        score: rawScore, // Computed via formula
        secondaryScore,
        change: 0, 
        isCurrentUser: user.id === currentUser.id,
        isCertified: user.isCertified 
      };
    });

    entries = entries.filter(e => e.score > 0 || e.isCurrentUser);

    entries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.secondaryScore || 0) - (a.secondaryScore || 0);
    });

    entries = entries.map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));

    return entries;
  }
};
