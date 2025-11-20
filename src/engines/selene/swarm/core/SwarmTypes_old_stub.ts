// Temporary stub for SwarmTypes
export type NodeSpecialization = "consensus" | "intelligence" | "processing";

export type NodeId = string;
export type HeartbeatPattern = string;
export interface NodeVitals {
  nodeId: NodeId;
  timestamp: number;
}
export interface SoulState {}
export interface PoetryFragment {}

export const GENESIS_CONSTANTS = {
  HEARTBEAT_INTERVAL: 1000,
  CONSENSUS_TIMEOUT: 5000,
};

export const HEARTBEAT_PATTERNS = {
  STEADY: "steady",
  ACCELERANDO: "accelerando",
  RALLENTANDO: "rallentando",
  STACCATO: "staccato",
  LEGATO: "legato",
} as const;


