/**
 * TradePro Simulator - Margin Engine
 * SPAN-based margin calculation for option strategies.
 */

import type { OptionLeg }         from "../models/Option";
import type {
  LegMargin, PortfolioMargin,
  MarginCheckResult,
} from "../models/Margin";
import { MARGIN_CONFIGS }          from "../models/Margin";

// ─── Single leg margin ────────────────────────────────────────────────────────

function calcLegMargin(leg: OptionLeg, spot: number): LegMargin {
  const { contract, action, lots, entryPrice } = leg;
  const config      = MARGIN_CONFIGS[contract.symbol];
  const contractVal = spot * contract.lotSize * lots;
  const premium     = entryPrice * contract.lotSize * lots;

  let spanMargin  = 0;
  let exposure    = 0;

  if (action === "SELL") {
    spanMargin = contractVal * config.spanPct;
    exposure   = contractVal * config.exposurePct;
  }
  // BUY: only premium paid, no margin required

  return {
    legId      : leg.id,
    symbol     : contract.symbol,
    strike     : contract.strike,
    optionType : contract.optionType,
    action,
    lots,
    spanMargin : Math.round(spanMargin),
    exposure   : Math.round(exposure),
    premium    : Math.round(premium),
    total      : Math.round(spanMargin + exposure),
  };
}

// ─── Hedge benefit ────────────────────────────────────────────────────────────

function calcHedgeBenefit(legs: OptionLeg[], legMargins: LegMargin[]): number {
  // If there are both BUY and SELL legs on same underlying → apply hedge discount
  const symbols = new Set(legs.map(l => l.contract.symbol));
  let benefit   = 0;

  symbols.forEach(sym => {
    const symLegs = legs.filter(l => l.contract.symbol === sym);
    const hasBuy  = symLegs.some(l => l.action === "BUY");
    const hasSell = symLegs.some(l => l.action === "SELL");

    if (hasBuy && hasSell) {
      const config   = MARGIN_CONFIGS[sym];
      const sellSpan = legMargins
        .filter(m => m.symbol === sym && m.action === "SELL")
        .reduce((s, m) => s + m.spanMargin, 0);
      benefit += sellSpan * (1 - config.hedgeDiscount);
    }
  });

  return Math.round(benefit);
}

// ─── Portfolio margin ─────────────────────────────────────────────────────────

export function calculatePortfolioMargin(
  legs: OptionLeg[],
  spot: number,
): PortfolioMargin {
  const legMargins     = legs.map(leg => calcLegMargin(leg, spot));
  const grossSpan      = legMargins.reduce((s, m) => s + m.spanMargin, 0);
  const grossExposure  = legMargins.reduce((s, m) => s + m.exposure,   0);
  const hedgeBenefit   = calcHedgeBenefit(legs, legMargins);
  const netSpan        = Math.max(grossSpan - hedgeBenefit, 0);
  const netExposure    = grossExposure;
  const totalMargin    = netSpan + netExposure;
  const premiumPaid    = legMargins
    .filter(m => m.action === "BUY")
    .reduce((s, m) => s + m.premium, 0);
  const premiumReceived= legMargins
    .filter(m => m.action === "SELL")
    .reduce((s, m) => s + m.premium, 0);

  return {
    legs           : legMargins,
    grossSpan,
    grossExposure,
    hedgeBenefit,
    netSpan,
    netExposure,
    totalMargin,
    premiumPaid,
    premiumReceived,
    netPremium     : premiumReceived - premiumPaid,
  };
}

// ─── Margin check ─────────────────────────────────────────────────────────────

export function checkMargin(
  legs     : OptionLeg[],
  spot     : number,
  available: number,
): MarginCheckResult {
  const { totalMargin } = calculatePortfolioMargin(legs, spot);
  const shortfall       = Math.max(totalMargin - available, 0);
  const utilizationPct  = available > 0
    ? Math.round((totalMargin / available) * 100 * 10) / 10
    : 100;

  return {
    required      : totalMargin,
    available,
    sufficient    : available >= totalMargin,
    shortfall,
    utilizationPct,
  };
}
