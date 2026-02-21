import { supabase } from './supabaseClient';
import { User } from '../types';

export type TrialInsert = {
  id: string;
  user_id: string;
  domain: string;
  status: string;
  start_time: number;
  end_time: number;
  score: any;
  feedback?: string | null;
  created_at?: string;
};

export const trialService = {
  async recordTrial(user: User, session: any): Promise<void> {
    if (!user?.id) return;

    try {
      const payload: TrialInsert = {
        id: session.id,
        user_id: user.id,
        domain: session.domain,
        status: session.status,
        start_time: session.startTime,
        end_time: session.endTime,
        score: session.score,
        feedback: session.feedback || null
      };

      const { error } = await supabase.from('trials').insert(payload);
      if (error) {
        console.warn('Supabase recordTrial failed:', error.message);
      }
    } catch (e) {
      console.warn('Supabase recordTrial failed:', e);
    }
  }
};
