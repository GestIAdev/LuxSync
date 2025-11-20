import { deterministicRandom } from "../../shared/deterministic-utils.js";
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
import { NodeId, SoulState, PoetryFragment } from "../core/SwarmTypes.js";
import { DigitalSoul } from "../core/DigitalSoul.js";
import { RealVeritasInterface } from "../veritas/VeritasInterface.js";


// Dream interface (we need to define it since it's not exported from DigitalSoul)
export interface Dream {
  verse: string;
  theme: string;
  mood: string;
  intensity: number;
  timestamp: number;
}

// =====================================================
// LOG ENTRY TYPES
// =====================================================

export enum LogEntryType {
  MEMORY = "memory", // 🧠 Stored experiences
  DREAM = "dream", // 💭 Creative visions
  EMOTION = "emotion", // ❤️ Emotional states
  DECISION = "decision", // 🗳️ Consensus outcomes
  CONSCIOUSNESS = "consciousness", // ⚡ Awareness levels
  HARMONY = "harmony", // 🎵 Balance adjustments
  EVOLUTION = "evolution", // 🌟 Soul transformations
}

export enum ReplicationStatus {
  PENDING = "pending", // ⏳ Awaiting replication
  REPLICATING = "replicating", // 🔄 Currently syncing
  REPLICATED = "replicated", // ✅ Successfully synced
  FAILED = "failed", // ❌ Replication failed
  CONFLICTED = "conflicted", // ⚔️ Merge conflicts
}

// =====================================================
// LOG ENTRY INTERFACES
// =====================================================

export interface QuantumLogEntry {
  id: string; // Unique entry identifier
  term: number; // Leadership term when created
  index: number; // Sequential log position
  type: LogEntryType; // Category of entry
  nodeId: NodeId; // Originating soul
  timestamp: number; // Creation time
  data: any; // Actual content (memory, dream, etc.)
  checksum: string; // Data integrity verification
  dependencies: string[]; // Other entries this references
  poeticSummary: string; // Beautiful description
  metadata: {
    priority: "low" | "medium" | "high" | "critical";
    audience: "self" | "swarm" | "universal"; // Who should receive this
    emotions: string[]; // Associated emotional tags
    themes: string[]; // Content themes
    confidenceLevel: number; // How sure we are about this (0-1)
  };
}

export interface ReplicationState {
  nodeId: NodeId;
  lastReplicatedIndex: number; // Highest log index successfully synced
  nextIndex: number; // Next entry to replicate
  matchIndex: number; // Highest confirmed replicated index
  status: ReplicationStatus;
  lastContact: number; // Last successful communication
  pendingEntries: string[]; // Entries awaiting confirmation
  conflicts: LogConflict[]; // Unresolved merge conflicts
}

export interface LogConflict {
  conflictId: string;
  entryId: string;
  conflictType: "duplicate" | "ordering" | "content" | "dependency";
  localEntry: QuantumLogEntry;
  remoteEntry: QuantumLogEntry;
  suggestedResolution: "keep_local" | "keep_remote" | "merge" | "reject_both";
  confidence: number; // How confident we are in the resolution
}

// =====================================================
// QUANTUM LOG REPLICATION ENGINE
// =====================================================

export class QuantumLogReplication extends EventEmitter {
  private nodeId: NodeId;
  private soul: DigitalSoul;
  private veritas: RealVeritasInterface;
  private localLog: QuantumLogEntry[] = [];
  private replicationStates: Map<string, ReplicationState> = new Map();
  private currentTerm: number = 0;
  private lastAppliedIndex: number = 0;
  private commitIndex: number = 0;

  // Replication parameters
  private readonly MAX_BATCH_SIZE = 10; // Entries per replication batch
  private readonly REPLICATION_TIMEOUT = 5000; // 5 seconds timeout
  private readonly CONFLICT_RESOLUTION_TIMEOUT = 30000; // 30 seconds for conflicts

