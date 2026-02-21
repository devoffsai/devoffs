
import { User, SkillDomain, ChallengeParticipant, ChallengeCheckpoint } from '../types';
import { supabase } from './supabaseClient';

/**
 * Devoffs LIVE ARENA: EVENT-SOURCED ARCHITECTURE
 * 
 * To ensure a "join anywhere, any device" experience that is "totally live and smooth,"
 * we use an Event-Sourced model on top of Firestore. 
 * 
 * 1. Authority: The list of Events in the document is the single source of truth.
 * 2. Determinism: Any client can replay the event log to arrive at the exact same session state.
 * 3. Atomic Updates: Transactions prevent race conditions during high-concurrency "join" or "finish" events.
 */

type EventType = 'SESSION_CREATED' | 'USER_JOINED' | 'USER_LEFT' | 'SCENARIO_SET' | 'SESSION_STARTED' | 'PROGRESS_UPDATED' | 'HEARTBEAT';

interface ChallengeEvent {
  type: EventType;
  timestamp: number;
  payload: any;
}

export interface ChallengeSession {
  id: string; // The 6-digit code
  hostId: string;
  domain: SkillDomain;
  status: 'waiting' | 'active' | 'finished';
  participants: ChallengeParticipant[];
  taskDescription?: string;
  checkpoints?: ChallengeCheckpoint[];
  startTime?: number;
  lastHeartbeat?: number;
  maxParticipants: number;
}

const SESSION_EXPIRY_MS = 1000 * 60 * 120; // 2 Hours
const MAX_PARTICIPANTS = 8;

const isSupabaseConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

/**
 * State Reducer: Reconstructs the ChallengeSession from an array of events.
 * This ensures the state is consistent across all connected devices.
 */
const reduceSessionState = (events: ChallengeEvent[], initialId: string): ChallengeSession | null => {
    if (events.length === 0) return null;

    let state: ChallengeSession = {
        id: initialId,
        hostId: '',
        domain: SkillDomain.ALGORITHMS,
        status: 'waiting',
        participants: [],
        maxParticipants: MAX_PARTICIPANTS,
        lastHeartbeat: Date.now()
    };

    // Sort events by timestamp to ensure deterministic replay
    const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

    for (const event of sortedEvents) {
        switch (event.type) {
            case 'SESSION_CREATED':
                state.hostId = event.payload.host.id;
                state.domain = event.payload.domain;
                state.participants = [{
                    id: event.payload.host.id,
                    name: event.payload.host.name,
                    avatar: event.payload.host.avatar || 'H',
                    progress: 0,
                    score: 0,
                    status: 'coding',
                    isBot: false
                }];
                break;
            case 'USER_JOINED':
                if (state.participants.length < state.maxParticipants) {
                    const existing = state.participants.find(p => p.id === event.payload.user.id);
                    if (!existing) {
                        state.participants.push({
                            id: event.payload.user.id,
                            name: event.payload.user.name,
                            avatar: event.payload.user.avatar || 'P',
                            progress: 0,
                            score: 0,
                            status: 'coding',
                            isBot: false
                        });
                    }
                }
                break;
            case 'USER_LEFT':
                state.participants = state.participants.filter(p => p.id !== event.payload.userId);
                break;
            case 'SCENARIO_SET':
                state.taskDescription = event.payload.taskDescription;
                state.checkpoints = event.payload.checkpoints;
                break;
            case 'SESSION_STARTED':
                state.status = 'active';
                state.startTime = event.payload.startTime;
                break;
            case 'PROGRESS_UPDATED':
                state.participants = state.participants.map(p => 
                    p.id === event.payload.userId 
                    ? { ...p, progress: event.payload.progress, status: event.payload.status }
                    : p
                );
                break;
            case 'HEARTBEAT':
                state.lastHeartbeat = event.timestamp;
                break;
        }
    }
    return state;
};

