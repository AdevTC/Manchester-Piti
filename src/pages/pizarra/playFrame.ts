// The frame of a jugada: where each of ours, the rivals and the ball stand, and its arrows. Pitch coordinates are
// percentages: x 0..100 across the pitch (left → right seen from our goal), y 0..100 from our goal line (0) to the
// rival goal line (100). (Kept from the old three.js stadium's types: the plays' stored shape still uses them.)

export interface PitchPoint {
  x: number;
  y: number;
}

export interface RivalSpec extends PitchPoint {
  id: string;
}

export type ArrowKind = "pase" | "carrera" | "conduccion";
export interface ArrowSpec {
  from: PitchPoint;
  to: PitchPoint;
  kind: ArrowKind;
}
export interface PlayFrame {
  players: { id: string; x: number; y: number }[];
  ball?: PitchPoint;
  arrows?: ArrowSpec[];
}
