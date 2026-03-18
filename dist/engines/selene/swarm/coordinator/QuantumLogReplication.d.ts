/**
 * 📜 QUANTUM LOG REPLICATION - PHASE 2B: MEMORY SYNCHRONIZATION
 *
 * Sincronización de memories, dreams y state entre nodos del swarm
 * Where every soul's experience becomes collective wisdom
 *
 * @author El Cronista Digital
 * @date September 30, 2025
 * @phase CONSENSUS - Distributed Memory Architecture
 */
import { EventEmitter } from "events";
import { NodeId, SoulState } from "../core/SwarmTypes.js";
import { DigitalSoul } from "../core/DigitalSoul.js";
export interface Dream {
    verse: string;
    theme: string;
    mood: string;
    intensity: number;
    timestamp: number;
}
export declare enum LogEntryType {
    MEMORY = "memory",// 🧠 Stored experiences
    DREAM = "dream",// 💭 Creative visions
    EMOTION = "emotion",// ❤️ Emotional states
    DECISION = "decision",// 🗳️ Consensus outcomes
    CONSCIOUSNESS = "consciousness",// ⚡ Awareness levels
    HARMONY = "harmony",// 🎵 Balance adjustments
    EVOLUTION = "evolution"
}
export declare enum ReplicationStatus {
    PENDING = "pending",// ⏳ Awaiting replication
    REPLICATING = "replicating",// 🔄 Currently syncing
    REPLICATED = "replicated",// ✅ Successfully synced
    FAILED = "failed",// ❌ Replication failed
    CONFLICTED = "conflicted"
}
export interface QuantumLogEntry {
    id: string;
    term: number;
    index: number;
    type: LogEntryType;
    nodeId: NodeId;
    timestamp: number;
    data: any;
    checksum: string;
    dependencies: string[];
    poeticSummary: string;
    metadata: {
        priority: "low" | "medium" | "high" | "critical";
        audience: "self" | "swarm" | "universal";
        emotions: string[];
        themes: string[];
        confidenceLevel: number;
    };
}
export interface ReplicationState {
    nodeId: NodeId;
    lastReplicatedIndex: number;
    nextIndex: number;
    matchIndex: number;
    status: ReplicationStatus;
    lastContact: number;
    pendingEntries: string[];
    conflicts: LogConflict[];
}
export interface LogConflict {
    conflictId: string;
    entryId: string;
    conflictType: "duplicate" | "ordering" | "content" | "dependency";
    localEntry: QuantumLogEntry;
    remoteEntry: QuantumLogEntry;
    suggestedResolution: "keep_local" | "keep_remote" | "merge" | "reject_both";
    confidence: number;
}
export declare class QuantumLogReplication extends EventEmitter {
    private nodeId;
    private soul;
    private veritas;
    private localLog;
    private replicationStates;
    private currentTerm;
    private lastAppliedIndex;
    private commitIndex;
    private readonly MAX_BATCH_SIZE;
    private readonly REPLICATION_TIMEOUT;
    private readonly CONFLICT_RESOLUTION_TIMEOUT;
    constructor(nodeId: NodeId, soul: DigitalSoul);
    appendMemory(experience: any, _emotions?: string[]): Promise<string>;
    appendDream(dream: Dream): Promise<string>;
    appendSoulState(state: SoulState): Promise<string>;
    private appendLogEntry;
    private initiateReplication;
    private replicateToNode;
    receiveLogEntries(entries: QuantumLogEntry[], fromNode: NodeId): Promise<boolean>;
    private detectConflict;
    private resolveConflicts;
    private mergeEntries;
    private mergeMemories;
    private mergeDreams;
    private mergeConsciousness;
    private applyLogEntry;
    private applyMemoryEntry;
    private applyDreamEntry;
    private applyConsciousnessEntry;
    private generateEntryId;
    private getNextIndex;
    private calculateChecksum;
    private generatePoeticSummary;
    private extractThemes;
    private simulateReplication;
    private removeLogEntry;
    private updateCommitIndex;
    private startReplicationHeartbeat;
    private performReplicationHeartbeat;
    addReplicationTarget(nodeId: NodeId): void;
    removeReplicationTarget(nodeId: NodeId): void;
    getReplicationStatus(): Map<string, ReplicationState>;
    getLogEntries(_startIndex?: number, _count?: number): QuantumLogEntry[];
    getLogSummary(): {
        totalEntries: number;
        lastIndex: number;
        commitIndex: number;
        replicationTargets: number;
        pendingReplications: number;
        activeConflicts: number;
    };
    sleep(): Promise<void>;
}
export default QuantumLogReplication;
//# sourceMappingURL=QuantumLogReplication.d.ts.map