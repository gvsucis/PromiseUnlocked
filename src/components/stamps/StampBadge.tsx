import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import {
  TIER_CONFIG,
  DEFAULT_TIER,
  getStampBaseImage,
  TIER_WRAPPERS,
} from "../../config/stampConstants";

interface StampBadgeProps {
  stampName: string;
  tier?: number;
  size?: "list" | "detail";
}

export default function StampBadge({
  stampName,
  tier = DEFAULT_TIER,
  size = "list",
}: Readonly<StampBadgeProps>) {
  const [error, setError] = useState(false);
  const tierCfg = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG[DEFAULT_TIER];

  if (error) {
    const circleSize = size === "detail" ? 121 : 95;
    return (
      <View
        style={[
          styles.fallback,
          {
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
            backgroundColor: tierCfg.color,
          },
        ]}
      >
        <Text style={size === "detail" ? styles.detailTierText : styles.listTierText}>
          {tierCfg.label}
        </Text>
      </View>
    );
  }

  const isDetail = size === "detail";

  return (
    <>
      <Image
        source={TIER_WRAPPERS[tier]}
        style={[styles.wrapper, isDetail ? styles.wrapperDetail : styles.wrapperList]}
        cachePolicy="memory-disk"
        onError={() => setError(true)}
      />
      <Image
        source={getStampBaseImage(stampName)}
        style={[styles.base, isDetail ? styles.baseDetail : styles.baseList]}
        cachePolicy="memory-disk"
      />
    </>
  );
}

const styles = StyleSheet.create({
  fallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  listTierText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  detailTierText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
  },
  wrapper: {
    position: "absolute",
  },
  wrapperList: {
    width: 103,
    height: 103,
  },
  wrapperDetail: {
    width: 132,
    height: 132,
  },
  base: {
    position: "absolute",
    borderRadius: 999,
  },
  baseList: {
    width: 66,
    height: 66,
    top: 14,
    left: 14,
  },
  baseDetail: {
    width: 84,
    height: 84,
    top: 18,
    left: 18,
  },
});
