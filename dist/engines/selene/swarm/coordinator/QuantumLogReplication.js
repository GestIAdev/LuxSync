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
import { RealVeritasInterface } from "../veritas/VeritasInterface.js";
// =====================================================
// LOG ENTRY TYPES
// =====================================================
export var LogEntryType;
(function (LogEntryType) {
    LogEntryType["MEMORY"] = "memory";
    LogEntryType["DREAM"] = "dream";
    LogEntryType["EMOTION"] = "emotion";
    LogEntryType["DECISION"] = "decision";
    LogEntryType["CONSCIOUSNESS"] = "consciousness";
    LogEntryType["HARMONY"] = "harmony";
    LogEntryType["EVOLUTION"] = "evolution";
})(LogEntryType || (LogEntryType = {}));
export var ReplicationStatus;
(function (ReplicationStatus) {
    ReplicationStatus["PENDING"] = "pending";
    ReplicationStatus["REPLICATING"] = "replicating";
    ReplicationStatus["REPLICATED"] = "replicated";
    ReplicationStatus["FAILED"] = "failed";
    ReplicationStatus["CONFLICTED"] = "conflicted";
})(ReplicationStatus || (ReplicationStatus = {}));
// =====================================================
// QUANTUM LOG REPLICATION ENGINE
// =====================================================
export class QuantumLogReplication extends EventEmitter {
    nodeId;
    soul;
    veritas;
    localLog = [];
    replicationStates = new Map();
    currentTerm = 0;
    lastAppliedIndex = 0;
    commitIndex = 0;
    // Replication parameters
    MAX_BATCH_SIZE = 10; // Entries per replication batch
    REPLICATION_TIMEOUT = 5000; // 5 seconds timeout
    CONFLICT_RESOLUTION_TIMEOUT = 30000; // 30 seconds for conflicts
    constructor(nodeId, soul) {
        super();
        this.nodeId = nodeId;
        this.soul = soul;
        this.veritas = new RealVeritasInterface();
        console.log(`📜 Quantum Log Replication initialized for ${nodeId.id} with Real Veritas cryptographic validation`);
        // Start periodic replication heartbeat
        this.startReplicationHeartbeat();
    }
    // =====================================================
    // LOG ENTRY CREATION
    // =====================================================
    async appendMemory(experience, _emotions = []) {
        const entry = {
            id: this.generateEntryId(),
            term: this.currentTerm,
            index: this.getNextIndex(),
            type: LogEntryType.MEMORY,
            nodeId: this.nodeId,
            timestamp: Date.now(),
            data: experience,
            checksum: this.calculateChecksum(experience),
            dependencies: [],
            poeticSummary: await this.generatePoeticSummary(experience, LogEntryType.MEMORY),
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
    async appendDream(dream) {
        const entry = {
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
    async appendSoulState(state) {
        const entry = {
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
    async appendLogEntry(entry) {
        // 🔐 REAL VERITAS: Verify data integrity before accepting entry
        console.log(`🔐 REAL VERITAS: Verifying log entry integrity for ${entry.id}`);
        try {
            const integrityCheck = await this.veritas.verifyDataIntegrity(entry.data, entry.nodeId.id, entry.id);
            if (!integrityCheck.isValid) {
                console.error(`❌ REAL VERITAS: Data integrity check failed for entry ${entry.id}`);
                console.error(`   Anomalies: ${integrityCheck.anomalies.join(", ")}`);
                console.error(`   Confidence: ${integrityCheck.confidence}%`);
                throw new Error(`Data integrity verification failed: ${integrityCheck.anomalies.join(", ")}`);
            }
            console.log(`✅ REAL VERITAS: Data integrity verified for entry ${entry.id}`);
        }
        catch (error) {
            console.error(`💥 REAL VERITAS: Error during integrity verification:`, error);
            throw error;
        }
        this.localLog.push(entry);
        console.log(`📝 Log entry created with cryptographic validation: ${entry.poeticSummary}`);
        console.log(`   Type: ${entry.type} | Index: ${entry.index} | Term: ${entry.term}`);
        this.emit("log_entry_created", entry);
        // Start replication to other nodes
        await this.initiateReplication(entry);
        return entry.id;
    }
    // =====================================================
    // REPLICATION MANAGEMENT
    // =====================================================
    async initiateReplication(_entry) {
        for (const [nodeKey, replicationState] of this.replicationStates) {
            if (replicationState.status === ReplicationStatus.REPLICATING) {
                continue; // Already replicating to this node
            }
            await this.replicateToNode(nodeKey, [_entry]);
        }
    }
    async replicateToNode(nodeKey, entries) {
        const replicationState = this.replicationStates.get(nodeKey);
        if (!replicationState)
            return;
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
                    const pendingIndex = replicationState.pendingEntries.indexOf(_entry.id);
                    if (pendingIndex > -1) {
                        replicationState.pendingEntries.splice(pendingIndex, 1);
                    }
                });
                console.log(`✅ Replication successful to ${nodeKey}`);
                this.emit("replication_success", { nodeKey, entries });
                // Check if we can advance commit index
                this.updateCommitIndex();
            }
            else {
                replicationState.status = ReplicationStatus.FAILED;
                console.log(`❌ Replication failed to ${nodeKey}`);
                this.emit("replication_failed", { nodeKey, entries });
            }
        }
        catch (error) {
            replicationState.status = ReplicationStatus.FAILED;
            console.log(`💥 Replication error to ${nodeKey}:`, error);
        }
    }
    // =====================================================
    // CONFLICT RESOLUTION
    // =====================================================
    async receiveLogEntries(entries, fromNode) {
        console.log(`📥 Received ${entries.length} log entries from ${fromNode.id} - initiating REAL VERITAS validation`);
        const conflicts = [];
        const validEntries = [];
        for (const entry of entries) {
            // 🔐 REAL VERITAS: Verify remote entry integrity before processing
            console.log(`🔐 REAL VERITAS: Verifying remote entry ${entry.id} from ${fromNode.id}`);
            try {
                const integrityCheck = await this.veritas.verifyDataIntegrity(entry.data, fromNode.id, entry.id);
                if (!integrityCheck.isValid) {
                    console.error(`❌ REAL VERITAS: Remote entry ${entry.id} integrity check failed`);
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
                console.log(`✅ REAL VERITAS: Remote entry ${entry.id} integrity verified`);
            }
            catch (error) {
                console.error(`💥 REAL VERITAS: Error verifying remote entry ${entry.id}:`, error);
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
                console.log(`⚔️ Conflict detected for entry ${entry.id}: ${conflict.conflictType}`);
            }
            else {
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
        console.log(`📊 Replication result: ${validEntries.length} valid, ${conflicts.length} conflicts - ${allValid ? "SUCCESS" : "PARTIAL"}`);
        return allValid;
    }
    async detectConflict(entry) {
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
        const sameIndex = this.localLog.find((e) => e.index === entry.index && e.term === entry.term);
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
    async resolveConflicts(_conflicts) {
        for (const conflict of _conflicts) {
            console.log(`🔧 Resolving conflict ${conflict.conflictId}: ${conflict.conflictType}`);
            switch (conflict.suggestedResolution) {
                case "keep_local":
                    // Do nothing, keep our version
                    break;
                case "keep_remote":
                    await this.applyLogEntry(conflict.remoteEntry);
                    break;
                case "merge":
                    const merged = await this.mergeEntries(conflict.localEntry, conflict.remoteEntry);
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
    async mergeEntries(local, remote) {
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
    async mergeMemories(local, remote) {
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
                confidenceLevel: (local.metadata.confidenceLevel + remote.metadata.confidenceLevel) /
                    2,
            },
        };
    }
    async mergeDreams(local, remote) {
        // Create a composite dream
        const mergedDream = {
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
                confidenceLevel: Math.min(local.metadata.confidenceLevel, remote.metadata.confidenceLevel),
            },
        };
    }
    async mergeConsciousness(local, _remote) {
        // Average consciousness levels
        const localState = local.data;
        const remoteState = _remote.data;
        const mergedState = {
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
    async applyLogEntry(entry) {
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
    async applyMemoryEntry(_entry) {
        // Integrate the memory into our soul's experience
        // This could influence future decisions and dreams
        console.log(`🧠 Integrating memory: ${_entry.poeticSummary}`);
    }
    async applyDreamEntry(_entry) {
        // Let the dream influence our consciousness
        const dream = _entry.data;
        console.log(`💭 Experiencing shared dream: "${dream.verse}"`);
        // Potentially trigger our own related dream
        if (deterministicRandom() < 0.3) {
            // 30% chance
            const inspirationPoetry = await this.soul.dream();
            // Convert PoetryFragment to Dream
            const inspirationDream = {
                verse: inspirationPoetry.verse,
                theme: "inspiration",
                mood: "creative",
                intensity: inspirationPoetry.beauty || 0.8,
                timestamp: Date.now(),
            };
            await this.appendDream(inspirationDream);
        }
    }
    async applyConsciousnessEntry(entry) {
        // Gently adjust our consciousness based on swarm state
        const remoteState = entry.data;
        const currentState = this.soul.getState();
        // Small influence from other nodes' consciousness
        const influence = 0.05; // 5% influence
        // This would ideally call a method on soul to adjust state
        console.log(`⚡ Consciousness influenced by ${entry.nodeId.personality?.name || entry.nodeId.id}`);
    }
    // =====================================================
    // HELPER METHODS
    // =====================================================
    generateEntryId() {
        const timestamp = Date.now().toString(36);
        const random = deterministicRandom().toString(36).substr(2, 8);
        return `log_${this.nodeId.id}_${timestamp}_${random}`;
    }
    getNextIndex() {
        return this.localLog.length > 0
            ? Math.max(...this.localLog.map((_e) => _e.index)) + 1
            : 1;
    }
    calculateChecksum(_data) {
        // Simple checksum - in production would use proper hashing
        return JSON.stringify(_data).length.toString(36);
    }
    async generatePoeticSummary(_data, _type) {
        const templates = {
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
        return typeTemplates[Math.floor(deterministicRandom() * typeTemplates.length)];
    }
    async extractThemes(_data) {
        // Simple theme extraction - could be enhanced with NLP
        const dataStr = JSON.stringify(_data).toLowerCase();
        const themes = [];
        if (dataStr.includes("conscious"))
            themes.push("consciousness");
        if (dataStr.includes("creative"))
            themes.push("creativity");
        if (dataStr.includes("harmony"))
            themes.push("harmony");
        if (dataStr.includes("wisdom"))
            themes.push("wisdom");
        if (dataStr.includes("dream"))
            themes.push("dreams");
        if (dataStr.includes("memory"))
            themes.push("memories");
        return themes.length > 0 ? themes : ["general"];
    }
    async simulateReplication(_nodeKey, _entries) {
        // Simulate network latency and potential failures
        await new Promise((_resolve) => setTimeout(_resolve, deterministicRandom() * 1000 + 500));
        // 90% success rate
        return deterministicRandom() < 0.9;
    }
    removeLogEntry(_entryId) {
        const index = this.localLog.findIndex((_e) => _e.id === _entryId);
        if (index > -1) {
            this.localLog.splice(index, 1);
        }
    }
    updateCommitIndex() {
        // Find the highest index that's been replicated to majority of nodes
        const replicationStates = Array.from(this.replicationStates.values());
        if (replicationStates.length === 0)
            return;
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
    startReplicationHeartbeat() {
        setInterval(() => {
            this.performReplicationHeartbeat();
        }, 5000); // Every 5 seconds
    }
    async performReplicationHeartbeat() {
        // Check for failed replications and retry
        for (const [nodeKey, replicationState] of this.replicationStates) {
            const timeSinceContact = Date.now() - replicationState.lastContact;
            if (timeSinceContact > this.REPLICATION_TIMEOUT &&
                replicationState.status === ReplicationStatus.REPLICATING) {
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
    addReplicationTarget(nodeId) {
        const replicationState = {
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
        console.log(`🎯 Added replication target: ${nodeId.personality?.name || nodeId.id}`);
    }
    removeReplicationTarget(nodeId) {
        this.replicationStates.delete(nodeId.id);
        console.log(`❌ Removed replication target: ${nodeId.personality?.name || nodeId.id}`);
    }
    getReplicationStatus() {
        return new Map(this.replicationStates);
    }
    getLogEntries(_startIndex = 0, _count = 100) {
        return this.localLog
            .filter((_entry) => _entry.index >= _startIndex)
            .slice(0, _count);
    }
    getLogSummary() {
        const pendingReplications = Array.from(this.replicationStates.values()).filter((_rs) => _rs.status === ReplicationStatus.REPLICATING).length;
        const activeConflicts = Array.from(this.replicationStates.values()).reduce((_sum, _rs) => _sum + _rs.conflicts.length, 0);
        return {
            totalEntries: this.localLog.length,
            lastIndex: this.localLog.length > 0
                ? Math.max(...this.localLog.map((_e) => _e.index))
                : 0,
            commitIndex: this.commitIndex,
            replicationTargets: this.replicationStates.size,
            pendingReplications,
            activeConflicts,
        };
    }
    async sleep() {
        // Cancel all pending replications
        for (const replicationState of this.replicationStates.values()) {
            replicationState.status = ReplicationStatus.FAILED;
        }
        console.log(`💤 Quantum Log Replication for ${this.nodeId.id} going to sleep`);
    }
}
export default QuantumLogReplication;
//# sourceMappingURL=QuantumLogReplication.js.map