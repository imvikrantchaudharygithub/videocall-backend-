import { startOfDayIST, istDayDiff, istDateKey } from '../../utils/time';

// IST = UTC+5:30. The IST day flips at 18:30 UTC the previous day.
describe('IST day helpers (QC-23)', () => {
  describe('startOfDayIST', () => {
    it('maps a mid-day UTC instant to the correct IST midnight', () => {
      // 2026-07-01T10:00Z = 15:30 IST on Jul 1 → IST midnight = 2026-06-30T18:30Z
      expect(startOfDayIST(new Date('2026-07-01T10:00:00Z')).toISOString()).toBe('2026-06-30T18:30:00.000Z');
    });

    it('rolls the IST day exactly at 18:30 UTC', () => {
      expect(startOfDayIST(new Date('2026-07-01T18:29:59Z')).toISOString()).toBe('2026-06-30T18:30:00.000Z');
      expect(startOfDayIST(new Date('2026-07-01T18:30:00Z')).toISOString()).toBe('2026-07-01T18:30:00.000Z');
    });
  });

  describe('istDayDiff', () => {
    it('is 0 for two instants in the same IST day', () => {
      expect(istDayDiff(new Date('2026-07-01T05:00:00Z'), new Date('2026-07-01T10:00:00Z'))).toBe(0);
    });

    it('counts a rollover the old UTC-local logic would have missed', () => {
      // last claim 23:30 IST Jul 1 (18:00Z), now 00:30 IST Jul 2 (19:00Z): different IST days → 1.
      const last = new Date('2026-07-01T18:00:00Z');
      const now = new Date('2026-07-01T19:00:00Z');
      expect(istDayDiff(now, last)).toBe(1);
    });
  });

  describe('istDateKey', () => {
    it('formats the IST calendar day regardless of server timezone', () => {
      expect(istDateKey(new Date('2026-07-01T18:29:00Z'))).toBe('2026-07-01');
      expect(istDateKey(new Date('2026-07-01T18:30:00Z'))).toBe('2026-07-02');
    });
  });
});
