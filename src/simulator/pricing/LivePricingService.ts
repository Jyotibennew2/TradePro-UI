/**
 * TradePro Simulator - Live Pricing Service
 * Connects backend API with frontend pricing engine.
 * Auto-refreshes prices and updates leg Greeks in real time.
 */

import { PricingEngine }     from "./PricingEngine";
import type { OptionLeg }    from "../models/Option";
import type { LegPricing, PortfolioPricing, QuickPriceResult, StrikeLadderRow } from "./PricingEngine";

export interface LiveSnapshot {
  spot         : number;
  timestamp    : number;
  portfolio    : PortfolioPricing | null;
  strikeLadder : StrikeLadderRow[];
}

type SnapshotCallback = (snapshot: LiveSnapshot) => void;

export class LivePricingService {
  private _legs       : OptionLeg[]         = [];
  private _spot       : number              = 0;
  private _iv         : number              = 15;
  private _r          : number              = 0.065;
  private _daysLeft   : number              = 7;
  private _step       : number              = 50;
  private _ladderCount: number              = 5;
  private _interval   : ReturnType<typeof setInterval> | null = null;
  private _subscribers: Set<SnapshotCallback> = new Set();
  private _lastSnapshot: LiveSnapshot | null  = null;

  configure(config: {
    legs?      : OptionLeg[];
    spot?      : number;
    iv?        : number;
    r?         : number;
    daysLeft?  : number;
    step?      : number;
    ladderCount?: number;
  }): void {
    if (config.legs       !== undefined) this._legs        = config.legs;
    if (config.spot       !== undefined) this._spot        = config.spot;
    if (config.iv         !== undefined) this._iv          = config.iv;
    if (config.r          !== undefined) this._r           = config.r;
    if (config.daysLeft   !== undefined) this._daysLeft    = config.daysLeft;
    if (config.step       !== undefined) this._step        = config.step;
    if (config.ladderCount!== undefined) this._ladderCount = config.ladderCount;
  }

  subscribe(cb: SnapshotCallback): () => void {
    this._subscribers.add(cb);
    if (this._lastSnapshot) cb(this._lastSnapshot);
    return () => this._subscribers.delete(cb);
  }

  private _compute(): LiveSnapshot {
    const spot    = this._spot;
    const r_      = this._r;
    const daysLeft= this._daysLeft;
    const iv      = this._iv;
    const step    = this._step;

    const portfolio = this._legs.length
      ? PricingEngine.pricePortfolio(this._legs, spot, r_, daysLeft)
      : null;

    const strikeLadder = spot > 0
      ? PricingEngine.strikeLadder(spot, step, this._ladderCount, daysLeft, iv, r_)
      : [];

    return { spot, timestamp: Date.now(), portfolio, strikeLadder };
  }

  private _publish(): void {
    const snapshot       = this._compute();
    this._lastSnapshot   = snapshot;
    this._subscribers.forEach(cb => cb(snapshot));
  }

  start(intervalMs: number = 2000): void {
    this.stop();
    this._publish();
    this._interval = setInterval(() => this._publish(), intervalMs);
  }

  stop(): void {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  refresh(): LiveSnapshot {
    this._publish();
    return this._lastSnapshot!;
  }

  quickPrice(strike: number): QuickPriceResult {
    return PricingEngine.quickPrice(
      this._spot, strike, this._daysLeft, this._iv, this._r
    );
  }

  priceLeg(leg: OptionLeg): LegPricing {
    return PricingEngine.priceLeg(leg, this._spot, this._r, this._daysLeft);
  }

  get snapshot(): LiveSnapshot | null {
    return this._lastSnapshot;
  }

  get isRunning(): boolean {
    return this._interval !== null;
  }
}

export const livePricingService = new LivePricingService();
