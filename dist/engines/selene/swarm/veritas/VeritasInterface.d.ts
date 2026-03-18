import { IntegrityCheck } from "../../Veritas/Veritas.js";
import { EthicalCertificate } from "../../consciousness/engines/MetaEngineInterfaces.js";
export interface VeritasInterface {
    verify_claim(claim: ClaimVerificationRequest): Promise<VerificationResult>;
    get_verified_facts(domain: string): Promise<VerifiedFact[]>;
    calculate_confidence(claim: string): Promise<number>;
    verifyDataIntegrity(data: any, entity: string, dataId: string): Promise<IntegrityCheck>;
    createEthicalCertificate(dreamData: any, ethicalDecision: any, dreamId: string): Promise<EthicalCertificate>;
}
export interface ClaimVerificationRequest {
    claim: string;
    source: string;
    confidence_threshold: number;
}
export interface VerificationResult {
    verified: boolean;
    confidence: number;
    verified_statement: string;
    signature: string;
    reason?: string;
}
export interface VerifiedFact {
    fact: string;
    confidence: number;
    signature: string;
    timestamp: Date;
}
export declare class RealVeritasInterface implements VeritasInterface {
    private apolloVeritas;
    constructor(server?: any, database?: any, cache?: any, monitoring?: any);
    verify_claim(request: ClaimVerificationRequest): Promise<VerificationResult>;
    get_verified_facts(domain: string): Promise<VerifiedFact[]>;
    calculate_confidence(claim: string): Promise<number>;
    verifyDataIntegrity(_data: any, entity: string, dataId: string): Promise<IntegrityCheck>;
    createEthicalCertificate(dreamData: any, ethicalDecision: any, dreamId: string): Promise<EthicalCertificate>;
}
//# sourceMappingURL=VeritasInterface.d.ts.map