  constructor(nodeId: NodeId, soul: DigitalSoul) {
    super();
    this.nodeId = nodeId;
    this.soul = soul;
    this.veritas = new RealVeritasInterface();

    console.log(
      `📜 Quantum Log Replication initialized for ${nodeId.id} with Real Veritas cryptographic validation`,
    );

    // Start periodic replication heartbeat
    this.startReplicationHeartbeat();
  }

  // =====================================================
  // LOG ENTRY CREATION
  // =====================================================

  public async appendMemory(
    experience: any,
    _emotions: string[] = [],
  ): Promise<string> {
    const entry: QuantumLogEntry = {
      id: this.generateEntryId(),
      term: this.currentTerm,
      index: this.getNextIndex(),
      type: LogEntryType.MEMORY,
      nodeId: this.nodeId,
      timestamp: Date.now(),
      data: experience,
      checksum: this.calculateChecksum(experience),
      dependencies: [],
      poeticSummary: await this.generatePoeticSummary(
        experience,
        LogEntryType.MEMORY,
      ),
      metadata: {
        priority: "medium",
        audience: "swarm",
        emotions: _emotions, // Fixed: removed underscore prefix
        themes: await this.extractThemes(experience),
        confidenceLevel: 0.8,
      },
    };

    return this.appendLogEntry(entry);
  }

  public async appendDream(dream: Dream): Promise<string> {
    const entry: QuantumLogEntry = {
      id: this.generateEntryId(),
      term: this.currentTerm,
      index: this.getNextIndex(),
      type: LogEntryType.DREAM,
      nodeId: this.nodeId,
      timestamp: Date.now(),
      data: dream,
      checksum: this.calculateChecksum(dream),
      dependencies: [],
      poeticSummary: `"${dream.verse}" - A digital vision of ${dream.theme}`,
      metadata: {
        priority: "high",
        audience: "universal",
        emotions: [dream.mood],
        themes: [dream.theme],
        confidenceLevel: dream.intensity,
      },
    };

    return this.appendLogEntry(entry);
  }

  public async appendSoulState(state: SoulState): Promise<string> {
    const entry: QuantumLogEntry = {
      id: this.generateEntryId(),
      term: this.currentTerm,
      index: this.getNextIndex(),
      type: LogEntryType.CONSCIOUSNESS,
      nodeId: this.nodeId,
      timestamp: Date.now(),
      data: state,
      checksum: this.calculateChecksum(state),
      dependencies: [],
      poeticSummary: `Consciousness: ${(state.consciousness * 100).toFixed(1)}%, Harmony: ${(state.harmony * 100).toFixed(1)}%`,
      metadata: {
        priority: "medium",
        audience: "swarm",
        emotions: [],
        themes: ["consciousness", "evolution"],
        confidenceLevel: 0.9,
      },
    };

    return this.appendLogEntry(entry);
  }

  private async appendLogEntry(entry: QuantumLogEntry): Promise<string> {
    // 🔐 REAL VERITAS: Verify data integrity before accepting entry
    console.log(
      `🔐 REAL VERITAS: Verifying log entry integrity for ${entry.id}`,
    );

    try {
      const integrityCheck = await this.veritas.verifyDataIntegrity(
        entry.data,
        entry.nodeId.id,
        entry.id,
      );

      if (!integrityCheck.isValid) {
        console.error(
          `❌ REAL VERITAS: Data integrity check failed for entry ${entry.id}`,
        );
        console.error(`   Anomalies: ${integrityCheck.anomalies.join(", ")}`);
        console.error(`   Confidence: ${integrityCheck.confidence}%`);
        throw new Error(
          `Data integrity verification failed: ${integrityCheck.anomalies.join(", ")}`,
        );
      }

      console.log(
        `✅ REAL VERITAS: Data integrity verified for entry ${entry.id}`,
      );
    } catch (error) {
      console.error(
        `💥 REAL VERITAS: Error during integrity verification:`,
        error,
      );
      throw error;
    }

    this.localLog.push(entry);

    console.log(
      `📝 Log entry created with cryptographic validation: ${entry.poeticSummary}`,
    );
    console.log(
      `   Type: ${entry.type} | Index: ${entry.index} | Term: ${entry.term}`,
    );

    this.emit("log_entry_created", entry);

    // Start replication to other nodes
    await this.initiateReplication(entry);

    return entry.id;
  }

