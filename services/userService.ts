
import { supabase } from './supabaseClient';
import { User, SkillDomain } from '../types';

export interface CandidateFilter {
  query?: string;
  domain?: string;
  minSkillDNA?: number;
  minProblemSolving?: number;
  minConceptualDepth?: number;
  minTrials?: number;
  minArenaWins?: number;
}

// Helper to determine Tier based on domain
export const getSkillTier = (domain: SkillDomain): string => {
  const tier1 = [SkillDomain.SYSTEMS_PROG, SkillDomain.DISTRIBUTED_SYS, SkillDomain.SW_ARCH, SkillDomain.DATA_ENG, SkillDomain.ML_ENG];
  const tier2 = [SkillDomain.ROBOTICS, SkillDomain.EDGE_COMP, SkillDomain.AUTONOMOUS_SYS, SkillDomain.GAME_DEV];
  
  if (tier1.includes(domain)) return "Tier 1";
  if (tier2.includes(domain)) return "Tier 2";
  return "Tier 3"; // Default/General
};

export const userService = {
  
  // Primary function to fetch and filter candidates from LIVE data sources
  async searchCandidates(filter: CandidateFilter): Promise<User[]> {
    let users: User[] = [];
    let fetchSuccess = false;

    // 1. Fetch Real Data Only (No Mocks)
    try {
      const { data, error } = await supabase.from('profiles').select('*').limit(100);
      if (error) throw error;
      users = (data || []).map((row: any) => ({
        id: row.id,
        email: row.email || '',
        name: row.name || '',
        username: row.username || (row.email ? row.email.split('@')[0] : 'user'),
        avatar: row.avatar || '',
        banner: row.banner || undefined,
        country: row.country || undefined,
        bio: row.bio || undefined,
        skills: row.skills || [],
        history: row.history || [],
        stats: row.stats || undefined,
        isOnboarded: !!row.is_onboarded,
        isCertified: !!row.is_certified
      } as User));
      fetchSuccess = true;
    } catch (e) {
      console.warn('Supabase Fetch Candidates Failed:', e);
      fetchSuccess = false;
    }
    
    // Fallback to LocalStorage if DB fetch failed or DB is offline
    if (!fetchSuccess) {
      const storageKey = 'devoffs_users_db_v1';
      const storedData = localStorage.getItem(storageKey);
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          users = Object.values(parsedData);
        } catch (e) {
          console.error("Error parsing local storage users", e);
          users = [];
        }
      }
    }

    // 2. Filter (Strict Client-Side Filtering)
    const filteredUsers = users.filter(user => {
      // Basic profile validation
      if (!user.name && !user.username) return false;

      // Calculate averages dynamically for filtering
      const avgScore = user.history && user.history.length > 0
        ? user.history.reduce((sum, h) => sum + (h.score?.average || 0), 0) / user.history.length
        : 0;
      
      const lastTrial = user.history?.[0]?.score;
      const arenaWins = user.stats?.arenaWins || 0;
      const trialsCompleted = user.stats?.trialsCompleted || (user.history?.length || 0);

      // Text Query
      if (filter.query) {
        const q = filter.query.toLowerCase();
        const matchesName = user.name.toLowerCase().includes(q);
        const matchesUser = user.username?.toLowerCase().includes(q);
        const matchesSkill = user.skills?.some(s => s.toLowerCase().includes(q));
        const matchesBio = user.bio?.toLowerCase().includes(q);
        if (!matchesName && !matchesUser && !matchesSkill && !matchesBio) return false;
      }

      // Domain Filter
      if (filter.domain && filter.domain !== "All") {
        const hasHistoryInDomain = user.history?.some(h => h.domain === filter.domain);
        const listsSkill = user.skills?.includes(filter.domain);
        if (!hasHistoryInDomain && !listsSkill) return false;
      }

      // Numeric Thresholds
      if (filter.minSkillDNA && avgScore < filter.minSkillDNA) return false;
      if (filter.minTrials && trialsCompleted < filter.minTrials) return false;
      if (filter.minArenaWins && arenaWins < filter.minArenaWins) return false;
      
      // Advanced DNA filters
      if (filter.minProblemSolving && lastTrial && lastTrial.problemSolving < filter.minProblemSolving) return false;
      if (filter.minConceptualDepth && lastTrial && lastTrial.conceptualDepth < filter.minConceptualDepth) return false;

      return true;
    });

    // 3. Sorting: Certified Users First, then by Skill DNA Score
    return filteredUsers.sort((a, b) => {
      // Priority 1: Certified (Exam) Status
      if (a.isCertified && !b.isCertified) return -1;
      if (!a.isCertified && b.isCertified) return 1;

      // Priority 2: Average Skill DNA Score
      const scoreA = a.history && a.history.length ? a.history.reduce((s, h) => s + (h.score?.average || 0), 0) / a.history.length : 0;
      const scoreB = b.history && b.history.length ? b.history.reduce((s, h) => s + (h.score?.average || 0), 0) / b.history.length : 0;
      
      return scoreB - scoreA;
    });
  }
};
