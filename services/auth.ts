
import { User } from '../types';
import { supabase } from './supabaseClient';

// ------------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------------

const isSupabaseConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
if (isSupabaseConfigured) {
  console.log('✅ Devoffs Backend: Supabase configured (Auth + Database)');
} else {
  console.log('⚠️ Devoffs Backend: Supabase env vars missing. Running in LocalStorage Simulation Mode.');
}

// ------------------------------------------------------------------
// INTERFACE DEFINITION
// ------------------------------------------------------------------

export interface AuthService {
  login(email: string, password: string): Promise<User>;
  register(email: string, password: string): Promise<User>;
  loginAsGuest(): Promise<User>;
  logout(): Promise<void>;
  updateUser(user: User): Promise<void>;
  onAuthStateChange(callback: (user: User | null) => void): () => void;
}

// ------------------------------------------------------------------
// REAL BACKEND IMPLEMENTATION (Supabase)
// ------------------------------------------------------------------

type ProfileRow = {
  id: string;
  email: string | null;
  name: string | null;
  username: string | null;
  avatar: string | null;
  banner: string | null;
  country: string | null;
  bio: string | null;
  skills: string[] | null;
  history: any[] | null;
  stats: any | null;
  is_onboarded: boolean | null;
  is_certified: boolean | null;
};

const mapProfileToUser = (profile: ProfileRow, isAuthenticated: boolean): User => {
  const email = profile.email || '';
  return {
    id: profile.id,
    email,
    name: profile.name || '',
    username: profile.username || (email ? email.split('@')[0] : 'user'),
    avatar: profile.avatar || '',
    banner: profile.banner || undefined,
    country: profile.country || undefined,
    bio: profile.bio || undefined,
    skills: profile.skills || [],
    history: (profile.history as any) || [],
    stats: (profile.stats as any) || undefined,
    isOnboarded: !!profile.is_onboarded,
    isCertified: !!profile.is_certified,
    isAuthenticated
  };
};

