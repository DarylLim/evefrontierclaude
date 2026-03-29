'use client';

import { useState } from 'react';
import AlertCard from './AlertCard';
import { AlertCard as AlertCardType } from '@/types';

type Category = 'ALL' | 'THREAT' | 'FUEL' | 'SAFETY' | 'TUTORIAL' | 'ECONOMIC';

const CATEGORIES: Category[] = ['ALL', 'THREAT', 'FUEL', 'SAFETY', 'TUTORIAL', 'ECONOMIC'];

export default function AlertFeed({ alerts }: { alerts: AlertCardType[] }) {
  const [active, setActive] = useState<Category>('ALL');

  const filtered = active === 'ALL' ? alerts : alerts.filter((a) => a.category === active);

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const count = cat === 'ALL' ? alerts.length : alerts.filter((a) => a.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className={`text-xs px-3 py-1 rounded-full border whitespace-nowrap transition-colors min-h-[32px] ${
                active === cat
                  ? 'border-ghost-accent text-ghost-accent'
                  : 'border-ghost-border text-gray-500 hover:border-gray-400'
              }`}
            >
              {cat}
              {count > 0 && (
                <span className="ml-1 opacity-70">({count})</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No {active === 'ALL' ? '' : active.toLowerCase() + ' '}alerts.</p>
        ) : (
          filtered.map((alert) => <AlertCard key={alert.id} alert={alert} />)
        )}
      </div>
    </div>
  );
}