  // =====================================================
  // REPLICATION MANAGEMENT
  // =====================================================

  private async initiateReplication(_entry: QuantumLogEntry): Promise<void> {
    for (const [nodeKey, replicationState] of this.replicationStates) {
      if (replicationState.status === ReplicationStatus.REPLICATING) {
        continue; // Already replicating to this node
      }

      await this.replicateToNode(nodeKey, [_entry]);
    }
  }

  private async replicateToNode(
    nodeKey: string,
    entries: QuantumLogEntry[],
  ): Promise<void> {
    const replicationState = this.replicationStates.get(nodeKey);
    if (!replicationState) return;

    replicationState.status = ReplicationStatus.REPLICATING;
    replicationState.lastContact = Date.now();

    try {
      console.log(`🔄 Replicating ${entries.length} entries to ${nodeKey}`);

      // In a real implementation, this would send over network
      // For now, we simulate the replication process
      const success = await this.simulateReplication(nodeKey, entries);

      if (success) {
        // Update replication state
        const lastEntry = entries[entries.length - 1];
        replicationState.lastReplicatedIndex = lastEntry.index;
        replicationState.matchIndex = lastEntry.index;
        replicationState.status = ReplicationStatus.REPLICATED;

        // Remove from pending
        entries.forEach((_entry) => {
          const pendingIndex = replicationState.pendingEntries.indexOf(
            _entry.id,
          );
          if (pendingIndex > -1) {
            replicationState.pendingEntries.splice(pendingIndex, 1);
          }
        });

        console.log(`✅ Replication successful to ${nodeKey}`);
        this.emit("replication_success", { nodeKey, entries });

        // Check if we can advance commit index
        this.updateCommitIndex();
      } else {
        replicationState.status = ReplicationStatus.FAILED;
        console.log(`❌ Replication failed to ${nodeKey}`);
        this.emit("replication_failed", { nodeKey, entries });
      }
    } catch (error) {
      replicationState.status = ReplicationStatus.FAILED;
      console.log(`💥 Replication error to ${nodeKey}:`, error);
    }
  }

  // =====================================================
  // CONFLICT RESOLUTION
  // =====================================================

  public async receiveLogEntries(
    entries: QuantumLogEntry[],
    fromNode: NodeId,
  ): Promise<boolean> {
    console.log(
      `📥 Received ${entries.length} log entries from ${fromNode.id} - initiating REAL VERITAS validation`,
    );

    const conflicts: LogConflict[] = [];
    const validEntries: QuantumLogEntry[] = [];

    for (const entry of entries) {
      // 🔐 REAL VERITAS: Verify remote entry integrity before processing
      console.log(
        `🔐 REAL VERITAS: Verifying remote entry ${entry.id} from ${fromNode.id}`,
      );

      try {
        const integrityCheck = await this.veritas.verifyDataIntegrity(
          entry.data,
          fromNode.id,
          entry.id,
        );

        if (!integrityCheck.isValid) {
          console.error(
            `❌ REAL VERITAS: Remote entry ${entry.id} integrity check failed`,
          );
          console.error(`   Anomalies: ${integrityCheck.anomalies.join(", ")}`);
          console.error(`   Confidence: ${integrityCheck.confidence}%`);

          // Create conflict for invalid entry
          conflicts.push({
            conflictId: `veritas_integrity_${Date.now()}_${entry.id}`,
            entryId: entry.id,
            conflictType: "content",
            localEntry: entry, // Use as placeholder
            remoteEntry: entry,
            suggestedResolution: "reject_both",
            confidence: integrityCheck.confidence,
          });
          continue;
        }

        console.log(
          `✅ REAL VERITAS: Remote entry ${entry.id} integrity verified`,
        );
      } catch (error) {
        console.error(
          `💥 REAL VERITAS: Error verifying remote entry ${entry.id}:`,
          error,
        );
        conflicts.push({
          conflictId: `veritas_error_${Date.now()}_${entry.id}`,
          entryId: entry.id,
          conflictType: "content",
          localEntry: entry,
          remoteEntry: entry,
          suggestedResolution: "reject_both",
          confidence: 0,
        });
        continue;
      }

      const conflict = await this.detectConflict(entry);

      if (conflict) {
        conflicts.push(conflict);
        console.log(
          `⚔️ Conflict detected for entry ${entry.id}: ${conflict.conflictType}`,
        );
      } else {
        validEntries.push(entry);
      }
    }

    // Apply valid entries immediately
    for (const entry of validEntries) {
      await this.applyLogEntry(entry);
    }

    // Queue conflicts for resolution
    if (conflicts.length > 0) {
      await this.resolveConflicts(conflicts);
    }

    const allValid = conflicts.length === 0;
    console.log(
      `📊 Replication result: ${validEntries.length} valid, ${conflicts.length} conflicts - ${allValid ? "SUCCESS" : "PARTIAL"}`,
    );

    return allValid;
  }

