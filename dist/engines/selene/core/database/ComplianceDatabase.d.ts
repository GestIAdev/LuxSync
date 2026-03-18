import { BaseDatabase } from './BaseDatabase.js';
export declare class ComplianceDatabase extends BaseDatabase {
    /**
     * Get compliance checks with nuclear efficiency
     */
    getCompliancesV3(args: {
        patientId?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    /**
     * Get compliance check by ID
     */
    getComplianceV3ById(id: string): Promise<any>;
    /**
     * Create new compliance check
     */
    createComplianceV3(input: any): Promise<any>;
    /**
     * Update compliance check
     */
    updateComplianceV3(id: string, input: any): Promise<any>;
    /**
     * Delete compliance check
     */
    deleteComplianceV3(id: string): Promise<void>;
}
//# sourceMappingURL=ComplianceDatabase.d.ts.map