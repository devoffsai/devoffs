
import React, { useState, useRef } from 'react';
import { User } from '../types';
import { useNavigate } from 'react-router-dom';
import { Camera, Check, Upload, User as UserIcon, Mail, FileText, ChevronRight, X, Sparkles, CheckCircle, MapPin, Image as ImageIcon } from 'lucide-react';

interface Props {
  user: User;
  onSave: (updatedUser: User) => void;
}

export const ProfileSetup: React.FC<Props> = ({ user, onSave }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: user.name || '',
    username: user.username || '',
    email: user.email || '',
    bio: user.bio || '',
    skills: user.skills || [] as string[],
    avatar: user.avatar || '',
    banner: user.banner || '',
    country: user.country || '',
  });

  const [tagInput, setTagInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      // Simulate upload delay
      setTimeout(() => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({ ...prev, avatar: reader.result as string }));
          setIsUploading(false);
        };
        reader.readAsDataURL(file);
      }, 1000);
    }
  };

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      setTimeout(() => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({ ...prev, banner: reader.result as string }));
          setIsUploading(false);
        };
        reader.readAsDataURL(file);
      }, 1000);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!formData.skills.includes(tagInput.trim())) {
        setFormData(prev => ({ ...prev, skills: [...prev.skills, tagInput.trim()] }));
      }
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({ ...prev, skills: prev.skills.filter(t => t !== tag) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Pass data back up
    onSave({
      ...user,
      name: formData.name,
      username: formData.username,
      email: formData.email,
      bio: formData.bio,
      skills: formData.skills,
      avatar: formData.avatar,
      banner: formData.banner,
      country: formData.country,
      isOnboarded: true,
    });
    navigate('/');
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center py-12 px-4 animate-fade-in">
      <div className="max-w-5xl w-full bg-slate-800/50 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Column: Form */}
        <div className="flex-1 p-8 md:p-12">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Complete Your Profile</h1>
            <p className="text-slate-400">Tell us about yourself to personalize your Skill DNA.</p>
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-cyan-400 tracking-wider uppercase">
              <span className="w-6 h-6 rounded-full bg-cyan-900 border border-cyan-500 flex items-center justify-center">1</span>
              <span>Account Created</span>
              <div className="h-px bg-slate-700 w-8"></div>
              <span className="w-6 h-6 rounded-full bg-cyan-900 border border-cyan-500 flex items-center justify-center text-white">2</span>
              <span className="text-white">Profile Details</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 text-slate-500" size={18} />
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                    placeholder="Jane Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Username</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500 font-mono">@</span>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-8 pr-4 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                    placeholder="janedoe"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-slate-500" size={18} />
                <input
                  type="email"
                  name="email"
                  disabled
                  value={formData.email}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-400 cursor-not-allowed"
                />
                <div className="absolute right-3 top-3 text-green-500">
                  <CheckCircle size={18} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
               <label className="text-sm font-medium text-slate-300">Country / Region</label>
               <div className="relative">
                 <MapPin className="absolute left-3 top-3 text-slate-500" size={18} />
                 <input
                   type="text"
                   name="country"
                   value={formData.country}
                   onChange={handleInputChange}
                   className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                   placeholder="e.g. Canada, United States"
                 />
               </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Bio</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 text-slate-500" size={18} />
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  maxLength={150}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all resize-none"
                  placeholder="Tell us briefly about your expertise..."
                />
                <span className="absolute right-2 bottom-2 text-xs text-slate-600">{formData.bio.length}/150</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Skills</label>
              <div className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 flex flex-wrap gap-2 min-h-[50px] focus-within:ring-2 focus-within:ring-cyan-500 focus-within:border-transparent transition-all">
                {formData.skills.map(skill => (
                  <span key={skill} className="bg-cyan-900/40 text-cyan-300 text-sm px-2 py-1 rounded-md flex items-center gap-1">
                    {skill}
                    <button type="button" onClick={() => removeTag(skill)} className="hover:text-cyan-100"><X size={14}/></button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  className="bg-transparent border-none outline-none text-white text-sm flex-1 min-w-[100px] h-8"
                  placeholder="Type skill & press Enter"
                />
              </div>
            </div>

            <div className="pt-6 flex gap-4">
              <button
                type="submit"
                className="flex-1 font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-900/20"
              >
                Complete Setup <ChevronRight size={20} />
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Visuals & Prefs */}
        <div className="md:w-80 bg-slate-900/50 p-8 flex flex-col items-center border-l border-slate-700">
          <div className="text-center mb-8">
            <h3 className="text-lg font-bold text-white mb-2">Profile Visuals</h3>
            <p className="text-xs text-slate-400">Customize your public appearance</p>
          </div>

          {/* Banner Upload */}
          <div className="w-full mb-6">
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block text-left">Cover Banner</label>
              <div className="group relative h-28 w-full rounded-xl bg-slate-800 border-2 border-dashed border-slate-700 overflow-hidden hover:border-slate-500 transition-colors">
                  {formData.banner ? (
                      <img src={formData.banner} alt="Banner" className="w-full h-full object-cover" />
                  ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
                          <ImageIcon size={24} className="mb-1" />
                          <span className="text-[10px]">Upload Cover</span>
                      </div>
                  )}
                  <button 
                     type="button" 
                     onClick={() => bannerInputRef.current?.click()}
                     className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold"
                  >
                     <Upload size={14} className="mr-1" /> Change
                  </button>
              </div>
              <input 
                  type="file" 
                  ref={bannerInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleBannerUpload}
              />
          </div>

          <label className="text-xs font-bold text-slate-500 uppercase mb-2 block w-full text-left">Profile Picture</label>
          <div className="relative group mb-8">
            <div className={`w-32 h-32 rounded-full overflow-hidden border-4 border-slate-700 shadow-2xl transition-all ${isUploading ? 'opacity-50' : ''}`}>
              {formData.avatar ? (
                <img src={formData.avatar} alt="Avatar Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center text-slate-600">
                   <UserIcon size={48} />
                </div>
              )}
            </div>
            
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            >
              <Camera className="text-white mb-2" size={24} />
              <span className="text-xs text-white font-medium">Change Photo</span>
            </button>
            
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleAvatarUpload}
            />
          </div>

          <div className="w-full space-y-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Preferences</h3>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Email Notifications</span>
              <div className="w-10 h-6 bg-cyan-900 rounded-full relative cursor-pointer border border-cyan-700">
                <div className="w-4 h-4 bg-cyan-400 rounded-full absolute top-1 right-1"></div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Profile Visibility</span>
              <div className="w-10 h-6 bg-cyan-900 rounded-full relative cursor-pointer border border-cyan-700">
                <div className="w-4 h-4 bg-cyan-400 rounded-full absolute top-1 right-1"></div>
              </div>
            </div>
            
            <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
               <div className="flex items-center gap-2 mb-2">
                 <Sparkles className="text-amber-400" size={16} />
                 <span className="text-xs font-bold text-white">Pro Tip</span>
               </div>
               <p className="text-xs text-slate-400 leading-relaxed">
                 Adding a banner and location increases verification trust score by <span className="text-green-400">12%</span>.
               </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};