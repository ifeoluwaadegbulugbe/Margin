import React from "react";
import { Composition } from "remotion";
import { Demo, FPS, TOTAL_FRAMES } from "./Demo";

export const Root: React.FC = () => (
  <Composition id="MarginDemo" component={Demo} width={1920} height={1080} fps={FPS} durationInFrames={TOTAL_FRAMES} />
);
