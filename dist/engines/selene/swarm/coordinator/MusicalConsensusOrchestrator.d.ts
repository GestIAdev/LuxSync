/**
 * 🎵 PHASE 3.2: Musical Consensus Orchestrator
 * Coordinates consensus with musical recording and NFT generation
 * ✅ INTEGRATES REAL HarmonicConsensusEngine (NO MORE Math.random() PLACEHOLDERS)
 */
export declare class MusicalConsensusOrchestrator {
    private nftEngine;
    private recorder;
    private harmonicEngine;
    private autoRecordEnabled;
    private nftGenerationEnabled;
    constructor(veritas?: any, nodeId?: string);
    /**
     * Enable/disable NFT generation at runtime
     */
    setNFTGeneration(enabled: boolean): void;
    /**
     * Check if NFT generation is enabled
     */
    isNFTGenerationEnabled(): boolean;
    /**
     * Toggle NFT generation on/off
     */
    toggleNFTGeneration(): Promise<void>;
    /**
     * Check if NFT is enabled (alias for dashboard compatibility)
     */
    isNFTEnabled(): boolean;
    /**
     * Get NFT collections (alias for dashboard compatibility)
     */
    getNFTCollections(): any;
    /**
     * Get NFT collection stats
     */
    getNFTStats(): any;
    /**
     * Export NFT collection
     */
    exportNFTCollection(directory: string): Promise<void>;
    /**
     * Handle verse generation event
     */
    onVerseGenerated(verse: PoetryFragment): Promise<void>;
    /**
     * Perform consensus using REAL HarmonicConsensusEngine (AXIOMA ANTI-SIMULACIÓN)
     * ✅ NO Math.random() - Uses actual system vitals and cryptographic verification
     */
    performConsensus(...args: any[]): Promise<ConsensusResult>;
    /**
     * Achieve consensus with musical recording
     */
    achieveConsensus(...args: any[]): Promise<ConsensusResult>;
    /**
     * Export musical recording
     */
    exportRecording(filename?: string): Promise<string>;
    /**
     * Get recording stats
     */
    getRecordingStats(): {
        noteCount: number;
        duration: number;
        isRecording: boolean;
    };
    /**
     * Handle shutdown - export recordings
     */
    handleShutdown(): Promise<void>;
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
export {};
//# sourceMappingURL=MusicalConsensusOrchestrator.d.ts.map