import { NFTPoetryEngine } from '../../poetry/NFTPoetryEngine.js';
import { MusicEngine } from '../music/MusicalConsensusRecorder.js'; // SSE-7.7: Renamed from MusicalConsensusRecorder
import { HarmonicConsensusEngine } from './HarmonicConsensusEngine.js';
import { SystemVitals } from '../core/SystemVitals.js';
import type { ConsensusResult as HarmonicConsensusResult } from './HarmonicConsensusEngine.js';


/**
 * 🎵 PHASE 3.2: Musical Consensus Orchestrator
 * Coordinates consensus with musical recording and NFT generation
 * ✅ INTEGRATES REAL HarmonicConsensusEngine (NO MORE Math.random() PLACEHOLDERS)
 */
export class MusicalConsensusOrchestrator {
  private nftEngine: NFTPoetryEngine | null = null;
  private recorder: MusicEngine; // SSE-7.7: Updated type
  private harmonicEngine: HarmonicConsensusEngine;
  private autoRecordEnabled = process.env.RECORD_CONSENSUS === 'true' || true;
  private nftGenerationEnabled = process.env.ENABLE_NFT_GENERATION === 'true' || false; // FALSE por defecto

  constructor(veritas?: any, nodeId: string = 'orchestrator-node') {
    this.recorder = new MusicEngine(); // SSE-7.7: Updated instantiation
    
    // ✅ INITIALIZE REAL HARMONIC CONSENSUS ENGINE (AXIOMA ANTI-SIMULACIÓN)
    const systemVitals = SystemVitals.getInstance();
    this.harmonicEngine = new HarmonicConsensusEngine(
      nodeId,
      systemVitals,
      veritas
    );

    // Initialize NFT engine only if enabled and veritas is available
    if (this.nftGenerationEnabled && veritas) {
      this.nftEngine = new NFTPoetryEngine(veritas);
    }

    // Start recording if auto-record is enabled
    if (this.autoRecordEnabled) {
      this.recorder.startRecording();
    }

    console.log('🎵 MusicalConsensusOrchestrator initialized with REAL HarmonicConsensusEngine');
    console.log('✅ AXIOMA ANTI-SIMULACIÓN: NO Math.random() - Only real consensus logic');
  }

  /**
   * Enable/disable NFT generation at runtime
   */
  setNFTGeneration(enabled: boolean): void {
    this.nftGenerationEnabled = enabled;
    if (enabled && !this.nftEngine) {
      // Note: Would need veritas instance here - simplified for now
      console.log('💎 NFT generation enabled - restart required for full functionality');
    }
    console.log(`💎 NFT generation: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Check if NFT generation is enabled
   */
  isNFTGenerationEnabled(): boolean {
    return this.nftGenerationEnabled;
  }

  /**
   * Toggle NFT generation on/off
   */
  async toggleNFTGeneration(): Promise<void> {
    this.setNFTGeneration(!this.nftGenerationEnabled);
  }

  /**
   * Check if NFT is enabled (alias for dashboard compatibility)
   */
  isNFTEnabled(): boolean {
    return this.isNFTGenerationEnabled();
  }

  /**
   * Get NFT collections (alias for dashboard compatibility)
   */
  getNFTCollections() {
    return this.getNFTStats();
  }

  /**
   * Get NFT collection stats
   */
  getNFTStats() {
    if (!this.nftEngine) {
      return { enabled: false, message: 'NFT generation disabled' };
    }
    return {
      enabled: true,
      ...this.nftEngine.getStats()
    };
  }

  /**
   * Export NFT collection
   */
  async exportNFTCollection(directory: string): Promise<void> {
    if (!this.nftEngine) {
      throw new Error('NFT generation is disabled');
    }
    await this.nftEngine.exportCollection(directory);
  }

  /**
   * Handle verse generation event
   */
  async onVerseGenerated(verse: PoetryFragment): Promise<void> {
    if (this.nftGenerationEnabled && this.nftEngine) {
      try {
        await this.nftEngine.generateNFTPoetry(verse);
      } catch (error) {
        console.error('Error generating NFT for verse:', error as Error);
      }
    }
  }

  /**
   * Perform consensus using REAL HarmonicConsensusEngine (AXIOMA ANTI-SIMULACIÓN)
   * ✅ NO Math.random() - Uses actual system vitals and cryptographic verification
   */
  async performConsensus(...args: any[]): Promise<ConsensusResult> {
    const startTime = Date.now();
    
    // ✅ REAL CONSENSUS LOGIC via HarmonicConsensusEngine
    const harmonicResult = await this.harmonicEngine.determineLeader(); // REAL METHOD
    
    // Map HarmonicConsensusResult to our ConsensusResult format
    const result: ConsensusResult = {
      consensusAchieved: harmonicResult.consensus_achieved,
      participants: harmonicResult.total_nodes > 0 
        ? Array.from({ length: harmonicResult.total_nodes }, (_, i) => `node-${i + 1}`)
        : ['node-1', 'node-2', 'node-3'], // Fallback for backward compat
      consensusTime: Date.now() - startTime,
      beauty: Math.round(harmonicResult.harmonic_score * 100) // Convert 0.0-1.0 to 0-100
    };

    console.log(`🎵 Consensus result (REAL): ${result.consensusAchieved ? 'SUCCESS' : 'FAILED'} (${result.consensusTime}ms)`);
    console.log(`🎼 Musical note: ${harmonicResult.dominant_note} (${harmonicResult.frequency_hz}Hz)`);
    console.log(`✨ Beauty score: ${result.beauty}/100 (harmonic: ${harmonicResult.harmonic_score.toFixed(3)})`);

    return result;
  }

  /**
   * Achieve consensus with musical recording
   */
  async achieveConsensus(...args: any[]): Promise<ConsensusResult> {
    const result = await this.performConsensus(...args);

    // Record musical consensus if enabled
    if (this.autoRecordEnabled) {
      this.recorder.recordConsensusEvent(result);
    }

    return result;
  }

  /**
   * Export musical recording
   */
  async exportRecording(filename?: string): Promise<string> {
    return await this.recorder.stopRecording(filename);
  }

  /**
   * Get recording stats
   */
  getRecordingStats() {
    return this.recorder.getStats();
  }

  /**
   * Handle shutdown - export recordings
   */
  async handleShutdown(): Promise<void> {
    console.log('🎵 Exporting musical consensus recording on shutdown...');

    try {
      const recordingPath = await this.exportRecording();
      if (recordingPath) {
        console.log(`🎵 ✅ Recording saved: ${recordingPath}`);
        console.log(`🎵 💿 Import this MIDI file into your favorite DAW!`);
      }
    } catch (error) {
      console.error('🎵 ❌ Failed to export recording:', error as Error);
    }

    // Export NFT collection if available
    if (this.nftEngine) {
      try {
        await this.exportNFTCollection('./nft-collection');
        console.log('💎 NFT collection exported');
      } catch (error) {
        console.error('💎 Failed to export NFT collection:', error as Error);
      }
    }
  }
}

interface PoetryFragment {
  id: string;
  text: string;
  sign: string;
  beauty: number;
}

interface ConsensusResult {
  consensusAchieved: boolean;
  participants: string[];
  consensusTime: number;
  beauty: number;
}


