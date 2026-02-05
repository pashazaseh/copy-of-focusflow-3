import React, { useMemo, useState, useEffect, useRef } from 'react';
import { StudyLog, Transaction, ShopItem } from '../types';
import { getUnlockedAchievements, RANKS, getDailyQuests, getAchievementReward } from '../services/gamificationService';
import * as storage from '../services/storageService';
import { playSpinTick, playWin, playTone } from '../services/audioService';
import { useTheme, useLogs } from '../AppContext';

interface GamificationPanelProps {
  allLogs: StudyLog[];
  totalHours: number;
  streak: number;
  isDataLoaded?: boolean;
}

interface Particle {
    id: string;
    x: number;
    y: number;
    color: string;
    text?: string;
}

// --- Constants & Helpers ---

const RARITY_COLORS: Record<string, string> = {
    common: 'text-slate-400 border-slate-600',
    uncommon: 'text-green-400 border-green-600',
    rare: 'text-blue-400 border-blue-600',
    epic: 'text-purple-400 border-purple-600',
    mythic: 'text-red-400 border-red-600',
    legendary: 'text-yellow-400 border-yellow-600'
};

const STATIC_SHOP_ITEMS: ShopItem[] = [
    { id: 'vault_mystery', name: 'Mystery Vault', icon: '📦', cost: 50, desc: 'Chance for Coins/Items. (Cost: 2.5h Work)', type: 'consumable', category: 'Gamble' },
    { id: 'vault_mega', name: 'Mega Vault', icon: '💎', cost: 150, desc: 'High stakes loot. (Cost: 7.5h Work)', type: 'consumable', category: 'Gamble' },
    { id: 'mech_double', name: 'Double or Nothing', icon: '🎲', cost: 50, desc: 'Bet 50. Win 100 or lose all.', type: 'consumable', category: 'Gamble' },
    { id: 'boba', name: 'Boba Tea', icon: '🧋', cost: 50, desc: 'Treat. Requires 5 hours of focus.', type: 'consumable', category: 'Micro' },
    { id: 'app_purchase', name: 'App Purchase', icon: '📱', cost: 20, desc: 'Small digital tool/game.', type: 'consumable', category: 'Micro' },
    { id: 'uber', name: 'Uber Ride', icon: '🚖', cost: 40, desc: 'Lazy tax. Costs 4 hours of work.', type: 'consumable', category: 'Micro' },
    { id: 'repair_combo', name: 'Repair Combo', icon: '🔧', cost: 60, desc: 'Repair a streak gap. (6h Work)', type: 'consumable', category: 'Micro' },
    { id: 'screen_free', name: 'Screen-Free Evening', icon: '🌙', cost: 60, desc: '6 hours of work buys a night off.', type: 'consumable', category: 'Micro' },
    { id: 'freeze', name: 'Streak Freeze', icon: '🛡️', cost: 100, desc: 'Protect momentum.', type: 'consumable', category: 'Minor' },
    { id: 'temu', name: 'Temu Order', icon: '📦', cost: 100, desc: 'Gadgets. Requires 10 hours work.', type: 'consumable', category: 'Minor' },
    { id: 'chiro', name: 'Chiropractor', icon: '🦴', cost: 150, desc: 'Back health. 15 hours work.', type: 'consumable', category: 'Minor' },
    { id: 'dessert', name: 'Cheat Dessert', icon: '🍰', cost: 150, desc: 'Guilt-free reward. (15h Work)', type: 'consumable', category: 'Minor' },
    { id: 'cloth_shopping', name: 'New Cloth Shopping', icon: '👕', cost: 200, desc: '20 Hours of work.', type: 'consumable', category: 'Minor' },
    { id: 'day_trip', name: 'Lone Day Trip', icon: '🗺️', cost: 350, desc: 'Adventure. 35 hours work.', type: 'consumable', category: 'Moderate' },
    { id: 'theme_cyber', name: 'Cyberpunk Theme', icon: '🌆', cost: 500, desc: 'Unlock visual theme. (50h Work)', type: 'unlock', category: 'Moderate' },
    { id: 'vacation', name: 'Vacation Ticket', icon: '✈️', cost: 500, desc: 'Take a break! (50h Work)', type: 'consumable', category: 'Moderate' },
    { id: 'app_coding', name: 'Coding Sprint', icon: '👨‍💻', cost: 550, desc: 'Investment.', type: 'consumable', category: 'Moderate' },
    { id: 'yes_man', name: '"Yes Man" Day', icon: '👍', cost: 600, desc: 'Say yes to everything.', type: 'consumable', category: 'Moderate' },
    { id: 'netflix_series', name: 'Netflix Binge', icon: '🎬', cost: 1000, desc: 'Permission to watch. (100h Work)', type: 'consumable', category: 'Major' },
    { id: 'videogame', name: 'New Video Game', icon: '🎮', cost: 1500, desc: 'AAA Title. 150 hours work.', type: 'consumable', category: 'Major' },
    { id: 'streaming_sub', name: 'Streaming Subscription', icon: '📺', cost: 2000, desc: 'Yearly sub.', type: 'consumable', category: 'Major' },
    { id: 'photo_upgrade', name: 'Photo Upgrade', icon: '📸', cost: 3500, desc: 'Lens/Body. 350 hours.', type: 'consumable', category: 'Major' },
    { id: 'laptop', name: 'New Electronics', icon: '💻', cost: 4000, desc: 'Critical Tool. 400 hours focus.', type: 'consumable', category: 'Major' },
];

const getCategoryColor = (cat: string, isCyberpunk: boolean) => {
    switch(cat) {
        case 'Gamble': return isCyberpunk ? 'text-[#ff00ff] border-[#ff00ff]/30 bg-[#ff00ff]/10' : 'text-pink-600 bg-pink-100 border-pink-200 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-800';
        case 'Micro': return isCyberpunk ? 'text-[#00ff00] border-[#00ff00]/30 bg-[#00ff00]/10' : 'text-green-600 bg-green-100 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
        case 'Minor': return isCyberpunk ? 'text-[#00f0ff] border-[#00f0ff]/30 bg-[#00f0ff]/10' : 'text-blue-600 bg-blue-100 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800';
        case 'Moderate': return isCyberpunk ? 'text-[#a855f7] border-[#a855f7]/30 bg-[#a855f7]/10' : 'text-purple-600 bg-purple-100 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800';
        case 'Major': return isCyberpunk ? 'text-[#f97316] border-[#f97316]/30 bg-[#f97316]/10' : 'text-orange-600 bg-orange-100 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800';
        case 'Investment': return isCyberpunk ? 'text-[#eab308] border-[#eab308]/30 bg-[#eab308]/10' : 'text-yellow-600 bg-yellow-100 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800';
        default: return 'text-gray-400';
    }
};

// --- Sub-Components ---

