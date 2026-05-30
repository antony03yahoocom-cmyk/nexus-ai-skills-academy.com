import { useMemo } from 'react';

export interface Completion {
  completed_at: string;
}

export function useStreakCalculation(completions: Completion[]): number {
  return useMemo(() => {
    if (!completions.length) return 0;

    const uniqueDates = [
      ...new Set(completions.map((c) => new Date(c.completed_at).toDateString())),
    ]
      .map((d) => new Date(d))
      .sort((a, b) => b.getTime() - a.getTime());

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (uniqueDates[0] < yesterday) return 0;

    let streak = 1;
    for (let i = 0; i < uniqueDates.length - 1; i++) {
      const diff = Math.round(
        (uniqueDates[i].getTime() - uniqueDates[i + 1].getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diff === 1) streak++;
      else break;
    }
    return streak;
  }, [completions]);
}
