import { BaseDatabase } from './BaseDatabase.js';
import { Pool } from 'pg';
import { RedisClientType } from 'redis';
export declare class TreatmentsDatabase extends BaseDatabase {
    constructor(pool: Pool, redis?: RedisClientType, redisConnectionId?: string);
    /**
     * 💰 PERSIST TREATMENT MATERIALS (Economic Singularity - Directiva #005)
     * Inserta registros en treatment_materials con snapshot de costos
     */
    private persistTreatmentMaterials;
    /**
     * 🩺 GET TREATMENTS - GraphQL Migration v1.0
     * ✅ MAPEO COMPLETO: snake_case DB → camelCase GraphQL
     * ✅ FIELDS: id, patientId, practitionerId, treatmentType, description, status, startDate, endDate, cost, notes, aiRecommendations, veritasScore, createdAt, updatedAt
     */
    getTreatments(filters?: any): Promise<any[]>;
    /**
     * ➕ CREATE TREATMENT - GraphQL Migration v1.0
     * ✅ MAPEO COMPLETO: camelCase input → snake_case DB → camelCase output
     */
    createTreatment(data: any): Promise<any>;
    /**
     * ✏️ UPDATE TREATMENT - GraphQL Migration v1.0
     * ✅ MAPEO COMPLETO con updatedAt (CRITICAL!)
     */
    updateTreatment(id: string, data: any): Promise<any>;
    /**
     * 🗑️ DELETE TREATMENT - GraphQL Migration v1.0
     * ✅ Soft delete
     */
    deleteTreatment(id: string): Promise<boolean>;
    getTreatmentByIdV3(id: string): Promise<any>;
    /**
     * Get or create odontogram data for patient (stored as JSON in medical_records)
     */
    getOdontogramData(patientId: string): Promise<any>;
    /**
     * Update specific tooth status in odontogram
     */
    updateToothStatus(patientId: string, toothNumber: number, status: string, condition: string | null, notes: string | null): Promise<any>;
    /**
     * Create 32 default healthy teeth
     */
    private createDefaultTeeth;
    /**
     * Calculate 3D position for tooth (simplified grid)
     */
    private calculateToothPosition;
    /**
     * Get color for tooth status (matches frontend CYBERPUNK_COLORS)
     */
    private getToothColor;
}
//# sourceMappingURL=TreatmentsDatabase.d.ts.map