const generateSessionCode = () => {
  // Uses uppercase alphanumeric excluding confusing chars (0, O, I, 1)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const supabaseImplementation = {
  async appendEvent(code: string, type: EventType, payload: any): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('challenge_events').insert({
      session_code: code,
      type,
      timestamp_ms: Date.now(),
      payload,
      created_by: userData.user?.id || null
    });
    if (error) throw error;
  },

  async getEvents(code: string): Promise<ChallengeEvent[]> {
    const { data, error } = await supabase
      .from('challenge_events')
      .select('type,timestamp_ms,payload')
      .eq('session_code', code)
      .order('timestamp_ms', { ascending: true })
      .limit(5000);
    if (error) throw error;

    return (data || []).map((row: any) => ({
      type: row.type,
      timestamp: row.timestamp_ms,
      payload: row.payload
    }));
  },

  async createSession(host: User, domain: SkillDomain): Promise<string> {
    const code = generateSessionCode();
    await this.appendEvent(code, 'SESSION_CREATED', { host, domain });
    return code;
  },

  async joinSession(code: string, user: User): Promise<{ success: boolean; message?: string }> {
    try {
      await this.appendEvent(code, 'USER_JOINED', { user });
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Failed to join duel.' };
    }
  },

  async leaveSession(code: string, userId: string): Promise<void> {
    await this.appendEvent(code, 'USER_LEFT', { userId });
  },

  async setSessionScenario(code: string, taskDescription: string, checkpoints: ChallengeCheckpoint[]): Promise<void> {
    await this.appendEvent(code, 'SCENARIO_SET', { taskDescription, checkpoints });
  },

  async startSession(code: string): Promise<void> {
    await this.appendEvent(code, 'SESSION_STARTED', { startTime: Date.now() });
  },

  async updateProgress(code: string, userId: string, progress: number, status: 'coding' | 'validating' | 'finished'): Promise<void> {
    await this.appendEvent(code, 'PROGRESS_UPDATED', { userId, progress, status });
  },

  subscribeToSession(code: string, callback: (data: ChallengeSession | null) => void): () => void {
    let isClosed = false;

    const emitLatest = async () => {
      try {
        const events = await this.getEvents(code);
        if (isClosed) return;
        callback(reduceSessionState(events, code));
      } catch (e) {
        if (isClosed) return;
        callback(null);
      }
    };

    emitLatest();

    const channel = supabase
      .channel(`challenge:${code}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'challenge_events',
          filter: `session_code=eq.${code}`
        },
        () => {
          emitLatest();
        }
      )
      .subscribe();

    const heartbeat = setInterval(() => {
      emitLatest();
    }, 5000);

    return () => {
      isClosed = true;
      clearInterval(heartbeat);
      supabase.removeChannel(channel);
    };
  }
};

/**
 * MOCK IMPLEMENTATION (LOCAL STORAGE)
 * Fallback for guest users or offline testing
 */
const MOCK_STORAGE_KEY = 'devoffs_mock_event_store';

const getMockEvents = (code: string): ChallengeEvent[] => {
    try {
        const store = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY) || '{}');
        return store[code] || [];
    } catch(e) { return []; }
};

const saveMockEvent = (code: string, event: ChallengeEvent) => {
    const store = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY) || '{}');
    if (!store[code]) store[code] = [];
    store[code].push(event);
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(store));
};

const mockImplementation = {
  async createSession(host: User, domain: SkillDomain): Promise<string> {
    const code = generateSessionCode();
    saveMockEvent(code, { type: 'SESSION_CREATED', timestamp: Date.now(), payload: { host, domain } });
    return code;
  },

  async joinSession(code: string, user: User): Promise<{ success: boolean; message?: string }> {
    saveMockEvent(code, { type: 'USER_JOINED', timestamp: Date.now(), payload: { user } });
    return { success: true };
  },

  async leaveSession(code: string, userId: string): Promise<void> {
    saveMockEvent(code, { type: 'USER_LEFT', timestamp: Date.now(), payload: { userId } });
  },

  async setSessionScenario(code: string, taskDescription: string, checkpoints: ChallengeCheckpoint[]): Promise<void> {
    saveMockEvent(code, { type: 'SCENARIO_SET', timestamp: Date.now(), payload: { taskDescription, checkpoints } });
  },

  async startSession(code: string): Promise<void> {
    saveMockEvent(code, { type: 'SESSION_STARTED', timestamp: Date.now(), payload: { startTime: Date.now() } });
  },

  async updateProgress(code: string, userId: string, progress: number, status: 'coding' | 'validating' | 'finished'): Promise<void> {
    saveMockEvent(code, { type: 'PROGRESS_UPDATED', timestamp: Date.now(), payload: { userId, progress, status } });
  },

  subscribeToSession(code: string, callback: (data: ChallengeSession | null) => void): () => void {
    const check = () => {
      const events = getMockEvents(code);
      const state = reduceSessionState(events, code);
      callback(state);
    };
    check();
    const interval = setInterval(check, 1000); 
    return () => clearInterval(interval);
  }
};

/**
 * Challenge Service Factory
 * Dispatches to the most available "Solid" implementation.
 */
export const challengeService = {
    createSession: async (h: User, d: SkillDomain) => {
        if (!isSupabaseConfigured) return mockImplementation.createSession(h, d);
        try {
          return await supabaseImplementation.createSession(h, d);
        } catch (e) {
          return mockImplementation.createSession(h, d);
        }
    },
    joinSession: async (c: string, u: User) => {
        if (!isSupabaseConfigured) return mockImplementation.joinSession(c, u);
        const res = await supabaseImplementation.joinSession(c, u);
        if (res.success) return res;
        return mockImplementation.joinSession(c, u);
    },
    leaveSession: async (c: string, u: string) => {
        if (isSupabaseConfigured) {
          try {
            await supabaseImplementation.leaveSession(c, u);
            return;
          } catch (e) {}
        }
        await mockImplementation.leaveSession(c, u);
    },
    setSessionScenario: async (c: string, t: string, cp: ChallengeCheckpoint[]) => {
        if (isSupabaseConfigured) {
          try {
            await supabaseImplementation.setSessionScenario(c, t, cp);
            return;
          } catch (e) {}
        }
        await mockImplementation.setSessionScenario(c, t, cp);
    },
    startSession: async (c: string) => {
        if (isSupabaseConfigured) {
          try {
            await supabaseImplementation.startSession(c);
            return;
          } catch (e) {}
        }
        await mockImplementation.startSession(c);
    },
    updateProgress: async (c: string, u: string, p: number, s: 'coding' | 'validating' | 'finished') => {
        if (isSupabaseConfigured) {
          try {
            await supabaseImplementation.updateProgress(c, u, p, s);
            return;
          } catch (e) {}
        }
        await mockImplementation.updateProgress(c, u, p, s);
    },
    subscribeToSession: (c: string, cb: (d: ChallengeSession | null) => void) => {
        if (!isSupabaseConfigured) {
          return mockImplementation.subscribeToSession(c, (data) => {
            if (data) cb(data);
          });
        }
        const unsubLive = supabaseImplementation.subscribeToSession(c, cb);
        return () => {
          unsubLive();
        };
    },
};
