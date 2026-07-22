import React, { useState, useCallback } from "react";

import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MaterialIcons } from "@expo/vector-icons";

import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";

import type { RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../types/navigation";
import { computeDerivedSkills } from "../config/stampTaxonomy";
import { DEFAULT_TIER, TIER_CONFIG } from "../config/stampConstants";
import StampBadge from "../components/stamps/StampBadge";
import { getActiveSessionId } from "../services/sessionManager";
import {
  getUnlockedStampsForCategory,
  getConversationHistory,
  syncFromFirestore,
  fetchPassportJustifications,
} from "../services/categoryStorageService";

import { colors } from "../styles/global";
import { DialogueButton } from "../components/dialogue/DialogueButton";

const DERIVED_SKILLS = computeDerivedSkills();

type StampDetailRouteProp = RouteProp<RootStackParamList, "StampDetails">;

type StampDetailNavigationProp = StackNavigationProp<RootStackParamList, "StampDetails">;

export default function StampDetailScreen() {
  const navigation = useNavigation<StampDetailNavigationProp>();
  const route = useRoute<StampDetailRouteProp>();
  const { stamp, region, categoryId } = route.params;
  const allStamps = DERIVED_SKILLS[region] ?? [];

  const [unlockInfo, setUnlockInfo] = useState<{
    name: string;
    timesUnlocked: number;
    tier?: number;
  } | null>(null);
  const [justifications, setJustifications] = useState<Array<{ justification: string }>>([]);
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
  const tierCfg = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG[DEFAULT_TIER];

  const loadUnlockInfo = useCallback(async () => {
    const unlocks = await getUnlockedStampsForCategory(categoryId);
    const found = unlocks.find((u) => u.name === stamp);
    setUnlockInfo(found ?? null);
    setUnlockedNames(new Set(unlocks.map((u) => u.name)));

    const activeSessionId = await getActiveSessionId();

    try {
      // Source 1: passport justifications filtered by this specific stamp
      const stampPassportItems = (
        await fetchPassportJustifications(categoryId, activeSessionId ?? undefined, stamp)
      ).map((j) => ({ justification: j }));
      if (stampPassportItems.length > 0) {
        setJustifications(stampPassportItems);
        return;
      }

      // Source 2: conversation history filtered by specificStamp field
      await syncFromFirestore();
      const history = await getConversationHistory();
      const stampHistoryItems = history
        .filter((i) => i.specificStamp === stamp && i.justification)
        .map((i) => ({ justification: i.justification! }));
      if (stampHistoryItems.length > 0) {
        setJustifications(stampHistoryItems);
        return;
      }

      setJustifications([]);
    } catch {
      setJustifications([]);
    }
  }, [categoryId, stamp]);

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
      categoryId,
    });
  }

  function goToNextStamp() {
    if (!nextStamp) return;
    navigation.replace("StampDetails", {
      stamp: nextStamp,
      region,
      categoryId,
    });
  }

  const badgeContent = !unlockInfo ? (
    <MaterialIcons name="school" size={50} color={colors.accent.sky} />
  ) : (
    <StampBadge stampName={stamp} tier={tier} size="detail" />
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.accent.skyDark} />
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <View style={styles.arrowContainer}>
            {previousStamp && (
              <TouchableOpacity onPress={goToPreviousStamp}>
                <MaterialIcons name="chevron-left" size={36} color={colors.accent.skyDark} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.headerTitle}>Stamp Detail</Text>

          <View style={styles.arrowContainer}>
            {nextStamp && (
              <TouchableOpacity onPress={goToNextStamp}>
                <MaterialIcons name="chevron-right" size={36} color={colors.accent.skyDark} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.badgeContainer}>
          <View style={styles.badgeCircle}>{badgeContent}</View>

          {unlockInfo && (
            <View style={[styles.tierBadge, { backgroundColor: tierCfg.color }]}>
              <Text style={styles.tierText}>{tierCfg.label}</Text>
            </View>
          )}

          <Text style={styles.title}>{stamp}</Text>

          <Text style={styles.subtitle}>{region}</Text>

          {unlockInfo && (
            <View style={styles.unlockedBadge}>
              <MaterialIcons name="lock-open" size={16} color="#FFFFFF" />
              <Text style={styles.unlockedBadgeText}>Unlocked ×{unlockInfo.timesUnlocked}</Text>
            </View>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Justifications</Text>
        </View>

        {justifications.length > 0 ? (
          justifications.map((item, index) => (
            <View key={index}>
              {index > 0 && <View style={styles.justificationSeparator} />}
              <View style={styles.justificationCard}>
                <View style={styles.justificationAccent} />
                <Text style={styles.justificationText}>{item.justification}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.justificationEmpty}>No justification recorded for this stamp.</Text>
        )}

        <DialogueButton variant="addDetail" stamp={stamp} region={region} />
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
    color: colors.text.primary,
  },

  badgeContainer: {
    alignItems: "center",
    marginBottom: 24,
  },

  badgeCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: colors.text.primary,
    textAlign: "center",
  },

  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },

  tierBadge: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },

  tierText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
  },

  unlockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accent.sky,
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

  sectionHeader: {
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },

  justificationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  justificationAccent: {
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.accent.sky,
    marginRight: 12,
    alignSelf: "stretch",
    minHeight: 22,
  },

  justificationText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 22,
  },

  justificationSeparator: {
    height: 1,
    backgroundColor: colors.background.card,
    marginVertical: 12,
    marginLeft: 15,
  },

  justificationEmpty: {
    fontSize: 14,
    color: colors.text.muted,
    fontStyle: "italic",
  },
});
