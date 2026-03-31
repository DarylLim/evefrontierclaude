'use client';

import { useState, useEffect } from 'react';

interface OnboardingProps {
  tutorialStage: number;
  onDismiss: () => void;
}

const STAGE_GUIDANCE: Record<number, { title: string; message: string }> = {
  0: {
    title: 'Welcome to GHOST',
    message:
      'I\'m your survival officer AI. I monitor your ship, fuel, and threats in real time so you can focus on flying. Let\'s get you started — connect your EVE Vault wallet and I\'ll pull your on-chain state.',
  },
  1: {
    title: 'Stage 1 — Gather Resources',
    message:
      'Your profile is active. Next step: collect 50x Iron Ore from the asteroid fields in your starter system. Use your mining laser module. I\'ll track your inventory and alert you when you have enough.',
  },
  2: {
    title: 'Stage 2 — Build a Refinery',
    message:
      'Great work on the refined materials. Now smelt your Iron Ore into Iron Plates using an SMU. You\'ll need Refined Water Ice too — look for blue asteroids in ice anomalies.',
  },
  3: {
    title: 'Stage 3 — First Blood',
    message:
      'You\'ve seen combat. Nice. Now destroy a Feral AI drone to complete Stage 3. Keep your distance (~5km) — their short-range attacks miss at that range. I\'ll be watching your hull.',
  },
  4: {
    title: 'Stage 4 — Manufacturing',
    message:
      'Your assemblies are online. Craft a Reflex Hull Component next: 10x Iron Plates + 5x Copper Wire + 2x Refined Water Ice + 1x Microprocessor. Don\'t dismantle your SMU while it\'s working.',
  },
  5: {
    title: 'Stage 5 — Shell Upgrade',
    message:
      'You\'ve got a new shell. Apply the Reflex Hull Component via Ship Fitting while docked. This gives you +50 cargo, +100 fuel capacity, and +200 Shield HP. Almost there.',
  },
  6: {
    title: 'Tutorial Complete',
    message:
      'You\'ve graduated from the starter system. From here, it\'s your call — but I\'ll keep watching your fuel, threats, and market intel. Check the Route Planner before jumping. Fly dangerous.',
  },
};

export default function Onboarding({ tutorialStage, onDismiss }: OnboardingProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem(`ghost_onboard_${tutorialStage}`);
    if (!dismissed) {
      setVisible(true);
    }
  }, [tutorialStage]);

  if (!visible) return null;

  const guidance = STAGE_GUIDANCE[tutorialStage] ?? STAGE_GUIDANCE[0];

  const handleDismiss = () => {
    sessionStorage.setItem(`ghost_onboard_${tutorialStage}`, '1');
    setVisible(false);
    onDismiss();
  };

  return (
    <div className="bg-ghost-accent/10 border border-ghost-accent rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-ghost-accent font-bold text-sm tracking-wider mb-1">
            {guidance.title}
          </h2>
          <p className="text-gray-300 text-sm leading-relaxed">{guidance.message}</p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-500 hover:text-gray-300 text-xs ml-3 mt-1 shrink-0"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
