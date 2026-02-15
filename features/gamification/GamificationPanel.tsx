import React, { useState, Suspense, lazy, useMemo, useCallback } from 'react';
import { useEconomy, validateEconomy } from './hooks/useEconomy';
import { useGamificationData } from './hooks/useGamificationData';
import { GamificationHeader } from './components/GamificationHeader';
import { ShopItem } from './types';
import { useLogs } from '../../AppContext'; // To get logs for XP calculation

// --- Static Data ---
const STATIC_SHOP_ITEMS: ShopItem[] = [
    { id: 'vault_mystery', name: 'Mystery Vault', icon: '📦', cost: 50, desc: 'Chance for Coins/Items.', type: 'consumable', category: 'Gamble' },
    { id: 'theme_cyber', name: 'Cyberpunk Theme', icon: '🌆', cost: 500, desc: 'Unlock a new visual theme.', type: 'unlock', category: 'Major' },
    { id: 'streak_freeze', name: 'Streak Freeze', icon: '🛡️', cost: 100, desc: 'Protect your hard-earned streak for one day.', type: 'consumable', category: 'Minor' },
];

// --- Lazy-loaded Components ---
const ShopModule = lazy(() => 
  import('./components/ShopModule').then(module => ({ default: module.ShopModule }))
);
const InventoryGrid = lazy(() => 
  import('./components/InventoryGrid').then(module => ({ default: module.InventoryGrid }))
);
const AchievementsList = lazy(() =>
  import('./components/AchievementsList').then(module => ({ default: module.AchievementsList }))
);
const DailyQuestWidget = lazy(() =>
  import('./components/DailyQuestWidget').then(module => ({ default: module.DailyQuestWidget }))
);

const LoadingSpinner: React.FC = () => (
  <div className="flex justify-center items-center p-20">
    <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const GamificationPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'shop' | 'inventory' | 'achievements'>('overview');

  // --- Hooks ---
  const { currentGems, spendGems } = useEconomy();
  const { profile, inventory, refreshData } = useGamificationData();
  const { logs } = useLogs(); // For calculating XP

  useEffect(() => {
    validateEconomy();
  }, []);

  // --- Memos and Callbacks ---
  const allShopItems = useMemo(() => {
    return STATIC_SHOP_ITEMS;
  }, []);

  const userProfileWithXP = useMemo(() => {
    const totalFocusHours = logs.reduce((acc, log) => acc + log.hours, 0);
    const xp = totalFocusHours * 100;
    return { ...profile, xp };
  }, [profile, logs]);

  const ownedItemIds = useMemo(() => inventory.map(item => item.itemId), [inventory]);

  const handlePurchase = useCallback(async (item: ShopItem) => {
    const success = await spendGems(item.cost, `Purchased ${item.name}`);
    if (success) {
      const currentInventory = JSON.parse(localStorage.getItem('focusflow_inventory') || '[]');
      const existingItemIndex = currentInventory.findIndex((invItem: { itemId: string }) => invItem.itemId === item.id);
      
      if (existingItemIndex > -1) {
        currentInventory[existingItemIndex].quantity += 1;
      } else {
        currentInventory.push({ itemId: item.id, quantity: 1 });
      }
      
      localStorage.setItem('focusflow_inventory', JSON.stringify(currentInventory));
      refreshData();
      alert(`Successfully purchased ${item.name}!`);
    } else {
      alert("Purchase failed. Not enough Gems.");
    }
  }, [spendGems, refreshData]);

  return (
    <div className="p-4 md:p-6 bg-black text-white min-h-screen font-sans">
      <GamificationHeader userProfile={userProfileWithXP} currency={currentGems} />

      {/* Tab Navigation */}
      <div className="my-6 flex justify-center border-b border-cyan-500/20">
        {(['overview', 'shop', 'inventory', 'achievements'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-300 ${
              activeTab === tab
                ? 'text-cyan-300 border-b-2 border-cyan-300'
                : 'text-gray-500 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        <Suspense fallback={<LoadingSpinner />}>
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <DailyQuestWidget />
              <div className="text-center p-10 bg-black/20 rounded-lg">
                <h2 className="text-2xl font-bold text-cyan-400">Streak & More</h2>
                <p className="text-gray-400 mt-2">Other widgets like streak, leaderboards will be displayed here.</p>
                <button
                  onClick={() => {
                    localStorage.setItem('focusflow_spent_gems', '100000');
                    window.dispatchEvent(new Event('focusflow-gem-update'));
                  }}
                  className="mt-4 px-4 py-2 bg-red-500 text-white rounded"
                >
                  Debug: Set Spent Gems High
                </button>
              </div>
            </div>
          )}
          {activeTab === 'shop' && (
            <ShopModule 
              items={allShopItems}
              ownedItemIds={ownedItemIds}
              userBalance={currentGems}
              onPurchase={handlePurchase}
            />
          )}
          {activeTab === 'inventory' && (
            <InventoryGrid 
              inventory={inventory}
              allItems={allShopItems}
            />
          )}
          {activeTab === 'achievements' && (
            <AchievementsList />
          )}
        </Suspense>
      </div>
    </div>
  );
};

export default GamificationPanel;