const ParticleOverlay: React.FC<{ particles: Particle[] }> = ({ particles }) => (
    <>
        <style>{`
            @keyframes particle-explode {
                0% { transform: translate(0, 0) scale(1); opacity: 1; }
                100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
            }
            .particle {
                position: fixed;
                pointer-events: none;
                animation: particle-explode 0.8s ease-out forwards;
                z-index: 9999;
                border-radius: 50%;
            }
        `}</style>
        {particles.map(p => (
            <div
                key={p.id}
                className="particle"
                style={{
                    left: p.x,
                    top: p.y,
                    backgroundColor: p.color,
                    width: '6px',
                    height: '6px',
                    '--tx': `${(Math.random() - 0.5) * 150}px`,
                    '--ty': `${(Math.random() - 0.5) * 150}px`
                } as React.CSSProperties}
            >
                {p.text && <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-xs font-bold" style={{color: p.color}}>{p.text}</span>}
            </div>
        ))}
    </>
);

const InventoryGrid: React.FC<{
    inventory: Record<string, any>;
    items: ShopItem[];
    handleConsume: (id: string) => void;
    handleSell: (id: string, e: React.MouseEvent) => void;
    isCyberpunk: boolean;
}> = ({ inventory, items, handleConsume, handleSell, isCyberpunk }) => (
    <div className={`rounded-3xl p-8 border ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-slate-800/50 border-white/5'}`}>
        <h3 className={`text-xl font-bold mb-6 flex items-center gap-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>
            <span className="text-2xl">🎒</span> Inventory
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.filter(item => {
                if (item.type === 'unlock') return inventory[item.id];
                if (item.id === 'freeze') return (inventory.streakFreeze || 0) > 0;
                if (item.id === 'dessert') return (inventory.cheatDessert || 0) > 0;
                if (item.id === 'vacation') return false;
                return (inventory[item.id] || 0) > 0;
            }).length === 0 ? (
                <div className={`col-span-full text-center py-8 ${isCyberpunk ? 'text-[#00f0ff]/40' : 'text-slate-500'}`}>Your inventory is empty. Visit the shop!</div>
            ) : (
                items.filter(item => {
                    if (item.type === 'unlock') return inventory[item.id];
                    if (item.id === 'freeze') return (inventory.streakFreeze || 0) > 0;
                    if (item.id === 'dessert') return (inventory.cheatDessert || 0) > 0;
                    if (item.id === 'vacation') return false;
                    return (inventory[item.id] || 0) > 0;
                }).map(item => {
                    let count = 0;
                    if (item.id === 'freeze') count = inventory.streakFreeze;
                    else if (item.id === 'dessert') count = inventory.cheatDessert;
                    else if (item.type !== 'unlock') count = inventory[item.id];

                    return (
                        <div key={item.id} className={`flex items-center justify-between p-4 rounded-xl border ${isCyberpunk ? 'bg-black border-[#00f0ff]/30' : 'bg-black/20 border-white/10'}`}>
                            <div className="flex items-center gap-3">
                                <div className="text-2xl">{item.icon}</div>
                                <div>
                                    <p className={`font-bold text-sm ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>{item.name}</p>
                                    {item.type !== 'unlock' && <p className={`text-xs ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-400'}`}>Owned: {count}</p>}
                                </div>
                            </div>
                            {item.type !== 'unlock' && (
                                <div className="flex gap-2">
                                    <button onClick={() => handleConsume(item.id)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/30' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}>Use</button>
                                    <button onClick={(e) => handleSell(item.id, e)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${isCyberpunk ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-red-100 text-red-600 hover:bg-red-200'}`} title={`Sell for ${Math.floor(item.cost * 0.6)} Gems`}>Sell</button>
                                </div>
                            )}
                            {item.type === 'unlock' && (
                                <div className="flex gap-2 items-center">
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${isCyberpunk ? 'bg-[#00ff00]/20 text-[#00ff00]' : 'bg-green-900/20 text-green-400'}`}>Active</span>
                                    <button onClick={(e) => handleSell(item.id, e)} className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-colors ${isCyberpunk ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-red-100 text-red-600 hover:bg-red-200'}`} title={`Sell for ${Math.floor(item.cost * 0.6)} Gems`}>Sell</button>
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    </div>
);

const ShopGrid: React.FC<{
    inventory: Record<string, any>;
    items: ShopItem[];
    currentGems: number;
    handleBuy: (item: ShopItem, e: React.MouseEvent) => void;
    handleDeleteCustom: (id: string) => void;
    isCyberpunk: boolean;
}> = ({ inventory, items, currentGems, handleBuy, handleDeleteCustom, isCyberpunk }) => (
    <div className={`rounded-3xl p-8 border shadow-2xl relative overflow-hidden ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-gradient-to-br from-slate-900 to-slate-800 border-white/10'}`}>
        <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none ${isCyberpunk ? 'bg-[#00f0ff]/10' : 'bg-purple-500/10'}`}></div>
        <h3 className={`text-2xl font-bold mb-8 flex items-center gap-3 relative z-10 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>
            <span className="text-3xl">🏦</span> Market <span className={`text-sm font-normal ml-2 opacity-60 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-slate-300'}`}>(Spend your winnings)</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
            {items.map(item => {
                const isExpired = item.expiryDate ? new Date(item.expiryDate) < new Date() : false;
                return (
                <div key={item.id} className={`group rounded-2xl p-5 transition-all duration-300 flex flex-col gap-4 relative ${isCyberpunk ? 'bg-black border-[#00f0ff]/20 hover:border-[#00f0ff]' : 'bg-black/20 hover:bg-white/5 border-white/5 hover:border-purple-500/50'} ${inventory[item.id] && item.type === 'unlock' ? (isCyberpunk ? 'border-[#00ff00]/50 bg-[#00ff00]/10' : 'border-green-500/30 bg-green-900/10') : ''} ${isExpired ? 'opacity-60 grayscale' : ''}`}>
                    {item.isCustom && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteCustom(item.id); }}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/20 hover:bg-red-500/20 text-gray-400 hover:text-red-500 transition-all z-20 opacity-0 group-hover:opacity-100"
                            title="Delete Custom Item"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    )}
                    <div className="flex justify-between items-start">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-inner border group-hover:scale-110 transition-transform ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-gradient-to-br from-purple-900 to-slate-900 border-white/10'}`}>
                            {item.icon}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex gap-1">
                                {item.type === 'unlock' && <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${isCyberpunk ? 'border-purple-500/30 text-purple-400 bg-purple-500/10' : 'border-purple-500/30 text-purple-300 bg-purple-500/10'}`}>One-Time</span>}
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${getCategoryColor(item.category || '', isCyberpunk)}`}>{item.category}</span>
                            </div>
                            {item.expiryDate && <span className={`text-[9px] font-mono ${isExpired ? 'text-red-500' : (isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-400')}`}>{isExpired ? 'EXPIRED' : new Date(item.expiryDate).toLocaleDateString()}</span>}
                        </div>
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-baseline mb-1">
                            <h4 className={`font-bold text-base ${isCyberpunk ? 'text-[#00f0ff]' : 'text-slate-200'}`}>{item.name}</h4>
                            <span className={`font-mono font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>{item.cost > 0 ? `${item.cost} 💎` : 'FREE'}</span>
                        </div>
                        <p className={`text-xs leading-relaxed ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-400'}`}>{item.desc}</p>
                    </div>
                    <button onClick={(e) => handleBuy(item, e)} disabled={isExpired || currentGems < item.cost || (item.type === 'unlock' && inventory[item.id])} className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${item.type === 'unlock' && inventory[item.id] ? (isCyberpunk ? 'bg-[#00ff00]/20 text-[#00ff00] cursor-default' : 'bg-green-600/20 text-green-500 cursor-default') : (isExpired ? (isCyberpunk ? 'bg-[#0a0a0a] text-red-500/50 border border-red-900/30 cursor-not-allowed' : 'bg-gray-800 text-gray-500 cursor-not-allowed') : (currentGems >= item.cost ? (isCyberpunk ? 'bg-[#00f0ff] text-black hover:bg-[#00f0ff]/80 shadow-[0_0_10px_rgba(0,240,255,0.4)]' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20') : (isCyberpunk ? 'bg-[#0a0a0a] text-[#00f0ff]/30 cursor-not-allowed border border-[#00f0ff]/10' : 'bg-slate-800 text-slate-600 cursor-not-allowed')))}`}>
                        {item.type === 'unlock' && inventory[item.id] ? 'Purchased' : isExpired ? 'Expired' : currentGems >= item.cost ? 'Purchase' : `Need ${item.cost - currentGems} 💎`}
                    </button>
                </div>
                );
            })}
        </div>
    </div>
);

const SlotMachineModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    isCyberpunk: boolean;
    slotItems: string[];
    reelStatuses: boolean[];
    slotMessage: string;
    slotRolling: boolean;
    onSpin: () => void;
}> = ({ isOpen, onClose, isCyberpunk, slotItems, reelStatuses, slotMessage, slotRolling, onSpin }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className={`w-full max-w-md rounded-3xl border-4 shadow-[0_0_50px_rgba(234,179,8,0.3)] p-8 relative overflow-hidden flex flex-col items-center ${isCyberpunk ? 'bg-black border-[#00f0ff] shadow-[0_0_50px_rgba(0,240,255,0.3)]' : 'bg-[#1c1c1e] border-yellow-500'}`}>
                <div className={`absolute top-0 left-0 w-full h-32 bg-gradient-to-b to-transparent pointer-events-none ${isCyberpunk ? 'from-[#00f0ff]/20' : 'from-yellow-500/20'}`}></div>
                <h3 className={`text-3xl font-black mb-8 drop-shadow-sm ${isCyberpunk ? 'text-[#00f0ff]' : 'text-yellow-400'}`}>JACKPOT SLOTS</h3>
                <div className={`flex gap-4 mb-8 p-6 rounded-2xl border shadow-inner ${isCyberpunk ? 'bg-black border-[#00f0ff]/30' : 'bg-black/50 border-white/10'}`}>
                    {slotItems.map((item, i) => (
                        <div key={i} className={`w-20 h-24 bg-white text-6xl flex items-center justify-center rounded-xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)] border-b-4 border-slate-300 overflow-hidden relative transition-transform duration-200 ${reelStatuses[i] ? 'scale-100' : 'scale-95'} ${isCyberpunk ? 'bg-[#00f0ff] text-black border-[#0099ff]' : ''}`}>
                            <div className={`transition-all duration-100 ${!reelStatuses[i] ? 'blur-[2px] -translate-y-1' : ''}`}>{item}</div>
                        </div>
                    ))}
                </div>
                {slotMessage ? (
                    <div className="text-center mb-8 animate-bounce">
                        <p className={`text-2xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>{slotMessage}</p>
                        <p className={`text-sm mt-1 ${isCyberpunk ? 'text-[#00f0ff]/80' : 'text-yellow-400'}`}>Prize added to inventory!</p>
                    </div>
                ) : (
                    <p className={`mb-8 text-sm ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-400'}`}>Good Luck!</p>
                )}
                <div className="flex gap-4 w-full">
                    {!slotMessage && (
                        <button onClick={onSpin} disabled={slotRolling} className={`flex-1 py-4 font-black text-xl rounded-2xl shadow-xl border-b-4 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isCyberpunk ? 'bg-[#00f0ff] text-black border-[#0099ff] hover:bg-[#00f0ff]/90' : 'bg-gradient-to-b from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 text-white border-red-900'}`}>
                            {slotRolling ? 'ROLLING...' : 'PULL LEVER'}
                        </button>
                    )}
                    {slotMessage && (
                        <button onClick={onClose} className={`flex-1 py-4 font-bold rounded-2xl transition-colors ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 hover:bg-[#00f0ff]/30' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}>Collect & Close</button>
                    )}
                </div>
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
        </div>
    );
};

const EconomyGuideModal: React.FC<{ isOpen: boolean; onClose: () => void; isCyberpunk: boolean }> = ({ isOpen, onClose, isCyberpunk }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className={`w-full max-w-md rounded-3xl border shadow-2xl p-8 relative overflow-hidden ${isCyberpunk ? 'bg-black border-[#00f0ff]/50' : 'bg-[#1c1c1e] border-slate-700'}`}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className={`text-2xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>Economy Guide</h3>
                    <button onClick={onClose} className={`p-1 rounded-lg transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-slate-400 hover:text-white'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                <div className="space-y-6">
                    <div className={`p-4 rounded-2xl border ${isCyberpunk ? 'bg-[#00f0ff]/10 border-[#00f0ff]/30' : 'bg-slate-800 border-slate-700'}`}>
                        <h4 className={`font-bold mb-2 flex items-center gap-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-blue-400'}`}><span>⏱️</span> Time is Money</h4>
                        <p className={`text-sm ${isCyberpunk ? 'text-[#00f0ff]/80' : 'text-slate-300'}`}>Earn <span className="font-bold">10 Gems</span> for every <span className="font-bold">1 Hour</span> of focused study time logged. (1 Gem = 1 PLN)</p>
                    </div>
                    <div className={`p-4 rounded-2xl border ${isCyberpunk ? 'bg-[#ff00ff]/10 border-[#ff00ff]/30' : 'bg-slate-800 border-slate-700'}`}>
                        <h4 className={`font-bold mb-2 flex items-center gap-2 ${isCyberpunk ? 'text-[#ff00ff]' : 'text-red-400'}`}><span>🔥</span> Streak Jackpot</h4>
                        <p className={`text-sm ${isCyberpunk ? 'text-[#ff00ff]/80' : 'text-slate-300'}`}>Every <span className="font-bold">7 Days</span> of streak unlocks a Jackpot Spin. Win between <span className="font-bold">50 - 1000 Gems</span>!</p>
                    </div>
                    <div className={`p-4 rounded-2xl border ${isCyberpunk ? 'bg-[#00ff00]/10 border-[#00ff00]/30' : 'bg-slate-800 border-slate-700'}`}>
                        <h4 className={`font-bold mb-2 flex items-center gap-2 ${isCyberpunk ? 'text-[#00ff00]' : 'text-green-400'}`}><span>🏆</span> Bonuses</h4>
                        <ul className={`text-sm space-y-1 ${isCyberpunk ? 'text-[#00ff00]/80' : 'text-slate-300'}`}>
                            <li>• Daily Quests: <span className="font-bold">~80 Gems/day</span></li>
                            <li>• Achievements: <span className="font-bold">50 - 5000 Gems</span> (Tiered)</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

const HistoryModal: React.FC<{ isOpen: boolean; onClose: () => void; isCyberpunk: boolean; history: Transaction[] }> = ({ isOpen, onClose, isCyberpunk, history }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className={`w-full max-w-lg rounded-3xl border shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[80vh] ${isCyberpunk ? 'bg-black border-[#00f0ff]/50' : 'bg-[#1c1c1e] border-slate-700'}`}>
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <h3 className={`text-2xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>Transaction History</h3>
                    <button onClick={onClose} className={`p-1 rounded-lg transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-slate-400 hover:text-white'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                    {history.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">No transactions yet.</div>
                    ) : (
                        history.map((tx) => (
                            <div key={tx.id} className={`flex items-center justify-between p-3 rounded-xl border ${isCyberpunk ? 'bg-[#00f0ff]/5 border-[#00f0ff]/20' : 'bg-white/5 border-white/5'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${tx.type === 'SPEND' ? (isCyberpunk ? 'bg-red-900/30 text-red-500' : 'bg-red-500/20 text-red-400') : tx.type === 'UNLOCK' ? (isCyberpunk ? 'bg-purple-900/30 text-purple-500' : 'bg-purple-500/20 text-purple-400') : (isCyberpunk ? 'bg-green-900/30 text-green-500' : 'bg-green-500/20 text-green-400')}`}>
                                        {tx.type === 'SPEND' ? '🛒' : tx.type === 'UNLOCK' ? '🏆' : tx.type === 'WIN' ? '🎰' : '📚'}
                                    </div>
                                    <div>
                                        <p className={`text-sm font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>{tx.description}</p>
                                        <p className={`text-xs ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-400'}`}>{new Date(tx.date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className={`font-mono font-bold ${tx.amount > 0 ? (isCyberpunk ? 'text-green-500' : 'text-green-400') : (isCyberpunk ? 'text-red-500' : 'text-red-400')}`}>{tx.amount > 0 ? '+' : ''}{tx.amount}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

const TrophyRoom: React.FC<{ 
    achievements: any[]; 
    unlockedCount: number; 
    isCyberpunk: boolean; 
    filter: 'all' | 'unlocked' | 'locked'; 
    setFilter: (f: 'all' | 'unlocked' | 'locked') => void; 
}> = ({ achievements, unlockedCount, isCyberpunk, filter, setFilter }) => (
    <div>
        <div className="flex items-center justify-between mb-6">
            <h3 className={`text-xl font-bold flex items-center gap-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>
                <span className="text-2xl">🏆</span> Trophy Room
            </h3>
            <div className="flex gap-2">
                <div className={`flex p-1 rounded-lg ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/20' : 'bg-slate-800'}`}>
                    {(['all', 'unlocked', 'locked'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all capitalize ${filter === f ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-sm' : 'bg-blue-600 text-white shadow-sm') : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-slate-400 hover:text-white')}`}>
                            {f}
                        </button>
                    ))}
                </div>
                <div className={`px-3 py-1 rounded-lg border flex items-center ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-slate-800 border-slate-700'}`}>
                    <span className={`text-xs font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-slate-300'}`}>{unlockedCount} / {achievements.length}</span>
                </div>
            </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {achievements.map((badge) => (
                <div key={badge.id} className={`relative aspect-square rounded-2xl border flex flex-col items-center justify-center text-center p-2 transition-all duration-300 group overflow-hidden ${badge.isUnlocked ? (isCyberpunk ? 'bg-black border-[#00f0ff]/50 shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:border-[#00f0ff]' : `bg-gradient-to-b from-slate-800 to-slate-900 shadow-[0_0_15px_rgba(0,0,0,0.3)] hover:-translate-y-1 ${RARITY_COLORS[badge.rewardConfig.rarity].replace('text-', 'border-').split(' ')[1] || 'border-slate-700'}`) : (isCyberpunk ? 'bg-black border-[#00f0ff]/10 opacity-40 grayscale' : 'bg-slate-900/50 border-slate-800 opacity-40 grayscale')}`}>
                <div className="flex flex-col items-center transition-opacity duration-300 group-hover:opacity-0">
                    <div className={`text-4xl mb-2 transition-transform duration-300 ${badge.isUnlocked ? (isCyberpunk ? 'drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]' : 'drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]') : 'opacity-50'}`}>{badge.icon}</div>
                    <h4 className={`font-bold text-xs mb-1 line-clamp-1 ${badge.isUnlocked ? (isCyberpunk ? 'text-[#00f0ff]' : RARITY_COLORS[badge.rewardConfig.rarity].split(' ')[0]) : (isCyberpunk ? 'text-[#00f0ff]/40' : 'text-slate-500')}`}>{badge.title}</h4>
                    {badge.isUnlocked && <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${isCyberpunk ? 'bg-[#00f0ff] shadow-[0_0_5px_rgba(0,240,255,0.8)]' : 'bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.8)]'}`}></div>}
                    <div className={`mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.isUnlocked ? (isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/20' : 'bg-slate-800 ' + RARITY_COLORS[badge.rewardConfig.rarity]) : (isCyberpunk ? 'bg-black text-[#00f0ff]/30 border-[#00f0ff]/10' : 'bg-slate-800 text-slate-600 border-slate-700')}`}>{badge.rewardConfig.gems} 💎</div>
                </div>
                <div className={`absolute inset-0 flex flex-col items-center justify-center p-3 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 ${isCyberpunk ? 'bg-black/95' : 'bg-slate-900/95'}`}>
                    <p className={`text-xs font-bold mb-1 line-clamp-1 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>{badge.title}</p>
                    <p className={`text-[10px] leading-relaxed line-clamp-3 ${isCyberpunk ? 'text-[#00f0ff]/80' : 'text-slate-300'}`}>{badge.description}</p>
                    {!badge.isUnlocked && badge.progress > 0 && (
                        <div className="w-full mt-2 px-1">
                            <div className={`flex justify-between text-[8px] mb-0.5 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-400'}`}><span>Progress</span><span>{Math.floor(badge.progress)}%</span></div>
                            <div className={`h-1 w-full rounded-full overflow-hidden ${isCyberpunk ? 'bg-[#00f0ff]/20' : 'bg-slate-700'}`}><div className={`h-full ${isCyberpunk ? 'bg-[#00f0ff]' : 'bg-blue-500'}`} style={{ width: `${badge.progress}%` }}></div></div>
                        </div>
                    )}
                    <div className={`mt-2 text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.isUnlocked ? (isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/20' : 'bg-slate-800 ' + RARITY_COLORS[badge.rewardConfig.rarity]) : (isCyberpunk ? 'bg-black text-[#00f0ff]/40 border-[#00f0ff]/10' : 'bg-slate-800 text-slate-500 border-slate-700')}`}>{badge.rewardConfig.gems} 💎</div>
                </div>
            </div>
        </div>
    </div>
);

export const GamificationPanel: React.FC<GamificationPanelProps> = ({ allLogs = [], totalHours = 0, streak = 0, isDataLoaded = true }) => {
  const { appTheme } = useTheme();
  const { transactions, addTransaction } = useLogs();
  const isCyberpunk = appTheme === 'cyberpunk';
  const achievements = useMemo(() => getUnlockedAchievements(allLogs, totalHours, streak), [allLogs, totalHours, streak]);
  const unlockedCount = achievements.filter(a => a.isUnlocked).length;

  const [isEconomyInfoOpen, setIsEconomyInfoOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'shop' | 'earn'>('shop');
  const [isCreateItemModalOpen, setIsCreateItemModalOpen] = useState(false);
  const [customShopItems, setCustomShopItems] = useState<ShopItem[]>([]);
  const [shopFilter, setShopFilter] = useState<'all' | 'custom'>('all');

  useEffect(() => {
      storage.getCustomShopItems().then(setCustomShopItems);
  }, []);

  const allShopItems = useMemo(() => [...STATIC_SHOP_ITEMS, ...customShopItems], [customShopItems]);

  // --- Particle State ---
  const [particles, setParticles] = useState<Particle[]>([]);

  const spawnParticles = (x: number, y: number, color: string, count: number = 12, text?: string) => {
      const newParticles = Array.from({ length: count }).map(() => ({
          id: Math.random().toString(36).substr(2, 9),
          x,
          y,
          color,
          text
      }));
      setParticles(prev => [...prev, ...newParticles]);
      setTimeout(() => {
          setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
      }, 1000);
  };

  // --- Slot Machine State ---
  const [lastSpinStreak, setLastSpinStreak] = useState(() => {
      if (typeof window === 'undefined') return 0;
      const val = parseInt(localStorage.getItem('focusflow_last_spin_streak') || '0');
      return isNaN(val) ? 0 : val;
  });
  const [isSlotMachineOpen, setIsSlotMachineOpen] = useState(false);
  const [slotRolling, setSlotRolling] = useState(false);
  const [slotItems, setSlotItems] = useState(['🍒', '7️⃣', '💎']);
  const [reelStatuses, setReelStatuses] = useState([true, true, true]); // true = stopped
  const [slotMessage, setSlotMessage] = useState('');

  // --- Inventory & Economy State ---
  const [spentGems, setSpentGems] = useState(() => {
      if (typeof window === 'undefined') return 0;
      const val = parseInt(localStorage.getItem('focusflow_spent_gems') || '0');
      return isNaN(val) ? 0 : val;
  });
  const [bonusGems, setBonusGems] = useState(() => {
      if (typeof window === 'undefined') return 0;
      const val = parseInt(localStorage.getItem('focusflow_bonus_gems') || '0');
      return isNaN(val) ? 0 : val;
  });
  const [inventory, setInventory] = useState<Record<string, any>>(() => {
      if (typeof window === 'undefined') return {};
      try {
          return JSON.parse(localStorage.getItem('focusflow_inventory') || '{}');
      } catch (e) {
          return {};
      }
  });

  // --- Filters ---
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  // Reset spin eligibility if streak breaks
  useEffect(() => {
      if (streak < lastSpinStreak) {
          if (streak === 0 && allLogs.length === 0) return;
          setLastSpinStreak(0);
          localStorage.setItem('focusflow_last_spin_streak', '0');
      }
  }, [streak, lastSpinStreak, allLogs.length]);

  const lastInventoryStr = useRef(typeof window !== 'undefined' ? localStorage.getItem('focusflow_inventory') || '{}' : '{}');

  useEffect(() => {
      if (typeof window !== 'undefined') {
          lastInventoryStr.current = JSON.stringify(inventory);
      }
  }, [inventory]);

  useEffect(() => {
      const interval = setInterval(() => {
          if (typeof window === 'undefined') return;
          
          const rawInv = localStorage.getItem('focusflow_inventory') || '{}';
          const storedBonusVal = parseInt(localStorage.getItem('focusflow_bonus_gems') || '0');
          const storedBonus = isNaN(storedBonusVal) ? 0 : storedBonusVal;
          const storedSpentVal = parseInt(localStorage.getItem('focusflow_spent_gems') || '0');
          const storedSpent = isNaN(storedSpentVal) ? 0 : storedSpentVal;
          
          if (rawInv !== lastInventoryStr.current) {
              try {
                  setInventory(JSON.parse(rawInv));
                  lastInventoryStr.current = rawInv;
              } catch (e) { /* ignore */ }
          }
          if (storedBonus !== bonusGems) {
              setBonusGems(storedBonus);
          }
          if (storedSpent !== spentGems) {
              setSpentGems(storedSpent);
          }
      }, 2000);
      return () => clearInterval(interval);
  }, [bonusGems, spentGems]);

  useEffect(() => {
      const unlockedIds = new Set((transactions || []).filter(t => t.type === 'UNLOCK').map(t => t.relatedId));
      let newTx: Transaction[] = [];
      
      achievements.forEach(badge => {
          if (badge.isUnlocked && !unlockedIds.has(badge.id)) {
              newTx.push({
                  id: `unlock-${badge.id}-${Date.now()}`,
                  date: new Date().toISOString(),
                  type: 'UNLOCK',
                  amount: badge.rewardConfig.gems,
                  description: `Unlocked: ${badge.title}`,
                  relatedId: badge.id
              });
          }
      });

      if (newTx.length > 0) {
          newTx.forEach(t => addTransaction(t));
      }
  }, [achievements, (transactions || []).length]);

  const achievementsWithRewards = useMemo(() => {
      const getProgress = (achievement: typeof achievements[0]) => {
          if (achievement.isUnlocked) return 100;
          const rank = RANKS.find(r => r.title === achievement.title); 
          if (rank) {
              if (rank.minHours === 0) return 100;
              return Math.min(100, (totalHours / rank.minHours) * 100);
          }
          if (achievement.id.startsWith('streak_')) {
              const target = parseInt(achievement.id.split('_')[1]);
              return Math.min(100, (streak / target) * 100);
          }
          if (achievement.id === 'marathoner' || achievement.id === 'iron_mind') {
              const dailyTotals = new Map<string, number>();
              allLogs.forEach(l => {
                  dailyTotals.set(l.date, (dailyTotals.get(l.date) || 0) + l.hours);
              });
              const maxDaily = Math.max(0, ...Array.from(dailyTotals.values()));
              if (achievement.id === 'marathoner') return Math.min(100, (maxDaily / 6) * 100);
              if (achievement.id === 'iron_mind') return Math.min(100, (maxDaily / 10) * 100);
          }
          return 0;
      };

      return achievements.map(a => ({
          ...a,
          rewardConfig: getAchievementReward(a),
          progress: getProgress(a) || 0
      }));
  }, [achievements, totalHours, streak, allLogs]);

  const filteredAchievements = useMemo(() => {
      return achievementsWithRewards.filter(badge => {
          if (badgeFilter === 'unlocked') return badge.isUnlocked;
          if (badgeFilter === 'locked') return !badge.isUnlocked;
          return true;
      });
  }, [achievementsWithRewards, badgeFilter]);

  const achievementGems = useMemo(() => 
      achievementsWithRewards.filter(a => a.isUnlocked).reduce((acc, curr) => acc + curr.rewardConfig.gems, 0)
  , [achievementsWithRewards]);

  const today = new Date().toISOString().split('T')[0];
  const todaysLogs = useMemo(() => allLogs.filter(l => l.date === today), [allLogs, today]);
  const todayHours = useMemo(() => todaysLogs.reduce((acc, curr) => acc + curr.hours, 0), [todaysLogs]);
  const quests = useMemo(() => getDailyQuests(allLogs), [allLogs]);
  const questGems = useMemo(() => 
      quests.filter(q => q.current >= q.target).reduce((acc, curr) => acc + curr.reward, 0)
  , [quests]);

  const streakCalendar = useMemo(() => {
      return Array.from({length: 7}, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          const dateStr = d.toISOString().split('T')[0];
          const hasLog = allLogs.some(l => l.date === dateStr && l.hours > 0);
          const isToday = dateStr === today;
          return {
              day: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
              date: d.getDate(),
              active: hasLog,
              isToday
          };
      });
  }, [allLogs, today]);

  const earningRate = 10;
  const rawBalance = Math.floor(totalHours * earningRate) + achievementGems + questGems + bonusGems - spentGems;
  const currentGems = Math.max(0, rawBalance);

  // Debt Forgiveness Effect (Handles rate change 20->10 or log deletion)
  useEffect(() => {
      if (isDataLoaded && rawBalance < 0) {
          const deficit = Math.abs(rawBalance);
          const newBonus = bonusGems + deficit;
          setBonusGems(newBonus);
          localStorage.setItem('focusflow_bonus_gems', newBonus.toString());
          
          addTransaction({ 
              id: `adjustment-${Date.now()}`, 
              date: new Date().toISOString(), 
              type: 'EARN', 
              amount: deficit, 
              description: 'Economy Adjustment' 
          });
      }
  }, [isDataLoaded, rawBalance, bonusGems, addTransaction]);

  const handleBuy = (item: ShopItem, e?: React.MouseEvent) => {
      if (currentGems >= item.cost && (!item.expiryDate || new Date(item.expiryDate) >= new Date())) {
          const savedVol = localStorage.getItem('focusflow_timer_volume');
          const vol = savedVol ? parseFloat(savedVol) : 0.5;

          if (item.id === 'mech_double') {
              const win = Math.random() > 0.5;
              if (win) {
                  playWin(vol);
                  setBonusGems(prev => {
                      const newVal = prev + 100;
                      localStorage.setItem('focusflow_bonus_gems', newVal.toString());
                      return newVal;
                  });
                  alert("WON Double or Nothing! (+100 Gems)");
                  addTransaction({ id: `gamble-win-${Date.now()}`, date: new Date().toISOString(), type: 'WIN', amount: 100, description: `Won Double or Nothing` });
              } else {
                  playTone(200, 0.3, vol, 'sawtooth');
                  const newSpent = spentGems + item.cost;
                  setSpentGems(newSpent);
                  localStorage.setItem('focusflow_spent_gems', newSpent.toString());
                  alert("Lost 50 Gems...");
                  addTransaction({ id: `gamble-loss-${Date.now()}`, date: new Date().toISOString(), type: 'SPEND', amount: -item.cost, description: `Lost Double or Nothing` });
              }
              return;
          }

          playTone(600, 0.1, vol, 'sine');
          setTimeout(() => playTone(400, 0.1, vol, 'sine'), 100);

          if (e) spawnParticles(e.clientX, e.clientY, isCyberpunk ? '#00f0ff' : '#ef4444');

          // Read from storage to ensure we have the latest value before adding
          const currentSpent = parseInt(localStorage.getItem('focusflow_spent_gems') || '0') || 0;
          const newSpent = currentSpent + item.cost;
          setSpentGems(newSpent);
          localStorage.setItem('focusflow_spent_gems', newSpent.toString());

          const newInventory = { ...inventory };
          if (item.id === 'freeze') newInventory.streakFreeze = (newInventory.streakFreeze || 0) + 1;
          else if (item.id === 'vacation') newInventory.streakFreeze = (newInventory.streakFreeze || 0) + 7;
          else if (item.id === 'dessert') newInventory.cheatDessert = (newInventory.cheatDessert || 0) + 1;
          else if (item.type === 'unlock') newInventory[item.id] = true;
          else newInventory[item.id] = (newInventory[item.id] || 0) + 1;
          
          setInventory(newInventory);
          localStorage.setItem('focusflow_inventory', JSON.stringify(newInventory));

          addTransaction({ id: `buy-${item.id}-${Date.now()}`, date: new Date().toISOString(), type: 'SPEND', amount: -item.cost, description: `Purchased ${item.name}` });
      }
  };

  const handleConsume = (itemId: string) => {
      const item = allShopItems.find(i => i.id === itemId);
      if (!confirm(`Are you sure you want to use ${item ? item.name : 'this item'}?`)) return;

      const newInventory = { ...inventory };
      let key = itemId;
      if (itemId === 'freeze') key = 'streakFreeze';
      if (itemId === 'dessert') key = 'cheatDessert';
      
      if (newInventory[key] > 0) {
          newInventory[key] = newInventory[key] - 1;
          setInventory(newInventory);
          localStorage.setItem('focusflow_inventory', JSON.stringify(newInventory));
      }
  };

  const handleSell = (itemId: string, e?: React.MouseEvent) => {
      const item = allShopItems.find(i => i.id === itemId);
      if (!item) return;
      
      const sellPrice = Math.floor(item.cost * 0.6);
      
      if (!confirm(`Are you sure you want to sell ${item.name} for ${sellPrice} Gems?`)) return;

      if (e) spawnParticles(e.clientX, e.clientY, isCyberpunk ? '#00ff00' : '#10b981', 15, `+${sellPrice}`);

      const newInventory = { ...inventory };
      let key = itemId;
      if (itemId === 'freeze') key = 'streakFreeze';
      if (itemId === 'dessert') key = 'cheatDessert';
      
      const count = item.type === 'unlock' ? (newInventory[key] ? 1 : 0) : (newInventory[key] || 0);

      if (count > 0) {
          const savedVol = localStorage.getItem('focusflow_timer_volume');
          const vol = savedVol ? parseFloat(savedVol) : 0.5;
          playTone(800, 0.1, vol, 'sine');
          setTimeout(() => playTone(1200, 0.2, vol, 'sine'), 100);

          if (item.type === 'unlock') {
              delete newInventory[key];
          } else {
              newInventory[key] = newInventory[key] - 1;
          }
          
          setInventory(newInventory);
          localStorage.setItem('focusflow_inventory', JSON.stringify(newInventory));
          
          // Read from storage to ensure we have the latest value before adding
          const currentBonus = parseInt(localStorage.getItem('focusflow_bonus_gems') || '0') || 0;
          const newBonus = currentBonus + sellPrice;
          setBonusGems(newBonus);
          localStorage.setItem('focusflow_bonus_gems', newBonus.toString());

          addTransaction({ id: `sell-${item.id}-${Date.now()}`, date: new Date().toISOString(), type: 'EARN', amount: sellPrice, description: `Sold ${item.name}` });
      }
  };

  const handleCreateItem = async (item: ShopItem) => {
      const updated = await storage.saveCustomShopItem(item);
      setCustomShopItems(updated);
  };

  const handleDeleteCustomItem = async (id: string) => {
      const updated = await storage.deleteCustomShopItem(id);
      setCustomShopItems(updated);
  };

  const canSpin = streak > 0 && streak % 7 === 0 && lastSpinStreak < streak;
  const daysToNextSpin = 7 - (streak % 7);

  const handleSlotSpin = () => {
      if (slotRolling) return;
      setSlotRolling(true);
      setSlotMessage('');
      setReelStatuses([false, false, false]);
      
      const savedVol = localStorage.getItem('focusflow_timer_volume');
      const vol = savedVol ? parseFloat(savedVol) : 0.5;
      
      let ticks = 0;
      const symbols = ['🍒', '🍋', '🍇', '💎', '7️⃣', '🔔'];
      
      const interval = setInterval(() => {
          ticks++;
          setSlotItems(prev => {
              if (ticks % 2 === 0) playSpinTick(vol);
              const next = [...prev];
              if (ticks < 20) next[0] = symbols[Math.floor(Math.random() * symbols.length)];
              else if (ticks === 20) { next[0] = '💎'; setReelStatuses(s => [true, false, false]); }
              if (ticks < 35) next[1] = symbols[Math.floor(Math.random() * symbols.length)];
              else if (ticks === 35) { next[1] = '💎'; setReelStatuses(s => [true, true, false]); }
              if (ticks < 50) next[2] = symbols[Math.floor(Math.random() * symbols.length)];
              else if (ticks === 50) { next[2] = '💎'; setReelStatuses(s => [true, true, true]); }
              return next;
          });
          if (ticks >= 50) {
              clearInterval(interval);
              finalizeSpin();
          }
      }, 60);
  };

  const finalizeSpin = () => {
      const savedVol = localStorage.getItem('focusflow_timer_volume');
      const vol = savedVol ? parseFloat(savedVol) : 0.5;
      playWin(vol);

      const amount = Math.floor(Math.random() * 951) + 50;
      let current = 0;
      const step = Math.max(1, Math.floor(amount / 20));
      const counterInterval = setInterval(() => {
          current += step;
          if (current >= amount) {
              current = amount;
              clearInterval(counterInterval);
              const currentBonus = parseInt(localStorage.getItem('focusflow_bonus_gems') || '0') || 0;
              const newBonus = currentBonus + amount;
              setBonusGems(newBonus);
              localStorage.setItem('focusflow_bonus_gems', newBonus.toString());
              
              setSlotMessage(`You won:  Gems!`);
              setSlotRolling(false);
          } else {
              setSlotMessage(`WIN:  Gems`);
          }
      }, 30);

      addTransaction({ id: `spin-${Date.now()}`, date: new Date().toISOString(), type: 'WIN', amount: amount, description: 'Weekly Jackpot Win' });
      setLastSpinStreak(streak);
      localStorage.setItem('focusflow_last_spin_streak', streak.toString());
  };

  const historyDisplay = useMemo(() => {
      const logTxs: Transaction[] = allLogs.map((l, i) => ({
          id: `log-${l.date}-${i}`,
          date: l.date,
          type: 'EARN',
          amount: Math.floor(l.hours * 10),
          description: `Study Session (${l.hours}h)`
      }));
      return [...(transactions || []), ...logTxs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, allLogs]);

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300 relative ${isCyberpunk ? 'bg-[#050505] text-[#00f0ff] font-mono' : 'bg-[#0f172a] text-white'}`}>
      <div className={`absolute inset-0 pointer-events-none ${isCyberpunk ? 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#00f0ff]/10 via-[#050505] to-[#050505]' : 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#0f172a] to-[#0f172a]'}`}></div>
      
      <div className="p-6 h-full overflow-y-auto custom-scrollbar relative z-10">
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            
            <div className={`flex flex-col md:flex-row justify-between items-center gap-6 p-6 rounded-3xl border backdrop-blur-md shadow-2xl ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-white/5 border-white/10'}`}>
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className={`text-4xl font-black drop-shadow-sm ${isCyberpunk ? 'text-[#00f0ff] drop-shadow-[0_0_5px_rgba(0,240,255,0.8)]' : 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600'}`}>
                            Marketplace
                        </h2>
                        <button onClick={() => setIsHistoryOpen(true)} className={`p-2 rounded-full transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-blue-200 hover:bg-white/10'}`} title="Transaction History">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                        <button onClick={() => setIsEconomyInfoOpen(true)} className={`p-2 rounded-full transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-blue-200 hover:bg-white/10'}`} title="Economy Guide">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                    </div>
                    <p className={`mt-1 font-medium ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-blue-200'}`}>Earn 10 Gems per hour of focus.</p>
                </div>
                
                <div className="flex gap-4">
                    <div className={`flex flex-col items-center p-3 rounded-2xl border min-w-[100px] ${isCyberpunk ? 'bg-black border-[#ff00ff]/30' : 'bg-black/40 border-red-500/30'}`}>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isCyberpunk ? 'text-[#ff00ff]' : 'text-red-400'}`}>Streak</span>
                        <div className={`text-2xl font-black drop-shadow-[0_0_8px_rgba(239,68,68,0.5)] ${isCyberpunk ? 'text-[#ff00ff] drop-shadow-[0_0_8px_rgba(255,0,255,0.5)]' : 'text-red-500'}`}>
                            {streak} <span className="text-sm">🔥</span>
                        </div>
                    </div>
                    <div className={`flex flex-col items-center p-3 rounded-2xl border min-w-[120px] ${isCyberpunk ? 'bg-black border-[#00f0ff]/30' : 'bg-black/40 border-yellow-500/30'}`}>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isCyberpunk ? 'text-[#00f0ff]' : 'text-yellow-400'}`}>Bankroll</span>
                        <div className={`text-2xl font-black drop-shadow-[0_0_8px_rgba(250,204,21,0.5)] ${isCyberpunk ? 'text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]' : 'text-yellow-400'}`}>
                            {currentGems} <span className="text-sm">💎</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex gap-2">
                <button onClick={() => setActiveTab('shop')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'shop' ? (isCyberpunk ? 'bg-[#00f0ff] text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]' : 'bg-white text-gray-900 shadow-lg') : (isCyberpunk ? 'text-[#00f0ff]/60 hover:bg-[#00f0ff]/10' : 'text-gray-400 hover:bg-white/5')}`}>Shop</button>
                <button onClick={() => setActiveTab('earn')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'earn' ? (isCyberpunk ? 'bg-[#00f0ff] text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]' : 'bg-white text-gray-900 shadow-lg') : (isCyberpunk ? 'text-[#00f0ff]/60 hover:bg-[#00f0ff]/10' : 'text-gray-400 hover:bg-white/5')}`}>Earn</button>
            </div>

            <div className="flex flex-col gap-10">
                {activeTab === 'earn' && (
                <>
                <div className={`relative overflow-hidden rounded-3xl p-1 shadow-2xl ${isCyberpunk ? 'bg-gradient-to-r from-[#00f0ff] via-[#ff00ff] to-[#00f0ff]' : 'bg-gradient-to-r from-yellow-500 via-red-500 to-pink-500'}`}>
                    <div className={`rounded-[20px] p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10 ${isCyberpunk ? 'bg-black' : 'bg-[#0f172a]'}`}>
                        <div className="flex items-center gap-4">
                            <div className="text-5xl">🎰</div>
                            <div>
                                <h3 className={`text-2xl font-black ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>Weekly Jackpot</h3>
                                <p className={`text-sm ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-400'}`}>Spin every 7 days of streak for Gems!</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            {canSpin ? (
                                <button onClick={() => setIsSlotMachineOpen(true)} className={`px-8 py-3 font-black text-lg rounded-xl shadow-lg transform hover:scale-105 transition-all animate-pulse ${isCyberpunk ? 'bg-[#00f0ff] text-black shadow-[0_0_15px_rgba(0,240,255,0.5)]' : 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black shadow-orange-500/20'}`}>SPIN NOW</button>
                            ) : (
                                <div className={`px-6 py-3 rounded-xl border text-center ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-slate-800 border-slate-700'}`}>
                                    <p className={`text-xs font-bold uppercase tracking-wider ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-500'}`}>Next Spin In</p>
                                    <p className={`text-xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>{daysToNextSpin} Days</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className={`rounded-3xl p-8 border ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-slate-800/50 border-white/5'}`}>
                    <h3 className={`text-sm font-bold uppercase tracking-wider mb-6 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-400'}`}>Streak History</h3>
                    <div className="flex justify-between items-center max-w-4xl mx-auto">
                        {streakCalendar.map((day, i) => (
                            <div key={i} className="flex flex-col items-center gap-3">
                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-sm md:text-base font-bold border-2 transition-all ${day.active ? (isCyberpunk ? 'bg-[#ff00ff] border-[#ff00ff] text-black shadow-[0_0_15px_rgba(255,0,255,0.6)]' : 'bg-red-500 border-red-400 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]') : (day.isToday ? (isCyberpunk ? 'bg-transparent border-[#00f0ff] text-[#00f0ff]' : 'bg-transparent border-white/20 text-white') : (isCyberpunk ? 'bg-transparent border-[#00f0ff]/20 text-[#00f0ff]/40' : 'bg-transparent border-slate-700 text-slate-600'))}`}>
                                    {day.active ? '✓' : day.date}
                                </div>
                                <span className={`text-[10px] md:text-xs font-bold uppercase ${isCyberpunk ? 'text-[#00f0ff]/40' : 'text-slate-500'}`}>{day.day}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <TrophyRoom 
                    achievements={filteredAchievements} 
                    unlockedCount={unlockedCount} 
                    isCyberpunk={isCyberpunk} 
                    filter={badgeFilter} 
                    setFilter={setBadgeFilter} 
                />
                </>
                )}

                {activeTab === 'shop' && (
                <>
                <InventoryGrid 
                    inventory={inventory}
                    items={allShopItems}
                    handleConsume={handleConsume}
                    handleSell={handleSell}
                    isCyberpunk={isCyberpunk}
                />
                <ShopGrid 
                    inventory={inventory}
                    items={allShopItems}
                    currentGems={currentGems}
                    handleBuy={handleBuy}
                    handleDeleteCustom={handleDeleteCustomItem}
                    isCyberpunk={isCyberpunk}
                />
                </>
                )}

                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className={`text-xl font-bold flex items-center gap-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>
                            <span className="text-2xl">🏆</span> Trophy Room
                        </h3>
                        <div className="flex gap-2">
                            <div className={`flex p-1 rounded-lg ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/20' : 'bg-slate-800'}`}>
                                {(['all', 'unlocked', 'locked'] as const).map(f => (
                                    <button key={f} onClick={() => setBadgeFilter(f)} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all capitalize ${badgeFilter === f ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-sm' : 'bg-blue-600 text-white shadow-sm') : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-slate-400 hover:text-white')}`}>
                                        {f}
                                    </button>
                                ))}
                            </div>
                            <div className={`px-3 py-1 rounded-lg border flex items-center ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-slate-800 border-slate-700'}`}>
                                <span className={`text-xs font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-slate-300'}`}>{unlockedCount} / {achievements.length}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {filteredAchievements.map((badge) => (
                            <div key={badge.id} className={`relative aspect-square rounded-2xl border flex flex-col items-center justify-center text-center p-2 transition-all duration-300 group overflow-hidden ${badge.isUnlocked ? (isCyberpunk ? 'bg-black border-[#00f0ff]/50 shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:border-[#00f0ff]' : `bg-gradient-to-b from-slate-800 to-slate-900 shadow-[0_0_15px_rgba(0,0,0,0.3)] hover:-translate-y-1 ${RARITY_COLORS[badge.rewardConfig.rarity].replace('text-', 'border-').split(' ')[1] || 'border-slate-700'}`) : (isCyberpunk ? 'bg-black border-[#00f0ff]/10 opacity-40 grayscale' : 'bg-slate-900/50 border-slate-800 opacity-40 grayscale')}`}>
                                <div className="flex flex-col items-center transition-opacity duration-300 group-hover:opacity-0">
                                    <div className={`text-4xl mb-2 transition-transform duration-300 ${badge.isUnlocked ? (isCyberpunk ? 'drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]' : 'drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]') : 'opacity-50'}`}>{badge.icon}</div>
                                    <h4 className={`font-bold text-xs mb-1 line-clamp-1 ${badge.isUnlocked ? (isCyberpunk ? 'text-[#00f0ff]' : RARITY_COLORS[badge.rewardConfig.rarity].split(' ')[0]) : (isCyberpunk ? 'text-[#00f0ff]/40' : 'text-slate-500')}`}>{badge.title}</h4>
                                    {badge.isUnlocked && <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${isCyberpunk ? 'bg-[#00f0ff] shadow-[0_0_5px_rgba(0,240,255,0.8)]' : 'bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.8)]'}`}></div>}
                                    <div className={`mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.isUnlocked ? (isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/20' : 'bg-slate-800 ' + RARITY_COLORS[badge.rewardConfig.rarity]) : (isCyberpunk ? 'bg-black text-[#00f0ff]/30 border-[#00f0ff]/10' : 'bg-slate-800 text-slate-600 border-slate-700')}`}>{badge.rewardConfig.gems} 💎</div>
                                </div>
                                <div className={`absolute inset-0 flex flex-col items-center justify-center p-3 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 ${isCyberpunk ? 'bg-black/95' : 'bg-slate-900/95'}`}>
                                    <p className={`text-xs font-bold mb-1 line-clamp-1 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>{badge.title}</p>
                                    <p className={`text-[10px] leading-relaxed line-clamp-3 ${isCyberpunk ? 'text-[#00f0ff]/80' : 'text-slate-300'}`}>{badge.description}</p>
                                    {!badge.isUnlocked && badge.progress > 0 && (
                                        <div className="w-full mt-2 px-1">
                                            <div className={`flex justify-between text-[8px] mb-0.5 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-400'}`}><span>Progress</span><span>{Math.floor(badge.progress)}%</span></div>
                                            <div className={`h-1 w-full rounded-full overflow-hidden ${isCyberpunk ? 'bg-[#00f0ff]/20' : 'bg-slate-700'}`}><div className={`h-full ${isCyberpunk ? 'bg-[#00f0ff]' : 'bg-blue-500'}`} style={{ width: `${badge.progress}%` }}></div></div>
                                        </div>
                                    )}
                                    <div className={`mt-2 text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.isUnlocked ? (isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/20' : 'bg-slate-800 ' + RARITY_COLORS[badge.rewardConfig.rarity]) : (isCyberpunk ? 'bg-black text-[#00f0ff]/40 border-[#00f0ff]/10' : 'bg-slate-800 text-slate-500 border-slate-700')}`}>{badge.rewardConfig.gems} 💎</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </div>

      {isSlotMachineOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
              <div className={`w-full max-w-md rounded-3xl border-4 shadow-[0_0_50px_rgba(234,179,8,0.3)] p-8 relative overflow-hidden flex flex-col items-center ${isCyberpunk ? 'bg-black border-[#00f0ff] shadow-[0_0_50px_rgba(0,240,255,0.3)]' : 'bg-[#1c1c1e] border-yellow-500'}`}>
                  <div className={`absolute top-0 left-0 w-full h-32 bg-gradient-to-b to-transparent pointer-events-none ${isCyberpunk ? 'from-[#00f0ff]/20' : 'from-yellow-500/20'}`}></div>
                  <h3 className={`text-3xl font-black mb-8 drop-shadow-sm ${isCyberpunk ? 'text-[#00f0ff]' : 'text-yellow-400'}`}>JACKPOT SLOTS</h3>
                  <div className={`flex gap-4 mb-8 p-6 rounded-2xl border shadow-inner ${isCyberpunk ? 'bg-black border-[#00f0ff]/30' : 'bg-black/50 border-white/10'}`}>
                      {slotItems.map((item, i) => (
                          <div key={i} className={`w-20 h-24 bg-white text-6xl flex items-center justify-center rounded-xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)] border-b-4 border-slate-300 overflow-hidden relative transition-transform duration-200 ${reelStatuses[i] ? 'scale-100' : 'scale-95'} ${isCyberpunk ? 'bg-[#00f0ff] text-black border-[#0099ff]' : ''}`}>
                              <div className={`transition-all duration-100 ${!reelStatuses[i] ? 'blur-[2px] -translate-y-1' : ''}`}>{item}</div>
                          </div>
                      ))}
                  </div>
                  {slotMessage ? (
                      <div className="text-center mb-8 animate-bounce">
                          <p className={`text-2xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>{slotMessage}</p>
                          <p className={`text-sm mt-1 ${isCyberpunk ? 'text-[#00f0ff]/80' : 'text-yellow-400'}`}>Prize added to inventory!</p>
                      </div>
                  ) : (
                      <p className={`mb-8 text-sm ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-400'}`}>Good Luck!</p>
                  )}
                  <div className="flex gap-4 w-full">
                      {!slotMessage && (
                          <button onClick={handleSlotSpin} disabled={slotRolling} className={`flex-1 py-4 font-black text-xl rounded-2xl shadow-xl border-b-4 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isCyberpunk ? 'bg-[#00f0ff] text-black border-[#0099ff] hover:bg-[#00f0ff]/90' : 'bg-gradient-to-b from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 text-white border-red-900'}`}>
                              {slotRolling ? 'ROLLING...' : 'PULL LEVER'}
                          </button>
                      )}
                      {slotMessage && (
                          <button onClick={() => setIsSlotMachineOpen(false)} className={`flex-1 py-4 font-bold rounded-2xl transition-colors ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 hover:bg-[#00f0ff]/30' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}>Collect & Close</button>
                      )}
                  </div>
                  <button onClick={() => setIsSlotMachineOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
          </div>
      )}

      {isEconomyInfoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
              <div className={`w-full max-w-md rounded-3xl border shadow-2xl p-8 relative overflow-hidden ${isCyberpunk ? 'bg-black border-[#00f0ff]/50' : 'bg-[#1c1c1e] border-slate-700'}`}>
                  <div className="flex justify-between items-center mb-6">
                      <h3 className={`text-2xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>Economy Guide</h3>
                      <button onClick={() => setIsEconomyInfoOpen(false)} className={`p-1 rounded-lg transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-slate-400 hover:text-white'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                  <div className="space-y-6">
                      <div className={`p-4 rounded-2xl border ${isCyberpunk ? 'bg-[#00f0ff]/10 border-[#00f0ff]/30' : 'bg-slate-800 border-slate-700'}`}>
                          <h4 className={`font-bold mb-2 flex items-center gap-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-blue-400'}`}><span>⏱️</span> Time is Money</h4>
                          <p className={`text-sm ${isCyberpunk ? 'text-[#00f0ff]/80' : 'text-slate-300'}`}>Earn <span className="font-bold">10 Gems</span> for every <span className="font-bold">1 Hour</span> of focused study time logged. (1 Gem = 1 PLN)</p>
                      </div>
                      <div className={`p-4 rounded-2xl border ${isCyberpunk ? 'bg-[#ff00ff]/10 border-[#ff00ff]/30' : 'bg-slate-800 border-slate-700'}`}>
                          <h4 className={`font-bold mb-2 flex items-center gap-2 ${isCyberpunk ? 'text-[#ff00ff]' : 'text-red-400'}`}><span>🔥</span> Streak Jackpot</h4>
                          <p className={`text-sm ${isCyberpunk ? 'text-[#ff00ff]/80' : 'text-slate-300'}`}>Every <span className="font-bold">7 Days</span> of streak unlocks a Jackpot Spin. Win between <span className="font-bold">50 - 1000 Gems</span>!</p>
                      </div>
                      <div className={`p-4 rounded-2xl border ${isCyberpunk ? 'bg-[#00ff00]/10 border-[#00ff00]/30' : 'bg-slate-800 border-slate-700'}`}>
                          <h4 className={`font-bold mb-2 flex items-center gap-2 ${isCyberpunk ? 'text-[#00ff00]' : 'text-green-400'}`}><span>🏆</span> Bonuses</h4>
                          <ul className={`text-sm space-y-1 ${isCyberpunk ? 'text-[#00ff00]/80' : 'text-slate-300'}`}>
                              <li>• Daily Quests: <span className="font-bold">~80 Gems/day</span></li>
                              <li>• Achievements: <span className="font-bold">50 - 5000 Gems</span> (Tiered)</li>
                          </ul>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {isHistoryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
              <div className={`w-full max-w-lg
