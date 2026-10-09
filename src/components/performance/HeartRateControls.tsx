import type { FC } from "react";
export type HeartRateControlProps = { running: boolean; reference?: number; onReading: (bpm: number, reference: number) => void; onBreak: () => void };
const HeartRateControls: FC<HeartRateControlProps> = () => null;
export default HeartRateControls;
