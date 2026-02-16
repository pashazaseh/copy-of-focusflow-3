import React from 'react';

interface FocusGardenProps {
  totalFocusTime: number;
  lastActiveDate: string;
}

const HOURS_PER_TREE = 10;
const DAYS_FOR_WEEDS = 3;

export const FocusGarden: React.FC<FocusGardenProps> = ({ totalFocusTime, lastActiveDate }) => {
  const numTrees = Math.floor(totalFocusTime / HOURS_PER_TREE);

  const today = new Date();
  const lastDate = new Date(lastActiveDate);
  const diffTime = today.getTime() - lastDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const showWeeds = diffDays > DAYS_FOR_WEEDS;

  const gardenItems = Array.from({ length: numTrees }, (_, i) => '🌳');
  if (showWeeds) {
    const numWeeds = Math.min(numTrees, Math.floor(diffDays / DAYS_FOR_WEEDS));
    for (let i = 0; i < numWeeds; i++) {
        const randomIndex = Math.floor(Math.random() * gardenItems.length);
        gardenItems.splice(randomIndex, 0, '🥀');
    }
  }

  return (
    <div className="mb-8 p-6 rounded-2xl bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
      <h4 className="text-lg font-bold text-green-800 dark:text-green-300 mb-4">Your Focus Garden</h4>
      <div className="flex flex-wrap gap-2">
        {gardenItems.length === 0 && <p className="text-sm text-green-700 dark:text-green-400">Your garden is empty. Plant a tree by focusing for {HOURS_PER_TREE} hours!</p>}
        {gardenItems.map((item, index) => (
          <span key={index} className="text-2xl">{item}</span>
        ))}
      </div>
      {showWeeds && <p className="text-xs text-red-500 dark:text-red-400 mt-3">Weeds have grown due to inactivity! Get back to focusing to clear them out.</p>}
    </div>
  );
};