const supabaseService: AuthService = {
  async login(email: string, password: string): Promise<User> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Login failed');

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      const fallback: User = {
        id: data.user.id,
        email: data.user.email || email,
        name: '',
        username: (data.user.email || email).split('@')[0],
        avatar: '',
        isOnboarded: false,
        isAuthenticated: true,
        history: [],
        skills: []
      };
      return fallback;
    }

    return mapProfileToUser(profile as ProfileRow, true);
  },

  async register(email: string, password: string): Promise<User> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Signup failed');

    const user: User = {
      id: data.user.id,
      email,
      name: '',
      username: email.split('@')[0],
      avatar: '',
      isOnboarded: false,
      isAuthenticated: true,
      history: [],
      skills: []
    };

    await this.updateUser(user);
    return user;
  },

  async loginAsGuest(): Promise<User> {
    await new Promise(resolve => setTimeout(resolve, 250));
    const guestId = 'guest_' + Date.now();
    const guestUser: User = {
      id: guestId,
      name: 'Guest Explorer',
      username: 'guest',
      email: '',
      avatar: '',
      isOnboarded: true,
      isAuthenticated: true,
      history: [],
      skills: ['Explorer'],
      bio: 'Just exploring.'
    };
    localStorage.setItem(SESSION_KEY, 'GUEST_MODE');
    localStorage.setItem('devoffs_guest_data', JSON.stringify(guestUser));
    return guestUser;
  },

  async logout(): Promise<void> {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('devoffs_guest_data');
    await supabase.auth.signOut();
  },

  async updateUser(user: User): Promise<void> {
    if (!user.id) return;
    if (user.id.startsWith('guest_') || user.id.startsWith('offline_guest_')) {
      localStorage.setItem('devoffs_guest_data', JSON.stringify(user));
      return;
    }

    const payload = {
      id: user.id,
      email: user.email || null,
      name: user.name || null,
      username: user.username || null,
      avatar: user.avatar || null,
      banner: user.banner || null,
      country: user.country || null,
      bio: user.bio || null,
      skills: user.skills || [],
      history: user.history || [],
      stats: user.stats || null,
      is_onboarded: !!user.isOnboarded,
      is_certified: !!user.isCertified,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase profile upsert failed:', error.message);
    }
  },

  onAuthStateChange(callback: (user: User | null) => void): () => void {
    const session = localStorage.getItem(SESSION_KEY);
    if (session === 'GUEST_MODE') {
      const guestData = localStorage.getItem('devoffs_guest_data');
      if (guestData) {
        callback(JSON.parse(guestData));
        return () => {};
      }
    }

    if (!isSupabaseConfigured) {
      callback(null);
      return () => {};
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session?.user) {
        callback(null);
        return;
      }
      const uid = data.session.user.id;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', uid).single();
      if (profile) callback(mapProfileToUser(profile as ProfileRow, true));
      else {
        callback({
          id: uid,
          email: data.session.user.email || '',
          name: '',
          username: (data.session.user.email || '').split('@')[0] || 'user',
          avatar: '',
          isOnboarded: false,
          isAuthenticated: true,
          history: []
        } as User);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sessionData) => {
      const u = sessionData?.user;
      if (!u) {
        callback(null);
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', u.id).single();
      if (profile) callback(mapProfileToUser(profile as ProfileRow, true));
      else {
        callback({
          id: u.id,
          email: u.email || '',
          name: '',
          username: (u.email || '').split('@')[0] || 'user',
          avatar: '',
          isOnboarded: false,
          isAuthenticated: true,
          history: []
        } as User);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }
};

// ------------------------------------------------------------------
// MOCK IMPLEMENTATION (LocalStorage)
// ------------------------------------------------------------------

const STORAGE_KEY = 'devoffs_users_db_v1';
const SESSION_KEY = 'devoffs_mock_session_user';
const DELAY_MS = 800;

interface StoredUser extends User {
  passwordHash: string;
}

const mockService: AuthService = {
  async login(email: string, password: string): Promise<User> {
    await new Promise(resolve => setTimeout(resolve, DELAY_MS)); 

    const dbLocal = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const user = dbLocal[email] as StoredUser | undefined;

    if (!user) {
      throw new Error("Account not found. Please sign up.");
    }

    const hash = btoa(password);
    if (user.passwordHash !== hash) {
      throw new Error("Invalid password.");
    }

    const { passwordHash, ...safeUser } = user;
    localStorage.setItem(SESSION_KEY, email); // Persist mock session
    return { ...safeUser, isAuthenticated: true };
  },

  async register(email: string, password: string): Promise<User> {
    await new Promise(resolve => setTimeout(resolve, DELAY_MS));

    const dbLocal = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    
    if (dbLocal[email]) {
      throw new Error("User already exists with this email.");
    }

    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      email,
      name: '',
      username: email.split('@')[0],
      passwordHash: btoa(password),
      avatar: '',
      isOnboarded: false,
      history: [],
      skills: []
    };

    dbLocal[email] = newUser;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dbLocal));
    localStorage.setItem(SESSION_KEY, email); // Persist mock session

    const { passwordHash, ...safeUser } = newUser;
    return { ...safeUser, isAuthenticated: true };
  },

  async loginAsGuest(): Promise<User> {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      const guestId = 'guest_' + Date.now();
      const guestUser: User = {
          id: guestId,
          name: 'Guest Explorer',
          username: 'guest',
          email: '',
          avatar: '',
          isOnboarded: true,
          isAuthenticated: true,
          history: [],
          skills: ['Explorer'],
          bio: 'Just exploring.'
      };
      localStorage.setItem(SESSION_KEY, 'GUEST_MODE');
      localStorage.setItem('devoffs_guest_data', JSON.stringify(guestUser));
      return guestUser;
  },

  async logout(): Promise<void> {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('devoffs_guest_data');
    await new Promise(resolve => setTimeout(resolve, 200));
  },

  async updateUser(user: User): Promise<void> {
    // If it's a guest, update guest data
    if (user.id.startsWith('guest')) {
         localStorage.setItem('devoffs_guest_data', JSON.stringify(user));
         return;
    }
    
    if (!user.email) return;
    await new Promise(resolve => setTimeout(resolve, 500));

    const dbLocal = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const existing = dbLocal[user.email];

    if (existing) {
      const { passwordHash } = existing;
      dbLocal[user.email] = { ...user, passwordHash };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dbLocal));
    }
  },

  onAuthStateChange(callback: (user: User | null) => void): () => void {
    // Check for guest session first
    const session = localStorage.getItem(SESSION_KEY);
    if (session === 'GUEST_MODE') {
        const guestData = localStorage.getItem('devoffs_guest_data');
        if (guestData) {
            callback(JSON.parse(guestData));
            return () => {};
        }
    }

    if (session) {
      const dbLocal = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const user = dbLocal[session];
      if (user) {
        const { passwordHash, ...safeUser } = user;
        callback({ ...safeUser, isAuthenticated: true });
      } else {
        callback(null);
      }
    } else {
      callback(null);
    }
    return () => {};
  }
};

// ------------------------------------------------------------------
// EXPORT (Factory)
// ------------------------------------------------------------------

// Only use Firebase Service if it successfully initialized
export const authService = isSupabaseConfigured ? supabaseService : mockService;
