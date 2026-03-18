export interface VeritasIntegrityResult {
    isValid: boolean;
    confidence: number;
    expectedHash: string;
    actualHash: string;
    anomalies: string[];
    timestamp: number;
    signature?: string;
}
export interface VeritasCertificate {
    id: string;
    data: any;
    entity: string;
    hash: string;
    signature: string;
    timestamp: number;
    merkleRoot?: string;
    zeroKnowledgeProof?: any;
}
export interface VeritasChainBlock {
    index: number;
    timestamp: number;
    certificates: VeritasCertificate[];
    previousHash: string;
    hash: string;
    nonce: number;
}
export declare class SeleneVeritas {
    private server;
    private database;
    private cache;
    private monitoring;
    private rsaKeyPair;
    private certificateChain;
    private merkleTree;
    private zeroKnowledgeSystem;
    private initializationPromise;
    private initialized;
    constructor(server: any, database: any, cache: any, monitoring: any);
    /**
     * Wait for async initialization to complete
     * Call this after construction before using Veritas
     */
    waitForInitialization(): Promise<void>;
    private initializeAsync;
    private initializeCertificateChainSync;
    verifyDataIntegrity(data: any, entity: string, _dataId: string): Promise<VeritasIntegrityResult>;
    private calculateDeterministicHash;
    private calculateBlockHash;
    private validateDataStructure;
    private signData;
    createCertificate(data: any, entity: string, dataId: string): Promise<VeritasCertificate>;
    verifyCertificate(certificate: VeritasCertificate): Promise<boolean>;
    getVerifiedFacts(_domain: string): Promise<any[]>;
}
//# sourceMappingURL=SeleneVeritas.d.ts.map