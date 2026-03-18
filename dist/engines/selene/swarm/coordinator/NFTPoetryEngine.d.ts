export interface NFTMetadata {
    id: string;
    title: string;
    description: string;
    imageUrl?: string;
    timestamp: number;
}
export declare class NFTPoetryEngine {
    private nfts;
    constructor(veritas?: any);
    /**
     * Create NFT metadata
     */
    createNFT(title: string, description: string): NFTMetadata;
    /**
     * Get NFT by ID
     */
    getNFT(id: string): NFTMetadata | undefined;
    /**
     * List all NFTs
     */
    listNFTs(): NFTMetadata[];
    /**
     * Delete NFT
     */
    deleteNFT(id: string): boolean;
}
//# sourceMappingURL=NFTPoetryEngine.d.ts.map