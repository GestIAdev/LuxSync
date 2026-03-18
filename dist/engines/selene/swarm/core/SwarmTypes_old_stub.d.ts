export type NodeSpecialization = "consensus" | "intelligence" | "processing";
export type NodeId = string;
export type HeartbeatPattern = string;
export interface NodeVitals {
    nodeId: NodeId;
    timestamp: number;
}
export interface SoulState {
}
export interface PoetryFragment {
}
export declare const GENESIS_CONSTANTS: {
    HEARTBEAT_INTERVAL: number;
    CONSENSUS_TIMEOUT: number;
};
export declare const HEARTBEAT_PATTERNS: {
    readonly STEADY: "steady";
    readonly ACCELERANDO: "accelerando";
    readonly RALLENTANDO: "rallentando";
    readonly STACCATO: "staccato";
    readonly LEGATO: "legato";
};
//# sourceMappingURL=SwarmTypes_old_stub.d.ts.map