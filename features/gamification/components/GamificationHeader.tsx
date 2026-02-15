import React from 'react';

// Assuming levelingService is in the services directory as created before
// We need to define the XP constant or import it if it's exported from the service
const XP_CONSTANT = 100;

const xpForLevel = (level: number): number => {
  if (level <= 1) return 0;
  return XP_CONSTANT * Math.pow(level - 1, 2);
};

interface UserProfile {
  name: string;
  avatar: string;
  level: number;
  xp: number;
}

interface GamificationHeaderProps {
  userProfile: UserProfile;
  currency: number;
}

export const GamificationHeader: React.FC<GamificationHeaderProps> = ({ userProfile, currency }) => {
  const { name, avatar, level, xp } = userProfile;

  const xpForCurrentLevel = xpForLevel(level);
  const xpForNextLevel = xpForLevel(level + 1);
  
  const xpInCurrentLevel = xp - xpForCurrentLevel;
  const totalXpForLevel = xpForNextLevel - xpForCurrentLevel;
  
  const progressPercentage = totalXpForLevel > 0 ? (xpInCurrentLevel / totalXpForLevel) * 100 : 0;

  return (
    <div className="bg-black/30 backdrop-blur-md border border-cyan-500/20 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_0_20px_rgba(0,240,255,0.1)]">
      
      {/* User Info */}
      <div className="flex items-center gap-4">
        <img 
          src={avatar} 
          alt={`${name}'s avatar`} 
          className="w-16 h-16 rounded-full border-2 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.5)]"
        />
        <div>
          <h2 className="text-xl font-bold text-white tracking-wider">{name}</h2>
          <p className="text-sm text-cyan-300 font-mono">Level {level}</p>
        </div>
      </div>

      {/* Level Progress */}
      <div className="w-full md:w-1/3">
        <div className="flex justify-between text-xs font-mono text-cyan-400/80 mb-1">
          <span>{Math.floor(xpInCurrentLevel)} / {totalXpForLevel} XP</span>
          <span>Next Level</span>
        </div>
        <div className="w-full bg-cyan-900/50 rounded-full h-2.5 border border-cyan-500/30 overflow-hidden">
          <div 
            className="bg-cyan-400 h-full rounded-full shadow-[0_0_10px_rgba(0,240,255,0.9)] transition-all duration-500" 
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* Gem Counter */}
      <div className="bg-gradient-to-br from-cyan-500/20 to-black p-4 rounded-2xl border border-cyan-400/50 flex items-center gap-4 shadow-lg">
        <div className="text-4xl animate-pulse">💎</div>
        <div>
          <p className="text-xs font-mono text-cyan-300 uppercase tracking-widest">Gems</p>
          <p className="text-3xl font-black text-white" style={{ textShadow: '0 0 10px #00f0ff, 0 0 20px #00f0ff' }}>
            {currency}
          </p>
        </div>
      </div>
    </div>
  );
};
