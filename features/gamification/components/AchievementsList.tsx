import React from 'react';
import { useGamificationData } from '../hooks/useGamificationData';
import { Achievement } from '../types';

const AchievementCard: React.FC<{ achievement: Achievement }> = ({ achievement }) => {
  const { icon, title, description, isUnlocked, reward } = achievement;

  return (
    <div 
      className={`border rounded-2xl p-5 flex items-center gap-5 transition-all duration-300 ${
        isUnlocked
          ? 'border-cyan-400/40 bg-black shadow-[0_0_15px_rgba(0,240,255,0.15)]'
          : 'border-gray-800 bg-gray-900/50 grayscale opacity-60'
      }`}
    >
      <div className={`text-5xl transition-transform duration-300 ${isUnlocked ? 'animate-pulse' : ''}`}>
        {icon}
      </div>
      <div className="flex-1">
        <h3 className={`font-bold text-lg ${isUnlocked ? 'text-cyan-300' : 'text-gray-400'}`}>
          {title}
        </h3>
        <p className={`text-sm ${isUnlocked ? 'text-gray-300' : 'text-gray-500'}`}>
          {description}
        </p>
      </div>
      <div className={`text-right ${isUnlocked ? 'text-yellow-400' : 'text-gray-600'}`}>
        <p className="font-bold text-xl">{reward}</p>
        <p className="text-xs font-mono">GEMS</p>
      </div>
    </div>
  );
};

export const AchievementsList: React.FC = () => {
  const { achievements } = useGamificationData();

  const unlockedCount = achievements.filter(a => a.isUnlocked).length;
  const totalCount = achievements.length;
  const progressPercentage = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold text-white">Achievements</h2>
          <span className="font-mono text-cyan-400">{unlockedCount} / {totalCount} Unlocked</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-4 border border-cyan-500/20">
          <div 
            className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Achievements Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {achievements.map(ach => (
          <AchievementCard key={ach.id} achievement={ach} />
        ))}
      </div>
    </div>
  );
};
