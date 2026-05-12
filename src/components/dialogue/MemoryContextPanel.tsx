/**
 * Memory Context Panel
 *
 * Displays the AI's "memory" of the user - extracted facts and conversation context.
 * This creates transparency and builds trust by showing what the AI remembers.
 */

import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { UserFact, SkillsGap } from "../../hooks/useMemoryConversation";

interface MemoryContextPanelProps {
  facts: UserFact[];
  skillGaps?: SkillsGap[];
  categoriesMapped: string[];
  totalCategories?: number;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export const MemoryContextPanel: React.FC<MemoryContextPanelProps> = ({
  facts,
  skillGaps = [],
  categoriesMapped,
  totalCategories = 8,
  isExpanded = false,
  onToggle,
}) => {
  const getConfidenceIcon = (confidence: UserFact["confidence"]) => {
    switch (confidence) {
      case "high":
        return <Ionicons name="shield-checkmark" size={14} color="#10B981" />;
      case "medium":
        return <Ionicons name="shield-half" size={14} color="#F59E0B" />;
      case "low":
        return <Ionicons name="shield-outline" size={14} color="#6B7280" />;
    }
  };

  const getStatusBadge = (status: UserFact["status"]) => {
    const styles = {
      verified: { backgroundColor: "#D1FAE5", color: "#059669" },
      pending: { backgroundColor: "#FEF3C7", color: "#D97706" },
      conflicting: { backgroundColor: "#FEE2E2", color: "#DC2626" },
      corrected: { backgroundColor: "#E0E7FF", color: "#4F46E5" },
    };

    const labels = {
      verified: "Verified",
      pending: "Pending",
      conflicting: "Conflict",
      corrected: "Updated",
    };

    return (
      <View style={[statusBadgeStyle.badge, { backgroundColor: styles[status].backgroundColor }]}>
        <Text style={[statusBadgeStyle.text, { color: styles[status].color }]}>
          {labels[status]}
        </Text>
      </View>
    );
  };

  const progressPercentage = Math.round((categoriesMapped.length / totalCategories) * 100);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={onToggle}>
        <View style={styles.headerLeft}>
          <Ionicons name="bulb-outline" size={20} color="#6366F1" />
          <Text style={styles.headerTitle}>What I Remember About You</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.factCount}>{facts.length} facts</Text>
          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#6B7280" />
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <ScrollView style={styles.expandedContent} showsVerticalScrollIndicator={false}>
          {/* Progress Section */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Discovery Progress</Text>
              <Text style={styles.progressText}>
                {categoriesMapped.length}/{totalCategories} categories
              </Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${progressPercentage}%` }]} />
            </View>
            <View style={styles.categoriesRow}>
              {categoriesMapped.map((cat) => (
                <View key={cat} style={styles.categoryChip}>
                  <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                  <Text style={styles.categoryChipText} numberOfLines={1}>
                    {cat.split(" ")[0]}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Facts Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Verified Facts</Text>
            {facts.length === 0 ? (
              <Text style={styles.emptyText}>No facts extracted yet. Keep chatting!</Text>
            ) : (
              facts.map((fact) => (
                <View key={fact.id} style={styles.factCard}>
                  <View style={styles.factHeader}>
                    <View style={styles.factType}>
                      <Ionicons name="pricetag" size={12} color="#6366F1" />
                      <Text style={styles.factTypeText}>{fact.factType.replaceAll("_", " ")}</Text>
                    </View>
                    <View style={styles.factMeta}>
                      {getConfidenceIcon(fact.confidence)}
                      {getStatusBadge(fact.status)}
                    </View>
                  </View>
                  <Text style={styles.factStatement}>{fact.factStatement}</Text>
                  {fact.category && <Text style={styles.factCategory}>{fact.category}</Text>}
                </View>
              ))
            )}
          </View>

          {/* Skill Gaps Section */}
          {skillGaps.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Still Exploring</Text>
              <Text style={styles.sectionSubtitle}>Topics we haven't covered yet</Text>
              {skillGaps.slice(0, 3).map((gap) => (
                <View key={`${gap.category}-${gap.skill}`} style={styles.gapCard}>
                  <View style={styles.gapHeader}>
                    <Ionicons name="search" size={14} color="#9CA3AF" />
                    <Text style={styles.gapSkill}>{gap.skill}</Text>
                  </View>
                  <Text style={styles.gapCategory}>{gap.category}</Text>
                  <View style={styles.priorityBadge}>
                    <Text style={styles.priorityText}>Priority: {gap.priority}/10</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Privacy Note */}
          <View style={styles.privacyNote}>
            <Ionicons name="lock-closed" size={14} color="#9CA3AF" />
            <Text style={styles.privacyText}>
              Your data is private and only used to personalize your experience
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const statusBadgeStyle = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  text: {
    fontSize: 10,
    fontWeight: "600",
  },
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  factCount: {
    fontSize: 13,
    color: "#6B7280",
  },
  expandedContent: {
    maxHeight: 400,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  progressSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
  progressText: {
    fontSize: 13,
    color: "#6B7280",
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#6366F1",
    borderRadius: 4,
  },
  categoriesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryChipText: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "500",
    maxWidth: 100,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 20,
  },
  factCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#6366F1",
  },
  factHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  factType: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  factTypeText: {
    fontSize: 11,
    color: "#6366F1",
    fontWeight: "600",
    textTransform: "capitalize",
  },
  factMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  factStatement: {
    fontSize: 14,
    color: "#1F2937",
    lineHeight: 20,
  },
  factCategory: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
  },
  gapCard: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  gapHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  gapSkill: {
    fontSize: 13,
    fontWeight: "500",
    color: "#4B5563",
  },
  gapCategory: {
    fontSize: 11,
    color: "#9CA3AF",
    marginLeft: 20,
  },
  priorityBadge: {
    alignSelf: "flex-start",
    marginLeft: 20,
    marginTop: 4,
  },
  priorityText: {
    fontSize: 10,
    color: "#6B7280",
  },
  privacyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  privacyText: {
    fontSize: 11,
    color: "#9CA3AF",
    flex: 1,
  },
});
