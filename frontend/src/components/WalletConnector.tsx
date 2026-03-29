'use client';

import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { useState } from 'react';

export default function WalletConnector() {
  const account = useCurrentAccount();
  const [manualAddress, setManualAddress] = useState('');
  const [showManual, setShowManual] = useState(false);

  return (
    <div className="min-h-screen bg-ghost-bg flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-widest text-ghost-accent">GHOST</h1>
        <p className="text-gray-400 text-sm">
          Survival officer AI for EVE Frontier. Connect your EVE Vault wallet to begin.
        </p>

        <div className="bg-ghost-surface rounded-lg border border-ghost-border p-6 space-y-4">
          <ConnectButton connectText="Connect EVE Vault" />

          <div className="text-xs text-gray-500">
            Requires the EVE Vault browser extension.
          </div>

          <button
            onClick={() => setShowManual((v) => !v)}
            className="text-xs text-gray-500 underline"
          >
            No extension? Enter address manually (read-only)
          </button>

          {showManual && (
            <div className="space-y-2">
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="0x... Sui wallet address"
                className="w-full bg-ghost-bg border border-ghost-border rounded px-3 py-2 text-sm focus:outline-none focus:border-ghost-accent"
              />
              <button
                disabled={!manualAddress.startsWith('0x')}
                className="w-full py-2 bg-ghost-accent text-ghost-bg rounded text-sm font-bold disabled:opacity-40"
              >
                View Read-Only
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
