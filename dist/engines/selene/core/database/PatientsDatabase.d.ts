import { BaseDatabase } from './BaseDatabase.js';
export declare class PatientsDatabase extends BaseDatabase {
    /**
     * 👥 Get all patients with filtering and pagination
     */
    getPatients(filters?: any): Promise<any[]>;
    /**
     * 👤 Get patient by ID
     */
    getPatientById(id: string): Promise<any>;
    /**
     * ➕ Create new patient
     */
    createPatient(patientData: any): Promise<any>;
    /**
     * ✏️ Update patient
     */
    updatePatient(id: string, patientData: any): Promise<any>;
    /**
     * 🗑️ Delete patient (soft delete)
     */
    deletePatient(id: string): Promise<boolean>;
    /**
     * 🗑️ Invalidate patient cache
     */
    private invalidatePatientCache;
}
//# sourceMappingURL=PatientsDatabase.d.ts.map