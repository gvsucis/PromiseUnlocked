import React, { useState, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../types/navigation";
import { computeDerivedSkills, REGIONS } from "../config/stampTaxonomy";
import { TIER_CONFIG, DEFAULT_TIER } from "../config/stampConstants";
import StampBadge from "../components/stamps/StampBadge";
import { QuestionInputModal } from "../components/dialogue/QuestionInputModal";
import { GeminiService } from "../services/geminiService";
import {
  getFilteredTaxonomyString,
  getCategoryIdFromName,
} from "../services/categoryTaxonomyService";
import { dialogueBridgeRef } from "./DialogueDashboardScreen";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getMappedCategories,
  ensureAllMappedCategoriesHaveStamps,
} from "../services/categoryStorageService";

import { colors } from "../styles/global";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

  const [unlockedStamps, setUnlockedStamps] = useState<Set<string>>(new Set());
  const [stampCounts, setStampCounts] = useState<Record<string, number>>({});
  const [stampTiers, setStampTiers] = useState<Record<string, number>>({});
  const [prevRegion, setPrevRegion] = useState<string | null>(null);
  const [nextRegion, setNextRegion] = useState<string | null>(null);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [generatedQuestion, setGeneratedQuestion] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

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
      for (const s of mc.unlockedStamps) {
        const stampCategory = s.category || mc.category;
        if (stampCategory !== region) continue;
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
    const prevCategoryId = getCategoryIdFromName(prevRegion);
    navigation.replace("Stamps", { region: prevRegion, categoryId: prevCategoryId });
  }

  function goToNextRegion() {
    if (!nextRegion) return;
    const nextCategoryId = getCategoryIdFromName(nextRegion);
    navigation.replace("Stamps", { region: nextRegion, categoryId: nextCategoryId });
  }

  const handleGenerateQuestion = useCallback(async () => {
    setIsGenerating(true);
    try {
      const filteredTaxonomy = getFilteredTaxonomyString(region);
      const bridge = dialogueBridgeRef.current;
      const interactions = bridge?.interactions ?? [];
      const mappedCategories = bridge?.mappedCategories ?? [];
      const pdfContextText = bridge?.pdfContextText ?? "";
      const question = await GeminiService.synthesizeNextQuestion(
        interactions,
        mappedCategories,
        filteredTaxonomy,
        { embeddingHistorySummary: pdfContextText || undefined },
        undefined,
        region
      );
      setGeneratedQuestion(question);
      setShowQuestionModal(true);
    } catch (err) {
      console.error("Failed to generate region question:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [region]);

  const handleRegionSubmit = useCallback(
    async (question: string, answerText: string) => {
      setShowQuestionModal(false);
      setGeneratedQuestion("");
      const bridge = dialogueBridgeRef.current;
      // Map + persist the answer (saves to storage/Firebase, unlocks stamps) in
      // the background, then refresh the grid so any newly unlocked stamp shows
      // here — that grid update is the local unlock feedback.
      if (bridge) {
        Promise.resolve(bridge.handleRegionAnswer(question, answerText, region))
          .then(() => loadUnlocked())
          .catch((err) => console.error("Failed to map region answer:", err));
      }
      // Stay on this screen and loop: immediately offer the next region-focused
      // question in this screen's own modal.
      await handleGenerateQuestion();
    },
    [region, loadUnlocked, handleGenerateQuestion]
  );

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
              const count = stampCounts[stamp] ?? 1;
              const tier = stampTiers[stamp] ?? DEFAULT_TIER;
              return (
                <TouchableOpacity
                  key={stamp}
                  style={styles.stampItem}
                  onPress={() => navigation.navigate("StampDetails", { stamp, region, categoryId })}
                >
                  <View style={styles.stampCircle}>
                    <StampBadge stampName={stamp} tier={tier} size="list" />
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

        <TouchableOpacity
          style={styles.generateButton}
          onPress={handleGenerateQuestion}
          disabled={isGenerating}
          activeOpacity={0.8}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons name="auto-awesome" size={20} color="#fff" />
          )}
          <Text style={styles.generateButtonText}>
            {isGenerating ? "Exploring..." : "Explore region"}
          </Text>
        </TouchableOpacity>

        <QuestionInputModal
          visible={showQuestionModal}
          question={generatedQuestion}
          onSubmitText={(text) => {
            void handleRegionSubmit(generatedQuestion, text);
          }}
          onClose={() => {
            setShowQuestionModal(false);
            setGeneratedQuestion("");
          }}
          onSelectInputType={() => {}}
          onNewQuestion={() => {
            setShowQuestionModal(false);
            setGeneratedQuestion("");
            handleGenerateQuestion();
          }}
          onNewTopic={() => {
            setShowQuestionModal(false);
            setGeneratedQuestion("");
            // Stay on this region screen and just generate another region-focused
            // question rather than handing off to the dashboard.
            void handleGenerateQuestion();
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.subtle,
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
    color: colors.text.primary,
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
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: colors.background.tinted,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },

  stampCircleUnlocked: {
    backgroundColor: "#2E6EE6",
    borderColor: "#1B3A72",
  },

  stampText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.primary,
    textAlign: "center",
    paddingHorizontal: 4,
  },

  stampTextUnlocked: {
    color: colors.text.primary,
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

  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.secondary,
    marginTop: 16,
  },

  emptySubtitle: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 40,
  },

  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent.sky,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 24,
    gap: 10,
  },
  generateButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
