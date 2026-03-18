export interface IntegrityCheck {
    valid: boolean;
    isValid?: boolean;
    confidence?: number;
    timestamp: number;
    signature?: string;
    certificate?: string;
    error?: string;
    verified?: boolean;
    anomalies?: string[];
}
export declare class SeleneVeritas {
    private enabled;
    /**
     * Verify data integrity
     */
    verify(data: any): Promise<IntegrityCheck>;
    /**
     * Generate signature for data
     */
    private generateSignature;
    /**
     * Enable/disable verification
     */
    setEnabled(enabled: boolean): void;
    /**
     * Check if verification is enabled
     */
    isEnabled(): boolean;
    /**
     * Verify data integrity (alias) - supports both 1 and 3 args
     */
    verifyDataIntegrity(data: any, context?: string, hash?: string): Promise<IntegrityCheck>;
    /**
     * Generate truth certificate - supports both 1 and 3 args
     */
    generateTruthCertificate(data: any, context?: string, hash?: string): Promise<{
        valid: boolean;
        certificate: string;
        timestamp: number;
        signature?: string;
    }>;
}
export default SeleneVeritas;
//# sourceMappingURL=Veritas.d.ts.map