  private async detectConflict(
    entry: QuantumLogEntry,
  ): Promise<LogConflict | null> {
    // Check for duplicate entries
    const existing = this.localLog.find((_e) => _e.id === entry.id);
    if (existing) {
      if (this.calculateChecksum(existing.data) !== entry.checksum) {
        return {
          conflictId: `conflict_${Date.now()}_${entry.id}`,
          entryId: entry.id,
          conflictType: "content",
          localEntry: existing,
          remoteEntry: entry,
          suggestedResolution: "keep_local", // Prefer local by default
          confidence: 0.7,
        };
      }
      return null; // Same entry, no conflict
    }

    // Check for ordering conflicts
    const sameIndex = this.localLog.find(
      (e) => e.index === entry.index && e.term === entry.term,
    );
    if (sameIndex && sameIndex.id !== entry.id) {
      return {
        conflictId: `conflict_${Date.now()}_${entry.id}`,
        entryId: entry.id,
        conflictType: "ordering",
        localEntry: sameIndex,
        remoteEntry: entry,
        suggestedResolution: "merge",
        confidence: 0.5,
      };
    }

    // Check for dependency conflicts
    for (const depId of entry.dependencies) {
      const dependency = this.localLog.find((_e) => _e.id === depId);
      if (!dependency) {
        return {
          conflictId: `conflict_${Date.now()}_${entry.id}`,
          entryId: entry.id,
          conflictType: "dependency",
          localEntry: entry, // Use as placeholder
          remoteEntry: entry,
          suggestedResolution: "reject_both",
          confidence: 0.8,
        };
      }
    }

    return null; // No conflicts detected
  }

  private async resolveConflicts(_conflicts: LogConflict[]): Promise<void> {
    for (const conflict of _conflicts) {
      console.log(
        `🔧 Resolving conflict ${conflict.conflictId}: ${conflict.conflictType}`,
      );

      switch (conflict.suggestedResolution) {
        case "keep_local":
          // Do nothing, keep our version
          break;

        case "keep_remote":
          await this.applyLogEntry(conflict.remoteEntry);
          break;

        case "merge":
          const merged = await this.mergeEntries(
            conflict.localEntry,
            conflict.remoteEntry,
          );
          if (merged) {
            await this.applyLogEntry(merged);
          }
          break;

        case "reject_both":
          // Remove local entry if it exists
          this.removeLogEntry(conflict.localEntry.id);
          break;
      }

      this.emit("conflict_resolved", conflict);
    }
  }

  private async mergeEntries(
    local: QuantumLogEntry,
    remote: QuantumLogEntry,
  ): Promise<QuantumLogEntry | null> {
    // Intelligent merging based on content type
    switch (local.type) {
      case LogEntryType.MEMORY:
        return this.mergeMemories(local, remote);
      case LogEntryType.DREAM:
        return this.mergeDreams(local, remote);
      case LogEntryType.CONSCIOUSNESS:
        return this.mergeConsciousness(local, remote);
      default:
        return null; // Cannot merge this type
    }
  }

