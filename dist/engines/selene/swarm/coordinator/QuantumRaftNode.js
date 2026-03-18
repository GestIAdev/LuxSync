// 🔗 QUANTUM RAFT NODE - Distributed consensus node (stub for LuxSync)
// Simplified version - just enough for type compatibility
export class QuantumRaftNode {
    nodeId;
    state;
    log = [];
    constructor(nodeId) {
        this.nodeId = nodeId;
        this.state = {
            nodeId,
            term: 0,
            state: 'follower',
            commitIndex: 0,
            lastApplied: 0,
        };
    }
    /**
     * Get node state
     */
    getState() {
        return { ...this.state };
    }
    /**
     * Append log entry
     */
    appendEntry(entry) {
        this.log.push(entry);
    }
    /**
     * Get last log index
     */
    getLastLogIndex() {
        return this.log.length > 0 ? this.log[this.log.length - 1].index : 0;
    }
    /**
     * Become leader
     */
    becomeLeader() {
        this.state.state = 'leader';
        this.state.term++;
    }
    /**
     * Become follower
     */
    becomeFollower() {
        this.state.state = 'follower';
    }
    /**
     * Vote for candidate
     */
    voteFor(candidateId) {
        if (this.state.votedFor === undefined) {
            this.state.votedFor = candidateId;
            return true;
        }
        return this.state.votedFor === candidateId;
    }
}
//# sourceMappingURL=QuantumRaftNode.js.map