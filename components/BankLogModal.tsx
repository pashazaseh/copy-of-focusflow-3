
import React from 'react';
import { Transaction } from '../features/gamification/types';

interface BankLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  isCyberpunk: boolean;
}

export const BankLogModal: React.FC<BankLogModalProps> = ({ isOpen, onClose, transactions, isCyberpunk }) => {
  if (!isOpen) {
    return null;
  }

  const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className={`w-full max-w-lg rounded-3xl border shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[80vh] ${isCyberpunk ? 'bg-black border-[#00f0ff]/50' : 'bg-[#1c1c1e] border-slate-700'}`}>
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h3 className={`text-2xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>Bank Log</h3>
          <button onClick={onClose} className={`p-1 rounded-lg transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-slate-400 hover:text-white'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
          {sortedTransactions.length === 0 ? (
            <div className="text-center py-10 text-slate-500">No transactions yet.</div>
          ) : (
            sortedTransactions.map((tx) => (
              <div key={tx.id} className={`flex items-center justify-between p-3 rounded-xl border ${isCyberpunk ? 'bg-[#00f0ff]/5 border-[#00f0ff]/20' : 'bg-white/5 border-white/5'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${tx.type === 'SPEND' ? (isCyberpunk ? 'bg-red-900/30 text-red-500' : 'bg-red-500/20 text-red-400') : (isCyberpunk ? 'bg-green-900/30 text-green-500' : 'bg-green-500/20 text-green-400')}`}>
                    {tx.type === 'SPEND' ? '🛒' : '💎'}
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
