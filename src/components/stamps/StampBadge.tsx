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
  const tierCfg =
    TIER_CONFIG[tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG[DEFAULT_TIER];

  if (error) {
    const circleSize = size === "detail" ? 110 : 86;
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
        style={[
          styles.wrapper,
          isDetail ? styles.wrapperDetail : styles.wrapperList,
        ]}
        onError={() => setError(true)}
      />
      <Image
        source={getStampBaseImage(stampName)}
        style={[
          styles.base,
          isDetail ? styles.baseDetail : styles.baseList,
        ]}
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
    width: 94,
    height: 94,
  },
  wrapperDetail: {
    width: 120,
    height: 120,
  },
  base: {
    position: "absolute",
    borderRadius: 999,
  },
  baseList: {
    width: 60,
    height: 60,
    top: 17,
    left: 17,
  },
  baseDetail: {
    width: 76,
    height: 76,
    top: 22,
    left: 22,
  },
});
