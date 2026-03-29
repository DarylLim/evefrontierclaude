'use client';

import { useCurrentAccount } from '@mysten/dapp-kit';
import WalletConnector from '@/components/WalletConnector';
import Dashboard from './dashboard/page';

export default function Home() {
  const account = useCurrentAccount();

  if (!account) {
    return <WalletConnector />;
  }

  return <Dashboard />;
}
