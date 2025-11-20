// 🔥 HARMONIC CONSENSUS SINGLETON - EL GUARDIÁN DE LA ARMONÍA MUSICAL 🔥
// "In music, as in life, harmony is the key to consensus"
import { HarmonicConsensusEngine } from "./HarmonicConsensusEngine.js";
import { UnifiedCommunicationProtocol } from "./UnifiedCommunicationProtocol.js";
import { SystemVitals } from "../core/SystemVitals.js";
import { TTLCache } from "../../shared/TTLCache.js";
import { NodeVitals } from "../core/SwarmTypes.js";
import { EmergenceGenerator } from "./EmergenceGenerator.js";


export class HarmonicConsensusSingleton {
  private static instance: HarmonicConsensusSingleton;
  private consensusEngine: HarmonicConsensusEngine;
  private nodeId: string;

  private constructor(nodeId: string = "default-node") {
    this.nodeId = nodeId;
    // 🎯 PUNK FIX: Create with basic nodeId, allow injection of dependencies later
    this.consensusEngine = new HarmonicConsensusEngine(nodeId);
    console.log(
      `🎼 HarmonicConsensusSingleton initialized - Node: ${nodeId}, Musical consensus guardian active`,
    );
  }

  public static getInstance(nodeId?: string): HarmonicConsensusSingleton {
    if (!HarmonicConsensusSingleton.instance) {
      // 🎯 PUNK FIX: Use provided nodeId or fallback to default
      const actualNodeId = nodeId || "default-node";
      HarmonicConsensusSingleton.instance = new HarmonicConsensusSingleton(actualNodeId);
    }
    return HarmonicConsensusSingleton.instance;
  }

  // 🔥 PHASE 4 FIX: Inject dependencies AFTER singleton creation
  public injectDependencies(
    systemVitals?: SystemVitals,
    vitalsCache?: TTLCache<string, NodeVitals>,
    emergenceGenerator?: EmergenceGenerator,
    communicationProtocol?: UnifiedCommunicationProtocol,
    redis?: any, // 🔥 ADD REDIS PARAMETER
  ): void {
    // 🎯 RECREATE ENGINE WITH FULL DEPENDENCIES
    this.consensusEngine = new HarmonicConsensusEngine(
      this.nodeId,
      systemVitals,
      undefined, // veritas - will use default RealVeritasInterface
      vitalsCache,
      emergenceGenerator,
      communicationProtocol, // 🔥 THIS IS THE CRITICAL FIX
      redis, // 🔥 PASS REDIS TO CONSTRUCTOR
    );
    
    if (communicationProtocol) {
      console.log(`🌐 PHASE 4 ACTIVATED: Real inter-node communication injected into HarmonicConsensusEngine`);
    } else {
      console.log(`⚠️ PHASE 4 PENDING: No communication protocol provided to HarmonicConsensusEngine`);
    }
  }

  // 🎼 DELEGATE METHODS TO HARMONIC CONSENSUS ENGINE
  public async determineLeader(): Promise<any> {
    return await this.consensusEngine.determineLeader();
  }

  // � UPDATE KNOWN NODES - DELEGATE TO ENGINE
  public updateKnownNodes(nodeIds: string[]): void {
    return this.consensusEngine.updateKnownNodes(nodeIds);
  }

  // �🎼 ADD ANY OTHER METHODS NEEDED BY PHOENIX PROTOCOL
  public getConsensusEngine(): HarmonicConsensusEngine {
    return this.consensusEngine;
  }

  // 🎼 HEALTH CHECK FOR SINGLETON
  public isOperational(): boolean {
    return this.consensusEngine !== null;
  }
}


