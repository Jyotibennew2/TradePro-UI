/**
 * TradePro Simulator - Exit Record Model
 *
 * One ExitRecord is created per manual exit action (partial or full) taken
 * on a leg from Position Book. Multiple ExitRecords can exist for the same
 * legId (multiple partial exits over time). Records are never mutated or
 * deleted after creation — they are the permanent history rendered as EXIT
 * child rows directly under their parent leg in Position Book.
 */

export type ExitReason = "MANUAL";

export interface ExitRecord {
  id          : string;      // uuid, unique per exit action
  legId       : string;      // the OptionLeg.id this exit was taken on
  entryTime?  : number;      // copied from the leg at exit time, for display on the EXIT row without needing to look the parent leg back up
  exitTime    : number;      // epoch ms when the exit was taken
  exitQty     : number;      // lots exited in this action
  exitLtp     : number;      // price the exit was taken at
  exitReason  : ExitReason;  // always "MANUAL" in this phase — reserved for SL/Target-triggered exits later
  realizedPnl : number;      // P&L for just this slice: (exitLtp - entryPrice) * exitQty * lotSize * sign
}
