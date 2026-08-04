declare module "@shipt/segmented-arc-for-react-native" {
  import * as React from "react";

  export interface Segment {
    scale: number;
    filledColor: string;
    emptyColor: string;
    data?: any;
    arcDegreeScale?: number;
  }

  export interface SegmentedArcProps {
    fillValue: number;
    segments: Segment[];

    filledArcWidth?: number;
    emptyArcWidth?: number;
    radius?: number;

    isAnimated?: boolean;
    animationDuration?: number;
    animationDelay?: number;

    spaceBetweenSegments?: number;

    arcDegree?: number;
    arcCenterAngle?: number;

    showArcRanges?: boolean;
    ranges?: string[];

    capInnerColor?: string;
    capOuterColor?: string;

    children?: (metaData: any) => React.ReactNode;
  }

  export const SegmentedArc: React.FC<SegmentedArcProps>;
}
