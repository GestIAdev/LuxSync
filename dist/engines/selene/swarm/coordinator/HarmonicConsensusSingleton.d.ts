import { HarmonicConsensusEngine } from "./HarmonicConsensusEngine.js";
import { UnifiedCommunicationProtocol } from "./UnifiedCommunicationProtocol.js";
import { SystemVitals } from "../core/SystemVitals.js";
import { TTLCache } from "../../shared/TTLCache.js";
import { NodeVitals } from "../core/SwarmTypes.js";
import { EmergenceGenerator } from "./EmergenceGenerator.js";
export declare class HarmonicConsensusSingleton {
    private static instance;
    private consensusEngine;
    private nodeId;
    private constructor();
    static getInstance(nodeId?: string): HarmonicConsensusSingleton;
    injectDependencies(systemVitals?: SystemVitals, vitalsCache?: TTLCache<string, NodeVitals>, emergenceGenerator?: EmergenceGenerator, communicationProtocol?: UnifiedCommunicationProtocol, redis?: any): void;
    determineLeader(): Promise<any>;
    updateKnownNodes(nodeIds: string[]): void;
    getConsensusEngine(): HarmonicConsensusEngine;
    isOperational(): boolean;
}
//# sourceMappingURL=HarmonicConsensusSingleton.d.ts.map