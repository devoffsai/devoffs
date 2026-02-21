import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { Link } from 'react-router-dom';
import { Camera, User as UserIcon, Settings, Trophy, LogOut } from 'lucide-react';

interface Props {
  user: User;
  onLogout?: () => void;
}

export const UserMenu: React.FC<Props> = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Avatar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative group focus:outline-none"
        aria-label="User menu"
      >
        <div
          className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-all duration-200 ${
            isOpen
              ? 'border-cyan-400 ring-2 ring-cyan-400/20 scale-105'
              : 'border-slate-600 group-hover:border-slate-400 group-hover:scale-105 group-hover:shadow-lg'
          }`}
        >
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-slate-700 flex items-center justify-center">
              <span className="text-sm font-bold text-slate-300">
                {getInitials(user.name)}
              </span>
            </div>
          )}
        </div>
      </button>

      {/* Dropdown Modal */}
      {isOpen && (
        <div className="absolute right-0 top-14 w-80 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden z-50 animate-fade-in origin-top-right">
          
          {/* Section A: User Info */}
          <div className="flex flex-col items-center pt-8 pb-6 px-6 bg-slate-800/50 border-b border-slate-700">
            <Link to="/profile" onClick={() => setIsOpen(false)} className="relative group cursor-pointer">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-700 shadow-xl group-hover:border-slate-600 transition-colors">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                    <span className="text-3xl font-bold text-slate-400">
                      {getInitials(user.name)}
                    </span>
                  </div>
                )}
              </div>
            </Link>
            
            <div className="mt-4 text-center">
              <h3 className="text-lg font-bold text-white">{user.name || 'User'}</h3>
              <p className="text-sm text-slate-400">{user.email || 'email@example.com'}</p>
              {user.username && <p className="text-xs text-cyan-400 font-mono mt-1">@{user.username}</p>}
            </div>

            {!user.avatar && (
              <div className="mt-4 bg-cyan-900/20 border border-cyan-900/50 rounded-lg p-2 flex items-start gap-2 max-w-[220px]">
                <div className="text-cyan-400 shrink-0 mt-0.5 text-xs">ⓘ</div>
                <p className="text-xs text-cyan-200 text-left leading-tight">
                  Add a profile picture to personalize your account.
                </p>
              </div>
            )}
          </div>

          {/* Section B: Actions */}
          <div className="p-2 space-y-1">
            <MenuLink to="/profile" icon={<UserIcon size={18} />} label="View Profile" onClick={() => setIsOpen(false)} />
            <MenuLink to="/setup" icon={<Settings size={18} />} label="Account Settings" onClick={() => setIsOpen(false)} />
            <MenuLink to="/" icon={<Trophy size={18} />} label="My Trials & Achievements" onClick={() => setIsOpen(false)} />
          </div>

          {/* Section C: Log Out */}
          <div className="p-2 border-t border-slate-700 mt-1">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors group"
            >
              <LogOut size={18} className="group-hover:text-red-400 transition-colors" />
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const MenuLink = ({ icon, label, to, onClick }: { icon: React.ReactNode; label: string; to: string; onClick: () => void }) => (
  <Link 
    to={to} 
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-xl transition-all duration-200 group"
  >
    <span className="text-slate-500 group-hover:text-cyan-400 transition-colors">{icon}</span>
    {label}
  </Link>
);