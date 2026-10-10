import { useSyncExternalStore } from 'react';
import { getClockOffsetHours, subscribeClock } from '@/lib/clock';

export function useClockOffset(): number {
  return useSyncExternalStore(subscribeClock, getClockOffsetHours, () => 0);
}
