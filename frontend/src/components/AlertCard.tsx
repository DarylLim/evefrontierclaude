'use client';

import { AlertCard as AlertCardType } from '@/types';

const SEVERITY_STYLES: Record<AlertCardType['severity'], string> = {
  info: 'border-blue-500 text-blue-400',
  warning: 'border-ghost-warning text-ghost-warning',
  critical: 'border-ghost-danger text-ghost-danger animate-pulse',
};

export default function AlertCard({ alert }: { alert: AlertCardType }) {
  return (
    <div className={`border rounded p-3 bg-ghost-surface text-sm ${SEVERITY_STYLES[alert.severity]}`}>
      <div className="font-bold">{alert.title}</div>
      <div className="text-gray-300 mt-1">{alert.message}</div>
    </div>
  );
}
