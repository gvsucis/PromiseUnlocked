import React, { useState, useCallback } from "react";

import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MaterialIcons } from "@expo/vector-icons";

import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";

import type { RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../types/navigation";
import { computeDerivedSkills } from "../config/stampTaxonomy";
import { TIER_CONFIG, DEFAULT_TIER } from "../config/stampConstants";
import {
  getUnlockedStampsForCategory,
  getMappedCategory,
} from "../services/categoryStorageService";

const DERIVED_SKILLS = computeDerivedSkills();

type StampDetailRouteProp = RouteProp<RootStackParamList, "StampDetails">;

type StampDetailNavigationProp = StackNavigationProp<RootStackParamList, "StampDetails">;

export default function StampDetailScreen() {
  const navigation = useNavigation<StampDetailNavigationProp>();
  const route = useRoute<StampDetailRouteProp>();
  const { stamp, region } = route.params;
  const allStamps = DERIVED_SKILLS[region] ?? [];

  const [unlockInfo, setUnlockInfo] = useState<{
    name: string;
    timesUnlocked: number;
    tier?: number;
  } | null>(null);
  const [justification, setJustification] = useState<string | null>(null);
  const [unlockedNames, setUnlockedNames] = useState<Set<string>>(new Set());

  const unlockedStamps = allStamps.filter((s) => {
    if (unlockedNames.has(s)) return true;
    const bare = s.split(": ").pop();
    return bare ? unlockedNames.has(bare) : false;
  });
  const currentIndex = unlockedStamps.indexOf(stamp);
  const previousStamp = currentIndex > 0 ? unlockedStamps[currentIndex - 1] : null;
  const nextStamp =
    currentIndex < unlockedStamps.length - 1 ? unlockedStamps[currentIndex + 1] : null;

  const tier = unlockInfo?.tier ?? DEFAULT_TIER;
  const tierCfg =
    TIER_CONFIG[tier as keyof typeof TIER_CONFIG] ??
    TIER_CONFIG[DEFAULT_TIER as keyof typeof TIER_CONFIG];

  const loadUnlockInfo = useCallback(async () => {
    const unlocks = await getUnlockedStampsForCategory(region);
    const found = unlocks.find((u) => u.name === stamp);
    setUnlockInfo(found ?? null);
    setUnlockedNames(new Set(unlocks.map((u) => u.name)));

    try {
      const mc = await getMappedCategory(region);
      setJustification(mc?.justification ?? null);
    } catch {
      setJustification(null);
    }
  }, [region, stamp]);

  useFocusEffect(
    useCallback(() => {
      loadUnlockInfo();
    }, [loadUnlockInfo])
  );

  function goToPreviousStamp() {
    if (!previousStamp) return;
    navigation.replace("StampDetails", {
      stamp: previousStamp,
      region,
    });
  }

  function goToNextStamp() {
    if (!nextStamp) return;
    navigation.replace("StampDetails", {
      stamp: nextStamp,
      region,
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#1B3A72" />
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <View style={styles.arrowContainer}>
            {previousStamp && (
              <TouchableOpacity onPress={goToPreviousStamp}>
                <MaterialIcons name="chevron-left" size={36} color="#1B3A72" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.headerTitle}>Stamp Detail</Text>

          <View style={styles.arrowContainer}>
            {nextStamp && (
              <TouchableOpacity onPress={goToNextStamp}>
                <MaterialIcons name="chevron-right" size={36} color="#1B3A72" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.badgeContainer}>
          <View
            style={[
              styles.badgeCircle,
              unlockInfo && {
                backgroundColor: tierCfg.color,
                borderColor: tierCfg.color,
              },
            ]}
          >
            {unlockInfo ? (
              <Text style={styles.badgeTierText}>{tierCfg.label}</Text>
            ) : (
              <MaterialIcons name="school" size={42} color="#2E6EE6" />
            )}
          </View>

          <Text style={styles.title}>{stamp}</Text>

          <Text style={styles.subtitle}>{region}</Text>

          {unlockInfo && (
            <View style={styles.unlockedBadge}>
              <MaterialIcons name="lock-open" size={16} color="#FFFFFF" />
              <Text style={styles.unlockedBadgeText}>Unlocked ×{unlockInfo.timesUnlocked}</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Justification</Text>

          <Text style={styles.justificationText}>
            {justification || "No justification recorded for this stamp."}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EBF2FF",
  },

  content: {
    padding: 16,
    paddingBottom: 40,
    paddingTop: 20,
  },

  backButton: {
    marginBottom: 8,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  arrowContainer: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",

    fontSize: 20,
    fontWeight: "700",
    color: "#1B3A72",
  },

  badgeContainer: {
    alignItems: "center",
    marginBottom: 24,
  },

  badgeCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#EEF4FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#D6E4FF",
    marginBottom: 12,
  },

  badgeCircleUnlocked: {
    backgroundColor: "#2E6EE6",
    borderColor: "#1B3A72",
  },

  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1B3A72",
    textAlign: "center",
  },

  subtitle: {
    fontSize: 14,
    color: "#6B7A99",
    marginTop: 4,
  },

  unlockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2E6EE6",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 8,
  },

  unlockedBadgeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 4,
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B3A72",
    marginBottom: 12,
  },

  justificationText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 22,
  },

  badgeTierText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
  },
});
