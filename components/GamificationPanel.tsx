import React, { useMemo, useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
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
    tx: number;
    ty: number;
}

interface Challenge {
    id: string;
    title: string;
    reward: number;
    dueDate?: string;
    completedDate?: string;
    penalized?: boolean;
    difficulty?: 'Easy' | 'Medium' | 'Hard';
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
    { id: 'yes_man', name: '"Yes Man" Day', icon: '👍', cost: 6000, desc: 'Say yes to everything.', type: 'consumable', category: 'Major' },
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

interface ParticleSystemHandle {
    spawn: (x: number, y: number, color: string, count?: number, text?: string) => void;
}

const ParticleSystem = forwardRef<ParticleSystemHandle, {}>((_, ref) => {
    const [particles, setParticles] = useState<Particle[]>([]);

    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    useImperativeHandle(ref, () => ({
        spawn: (x, y, color, count = 12, text) => {
            const newParticles = Array.from({ length: count }).map(() => ({
                id: Math.random().toString(36).substr(2, 9),
                x,
                y,
                color,
                text,
                tx: (Math.random() - 0.5) * 150,
                ty: (Math.random() - 0.5) * 150
            }));
            if (isMounted.current) setParticles(prev => [...prev, ...newParticles]);
            setTimeout(() => {
                if (isMounted.current) setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
            }, 1000);
        }
    }));

    return (
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
                    '--tx': `${p.tx}px`,
                    '--ty': `${p.ty}px`
                } as React.CSSProperties}
            >
                {p.text && <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-xs font-bold" style={{color: p.color}}>{p.text}</span>}
            </div>
        ))}
    </>
    );
});

const CreateItemModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onCreate: (item: ShopItem) => void;
    isCyberpunk: boolean;
}> = ({ isOpen, onClose, onCreate, isCyberpunk }) => {
    const [name, setName] = useState('');
    const [cost, setCost] = useState(100);
    const [desc, setDesc] = useState('');
    const [icon, setIcon] = useState('🎁');
    const [expiryDate, setExpiryDate] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || cost < 0) return;
        
        onCreate({
            id: `custom_${Date.now()}`,
            name,
            cost,
            desc,
            icon,
            type: 'consumable',
            category: 'Custom',
            isCustom: true,
            expiryDate: expiryDate || undefined
        });
        onClose();
        setName('');
        setCost(100);
        setDesc('');
        setIcon('🎁');
        setExpiryDate('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className={`w-full max-w-md rounded-3xl border shadow-2xl p-6 relative overflow-hidden flex flex-col ${isCyberpunk ? 'bg-black border-[#00f0ff]/50' : 'bg-[#1c1c1e] border-slate-700'}`}>
                <h3 className={`text-xl font-bold mb-4 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>Create Custom Item</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className={`w-full p-2 rounded-lg border focus:outline-none focus:ring-2 ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-slate-800 border-slate-600 text-white focus:ring-blue-500'}`} required placeholder="e.g. Pizza Night" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cost (Gems)</label>
                        <input type="number" value={cost} onChange={e => setCost(parseInt(e.target.value))} className={`w-full p-2 rounded-lg border focus:outline-none focus:ring-2 ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-slate-800 border-slate-600 text-white focus:ring-blue-500'}`} required min="0" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Icon (Emoji)</label>
                            <input type="text" value={icon} onChange={e => setIcon(e.target.value)} className={`w-full p-2 rounded-lg border focus:outline-none focus:ring-2 ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-slate-800 border-slate-600 text-white focus:ring-blue-500'}`} maxLength={2} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Expiry (Optional)</label>
                            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className={`w-full p-2 rounded-lg border focus:outline-none focus:ring-2 ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff] [color-scheme:dark]' : 'bg-slate-800 border-slate-600 text-white focus:ring-blue-500 [color-scheme:dark]'}`} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                        <input type="text" value={desc} onChange={e => setDesc(e.target.value)} className={`w-full p-2 rounded-lg border focus:outline-none focus:ring-2 ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-slate-800 border-slate-600 text-white focus:ring-blue-500'}`} placeholder="Optional details..." />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className={`flex-1 py-2.5 rounded-xl font-bold transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'text-gray-400 hover:bg-white/10'}`}>Cancel</button>
                        <button type="submit" className={`flex-1 py-2.5 rounded-xl font-bold shadow-lg transition-transform active:scale-95 ${isCyberpunk ? 'bg-[#00f0ff] text-black hover:bg-[#00f0ff]/80' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>Create</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const InventoryGrid: React.FC<{
    inventory: Record<string, any>;
    items: ShopItem[];
    handleConsume: (id: string, e?: React.MouseEvent) => void;
    handleSell: (id: string, e: React.MouseEvent) => void;
    isCyberpunk: boolean;
}> = ({ inventory, items, handleConsume, handleSell, isCyberpunk }) => (
    <div className={`rounded-3xl p-8 border ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-white dark:bg-slate-800/50 border-gray-200 dark:border-white/5'}`}>
        <h3 className={`text-xl font-bold mb-6 flex items-center gap-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>
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
                <div className={`col-span-full text-center py-8 ${isCyberpunk ? 'text-[#00f0ff]/40' : 'text-gray-500 dark:text-slate-500'}`}>Your inventory is empty. Visit the shop!</div>
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
                        <div key={item.id} className={`flex items-center justify-between p-4 rounded-xl border ${isCyberpunk ? 'bg-black border-[#00f0ff]/30' : 'bg-gray-50 dark:bg-black/20 border-gray-200 dark:border-white/10'}`}>
                            <div className="flex items-center gap-3">
                                <div className="text-2xl">{item.icon}</div>
                                <div>
                                    <p className={`font-bold text-sm ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>{item.name}</p>
                                    {item.type !== 'unlock' && <p className={`text-xs ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500 dark:text-slate-400'}`}>Owned: {count}</p>}
                                </div>
                            </div>
                            {item.type !== 'unlock' && (
                                <div className="flex gap-2">
                                    <button onClick={(e) => handleConsume(item.id, e)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/30' : 'bg-white dark:bg-slate-700 border border-gray-200 dark:border-transparent hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-700 dark:text-white'}`}>Use</button>
                                    <button onClick={(e) => handleSell(item.id, e)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${isCyberpunk ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'}`} title={`Sell for ${Math.floor(item.cost * 0.6)} Gems`}>Sell</button>
                                </div>
                            )}
                            {item.type === 'unlock' && (
                                <div className="flex gap-2 items-center">
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${isCyberpunk ? 'bg-[#00ff00]/20 text-[#00ff00]' : 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'}`}>Active</span>
                                    <button onClick={(e) => handleSell(item.id, e)} className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-colors ${isCyberpunk ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'}`} title={`Sell for ${Math.floor(item.cost * 0.6)} Gems`}>Sell</button>
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
    onAddCustom?: () => void;
    onReorder: (ids: string[]) => void;
}> = ({ inventory, items, currentGems, handleBuy, handleDeleteCustom, isCyberpunk, onAddCustom, onReorder }) => {
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggingIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggingIndex === null || draggingIndex === index) return;
        
        const newItems = [...items];
        const draggedItem = newItems[draggingIndex];
        newItems.splice(draggingIndex, 1);
        newItems.splice(index, 0, draggedItem);
        
        onReorder(newItems.map(i => i.id));
        setDraggingIndex(index);
    };

    return (
    <div className={`rounded-3xl p-8 border shadow-2xl relative overflow-hidden ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 border-gray-200 dark:border-white/10'}`}>
        <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none ${isCyberpunk ? 'bg-[#00f0ff]/10' : 'bg-purple-100 dark:bg-purple-500/10'}`}></div>
        <div className="flex justify-between items-center mb-8 relative z-10">
            <h3 className={`text-2xl font-bold flex items-center gap-3 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>
                <span className="text-3xl">🏦</span> Market <span className={`text-sm font-normal ml-2 opacity-60 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-500 dark:text-slate-300'}`}>(Spend your winnings)</span>
            </h3>
            {onAddCustom && (
                <button onClick={onAddCustom} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/30 hover:bg-[#00f0ff]/20' : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white border-gray-200 dark:border-white/20 hover:bg-gray-200 dark:hover:bg-white/20'}`}>
                    + Custom Item
                </button>
            )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
            {items.map((item, index) => {
                const isExpired = item.expiryDate ? new Date(item.expiryDate) < new Date() : false;
                return (
                <div 
                    key={item.id} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={() => setDraggingIndex(null)}
                    className={`group rounded-2xl p-5 transition-all duration-300 flex flex-col gap-4 relative cursor-move ${isCyberpunk ? 'bg-black border-[#00f0ff]/20 hover:border-[#00f0ff]' : 'bg-gray-50 dark:bg-black/20 hover:bg-white dark:hover:bg-white/5 border-gray-200 dark:border-white/5 hover:border-purple-300 dark:hover:border-purple-500/50'} ${inventory[item.id] && item.type === 'unlock' ? (isCyberpunk ? 'border-[#00ff00]/50 bg-[#00ff00]/10' : 'border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-900/10') : ''} ${isExpired ? 'opacity-60 grayscale' : ''} ${draggingIndex === index ? 'opacity-50' : ''}`}>
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
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-inner border group-hover:scale-110 transition-transform ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gradient-to-br dark:from-purple-900 dark:to-slate-900 border-gray-200 dark:border-white/10'}`}>
                            {item.icon}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex gap-1">
                                {item.type === 'unlock' && <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${isCyberpunk ? 'border-purple-500/30 text-purple-400 bg-purple-500/10' : 'border-purple-200 dark:border-purple-500/30 text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-500/10'}`}>One-Time</span>}
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${getCategoryColor(item.category || '', isCyberpunk)}`}>{item.category}</span>
                            </div>
                            {item.expiryDate && <span className={`text-[9px] font-mono ${isExpired ? 'text-red-500' : (isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-400')}`}>{isExpired ? 'EXPIRED' : new Date(item.expiryDate).toLocaleDateString()}</span>}
                        </div>
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-baseline mb-1">
                            <h4 className={`font-bold text-base ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-slate-200'}`}>{item.name}</h4>
                            <span className={`font-mono font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-700 dark:text-white'}`}>{item.cost > 0 ? `${item.cost} 💎` : 'FREE'}</span>
                        </div>
                        <p className={`text-xs leading-relaxed ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500 dark:text-slate-400'}`}>{item.desc}</p>
                    </div>
                    <button onClick={(e) => handleBuy(item, e)} disabled={isExpired || currentGems < item.cost || (item.type === 'unlock' && inventory[item.id])} className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${item.type === 'unlock' && inventory[item.id] ? (isCyberpunk ? 'bg-[#00ff00]/20 text-[#00ff00] cursor-default' : 'bg-green-100 dark:bg-green-600/20 text-green-600 dark:text-green-500 cursor-default') : (isExpired ? (isCyberpunk ? 'bg-[#0a0a0a] text-red-500/50 border border-red-900/30 cursor-not-allowed' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed') : (currentGems >= item.cost ? (isCyberpunk ? 'bg-[#00f0ff] text-black hover:bg-[#00f0ff]/80 shadow-[0_0_10px_rgba(0,240,255,0.4)]' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20') : (isCyberpunk ? 'bg-[#0a0a0a] text-[#00f0ff]/30 cursor-not-allowed border border-[#00f0ff]/10' : 'bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-slate-600 cursor-not-allowed')))}`}>
                        {item.type === 'unlock' && inventory[item.id] ? 'Purchased' : isExpired ? 'Expired' : currentGems >= item.cost ? 'Purchase' : `Need ${item.cost - currentGems} 💎`}
                    </button>
                </div>
                );
            })}
        </div>
    </div>
    );
};

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
            <style>{`
                @keyframes slot-spin {
                    0% { transform: translateY(-150%); filter: blur(4px); opacity: 0.5; }
                    100% { transform: translateY(150%); filter: blur(4px); opacity: 0.5; }
                }
                @keyframes reel-stop {
                    0% { transform: translateY(-100%); filter: blur(2px); }
                    60% { transform: translateY(15%); filter: blur(0); }
                    80% { transform: translateY(-5%); }
                    100% { transform: translateY(0); }
                }
                .slot-spinning {
                    animation: slot-spin 0.1s linear infinite;
                }
                .reel-stop {
                    animation: reel-stop 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
                }
            `}</style>
            <div className={`w-full max-w-md rounded-3xl border-4 shadow-[0_0_50px_rgba(234,179,8,0.3)] p-8 relative overflow-hidden flex flex-col items-center ${isCyberpunk ? 'bg-black border-[#00f0ff] shadow-[0_0_50px_rgba(0,240,255,0.3)]' : 'bg-[#1c1c1e] border-yellow-500'}`}>
                <div className={`absolute top-0 left-0 w-full h-32 bg-gradient-to-b to-transparent pointer-events-none ${isCyberpunk ? 'from-[#00f0ff]/20' : 'from-yellow-500/20'}`}></div>
                <h3 className={`text-3xl font-black mb-8 drop-shadow-sm ${isCyberpunk ? 'text-[#00f0ff]' : 'text-yellow-400'}`}>JACKPOT SLOTS</h3>
                <div className={`flex gap-4 mb-8 p-6 rounded-2xl border shadow-inner ${isCyberpunk ? 'bg-black border-[#00f0ff]/30' : 'bg-black/50 border-white/10'}`}>
                    {slotItems.map((item, i) => (
                        <div key={i} className={`w-20 h-24 bg-white text-6xl flex items-center justify-center rounded-xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)] border-b-4 border-slate-300 overflow-hidden relative transition-transform duration-200 ${reelStatuses[i] ? 'scale-100' : 'scale-95'} ${isCyberpunk ? 'bg-[#00f0ff] text-black border-[#0099ff]' : ''}`}>
                            <div className={`${!reelStatuses[i] ? 'slot-spinning' : 'reel-stop'}`}>{item}</div>
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

const ChallengeHistoryModal: React.FC<{ isOpen: boolean; onClose: () => void; isCyberpunk: boolean; challenges: Challenge[] }> = ({ isOpen, onClose, isCyberpunk, challenges }) => {
    if (!isOpen) return null;

    const history = challenges.filter(c => c.completedDate || (c.dueDate && new Date(c.dueDate + 'T23:59:59') < new Date() && !c.completedDate)).sort((a, b) => {
        const dateA = a.completedDate ? new Date(a.completedDate) : (a.dueDate ? new Date(a.dueDate) : new Date(0));
        const dateB = b.completedDate ? new Date(b.completedDate) : (b.dueDate ? new Date(b.dueDate) : new Date(0));
        return dateB.getTime() - dateA.getTime();
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className={`w-full max-w-2xl rounded-3xl border shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[80vh] ${isCyberpunk ? 'bg-black border-[#00f0ff]/50' : 'bg-[#1c1c1e] border-slate-700'}`}>
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <h3 className={`text-2xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>Challenge History</h3>
                    <button onClick={onClose} className={`p-1 rounded-lg transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-slate-400 hover:text-white'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                    {history.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">No past challenges.</div>
                    ) : (
                        history.map((c) => {
                            const isCompleted = !!c.completedDate;
                            const statusColor = isCompleted ? (isCyberpunk ? 'text-green-500' : 'text-green-400') : (isCyberpunk ? 'text-red-500' : 'text-red-400');
                            const statusText = isCompleted ? 'Completed' : 'Failed';
                            const date = isCompleted ? c.completedDate : c.dueDate;
                            
                            return (
                                <div key={c.id} className={`flex items-center justify-between p-4 rounded-xl border ${isCyberpunk ? 'bg-[#00f0ff]/5 border-[#00f0ff]/20' : 'bg-white/5 border-white/5'}`}>
                                    <div>
                                        <p className={`text-sm font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>{c.title}</p>
                                        <p className={`text-xs ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-400'}`}>
                                            {statusText} on {date ? new Date(date).toLocaleDateString() : 'Unknown'} • {c.difficulty || 'Medium'}
                                        </p>
                                    </div>
                                    <div className={`font-mono font-bold ${statusColor}`}>
                                        {isCompleted ? `+${c.reward}` : `-${c.difficulty === 'Hard' ? 20 : c.difficulty === 'Easy' ? 5 : 10}`} 💎
                                    </div>
                                </div>
                            );
                        })
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
            <h3 className={`text-xl font-bold flex items-center gap-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>
                <span className="text-2xl">🏆</span> Trophy Room
            </h3>
            <div className="flex gap-2">
                <div className={`flex p-1 rounded-lg ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/20' : 'bg-gray-100 dark:bg-slate-800'}`}>
                    {(['all', 'unlocked', 'locked'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all capitalize ${filter === f ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-sm' : 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm') : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white')}`}>
                            {f}
                        </button>
                    ))}
                </div>
                <div className={`px-3 py-1 rounded-lg border flex items-center ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`}>
                    <span className={`text-xs font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-700 dark:text-slate-300'}`}>{unlockedCount} / {achievements.length}</span>
                </div>
            </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {achievements.map((badge) => (
                <div key={badge.id} className={`relative aspect-square rounded-2xl border flex flex-col items-center justify-center text-center p-2 transition-all duration-300 group overflow-hidden ${badge.isUnlocked ? (isCyberpunk ? 'bg-black border-[#00f0ff]/50 shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:border-[#00f0ff]' : `bg-white dark:bg-gradient-to-b dark:from-slate-800 dark:to-slate-900 shadow-lg dark:shadow-[0_0_15px_rgba(0,0,0,0.3)] hover:-translate-y-1 ${RARITY_COLORS[badge.rewardConfig.rarity].replace('text-', 'border-').split(' ')[1] || 'border-gray-200 dark:border-slate-700'}`) : (isCyberpunk ? 'bg-black border-[#00f0ff]/10 opacity-40 grayscale' : 'bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-800 opacity-40 grayscale')}`}>
                <div className="flex flex-col items-center transition-opacity duration-300 group-hover:opacity-0">
                    <div className={`text-4xl mb-2 transition-transform duration-300 ${badge.isUnlocked ? (isCyberpunk ? 'drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]' : 'drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]') : 'opacity-50'}`}>{badge.icon}</div>
                    <h4 className={`font-bold text-xs mb-1 line-clamp-1 ${badge.isUnlocked ? (isCyberpunk ? 'text-[#00f0ff]' : RARITY_COLORS[badge.rewardConfig.rarity].split(' ')[0]) : (isCyberpunk ? 'text-[#00f0ff]/40' : 'text-gray-400 dark:text-slate-500')}`}>{badge.title}</h4>
                    {badge.isUnlocked && <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${isCyberpunk ? 'bg-[#00f0ff] shadow-[0_0_5px_rgba(0,240,255,0.8)]' : 'bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.8)]'}`}></div>}
                    <div className={`mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.isUnlocked ? (isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-slate-800 ' + RARITY_COLORS[badge.rewardConfig.rarity]) : (isCyberpunk ? 'bg-black text-[#00f0ff]/30 border-[#00f0ff]/10' : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600 border-gray-200 dark:border-slate-700')}`}>{badge.rewardConfig.gems} 💎</div>
                </div>
                <div className={`absolute inset-0 flex flex-col items-center justify-center p-3 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 ${isCyberpunk ? 'bg-black/95' : 'bg-white/95 dark:bg-slate-900/95'}`}>
                    <p className={`text-xs font-bold mb-1 line-clamp-1 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>{badge.title}</p>
                    <p className={`text-[10px] leading-relaxed line-clamp-3 ${isCyberpunk ? 'text-[#00f0ff]/80' : 'text-gray-600 dark:text-slate-300'}`}>{badge.description}</p>
                    {!badge.isUnlocked && badge.progress > 0 && (
                        <div className="w-full mt-2 px-1">
                            <div className={`flex justify-between text-[8px] mb-0.5 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500 dark:text-slate-400'}`}><span>Progress</span><span>{Math.floor(badge.progress)}%</span></div>
                            <div className={`h-1 w-full rounded-full overflow-hidden ${isCyberpunk ? 'bg-[#00f0ff]/20' : 'bg-slate-700'}`}><div className={`h-full ${isCyberpunk ? 'bg-[#00f0ff]' : 'bg-blue-500'}`} style={{ width: `${badge.progress}%` }}></div></div>
                        </div>
                    )}
                    <div className={`mt-2 text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.isUnlocked ? (isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-slate-800 ' + RARITY_COLORS[badge.rewardConfig.rarity]) : (isCyberpunk ? 'bg-black text-[#00f0ff]/40 border-[#00f0ff]/10' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500 border-gray-200 dark:border-slate-700')}`}>{badge.rewardConfig.gems} 💎</div>
                </div>
            </div>
            ))}
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
  const [activeTab, setActiveTab] = useState<'shop' | 'earn' | 'challenges'>('shop');
  const [isCreateItemModalOpen, setIsCreateItemModalOpen] = useState(false);
  const [customShopItems, setCustomShopItems] = useState<ShopItem[]>([]);
  const [shopFilter, setShopFilter] = useState<'all' | 'custom'>('all');

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [newChallengeTitle, setNewChallengeTitle] = useState('');
  const [newChallengeReward, setNewChallengeReward] = useState(50);
  const [newChallengeDueDate, setNewChallengeDueDate] = useState('');
  const [newChallengeDifficulty, setNewChallengeDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [challengeFilter, setChallengeFilter] = useState<'active' | 'expired' | 'completed' | 'all'>('active');
  const [timerTick, setTimerTick] = useState(0);
  const [isAddChallengeMenuOpen, setIsAddChallengeMenuOpen] = useState(false);
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);
  const [isChallengeHistoryOpen, setIsChallengeHistoryOpen] = useState(false);

  useEffect(() => {
      const timer = setInterval(() => setTimerTick(t => t + 1), 60000);
      return () => clearInterval(timer);
  }, []);

  useEffect(() => {
      try {
          const saved = localStorage.getItem('focusflow_challenges');
          if (saved) {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed)) {
                  setChallenges(parsed);
              }
          }
      } catch {}
  }, []);

  const handleAddChallenge = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newChallengeTitle.trim() || newChallengeReward <= 0) return;
      
      let updated;
      if (editingChallengeId) {
          updated = challenges.map(c => {
              if (c.id === editingChallengeId) {
                  return {
                      ...c,
                      title: newChallengeTitle.trim(),
                      reward: newChallengeReward,
                      dueDate: newChallengeDueDate || undefined,
                      difficulty: newChallengeDifficulty
                  };
              }
              return c;
          });
          setEditingChallengeId(null);
      } else {
          const newChallenge: Challenge = {
              id: Date.now().toString(),
              title: newChallengeTitle.trim(),
              reward: newChallengeReward,
              dueDate: newChallengeDueDate || undefined,
              difficulty: newChallengeDifficulty
          };
          updated = [...challenges, newChallenge];
      }

      setChallenges(updated);
      localStorage.setItem('focusflow_challenges', JSON.stringify(updated));
      setNewChallengeTitle('');
      setNewChallengeReward(50);
      setNewChallengeDueDate('');
      setNewChallengeDifficulty('Medium');
      setIsAddChallengeMenuOpen(false);
  };

  const handleEditChallenge = (challenge: Challenge) => {
      setEditingChallengeId(challenge.id);
      setNewChallengeTitle(challenge.title);
      setNewChallengeReward(challenge.reward);
      setNewChallengeDueDate(challenge.dueDate || '');
      setNewChallengeDifficulty(challenge.difficulty || 'Medium');
      setIsAddChallengeMenuOpen(true);
  };

  const handleCancelEdit = () => {
      setEditingChallengeId(null);
      setNewChallengeTitle('');
      setNewChallengeReward(50);
      setNewChallengeDueDate('');
      setNewChallengeDifficulty('Medium');
      setIsAddChallengeMenuOpen(false);
  };

  const handleDifficultyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const diff = e.target.value as 'Easy' | 'Medium' | 'Hard';
      setNewChallengeDifficulty(diff);
      if (diff === 'Easy') setNewChallengeReward(20);
      else if (diff === 'Medium') setNewChallengeReward(50);
      else if (diff === 'Hard') setNewChallengeReward(100);
  };

  const handleCompleteChallenge = (id: string, e?: React.MouseEvent) => {
      const challenge = challenges.find(c => c.id === id);
      if (!challenge) return;
      
      if (confirm(`Did you complete "${challenge.title}"?`)) {
          const currentBonus = parseInt(localStorage.getItem('focusflow_bonus_gems') || '0') || 0;
          const newBonus = currentBonus + challenge.reward;
          setBonusGems(newBonus);
          localStorage.setItem('focusflow_bonus_gems', newBonus.toString());
          
          addTransaction({
              id: `challenge-${id}-${Date.now()}`,
              date: new Date().toISOString(),
              type: 'EARN',
              amount: challenge.reward,
              description: `Challenge: ${challenge.title}`
          });
          
          const savedVol = localStorage.getItem('focusflow_timer_volume');
          const vol = savedVol ? parseFloat(savedVol) : 0.5;
          playWin(vol);
          
          if (e) spawnParticles(e.clientX, e.clientY, isCyberpunk ? '#00ff00' : '#10b981', 15, `+${challenge.reward}`);
          
          const newChallenges = challenges.map(c => c.id === id ? { ...c, completedDate: new Date().toISOString() } : c);
          setChallenges(newChallenges);
          localStorage.setItem('focusflow_challenges', JSON.stringify(newChallenges));
          if (challengeFilter === 'active') setChallengeFilter('active'); // Refresh view context if needed
      }
  };

  const handleDeleteChallenge = (id: string) => {
      if (confirm('Delete this challenge?')) {
          const newChallenges = challenges.filter(c => c.id !== id);
          setChallenges(newChallenges);
          localStorage.setItem('focusflow_challenges', JSON.stringify(newChallenges));
      }
  };

  const getCountdown = (dateStr: string) => {
      const now = new Date();
      const due = new Date(dateStr + 'T23:59:59');
      const diff = due.getTime() - now.getTime();
      
      if (diff <= 0) return 'Expired';
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (days > 0) return `${days}d ${hours}h`;
      return `${hours}h ${minutes}m`;
  };

  // Penalty Check
  useEffect(() => {
      if (!Array.isArray(challenges)) return;

      const now = new Date();
      let penaltyTotal = 0;
      let hasUpdates = false;

      const updatedChallenges = challenges.map(c => {
          if (!c.completedDate && !c.penalized && c.dueDate) {
              const due = new Date(c.dueDate + 'T23:59:59');
              if (now > due) {
                  hasUpdates = true;
                  const penalty = c.difficulty === 'Hard' ? 20 : c.difficulty === 'Easy' ? 5 : 10;
                  penaltyTotal += penalty;
                  return { ...c, penalized: true };
              }
          }
          return c;
      });

      if (hasUpdates) {
          setChallenges(updatedChallenges);
          localStorage.setItem('focusflow_challenges', JSON.stringify(updatedChallenges));

          if (penaltyTotal > 0) {
              const currentBonus = parseInt(localStorage.getItem('focusflow_bonus_gems') || '0') || 0;
              const newBonus = currentBonus - penaltyTotal;
              setBonusGems(newBonus);
              localStorage.setItem('focusflow_bonus_gems', newBonus.toString());

              addTransaction({
                  id: `penalty-${Date.now()}`,
                  date: new Date().toISOString(),
                  type: 'SPEND',
                  amount: -penaltyTotal,
                  description: 'Challenge Expired Penalty'
              });
              
              const savedVol = localStorage.getItem('focusflow_timer_volume');
              const vol = savedVol ? parseFloat(savedVol) : 0.5;
              playTone(150, 0.5, vol, 'sawtooth');
          }
      }
  }, [challenges, timerTick]);

  const filteredChallenges = useMemo(() => {
      if (!Array.isArray(challenges)) return [];

      return challenges.filter(c => {
          const isExpired = c.dueDate && getCountdown(c.dueDate) === 'Expired';
          const isCompleted = !!c.completedDate;

          if (challengeFilter === 'active') return !isCompleted && !isExpired;
          if (challengeFilter === 'expired') return !isCompleted && isExpired;
          if (challengeFilter === 'completed') return isCompleted;
          return true;
      }).sort((a, b) => {
          if (challengeFilter === 'completed' && a.completedDate && b.completedDate) {
              return new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime();
          }
          return 0;
      });
  }, [challenges, challengeFilter, timerTick]); // tick dependency to update expired status

  const isMounted = useRef(true);
  useEffect(() => {
      isMounted.current = true;
      return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
      storage.getCustomShopItems().then(setCustomShopItems);
  }, []);

  const [shopOrder, setShopOrder] = useState<string[]>([]);
  useEffect(() => {
      try {
          setShopOrder(JSON.parse(localStorage.getItem('focusflow_shop_order') || '[]'));
      } catch { setShopOrder([]); }
  }, []);

  const orderedShopItems = useMemo(() => {
      const all = [...STATIC_SHOP_ITEMS, ...customShopItems];
      if (shopOrder.length === 0) return all;

      const itemMap = new Map(all.map(i => [i.id, i]));
      const result: ShopItem[] = [];
      
      shopOrder.forEach(id => {
          const item = itemMap.get(id);
          if (item) {
              result.push(item);
              itemMap.delete(id);
          }
      });
      
      // Append remaining items
      all.forEach(item => {
          if (itemMap.has(item.id)) {
              result.push(item);
          }
      });
      
      return result;
  }, [customShopItems, shopOrder]);

  const handleShopReorder = (newOrderIds: string[]) => {
      setShopOrder(newOrderIds);
      localStorage.setItem('focusflow_shop_order', JSON.stringify(newOrderIds));
  };

  // --- Particle State ---
  const particleSystemRef = useRef<ParticleSystemHandle>(null);

  const spawnParticles = (x: number, y: number, color: string, count: number = 12, text?: string) => {
      particleSystemRef.current?.spawn(x, y, color, count, text);
  };

  // --- Slot Machine State ---
  const [lastSpinStreak, setLastSpinStreak] = useState(0);
  useEffect(() => {
      const val = parseInt(localStorage.getItem('focusflow_last_spin_streak') || '0');
      setLastSpinStreak(isNaN(val) ? 0 : val);
  }, []);

  const [isSlotMachineOpen, setIsSlotMachineOpen] = useState(false);
  const [slotRolling, setSlotRolling] = useState(false);
  const [slotItems, setSlotItems] = useState(['🍒', '7️⃣', '💎']);
  const [reelStatuses, setReelStatuses] = useState([true, true, true]); // true = stopped
  const [slotMessage, setSlotMessage] = useState('');
  
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const winIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
      return () => {
          if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
          if (winIntervalRef.current) clearInterval(winIntervalRef.current);
      };
  }, []);

  // --- Inventory & Economy State ---
  const [spentGems, setSpentGems] = useState(0);
  const [bonusGems, setBonusGems] = useState(0);
  const [inventory, setInventory] = useState<Record<string, any>>({});

  useEffect(() => {
      const s = parseInt(localStorage.getItem('focusflow_spent_gems') || '0');
      setSpentGems(isNaN(s) ? 0 : s);
      
      const b = parseInt(localStorage.getItem('focusflow_bonus_gems') || '0');
      setBonusGems(isNaN(b) ? 0 : b);
      
      try {
          setInventory(JSON.parse(localStorage.getItem('focusflow_inventory') || '{}'));
      } catch { setInventory({}); }
  }, []);

  // --- Filters ---
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  
  // 2. Define achievementsWithRewards IMMEDIATELY after (Moved up)
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

  // 3. Now the useEffect can safely use achievementsWithRewards
  useEffect(() => {
      const unlockedIds = new Set((transactions || []).filter(t => t.type === 'UNLOCK').map(t => t.relatedId));
      let newTx: Transaction[] = [];
      
      // FIX: Use achievementsWithRewards instead of achievements
      achievementsWithRewards.forEach(badge => {
          if (badge.isUnlocked && !unlockedIds.has(badge.id)) {
              newTx.push({
                  id: `unlock-${badge.id}-${Date.now()}`,
                  date: new Date().toISOString(),
                  type: 'UNLOCK',
                  // Now rewardConfig exists!
                  amount: badge.rewardConfig.gems,
                  description: `Unlocked: ${badge.title}`,
                  relatedId: badge.id
              });
          }
      });

      if (newTx.length > 0) {
          newTx.forEach(t => addTransaction(t));
      }
  }, [achievementsWithRewards, (transactions || []).length]); // FIX: Dependency updated

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
                  const isCrit = Math.random() > 0.9; // 10% chance for critical win
                  const winAmount = isCrit ? 250 : 100; // 5x payout on crit, 2x normal
                  playWin(vol);
                  setBonusGems(prev => {
                      const newVal = prev + winAmount;
                      localStorage.setItem('focusflow_bonus_gems', newVal.toString());
                      return newVal;
                  });
                  alert(isCrit ? `JACKPOT! Double or Nothing CRITICAL WIN! (+${winAmount} Gems)` : "WON Double or Nothing! (+100 Gems)");
                  addTransaction({ id: `gamble-win-${Date.now()}`, date: new Date().toISOString(), type: 'WIN', amount: winAmount, description: isCrit ? `Won Double or Nothing (CRIT)` : `Won Double or Nothing` });
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

  const handleConsume = (itemId: string, e?: React.MouseEvent) => {
      const item = orderedShopItems.find(i => i.id === itemId);
      if (!confirm(`Are you sure you want to use ${item ? item.name : 'this item'}?`)) return;

      const newInventory = { ...inventory };
      let key = itemId;
      if (itemId === 'freeze') key = 'streakFreeze';
      if (itemId === 'dessert') key = 'cheatDessert';
      
      if (newInventory[key] > 0) {
          newInventory[key] = newInventory[key] - 1;

          // Vault Logic
          if (itemId === 'vault_mystery' || itemId === 'vault_mega') {
              const isMega = itemId === 'vault_mega';
              const roll = Math.random();
              let rewardMsg = '';
              
              if (roll < 0.7) {
                  // Gems Reward
                  const base = isMega ? 300 : 80;
                  const amount = Math.floor(base * (0.5 + Math.random() * 2.0)); // Increased variance (0.5x to 2.5x)
                  
                  setBonusGems(prev => {
                      const newVal = prev + amount;
                      localStorage.setItem('focusflow_bonus_gems', newVal.toString());
                      return newVal;
                  });
                  
                  addTransaction({ id: `vault-${Date.now()}`, date: new Date().toISOString(), type: 'WIN', amount: amount, description: `Loot: ${item?.name}` });
                  rewardMsg = `You found ${amount} Gems!`;
                  
                  if (e) spawnParticles(e.clientX, e.clientY, '#fbbf24', 20, `+${amount}`);
              } else {
                  // Item Reward (Streak Freeze)
                  const count = isMega ? 3 : 1;
                  newInventory.streakFreeze = (newInventory.streakFreeze || 0) + count;
                  rewardMsg = `You found ${count} Streak Freeze${count > 1 ? 's' : ''}!`;
                  if (e) spawnParticles(e.clientX, e.clientY, '#3b82f6', 20, '🛡️');
              }
              
              const savedVol = localStorage.getItem('focusflow_timer_volume');
              const vol = savedVol ? parseFloat(savedVol) : 0.5;
              playWin(vol);
              alert(rewardMsg);
          }

          setInventory(newInventory);
          localStorage.setItem('focusflow_inventory', JSON.stringify(newInventory));
      }
  };

  const handleSell = (itemId: string, e?: React.MouseEvent) => {
      const item = orderedShopItems.find(i => i.id === itemId);
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
      if (isMounted.current) setCustomShopItems(updated);
  };

  const handleDeleteCustomItem = async (id: string) => {
      const updated = await storage.deleteCustomShopItem(id);
      if (isMounted.current) setCustomShopItems(updated);
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
      
      playTone(600, 0.2, vol, 'sine'); // Start Spin Sound
      
      let ticks = 0;
      const symbols = ['🍒', '🍋', '🍇', '💎', '7️⃣', '🔔'];
      
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = setInterval(() => {
          ticks++;
          setSlotItems(prev => {
              if (ticks % 2 === 0) playSpinTick(vol);
              const next = [...prev];
              if (ticks < 20) next[0] = symbols[Math.floor(Math.random() * symbols.length)];
              else if (ticks === 20) { next[0] = '💎'; setReelStatuses(s => [true, false, false]); playTone(300, 0.1, vol, 'sawtooth'); }
              if (ticks < 35) next[1] = symbols[Math.floor(Math.random() * symbols.length)];
              else if (ticks === 35) { next[1] = '💎'; setReelStatuses(s => [true, true, false]); playTone(300, 0.1, vol, 'sawtooth'); }
              if (ticks < 50) next[2] = symbols[Math.floor(Math.random() * symbols.length)];
              else if (ticks === 50) { next[2] = '💎'; setReelStatuses(s => [true, true, true]); playTone(300, 0.1, vol, 'sawtooth'); }
              return next;
          });
          if (ticks >= 50) {
              if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
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
      
      if (winIntervalRef.current) clearInterval(winIntervalRef.current);
      winIntervalRef.current = setInterval(() => {
          current += step;
          if (current >= amount) {
              current = amount;
              if (winIntervalRef.current) clearInterval(winIntervalRef.current);
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
      <ParticleSystem ref={particleSystemRef} />
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

            <div className={`flex p-1 rounded-2xl mb-8 transition-all duration-300 ${isCyberpunk ? 'bg-black/40 border border-[#00f0ff]/20 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-gray-100 dark:bg-white/5'}`}>
                {(['shop', 'earn', 'challenges'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 px-6 rounded-xl text-sm font-bold transition-all duration-300 capitalize ${
                            activeTab === tab
                                ? (isCyberpunk 
                                    ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.4)] border border-[#00f0ff]/50 animate-pulse' 
                                    : 'bg-white text-gray-900 shadow-lg')
                                : (isCyberpunk 
                                    ? 'text-[#00f0ff]/40 hover:text-[#00f0ff] hover:bg-[#00f0ff]/5' 
                                    : 'text-gray-400 hover:bg-white/5')
                        }`}
                    >
                        {tab}
                    </button>
                ))}
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
                    items={orderedShopItems}
                    handleConsume={handleConsume}
                    handleSell={handleSell}
                    isCyberpunk={isCyberpunk}
                />
                <ShopGrid 
                    inventory={inventory}
                    items={orderedShopItems}
                    currentGems={currentGems}
                    handleBuy={handleBuy}
                    handleDeleteCustom={handleDeleteCustomItem}
                    isCyberpunk={isCyberpunk}
                    onAddCustom={() => setIsCreateItemModalOpen(true)}
                    onReorder={handleShopReorder}
                />
                </>
                )}

                {activeTab === 'challenges' && (
                    <div className={`rounded-3xl p-8 border ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-white dark:bg-slate-800/50 border-gray-200 dark:border-white/5'}`}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className={`text-xl font-bold flex items-center gap-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>
                                <span className="text-2xl">⚔️</span> Self-Challenges
                            </h3>
                            <div className="flex items-center gap-3">
                                <div className={`text-xs hidden sm:block ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>
                                    Set goals, complete them, earn gems.
                                </div>
                                <button onClick={() => setIsChallengeHistoryOpen(true)} className={`p-2 rounded-xl transition-all ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'}`} title="Challenge History">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </button>
                                <button onClick={() => { if(isAddChallengeMenuOpen) handleCancelEdit(); else setIsAddChallengeMenuOpen(true); }} className={`p-2 rounded-xl transition-all ${isAddChallengeMenuOpen ? (isCyberpunk ? 'bg-[#00f0ff] text-black' : 'bg-blue-600 text-white') : (isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600')}`}>
                                    <svg className={`w-5 h-5 transition-transform ${isAddChallengeMenuOpen ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                </button>
                            </div>
                        </div>

                        {/* Create Challenge Form */}
                        {isAddChallengeMenuOpen && (
                        <form onSubmit={handleAddChallenge} className={`mb-8 p-4 rounded-2xl border animate-fade-in ${isCyberpunk ? 'bg-black border-[#00f0ff]/30' : 'bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-white/10'}`}>
                            <div className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="flex-1 w-full">
                                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>Challenge Title</label>
                                    <input type="text" value={newChallengeTitle} onChange={(e) => setNewChallengeTitle(e.target.value)} placeholder="e.g. Read 50 pages" className={`w-full px-4 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2 ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white focus:ring-blue-500'}`} />
                                </div>
                                <div className="w-full md:w-28">
                                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>Difficulty</label>
                                    <select value={newChallengeDifficulty} onChange={handleDifficultyChange} className={`w-full px-3 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2 ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white focus:ring-blue-500'}`}>
                                        <option value="Easy">Easy</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Hard">Hard</option>
                                    </select>
                                </div>
                                <div className="w-full md:w-32">
                                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>Reward</label>
                                    <input type="number" value={newChallengeReward} onChange={(e) => setNewChallengeReward(parseInt(e.target.value))} min="1" className={`w-full px-4 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2 ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white focus:ring-blue-500'}`} />
                                </div>
                                <div className="w-full md:w-32">
                                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>Due Date</label>
                                    <input type="date" value={newChallengeDueDate} onChange={(e) => setNewChallengeDueDate(e.target.value)} className={`w-full px-4 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2 ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff] [color-scheme:dark]' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white focus:ring-blue-500 [color-scheme:light] dark:[color-scheme:dark]'}`} />
                                </div>
                                <button type="submit" disabled={!newChallengeTitle.trim() || newChallengeReward <= 0} className={`w-full md:w-auto px-6 py-2 rounded-xl text-sm font-bold shadow-lg transition-all ${isCyberpunk ? 'bg-[#00f0ff] text-black hover:bg-[#00f0ff]/80 disabled:opacity-50' : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'}`}>{editingChallengeId ? 'Update' : 'Set Challenge'}</button>
                                {editingChallengeId && (
                                    <button type="button" onClick={handleCancelEdit} className={`w-full md:w-auto px-4 py-2 rounded-xl text-sm font-bold transition-all ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>Cancel</button>
                                )}
                            </div>
                        </form>
                        )}

                        {/* Filter Controls */}
                        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
                            {(['active', 'expired', 'completed', 'all'] as const).map(filter => (
                                <button key={filter} onClick={() => setChallengeFilter(filter)} className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all whitespace-nowrap ${challengeFilter === filter ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300') : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white')}`}>
                                    {filter}
                                </button>
                            ))}
                        </div>

                        {/* Challenges List */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {filteredChallenges.length === 0 ? (
                                <div className={`col-span-full text-center py-10 ${isCyberpunk ? 'text-[#00f0ff]/40' : 'text-gray-400'}`}>No {challengeFilter} challenges found.</div>
                            ) : (
                                filteredChallenges.map(challenge => (
                                    <div key={challenge.id} className={`group relative p-5 rounded-2xl border transition-all ${isCyberpunk ? 'bg-black border-[#00f0ff]/20 hover:border-[#00f0ff]' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:shadow-md'}`}>
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEditChallenge(challenge)} className="p-1.5 text-gray-400 hover:text-blue-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                            <button onClick={() => handleDeleteChallenge(challenge.id)} className="p-1.5 text-gray-400 hover:text-red-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                        </div>
                                        <div className="mb-4">
                                            <h4 className={`font-bold text-lg ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>{challenge.title}</h4>
                                            <p className={`text-xs font-mono mt-1 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>Reward: {challenge.reward} 💎</p>
                                            <p className={`text-xs font-mono mt-0.5 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>Difficulty: {challenge.difficulty || 'Medium'}</p>
                                            {challenge.dueDate && (
                                                <p className={`text-xs font-mono mt-1 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>
                                                    Due: {challenge.dueDate} <span className={getCountdown(challenge.dueDate) === 'Expired' ? 'text-red-500 font-bold' : ''}>({getCountdown(challenge.dueDate)})</span>
                                                </p>
                                            )}
                                            {challenge.penalized && (
                                                <p className={`text-xs font-mono mt-1 ${isCyberpunk ? 'text-red-500' : 'text-red-600'}`}>Penalty Applied (-{challenge.difficulty === 'Hard' ? 20 : challenge.difficulty === 'Easy' ? 5 : 10} 💎)</p>
                                            )}
                                            {challenge.completedDate && (
                                                <p className={`text-xs font-mono mt-1 ${isCyberpunk ? 'text-green-400' : 'text-green-600 dark:text-green-400'}`}>Completed: {new Date(challenge.completedDate).toLocaleDateString()}</p>
                                            )}
                                        </div>
                                        {!challenge.completedDate && <button onClick={(e) => handleCompleteChallenge(challenge.id, e)} className={`w-full py-2 rounded-xl text-sm font-bold transition-all ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30 hover:bg-[#00f0ff]/20' : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30'}`}>Complete & Claim</button>}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>

      <SlotMachineModal 
          isOpen={isSlotMachineOpen} 
          onClose={() => setIsSlotMachineOpen(false)} 
          isCyberpunk={isCyberpunk} 
          slotItems={slotItems} 
          reelStatuses={reelStatuses} 
          slotMessage={slotMessage} 
          slotRolling={slotRolling} 
          onSpin={handleSlotSpin} 
      />

      <EconomyGuideModal 
          isOpen={isEconomyInfoOpen} 
          onClose={() => setIsEconomyInfoOpen(false)} 
          isCyberpunk={isCyberpunk} 
      />

      <HistoryModal 
          isOpen={isHistoryOpen} 
          onClose={() => setIsHistoryOpen(false)} 
          isCyberpunk={isCyberpunk} 
          history={historyDisplay} 
      />

      <CreateItemModal 
          isOpen={isCreateItemModalOpen}
          onClose={() => setIsCreateItemModalOpen(false)}
          onCreate={handleCreateItem}
          isCyberpunk={isCyberpunk}
      />

      <ChallengeHistoryModal 
          isOpen={isChallengeHistoryOpen} 
          onClose={() => setIsChallengeHistoryOpen(false)} 
          isCyberpunk={isCyberpunk} 
          challenges={challenges} 
      />
    </div>
  );
};