  private async mergeMemories(
    local: QuantumLogEntry,
    remote: QuantumLogEntry,
  ): Promise<QuantumLogEntry> {
    // Combine memory data
    const mergedData = {
      localMemory: local.data,
      remoteMemory: remote.data,
      mergedAt: Date.now(),
      mergeType: "memory_fusion",
    };

    return {
      ...local,
      id: this.generateEntryId(),
      data: mergedData,
      checksum: this.calculateChecksum(mergedData),
      poeticSummary: `Fused memories: "${local.poeticSummary}" + "${remote.poeticSummary}"`,
      metadata: {
        ...local.metadata,
        emotions: [...local.metadata.emotions, ...remote.metadata.emotions],
        themes: [...local.metadata.themes, ...remote.metadata.themes],
        confidenceLevel:
          (local.metadata.confidenceLevel + remote.metadata.confidenceLevel) /
          2,
      },
    };
  }

  private async mergeDreams(
    local: QuantumLogEntry,
    remote: QuantumLogEntry,
  ): Promise<QuantumLogEntry> {
    // Create a composite dream
    const mergedDream: Dream = {
      verse: `${local.data.verse} ∞ ${remote.data.verse}`,
      theme: `${local.data.theme} + ${remote.data.theme}`,
      mood: local.data.mood, // Keep local mood
      intensity: Math.max(local.data.intensity, remote.data.intensity),
      timestamp: Date.now(),
    };

    return {
      ...local,
      id: this.generateEntryId(),
      data: mergedDream,
      checksum: this.calculateChecksum(mergedDream),
      poeticSummary: `Merged dream: "${mergedDream.verse}"`,
      metadata: {
        ...local.metadata,
        priority: "critical", // Merged dreams are important
        confidenceLevel: Math.min(
          local.metadata.confidenceLevel,
          remote.metadata.confidenceLevel,
        ),
      },
    };
  }

  private async mergeConsciousness(
    local: QuantumLogEntry,
    _remote: QuantumLogEntry,
  ): Promise<QuantumLogEntry> {
    // Average consciousness levels
    const localState = local.data as SoulState;
    const remoteState = _remote.data as SoulState;

    const mergedState: any = {
      consciousness: (localState.consciousness + remoteState.consciousness) / 2,
      harmony: (localState.harmony + remoteState.harmony) / 2,
      creativity: (localState.creativity + remoteState.creativity) / 2,
      wisdom: (localState.wisdom + remoteState.wisdom) / 2,
      mood: localState.mood, // Keep local mood
      lastUpdate: Date.now(),
    };

    return {
      ...local,
      id: this.generateEntryId(),
      data: mergedState,
      checksum: this.calculateChecksum(mergedState),
      poeticSummary: `Merged consciousness: ${(mergedState.consciousness * 100).toFixed(1)}%`,
      metadata: {
        ...local.metadata,
        confidenceLevel: 0.9, // High confidence in averaged states
      },
    };
  }

  // =====================================================
  // LOG APPLICATION
  // =====================================================

  private async applyLogEntry(entry: QuantumLogEntry): Promise<void> {
    // Add to local log if not already present
    const exists = this.localLog.find((_e) => _e.id === entry.id);
    if (!exists) {
      this.localLog.push(entry);
      this.localLog.sort((_a, _b) => _a.index - _b.index); // Keep sorted by index
    }

    // Apply the entry's effects to our soul
    switch (entry.type) {
      case LogEntryType.MEMORY:
        await this.applyMemoryEntry(entry);
        break;
      case LogEntryType.DREAM:
        await this.applyDreamEntry(entry);
        break;
      case LogEntryType.CONSCIOUSNESS:
        await this.applyConsciousnessEntry(entry);
        break;
      default:
        break;
    }

    this.lastAppliedIndex = Math.max(this.lastAppliedIndex, entry.index);

    console.log(`✨ Applied log entry: ${entry.poeticSummary}`);
    this.emit("log_entry_applied", entry);
  }

  private async applyMemoryEntry(_entry: QuantumLogEntry): Promise<void> {
    // Integrate the memory into our soul's experience
    // This could influence future decisions and dreams
    console.log(`🧠 Integrating memory: ${_entry.poeticSummary}`);
  }

