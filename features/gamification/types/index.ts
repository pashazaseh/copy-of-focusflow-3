export interface UserProfile {
  name: string;
  level: number;
  xp: number;
  gems: number;
  rank: string;
}

export interface ShopItem {
  id: string;
  name: string;
  icon: string;
  cost: number;
  desc: string;
  type: 'consumable' | 'unlock';
  category: string;
  isCustom?: boolean;
  expiryDate?: string;
}

export interface InventoryItem {
  itemId: string;
  quantity: number;
}

export interface Transaction {
  id: string;
  date: string; // ISO string
  type: 'EARN' | 'SPEND' | 'UNLOCK' | 'WIN';
  amount: number;
  description: string;
  relatedId?: string; // e.g., shop item id, achievement id
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  isUnlocked: boolean;
  reward?: number; // Gems awarded for unlocking
}

export interface GamificationState {
  userProfile: UserProfile;
  inventory: InventoryItem[];
  transactions: Transaction[];
  achievements: Achievement[];
}
