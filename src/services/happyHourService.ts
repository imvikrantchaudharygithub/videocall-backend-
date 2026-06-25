import { HappyHour, IHappyHour } from '../models/happyHour.model';

/**
 * Check if a recurring event is currently active based on day/time
 */
function isRecurringActive(event: IHappyHour): boolean {
  const now = new Date();
  const currentDay = now.getDay(); // 0=Sun
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (!event.recurringDays.includes(currentDay)) return false;

  const startMinutes = event.recurringStartHour * 60 + event.recurringStartMinute;
  const endMinutes = event.recurringEndHour * 60 + event.recurringEndMinute;

  // Handle overnight events (e.g., 23:00 - 02:00)
  if (endMinutes <= startMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Get currently active happy hour/flash sale (if any).
 * Returns the one with the highest bonus if multiple overlap.
 */
export const getActiveHappyHour = async (): Promise<IHappyHour | null> => {
  const now = new Date();

  // Get all active events
  const events = await HappyHour.find({ isActive: true });

  let bestEvent: IHappyHour | null = null;

  for (const event of events) {
    let isCurrentlyActive = false;

    if (event.isRecurring) {
      isCurrentlyActive = isRecurringActive(event);
    } else {
      // One-time event: check start/end time window
      isCurrentlyActive = event.startTime <= now && event.endTime > now;
    }

    if (isCurrentlyActive) {
      if (!bestEvent || event.bonusPercent > bestEvent.bonusPercent) {
        bestEvent = event;
      }
    }
  }

  return bestEvent;
};

/**
 * Calculate happy hour bonus coins for a purchase
 */
export const calculateHappyHourBonus = async (baseCoins: number): Promise<{ bonus: number; eventName: string } | null> => {
  const event = await getActiveHappyHour();
  if (!event) return null;

  const bonus = Math.floor(baseCoins * event.bonusPercent / 100);
  return { bonus, eventName: event.name };
};

/**
 * Get the time remaining for the current active event (in seconds)
 */
export const getActiveEventTimeRemaining = async (): Promise<{ event: IHappyHour; remainingSeconds: number } | null> => {
  const event = await getActiveHappyHour();
  if (!event) return null;

  const now = new Date();

  if (!event.isRecurring) {
    const remaining = Math.max(0, Math.floor((event.endTime.getTime() - now.getTime()) / 1000));
    return { event, remainingSeconds: remaining };
  }

  // For recurring: calculate end time for today
  const endToday = new Date(now);
  endToday.setHours(event.recurringEndHour, event.recurringEndMinute, 0, 0);

  // If end is before start (overnight), add a day
  if (event.recurringEndHour * 60 + event.recurringEndMinute <=
      event.recurringStartHour * 60 + event.recurringStartMinute) {
    if (now.getHours() >= event.recurringStartHour) {
      endToday.setDate(endToday.getDate() + 1);
    }
  }

  const remaining = Math.max(0, Math.floor((endToday.getTime() - now.getTime()) / 1000));
  return { event, remainingSeconds: remaining };
};
