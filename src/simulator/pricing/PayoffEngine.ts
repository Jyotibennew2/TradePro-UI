/**
 * TradePro Simulator - Payoff Engine
 * Calculate payoff curves for single and multi-leg strategies.
 */

import { bsPrice, spotRange, daysToYears } from "./BlackScholes";
import type { OptionLeg }   from "../models/Option";
import type {
  PayoffPoint, PayoffCurve, LegPayoff,
  PayoffRequest, PayoffResult, ScenarioMatrix, ScenarioMatrixCell,
} from "../models/Payoff";
import { LEG_COLORS } from "../models/Payoff";

// ─── Single leg payoff at a spot ──────────────────────────────────────────────

function legPnlAtSpot(leg: OptionLeg, spot: number, daysLeft: number, r: number): number {
  const { contract, action, lots, entryPrice } = leg;
  const T         = daysToYears(Math.max(daysLeft, 0));
  const sigma     = leg.iv / 100;
  const optType   = contract.optionType;
  const currentPx = T > 0
    ? bsPrice(spot, contract.strike, T, r, sigma, optType)
    : Math.max(
        optType === "CE" ? spot - contract.strike : contract.strike - spot,
        0,
      );

  const multiplier = action === "BUY" ? 1 : -1;
  return multiplier * (currentPx - entryPrice) * lots * contract.lotSize;
}

// ─── Payoff curve for all legs ────────────────────────────────────────────────

export function buildPayoffCurve(
  legs     : OptionLeg[],
  spots    : number[],
  daysLeft : number,
  r        : number,
  currentSpot: number,
): PayoffCurve {
  if (!legs.length) {
    return { points: [], maxProfit: 0, maxLoss: 0, breakevens: [], currentPnl: 0, currentSpot };
  }

  const points: PayoffPoint[] = spots.map(spot => {
    const pnl = legs.reduce((sum, leg) => sum + legPnlAtSpot(leg, spot, daysLeft, r), 0);
    const intrinsic = legs.reduce((sum, leg) => {
      const { contract, action, lots } = leg;
      const iv = Math.max(
        contract.optionType === "CE" ? spot - contract.strike : contract.strike - spot,
        0,
      );
      return sum + (action === "BUY" ? 1 : -1) * (iv - leg.entryPrice) * lots * contract.lotSize;
    }, 0);

    return {
      spot,
      pnl      : Math.round(pnl),
      pnlPct   : 0,
      intrinsic: Math.round(intrinsic),
      timeValue: Math.round(pnl - intrinsic),
    };
  });

  const pnls      = points.map(p => p.pnl);
  const maxProfit = Math.max(...pnls);
  const maxLoss   = Math.min(...pnls);
  const maxRisk   = Math.abs(maxLoss) || 1;

  // Normalize pnlPct
  points.forEach(p => { p.pnlPct = Math.round((p.pnl / maxRisk) * 100); });

  // Breakevens (sign change detection)
  const breakevens: number[] = [];
  for (let i = 1; i < points.length; i++) {
    if (points[i - 1].pnl * points[i].pnl < 0) {
      const be = points[i - 1].spot +
        (0 - points[i - 1].pnl) *
        (points[i].spot - points[i - 1].spot) /
        (points[i].pnl - points[i - 1].pnl);
      breakevens.push(Math.round(be));
    }
  }

  const currentPnl = legs.reduce(
    (sum, leg) => sum + legPnlAtSpot(leg, currentSpot, daysLeft, r), 0
  );

  return { points, maxProfit, maxLoss, breakevens, currentPnl: Math.round(currentPnl), currentSpot };
}

// ─── Per-leg payoff curves ─────────────────────────────────────────────────────

export function buildLegPayoffs(
  legs    : OptionLeg[],
  spots   : number[],
  daysLeft: number,
  r       : number,
): LegPayoff[] {
  return legs.map((leg, i) => ({
    leg,
    color : LEG_COLORS[i % LEG_COLORS.length],
    points: spots.map(spot => ({
      spot,
      pnl      : Math.round(legPnlAtSpot(leg, spot, daysLeft, r)),
      pnlPct   : 0,
      intrinsic: 0,
      timeValue: 0,
    })),
  }));
}

// ─── Full payoff result ────────────────────────────────────────────────────────

export function calculatePayoff(req: PayoffRequest): PayoffResult {
  const { legs, spotRange: sr, daysToExpiry, riskFreeRate } = req;
  const spots = spotRange(
    (sr.min + sr.max) / 2,
    (sr.max - sr.min) / ((sr.min + sr.max) / 2) / 2,
    sr.steps,
  );

  const combined  = buildPayoffCurve(legs, spots, daysToExpiry, riskFreeRate, (sr.min + sr.max) / 2);
  const perLeg    = buildLegPayoffs(legs, spots, daysToExpiry, riskFreeRate);
  const netPremium= legs.reduce((sum, leg) => {
    const m = leg.action === "SELL" ? 1 : -1;
    return sum + m * leg.entryPrice * leg.lots * leg.contract.lotSize;
  }, 0);
  const marginReq = Math.max(-combined.maxLoss, 0);
  const rorPct    = marginReq > 0
    ? Math.round((combined.maxProfit / marginReq) * 100 * 100) / 100
    : 0;

  return { combined, perLeg, netPremium: Math.round(netPremium), marginReq, rorPct };
}

// ─── Scenario matrix ──────────────────────────────────────────────────────────

export function buildScenarioMatrix(
  legs       : OptionLeg[],
  baseSpot   : number,
  baseIV     : number,
  daysLeft   : number,
  r          : number,
): ScenarioMatrix {
  const spotChanges = [-6, -4, -2, 0, 2, 4, 6];
  const ivChanges   = [-4, -2, 0, 2, 4];

  const matrix: ScenarioMatrixCell[][] = spotChanges.map(sc =>
    ivChanges.map(ivc => {
      const spot    = baseSpot * (1 + sc / 100);
      const adjLegs = legs.map(leg => ({
        ...leg,
        iv: Math.max(leg.iv + ivc, 1),
      }));
      const pnl = adjLegs.reduce(
        (sum, leg) => sum + legPnlAtSpot(leg, spot, daysLeft, r), 0
      );
      const maxRisk = Math.abs(
        adjLegs.reduce((sum, leg) => sum + leg.entryPrice * leg.lots * leg.contract.lotSize, 0)
      ) || 1;
      return {
        spotChange: sc,
        ivChange  : ivc,
        pnl       : Math.round(pnl),
        pnlPct    : Math.round((pnl / maxRisk) * 100),
      };
    })
  );

  return { baseSpot, baseIV, scenarios: [], matrix };
}
