import React from 'react';
import type { PlanId } from './PricingPlans';

const COLORS: Record<PlanId, string> = {
  free: '#9ca3af',
  basic: '#3b82f6',
  pro: '#8b5cf6',
  enterprise: '#f59e0b',
};

interface SubscriptionBadgeProps {
  plan: PlanId;
  expiresAt?: string;
}

export const SubscriptionBadge: React.FC<SubscriptionBadgeProps> = ({ plan, expiresAt }) => {
  const color = COLORS[plan];
  return (
    <span
      style={{
        backgroundColor: color,
        color: '#fff',
        padding: '2px 10px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      {plan}{expiresAt ? ` · expires ${new Date(expiresAt).toLocaleDateString()}` : ''}
    </span>
  );
};

export default SubscriptionBadge;
