// 🔥 HARMONIC CONSENSUS SINGLETON - EL GUARDIÁN DE LA ARMONÍA MUSICAL 🔥
// "In music, as in life, harmony is the key to consensus"
import { HarmonicConsensusEngine } from "./HarmonicConsensusEngine.js";
export class HarmonicConsensusSingleton {
    static instance;
    consensusEngine;
    nodeId;
    constructor(nodeId = "default-node") {
        this.nodeId = nodeId;
        // 🎯 PUNK FIX: Create with basic nodeId, allow injection of dependencies later
        this.consensusEngine = new HarmonicConsensusEngine(nodeId);
        console.log(`🎼 HarmonicConsensusSingleton initialized - Node: ${nodeId}, Musical consensus guardian active`);
    }
    static getInstance(nodeId) {
        if (!HarmonicConsensusSingleton.instance) {
            // 🎯 PUNK FIX: Use provided nodeId or fallback to default
            const actualNodeId = nodeId || "default-node";
            HarmonicConsensusSingleton.instance = new HarmonicConsensusSingleton(actualNodeId);
        }
        return HarmonicConsensusSingleton.instance;
    }
    // 🔥 PHASE 4 FIX: Inject dependencies AFTER singleton creation
    injectDependencies(systemVitals, vitalsCache, emergenceGenerator, communicationProtocol, redis) {
        // 🎯 RECREATE ENGINE WITH FULL DEPENDENCIES
        this.consensusEngine = new HarmonicConsensusEngine(this.nodeId, systemVitals, undefined, // veritas - will use default RealVeritasInterface
        vitalsCache, emergenceGenerator, communicationProtocol, // 🔥 THIS IS THE CRITICAL FIX
        redis);
        if (communicationProtocol) {
            console.log(`🌐 PHASE 4 ACTIVATED: Real inter-node communication injected into HarmonicConsensusEngine`);
        }
        else {
            console.log(`⚠️ PHASE 4 PENDING: No communication protocol provided to HarmonicConsensusEngine`);
        }
    }
    // 🎼 DELEGATE METHODS TO HARMONIC CONSENSUS ENGINE
    async determineLeader() {
        return await this.consensusEngine.determineLeader();
    }
    // � UPDATE KNOWN NODES - DELEGATE TO ENGINE
    updateKnownNodes(nodeIds) {
        return this.consensusEngine.updateKnownNodes(nodeIds);
    }
    // �🎼 ADD ANY OTHER METHODS NEEDED BY PHOENIX PROTOCOL
    getConsensusEngine() {
        return this.consensusEngine;
    }
    // 🎼 HEALTH CHECK FOR SINGLETON
    isOperational() {
        return this.consensusEngine !== null;
    }
}
//# sourceMappingURL=HarmonicConsensusSingleton.js.map