
import React, { useState } from 'react';
import { Check, Globe } from 'lucide-react';
import { User } from '../types';

interface Props {
  user: User;
}

export const Pricing: React.FC<Props> = ({ user }) => {
  return (
    <div className="max-w-6xl mx-auto py-12 px-4 animate-fade-in">
      <div className="text-center mb-16 space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold text-white">Devoffs is Free</h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
          No memberships. No subscriptions. No paywalls.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 flex flex-col order-2 md:order-1">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white">Access</h3>
            <div className="mt-4 flex items-baseline">
              <span className="text-4xl font-bold text-white">$0</span>
              <span className="text-slate-500 ml-2">/forever</span>
            </div>
            <p className="mt-4 text-slate-400 text-sm">Everything is available for everyone.</p>
          </div>
          <ul className="space-y-4 mb-8 flex-1">
            <li className="flex items-start gap-3 text-slate-300 text-sm"><Check size={16} className="text-green-400 mt-1"/> Unlimited Skill Trials</li>
            <li className="flex items-start gap-3 text-slate-300 text-sm"><Check size={16} className="text-green-400 mt-1"/> Unlimited AI Interviews</li>
            <li className="flex items-start gap-3 text-slate-300 text-sm"><Check size={16} className="text-green-400 mt-1"/> Certification Exams included</li>
          </ul>
          <div className="w-full py-3 bg-slate-700/50 text-slate-400 font-medium rounded-xl cursor-default border border-slate-700 text-center">
            Free for all users
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 flex flex-col order-3">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2"><Globe size={20} className="text-purple-400" /> Community</h3>
            <p className="mt-4 text-slate-400 text-sm">Built for developers and teams. Free to use.</p>
          </div>
          <ul className="space-y-4 mb-8 flex-1">
            <li className="flex items-start gap-3 text-slate-300 text-sm"><Check size={16} className="text-purple-400 mt-1"/> Public leaderboards</li>
            <li className="flex items-start gap-3 text-slate-300 text-sm"><Check size={16} className="text-purple-400 mt-1"/> Recruiter search</li>
            <li className="flex items-start gap-3 text-slate-300 text-sm"><Check size={16} className="text-purple-400 mt-1"/> Live arena challenges</li>
          </ul>
          <div className="w-full py-3 bg-slate-700/50 text-slate-400 font-medium rounded-xl cursor-default border border-slate-700 text-center">
            No payment required
          </div>
        </div>
      </div>
    </div>
  );
};
