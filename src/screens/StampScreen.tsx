import React, { useState, useCallback } from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../types/navigation";
import { computeDerivedSkills, REGIONS } from "../config/stampTaxonomy";
import { TIER_CONFIG, DEFAULT_TIER } from "../config/stampConstants";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getMappedCategories,
  ensureAllMappedCategoriesHaveStamps,
} from "../services/categoryStorageService";

const DERIVED_SKILLS = computeDerivedSkills();

function findNearestWithUnlocks(
  list: string[],
  start: number,
  step: number,
  hasUnlocks: Set<string>
): string | null {
  for (let i = start + step; i >= 0 && i < list.length; i += step) {
    if (hasUnlocks.has(list[i])) return list[i];
  }
  return null;
}

type StampRouteProp = RouteProp<RootStackParamList, "Stamps">;
type StampNavigationProp = StackNavigationProp<RootStackParamList, "Stamps">;

export default function StampScreen() {
  const navigation = useNavigation<StampNavigationProp>();

  const route = useRoute<StampRouteProp>();
  const { region } = route.params;
  const currentIndex = REGIONS.indexOf(region);

  const [unlockedStamps, setUnlockedStamps] = useState<Set<string>>(new Set());
  const [stampCounts, setStampCounts] = useState<Record<string, number>>({});
  const [stampTiers, setStampTiers] = useState<Record<string, number>>({});
  const [prevRegion, setPrevRegion] = useState<string | null>(null);
  const [nextRegion, setNextRegion] = useState<string | null>(null);

  const loadUnlocked = useCallback(async () => {
    await ensureAllMappedCategoriesHaveStamps();
    const mappedCategories = await getMappedCategories();

    const regionsWithUnlocks = new Set<string>();
    const names = new Set<string>();

    const counts: Record<string, number> = {};
    const tiers: Record<string, number> = {};
    for (const mc of mappedCategories) {
      if (!mc.unlockedStamps?.length) continue;
      regionsWithUnlocks.add(mc.category);
      if (mc.category !== region) continue;
      for (const s of mc.unlockedStamps) {
        names.add(s.name);
        counts[s.name] = s.timesUnlocked;
        tiers[s.name] = s.tier ?? DEFAULT_TIER;
      }
    }

    setUnlockedStamps(names);
    setStampCounts(counts);
    setStampTiers(tiers);
    setPrevRegion(findNearestWithUnlocks(REGIONS, currentIndex, -1, regionsWithUnlocks));
    setNextRegion(findNearestWithUnlocks(REGIONS, currentIndex, 1, regionsWithUnlocks));
  }, [region, currentIndex]);

  useFocusEffect(
    useCallback(() => {
      loadUnlocked();
    }, [loadUnlocked])
  );

  function goToPreviousRegion() {
    if (!prevRegion) return;
    navigation.replace("Stamps", { region: prevRegion });
  }

  function goToNextRegion() {
    if (!nextRegion) return;
    navigation.replace("Stamps", { region: nextRegion });
  }

  const allStamps = DERIVED_SKILLS[region] ?? [];
  const unlockedList = allStamps.filter((s) => {
    if (unlockedStamps.has(s)) return true;
    const bare = s.split(": ").pop();
    return bare ? unlockedStamps.has(bare) : false;
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#1B3A72" />
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <View style={styles.arrowContainer}>
            {prevRegion && (
              <TouchableOpacity onPress={goToPreviousRegion}>
                <MaterialIcons name="chevron-left" size={36} color="#1B3A72" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.title}>{region}</Text>

          <View style={styles.arrowContainer}>
            {nextRegion && (
              <TouchableOpacity onPress={goToNextRegion}>
                <MaterialIcons name="chevron-right" size={36} color="#1B3A72" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {unlockedList.length > 0 ? (
          <View style={styles.grid}>
            {unlockedList.map((stamp) => {
              const count = stampCounts[stamp] ?? 1;
              const tier = stampTiers[stamp] ?? DEFAULT_TIER;
              const tierCfg =
                TIER_CONFIG[tier as keyof typeof TIER_CONFIG] ??
                TIER_CONFIG[DEFAULT_TIER as keyof typeof TIER_CONFIG];
              return (
                <TouchableOpacity
                  key={stamp}
                  style={styles.stampItem}
                  onPress={() => navigation.navigate("StampDetails", { stamp, region })}
                >
                  <View
                    style={[
                      styles.stampCircle,
                      { backgroundColor: tierCfg.color, borderColor: tierCfg.color },
                    ]}
                  >
                    <Text style={styles.tierText}>{tierCfg.label}</Text>
                    {count > 1 && (
                      <View style={styles.countBadge}>
                        <Text style={styles.countText}>×{count}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.stampText, styles.stampTextUnlocked]}>{stamp}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="lock-outline" size={64} color="#9BABCF" />
            <Text style={styles.emptyTitle}>No stamps unlocked yet</Text>
            <Text style={styles.emptySubtitle}>
              Complete the dialogue to unlock stamps in this region.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EBF2FF",
    paddingTop: 20,
  },

  backButton: {
    marginBottom: 8,
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  arrowContainer: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 28,
    fontWeight: "bold",
    color: "#1B3A72",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },

  stampItem: {
    width: "33.33%",
    alignItems: "center",
    marginBottom: 26,
  },

  stampCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#EEF4FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#D6E4FF",
  },

  stampCircleUnlocked: {
    backgroundColor: "#2E6EE6",
    borderColor: "#1B3A72",
  },

  stampText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1B3A72",
    textAlign: "center",
    paddingHorizontal: 4,
  },

  stampTextUnlocked: {
    color: "#1B3A72",
    fontWeight: "700",
  },

  countBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FF6B35",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },

  countText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },

  tierText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },

  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#6B7A99",
    marginTop: 16,
  },

  emptySubtitle: {
    fontSize: 14,
    color: "#9BABCF",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 40,
  },
});
