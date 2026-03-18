import { BaseDatabase } from './BaseDatabase.js';
export declare class MedicalRecordsDatabase extends BaseDatabase {
    /**
     * 📋 Get all medical records with filtering and pagination
     */
    getMedicalRecords(filters?: any): Promise<any[]>;
    /**
     * ➕ Create new medical record
     */
    createMedicalRecord(data: any): Promise<any>;
    /**
     * ✏️ Update medical record
     */
    updateMedicalRecord(id: string, data: any): Promise<any>;
    /**
     * 🗑️ Delete medical record (soft delete)
     */
    deleteMedicalRecord(id: string): Promise<void>;
    getMedicalRecordsV3(args: {
        patientId?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    getMedicalRecordV3ById(id: string): Promise<any>;
    createMedicalRecordV3(input: any): Promise<any>;
    updateMedicalRecordV3(id: string, input: any): Promise<any>;
    deleteMedicalRecordV3(id: string): Promise<void>;
}
//# sourceMappingURL=MedicalRecordsDatabase.d.ts.map