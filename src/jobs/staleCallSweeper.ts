import { Call } from '../models/call.model';
import { endActiveCall } from '../controllers/callController';
import {
  STALE_CALL_SECONDS,
  MAX_CALL_DURATION_SECONDS,
  CALL_SWEEP_INTERVAL_MS,
} from '../utils/constants';

// Server-authoritative billing safety net (QC-06).
// Force-settles active calls whose client has gone silent (no billing tick for
// STALE_CALL_SECONDS) or that exceed MAX_CALL_DURATION_SECONDS. Without this, a caller
// could get free talk-time by withholding ticks, and a call could hang 'active' forever
// (leaving the host stuck "busy"). Stale calls are settled as of their last confirmed
// active moment (lastBilledAt) so the caller isn't charged for dead air.

let timer: NodeJS.Timeout | undefined;

export const sweepStaleCalls = async (now: number = Date.now()): Promise<number> => {
  const active = await Call.find({ status: 'active' });
  let settled = 0;
  for (const call of active) {
    const answeredMs = call.answeredAt?.getTime() ?? call.createdAt?.getTime() ?? now;
    const lastSeenMs = call.lastBilledAt?.getTime() ?? answeredMs;
    const staleForSeconds = (now - lastSeenMs) / 1000;
    const ranForSeconds = (now - answeredMs) / 1000;

    if (staleForSeconds >= STALE_CALL_SECONDS || ranForSeconds >= MAX_CALL_DURATION_SECONDS) {
      const effectiveEnd = call.lastBilledAt ?? new Date(now);
      try {
        await endActiveCall(call, 'system_timeout', effectiveEnd);
        settled++;
      } catch (err) {
        console.error('staleCallSweeper: failed to settle call', call._id?.toString(), err);
      }
    }
  }
  return settled;
};

export const startCallSweeper = (): void => {
  if (timer) return;
  timer = setInterval(() => {
    sweepStaleCalls().catch((err) => console.error('staleCallSweeper error:', err));
  }, CALL_SWEEP_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref(); // don't keep the process alive for the sweeper
};

export const stopCallSweeper = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
};
