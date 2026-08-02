import React, { useState } from 'react';

export type PlanId = 'free' | 'basic' | 'pro' | 'enterprise';

interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  features: string[];
  highlighted?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceAnnual: 0,
    features: ['1 Watchlist', '5 Alerts', '100 API calls/day'],
  },
  {
    id: 'basic',
    name: 'Basic',
    priceMonthly: 499,
    priceAnnual: 4999,
    features: ['5 Watchlists', '25 Alerts', 'Live Portfolio', 'Backtest Engine'],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 999,
    priceAnnual: 9999,
    features: ['20 Watchlists', '100 Alerts', 'Signal Engine', 'Equity Scanner', '10K API calls/day'],
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 4999,
    priceAnnual: 49999,
    features: ['Unlimited Everything', 'Priority Support', 'Custom Integrations'],
  },
];

interface PricingPlansProps {
  currentPlan?: PlanId;
  onSelectPlan: (planId: PlanId, cycle: 'monthly' | 'annual') => void;
}

export const PricingPlans: React.FC<PricingPlansProps> = ({ currentPlan, onSelectPlan }) => {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');

  return (
    <div className="pricing-plans">
      <div className="billing-toggle">
        <button
          className={cycle === 'monthly' ? 'active' : ''}
          onClick={() => setCycle('monthly')}
        >
          Monthly
        </button>
        <button
          className={cycle === 'annual' ? 'active' : ''}
          onClick={() => setCycle('annual')}
        >
          Annual <span className="badge">Save 17%</span>
        </button>
      </div>

      <div className="plans-grid">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`plan-card ${plan.highlighted ? 'plan-card--highlighted' : ''} ${
              currentPlan === plan.id ? 'plan-card--current' : ''
            }`}
          >
            <h3>{plan.name}</h3>
            <div className="plan-price">
              <span className="price">
                ₹{cycle === 'monthly' ? plan.priceMonthly : plan.priceAnnual}
              </span>
              <span className="period">/{cycle === 'monthly' ? 'mo' : 'yr'}</span>
            </div>
            <ul className="feature-list">
              {plan.features.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
            <button
              className="btn-select-plan"
              disabled={currentPlan === plan.id}
              onClick={() => onSelectPlan(plan.id, cycle)}
            >
              {currentPlan === plan.id ? 'Current Plan' : 'Select'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PricingPlans;
