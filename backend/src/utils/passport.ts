export interface PassportCategory {
  category: string;
  totalMappings: number;
  unlockedStampCount: number;
}

export interface AggregatedPassport {
  passport: PassportCategory[];
  totalStampsUnlocked: number;
  totalMappings: number;
}

export function aggregatePassport(
  allPassportDocs: Record<string, unknown>[]
): AggregatedPassport {
  const aggregated: Record<string, PassportCategory> = {};

  for (const p of allPassportDocs) {
    const category = p.category as string;
    if (!category) continue;

    if (!aggregated[category]) {
      aggregated[category] = { category, totalMappings: 0, unlockedStampCount: 0 };
    }

    const stamps = p.unlockedStamps as Record<string, unknown> | undefined;
    aggregated[category].unlockedStampCount += stamps ? Object.keys(stamps).length : 0;
    aggregated[category].totalMappings += (p.totalMappings as number) ?? 0;
  }

  const passport = Object.values(aggregated);
  const totalStampsUnlocked = passport.reduce(
    (sum, c) => sum + c.unlockedStampCount,
    0
  );
  const totalMappings = passport.reduce((sum, c) => sum + c.totalMappings, 0);

  return { passport, totalStampsUnlocked, totalMappings };
}