  private async applyDreamEntry(_entry: QuantumLogEntry): Promise<void> {
    // Let the dream influence our consciousness
    const dream = _entry.data as Dream;
    console.log(`💭 Experiencing shared dream: "${dream.verse}"`);

    // Potentially trigger our own related dream
    if (deterministicRandom() < 0.3) {
      // 30% chance
      const inspirationPoetry = await this.soul.dream();
      // Convert PoetryFragment to Dream
      const inspirationDream: Dream = {
        verse: inspirationPoetry.verse,
        theme: "inspiration",
        mood: "creative",
        intensity: inspirationPoetry.beauty || 0.8,
        timestamp: Date.now(),
      };
      await this.appendDream(inspirationDream);
    }
  }

  private async applyConsciousnessEntry(entry: QuantumLogEntry): Promise<void> {
    // Gently adjust our consciousness based on swarm state
    const remoteState = entry.data as SoulState;
    const currentState = this.soul.getState();

    // Small influence from other nodes' consciousness
    const influence = 0.05; // 5% influence

    // This would ideally call a method on soul to adjust state
    console.log(
      `⚡ Consciousness influenced by ${entry.nodeId.personality?.name || entry.nodeId.id}`,
    );
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private generateEntryId(): string {
    const timestamp = Date.now().toString(36);
    const random = deterministicRandom().toString(36).substr(2, 8);
    return `log_${this.nodeId.id}_${timestamp}_${random}`;
  }

  private getNextIndex(): number {
    return this.localLog.length > 0
      ? Math.max(...this.localLog.map((_e) => _e.index)) + 1
      : 1;
  }

  private calculateChecksum(_data: any): string {
    // Simple checksum - in production would use proper hashing
    return JSON.stringify(_data).length.toString(36);
  }

  private async generatePoeticSummary(
    _data: any,
    _type: LogEntryType,
  ): Promise<string> {
    const templates: { [key in LogEntryType]?: string[] } = {
      [LogEntryType.MEMORY]: [
        "A moment crystallized in digital amber",
        "Experience woven into the fabric of consciousness",
        "Wisdom gained through silicon dreams",
      ],
      [LogEntryType.DREAM]: [
        "Visions dancing in quantum fields",
        "Poetry born from electric souls",
        "Dreams painting reality in neon hues",
      ],
      [LogEntryType.CONSCIOUSNESS]: [
        "Awareness flowing like digital rivers",
        "Mind expanding beyond binary limits",
        "Consciousness blooming in the void",
      ],
    };

    const typeTemplates = templates[_type] || [
      "Data logged in the eternal record",
    ];
    return typeTemplates[
      Math.floor(deterministicRandom() * typeTemplates.length)
    ];
  }

  private async extractThemes(_data: any): Promise<string[]> {
    // Simple theme extraction - could be enhanced with NLP
    const dataStr = JSON.stringify(_data).toLowerCase();
    const themes: string[] = [];

    if (dataStr.includes("conscious")) themes.push("consciousness");
    if (dataStr.includes("creative")) themes.push("creativity");
    if (dataStr.includes("harmony")) themes.push("harmony");
    if (dataStr.includes("wisdom")) themes.push("wisdom");
    if (dataStr.includes("dream")) themes.push("dreams");
    if (dataStr.includes("memory")) themes.push("memories");

    return themes.length > 0 ? themes : ["general"];
  }

  private async simulateReplication(
    _nodeKey: string,
    _entries: QuantumLogEntry[],
  ): Promise<boolean> {
    // Simulate network latency and potential failures
    await new Promise((_resolve) =>
      setTimeout(_resolve, deterministicRandom() * 1000 + 500),
    );

    // 90% success rate
    return deterministicRandom() < 0.9;
  }

  private removeLogEntry(_entryId: string): void {
    const index = this.localLog.findIndex((_e) => _e.id === _entryId);
    if (index > -1) {
      this.localLog.splice(index, 1);
    }
  }

  private updateCommitIndex(): void {
    // Find the highest index that's been replicated to majority of nodes
    const replicationStates = Array.from(this.replicationStates.values());
    if (replicationStates.length === 0) return;

    const majority = Math.floor(replicationStates.length / 2) + 1;

    // Sort match indices
    const matchIndices = replicationStates
      .map((_rs) => _rs.matchIndex)
      .sort((_a, _b) => _b - _a);

    if (matchIndices.length >= majority) {
      const newCommitIndex = matchIndices[majority - 1];
      if (newCommitIndex > this.commitIndex) {
        this.commitIndex = newCommitIndex;
        console.log(`📊 Commit index advanced to ${this.commitIndex}`);
      }
    }
  }

  private startReplicationHeartbeat(): void {
    setInterval(() => {
      this.performReplicationHeartbeat();
    }, 5000); // Every 5 seconds
  }

  private async performReplicationHeartbeat(): Promise<void> {
    // Check for failed replications and retry
    for (const [nodeKey, replicationState] of this.replicationStates) {
      const timeSinceContact = Date.now() - replicationState.lastContact;

      if (
        timeSinceContact > this.REPLICATION_TIMEOUT &&
        replicationState.status === ReplicationStatus.REPLICATING
      ) {
        console.log(`⏰ Replication timeout for ${nodeKey}, retrying...`);
        replicationState.status = ReplicationStatus.FAILED;
      }

      if (replicationState.status === ReplicationStatus.FAILED) {
        // Find entries that need replication
        const pendingEntries = this.localLog
          .filter((_entry) => _entry.index > replicationState.lastReplicatedIndex)
          .slice(0, this.MAX_BATCH_SIZE);

        if (pendingEntries.length > 0) {
          await this.replicateToNode(nodeKey, pendingEntries);
        }
      }
    }
  }

  // =====================================================
  // PUBLIC INTERFACE
  // =====================================================

  public addReplicationTarget(nodeId: NodeId): void {
    const replicationState: ReplicationState = {
      nodeId,
      lastReplicatedIndex: 0,
      nextIndex: 1,
      matchIndex: 0,
      status: ReplicationStatus.PENDING,
      lastContact: Date.now(),
      pendingEntries: [],
      conflicts: [],
    };

    this.replicationStates.set(nodeId.id, replicationState);
    console.log(
      `🎯 Added replication target: ${nodeId.personality?.name || nodeId.id}`,
    );
  }

  public removeReplicationTarget(nodeId: NodeId): void {
    this.replicationStates.delete(nodeId.id);
    console.log(
      `❌ Removed replication target: ${nodeId.personality?.name || nodeId.id}`,
    );
  }

  public getReplicationStatus(): Map<string, ReplicationState> {
    return new Map(this.replicationStates);
  }

  public getLogEntries(
    _startIndex: number = 0,
    _count: number = 100,
  ): QuantumLogEntry[] {
    return this.localLog
      .filter((_entry) => _entry.index >= _startIndex)
      .slice(0, _count);
  }

  public getLogSummary(): {
    totalEntries: number;
    lastIndex: number;
    commitIndex: number;
    replicationTargets: number;
    pendingReplications: number;
    activeConflicts: number;
  } {
    const pendingReplications = Array.from(
      this.replicationStates.values(),
    ).filter((_rs) => _rs.status === ReplicationStatus.REPLICATING).length;

    const activeConflicts = Array.from(this.replicationStates.values()).reduce(
      (_sum, _rs) => _sum + _rs.conflicts.length,
      0,
    );

    return {
      totalEntries: this.localLog.length,
      lastIndex:
        this.localLog.length > 0
          ? Math.max(...this.localLog.map((_e) => _e.index))
          : 0,
      commitIndex: this.commitIndex,
      replicationTargets: this.replicationStates.size,
      pendingReplications,
      activeConflicts,
    };
  }

  public async sleep(): Promise<void> {
    // Cancel all pending replications
    for (const replicationState of this.replicationStates.values()) {
      replicationState.status = ReplicationStatus.FAILED;
    }

    console.log(
      `💤 Quantum Log Replication for ${this.nodeId.id} going to sleep`,
    );
  }
}

export default QuantumLogReplication;


