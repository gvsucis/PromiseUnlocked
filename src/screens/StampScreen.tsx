import React, { useState, useCallback } from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../types/navigation";
import { computeDerivedSkills, REGIONS } from "../config/stampTaxonomy";
import { DEFAULT_TIER } from "../config/stampConstants";
import StampBadge from "../components/stamps/StampBadge";
import { getCategoryIdFromName } from "../services/categoryTaxonomyService";
import { useDialogue } from "../context/DialogueProvider";
import { DialogueButton } from "../components/dialogue/DialogueButton";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../styles/global";

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
  const { region, categoryId } = route.params;
  const currentIndex = REGIONS.indexOf(region);
  const d = useDialogue();

  const { unlockedStamps, stampTiers, regionsWithUnlocks } = React.useMemo(() => {
    const names = new Set<string>();
    const tiers: Record<string, number> = {};
    const regionsWithUnlocks = new Set<string>();
    for (const mc of d.mappedCategories) {
      if (!mc.unlockedStamps?.length) continue;
      regionsWithUnlocks.add(mc.category);
      for (const s of mc.unlockedStamps) {
        names.add(s.name);
        tiers[s.name] = s.tier ?? DEFAULT_TIER;
      }
    }
    return { unlockedStamps: names, stampTiers: tiers, regionsWithUnlocks };
  }, [d.mappedCategories, region]);

  const prevRegion = findNearestWithUnlocks(REGIONS, currentIndex, -1, regionsWithUnlocks);
  const nextRegion = findNearestWithUnlocks(REGIONS, currentIndex, 1, regionsWithUnlocks);

  const goToPreviousRegion = () => {
    if (!prevRegion) return;
    navigation.replace("Stamps", {
      region: prevRegion,
      categoryId: getCategoryIdFromName(prevRegion),
    });
  };
  const goToNextRegion = () => {
    if (!nextRegion) return;
    navigation.replace("Stamps", {
      region: nextRegion,
      categoryId: getCategoryIdFromName(nextRegion),
    });
  };

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
          <MaterialIcons name="arrow-back" size={24} color={colors.accent.skyDark} />
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <View style={styles.arrowContainer}>
            {prevRegion && (
              <TouchableOpacity onPress={goToPreviousRegion}>
                <MaterialIcons name="chevron-left" size={36} color={colors.accent.skyDark} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.title}>{region}</Text>
          <View style={styles.arrowContainer}>
            {nextRegion && (
              <TouchableOpacity onPress={goToNextRegion}>
                <MaterialIcons name="chevron-right" size={36} color={colors.accent.skyDark} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {unlockedList.length > 0 ? (
          <View style={styles.grid}>
            {unlockedList.map((stamp) => {
              const tier = stampTiers[stamp] ?? DEFAULT_TIER;
              return (
                <TouchableOpacity
                  key={stamp}
                  style={styles.stampItem}
                  onPress={() => navigation.navigate("StampDetails", { stamp, region, categoryId })}
                >
                  <View style={styles.stampCircle}>
                    <StampBadge stampName={stamp} tier={tier} size="list" />
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

        <DialogueButton variant="region" region={region} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.subtle,
  },

  content: {
    padding: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  backButton: { marginBottom: 8 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  arrowContainer: { width: 40, alignItems: "center", justifyContent: "center" },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 28,
    fontWeight: "bold",
    color: colors.text.primary,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start" },
  stampItem: { width: "33.33%", alignItems: "center", marginBottom: 26 },
  stampCircle: {
    width: 94,
    height: 94,
    borderRadius: 47,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  stampText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.primary,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  stampTextUnlocked: { color: colors.text.primary, fontWeight: "700" },
  emptyContainer: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.text.secondary, marginTop: 16 },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 40,
  },
});
