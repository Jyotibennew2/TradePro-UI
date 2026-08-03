/**
 * TradePro Simulator - Strategy Builder Service
 * Build standard option strategies as OptionLeg arrays.
 */
import { v4 as uuidv4 }  from "uuid";
import { bsPrice }       from "../pricing/BlackScholes";
import { makeOptionLeg } from "../state/simulatorStore";
import type { OptionLeg, UnderlyingType } from "../models/Option";
import type { StrategyType }              from "../models/Strategy";
import { STRIKE_STEPS }                   from "../models/Option";

function atm(spot: number, underlying: UnderlyingType): number {
  const step = STRIKE_STEPS[underlying];
  return Math.round(spot / step) * step;
}

function getPremium(
  spot: number, strike: number, T: number, r: number,
  iv: number, type: "CE" | "PE"
): number {
  return Math.max(
    Math.round(bsPrice(spot, strike, T, r / 100, iv / 100, type) * 20) / 20,
    0.05,
  );
}

export class StrategyBuilder {

  static build(
    type       : StrategyType,
    underlying : UnderlyingType,
    spot       : number,
    daysToExpiry: number,
    iv         : number,
    r          : number,
    lots       : number = 1,
    expiry     : string = "",
  ): OptionLeg[] {
    const T    = daysToExpiry / 365;
    const step = STRIKE_STEPS[underlying];
    const A    = atm(spot, underlying);

    const leg = (
      strike: number, optType: "CE" | "PE",
      action: "BUY" | "SELL", l = lots
    ): Omit<OptionLeg, "id"> =>
      makeOptionLeg(
        underlying, strike, optType, action, l,
        getPremium(spot, strike, T, r, iv, optType),
        iv, expiry,
      );

    switch (type) {
      case "LONG_CALL":
        return [leg(A, "CE", "BUY")].map(addId);

      case "LONG_PUT":
        return [leg(A, "PE", "BUY")].map(addId);

      case "SHORT_CALL":
        return [leg(A, "CE", "SELL")].map(addId);

      case "SHORT_PUT":
        return [leg(A, "PE", "SELL")].map(addId);

      case "SHORT_STRADDLE":
        return [leg(A, "CE", "SELL"), leg(A, "PE", "SELL")].map(addId);

      case "SHORT_STRANGLE":
        return [
          leg(A + step * 2, "CE", "SELL"),
          leg(A - step * 2, "PE", "SELL"),
        ].map(addId);

      case "LONG_STRADDLE":
        return [leg(A, "CE", "BUY"), leg(A, "PE", "BUY")].map(addId);

      case "LONG_STRANGLE":
        return [
          leg(A + step * 2, "CE", "BUY"),
          leg(A - step * 2, "PE", "BUY"),
        ].map(addId);

      case "IRON_CONDOR":
        return [
          leg(A + step * 2, "CE", "SELL"),
          leg(A + step * 4, "CE", "BUY"),
          leg(A - step * 2, "PE", "SELL"),
          leg(A - step * 4, "PE", "BUY"),
        ].map(addId);

      case "IRON_FLY":
        return [
          leg(A,            "CE", "SELL"),
          leg(A + step * 2, "CE", "BUY"),
          leg(A,            "PE", "SELL"),
          leg(A - step * 2, "PE", "BUY"),
        ].map(addId);

      case "BULL_CALL_SPREAD":
        return [
          leg(A,            "CE", "BUY"),
          leg(A + step * 2, "CE", "SELL"),
        ].map(addId);

      case "BEAR_PUT_SPREAD":
        return [
          leg(A,            "PE", "BUY"),
          leg(A - step * 2, "PE", "SELL"),
        ].map(addId);

      case "BULL_PUT_SPREAD":
        return [
          leg(A,            "PE", "SELL"),
          leg(A - step * 2, "PE", "BUY"),
        ].map(addId);

      case "BEAR_CALL_SPREAD":
        return [
          leg(A,            "CE", "SELL"),
          leg(A + step * 2, "CE", "BUY"),
        ].map(addId);

      case "COVERED_CALL":
        return [leg(A + step, "CE", "SELL")].map(addId);

      case "JADE_LIZARD":
        return [
          leg(A - step * 2, "PE", "SELL"),
          leg(A + step * 2, "CE", "SELL"),
          leg(A + step * 4, "CE", "BUY"),
        ].map(addId);

      case "BWB":
        return [
          leg(A - step * 2, "CE", "BUY"),
          leg(A,            "CE", "SELL"),
          leg(A,            "CE", "SELL"),
          leg(A + step * 4, "CE", "BUY"),
        ].map(addId);

      case "RATIO":
        return [
          leg(A,            "CE", "BUY",  1),
          leg(A + step * 2, "CE", "SELL", 2),
        ].map(addId);

      case "CUSTOM":
      default:
        return [];
    }
  }
}

function addId(leg: Omit<OptionLeg, "id">): OptionLeg {
  return { ...leg, id: uuidv4() };
}
