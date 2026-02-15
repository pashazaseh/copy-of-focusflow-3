import React, { useState } from 'react';
import { ShopItem } from '../types';

interface ShopModuleProps {
  items: ShopItem[];
  ownedItemIds: string[];
  userBalance: number;
  onPurchase: (item: ShopItem) => void;
}

const ConfirmationModal: React.FC<{
  item: ShopItem | null;
  isOpen: boolean;
  onConfirm: () => void;
  onClose: () => void;
  userBalance: number;
}> = ({ item, isOpen, onConfirm, onClose, userBalance }) => {
  if (!isOpen || !item) return null;

  const canAfford = userBalance >= item.cost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-lg animate-fade-in">
      <div className="bg-black border-2 border-purple-500/50 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center transform transition-all animate-slide-in-up">
        <h3 className="text-2xl font-bold text-purple-300 mb-2">Confirm Purchase</h3>
        <div className="text-4xl my-4">{item.icon}</div>
        <p className="text-lg font-semibold text-white mb-1">{item.name}</p>
        <p className="text-sm text-gray-400 mb-6">{item.desc}</p>
        
        <div className="bg-gray-900/50 border border-purple-500/20 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center text-lg">
            <span className="text-gray-300">Cost:</span>
            <span className="font-bold text-purple-400">{item.cost} 💎</span>
          </div>
          <div className={`flex justify-between items-center text-sm mt-2 pt-2 border-t border-purple-500/20 ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
            <span className="text-gray-400">Balance after:</span>
            <span className="font-mono">{userBalance - item.cost} 💎</span>
          </div>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={onClose} 
            className="flex-1 bg-gray-700/50 hover:bg-gray-700 text-white font-bold py-3 rounded-lg transition-all duration-300"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm} 
            disabled={!canAfford}
            className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all duration-300"
          >
            {canAfford ? 'Confirm' : 'Not Enough Gems'}
          </button>
        </div>
      </div>
    </div>
  );
};


export const ShopModule: React.FC<ShopModuleProps> = ({ items, ownedItemIds, userBalance, onPurchase }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);

  const handleBuyClick = (item: ShopItem) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleConfirmPurchase = () => {
    if (selectedItem) {
      onPurchase(selectedItem);
    }
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {items.map((item) => {
          const isOwned = item.type === 'unlock' && ownedItemIds.includes(item.id);
          const canAfford = userBalance >= item.cost;
          const isDisabled = isOwned || !canAfford;

          return (
            <div key={item.id} className="bg-black/50 border border-violet-500/30 rounded-2xl p-6 flex flex-col text-center items-center shadow-lg hover:shadow-violet-500/20 hover:border-violet-400 transition-all duration-300">
              <div className="text-5xl mb-4 transition-transform duration-300 group-hover:scale-110">{item.icon}</div>
              <h3 className="text-lg font-bold text-white mb-1">{item.name}</h3>
              <p className="text-xs text-gray-400 flex-grow mb-4">{item.desc}</p>
              
              <div className="text-2xl font-bold text-violet-400 font-mono mb-4">{item.cost} 💎</div>

              <button 
                onClick={() => handleBuyClick(item)} 
                disabled={isDisabled}
                className="w-full bg-violet-600/80 hover:bg-violet-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:bg-gray-700"
              >
                {isOwned ? 'Owned' : !canAfford ? 'Too Expensive' : 'Buy'}
              </button>
            </div>
          );
        })}
      </div>

      <ConfirmationModal 
        item={selectedItem}
        isOpen={isModalOpen}
        onConfirm={handleConfirmPurchase}
        onClose={handleCloseModal}
        userBalance={userBalance}
      />
    </div>
  );
};
