import React, { useMemo } from 'react';
import { InventoryItem, ShopItem } from '../types';

interface InventoryGridProps {
  inventory: InventoryItem[];
  allItems: ShopItem[]; // We need all possible items to get details like name, icon, etc.
}

// Define the order of rarity based on item category
const rarityOrder: { [key: string]: number } = {
  'Major': 5,
  'Moderate': 4,
  'Minor': 3,
  'Unlock': 3, // Treat unlocks as important
  'Micro': 2,
  'Gamble': 1,
  'Consumable': 1,
  'default': 0,
};

export const InventoryGrid: React.FC<InventoryGridProps> = ({ inventory, allItems }) => {

  const ownedItemsWithDetails = useMemo(() => {
    if (!inventory || !allItems) return [];

    const itemMap = new Map(allItems.map(item => [item.id, item]));

    const populatedInventory = inventory
      .map(invItem => {
        const details = itemMap.get(invItem.itemId);
        if (!details) return null;
        return {
          ...details,
          quantity: invItem.quantity,
        };
      })
      .filter((item): item is ShopItem & { quantity: number } => item !== null);

    // Sort by rarity
    return populatedInventory.sort((a, b) => {
      const rarityA = rarityOrder[a.category] ?? rarityOrder.default;
      const rarityB = rarityOrder[b.category] ?? rarityOrder.default;
      return rarityB - rarityA;
    });

  }, [inventory, allItems]);

  if (ownedItemsWithDetails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-12 bg-black/20 border-2 border-dashed border-gray-700/50 rounded-2xl">
        <div className="text-5xl mb-4 opacity-50">🎒</div>
        <h3 className="text-xl font-bold text-gray-400">Inventory is Empty</h3>
        <p className="text-gray-500">Visit the shop to acquire new items!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {ownedItemsWithDetails.map((item) => (
        <div 
          key={item.id} 
          className="bg-gray-900/70 border border-gray-700/50 rounded-xl p-4 flex flex-col items-center text-center shadow-lg transition-transform hover:scale-105 hover:border-cyan-500"
          title={`${item.name} - ${item.category}`}
        >
          <div className="text-4xl mb-3">{item.icon}</div>
          <p className="text-sm font-semibold text-white flex-grow">{item.name}</p>
          {item.type === 'consumable' && (
            <p className="text-xs text-cyan-400 font-mono mt-1">x{item.quantity}</p>
          )}
          {item.type === 'unlock' && (
             <p className="text-xs font-bold text-green-400 mt-1">Unlocked</p>
          )}
        </div>
      ))}
    </div>
  );
};
