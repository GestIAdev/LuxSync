import { BaseDatabase } from './BaseDatabase.js';
import { Pool } from 'pg';
import { RedisClientType } from 'redis';

export class TreatmentsDatabase extends BaseDatabase {
  constructor(pool: Pool, redis?: RedisClientType, redisConnectionId?: string) {
    super(pool, redis, redisConnectionId);
  }

  /**
   * 💰 PERSIST TREATMENT MATERIALS (Economic Singularity - Directiva #005)
   * Inserta registros en treatment_materials con snapshot de costos
   */
  private async persistTreatmentMaterials(
    client: any,
    treatmentId: string,
    materials: Array<{ inventoryItemId: string | number; quantity: number }>,
    createdBy?: string
  ): Promise<void> {
    if (!materials || materials.length === 0) {
      return;
    }

    for (const material of materials) {
      try {
        // Recuperar material_id y unit_cost desde dental_materials
        const materialInfo = await client.query(
          `SELECT id, unit_cost FROM dental_materials WHERE id = $1`,
          [material.inventoryItemId]
        );

        if (materialInfo.rows.length === 0) {
          console.warn(`⚠️ Material no encontrado: ${material.inventoryItemId}`);
          continue;
        }

        const { id: materialId, unit_cost: unitCost } = materialInfo.rows[0];

        // Insertar en treatment_materials con cost_snapshot
        await client.query(
          `INSERT INTO treatment_materials (
            treatment_id, material_id, quantity, cost_snapshot, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())`,
          [treatmentId, materialId, material.quantity, unitCost || 0, createdBy]
        );

        console.log(`✅ Material persistido: ${materialId} (qty: ${material.quantity}, cost_snapshot: ${unitCost})`);
      } catch (error) {
        console.error(`❌ Error persistiendo material ${material.inventoryItemId}:`, error);
        // Continuar con otros materiales (no fallar toda la transacción)
      }
    }
  }

  /**
   * 🩺 GET TREATMENTS - GraphQL Migration v1.0
   * ✅ MAPEO COMPLETO: snake_case DB → camelCase GraphQL
   * ✅ FIELDS: id, patientId, practitionerId, treatmentType, description, status, startDate, endDate, cost, notes, aiRecommendations, veritasScore, createdAt, updatedAt
   */
  public async getTreatments(filters?: any): Promise<any[]> {
    try {
      // Query treatments from medical_records table
      let query = `
        SELECT
          id,
          patient_id,
          created_by,
          procedure_category,
          diagnosis,
          treatment_status,
          visit_date,
          follow_up_date,
          estimated_cost,
          clinical_notes,
          created_at,
          updated_at
        FROM medical_records
        WHERE is_active = true AND deleted_at IS NULL
      `;
      const params: any[] = [];

      if (filters) {
        if (filters.patientId) {
          query += ` AND patient_id = $${params.length + 1}`;
          params.push(filters.patientId);
        }
        if (filters.status) {
          query += ` AND treatment_status = $${params.length + 1}`;
          params.push(filters.status);
        }
      }

      query += " ORDER BY created_at DESC";

      if (filters?.limit) {
        query += ` LIMIT $${params.length + 1}`;
        params.push(filters.limit);
      }

      const result = await this.pool.query(query, params);

      // ✅ MAPEO COMPLETO snake_case → camelCase con FALLBACKS para non-nullable fields
      return result.rows.map((dbRow) => ({
        id: dbRow.id,
        patientId: dbRow.patient_id,
        practitionerId: dbRow.created_by || "unknown", // Schema: practitionerId: ID!
        treatmentType: dbRow.procedure_category || "general", // Schema: treatmentType: String!
        description: dbRow.diagnosis || "No description", // Schema: description: String!
        status: dbRow.treatment_status || "pending", // Schema: status: String!
        startDate: dbRow.visit_date || new Date().toISOString(), // Schema: startDate: String!
        endDate: dbRow.follow_up_date,
        cost: dbRow.estimated_cost || 0,
        notes: dbRow.clinical_notes || "",
        aiRecommendations: [], // Default empty array
        veritasScore: 0, // Default 0
        createdAt: dbRow.created_at || new Date().toISOString(), // Schema: createdAt: String!
        updatedAt: dbRow.updated_at || new Date().toISOString(), // Schema: updatedAt: String!
      }));
    } catch (error) {
      console.error("💥 Failed to get treatments:", error as Error);
      throw error;
    }
  }

  /**
   * ➕ CREATE TREATMENT - GraphQL Migration v1.0
   * ✅ MAPEO COMPLETO: camelCase input → snake_case DB → camelCase output
   */
  public async createTreatment(data: any): Promise<any> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
        INSERT INTO medical_records (
          patient_id, created_by, procedure_category,
          diagnosis, treatment_status, visit_date,
          follow_up_date, estimated_cost, clinical_notes,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *
      `,
        [
          data.patientId,
          data.practitionerId,
          data.treatmentType || "general",
          data.description || "",
          data.status || "pending",
          data.startDate || new Date(),
          data.endDate,
          data.cost || 0,
          data.notes || "",
        ],
      );

      const dbRow = result.rows[0];

      // 💰 ECONOMIC SINGULARITY: Persistir materiales con cost_snapshot
      if (data.materialsUsed && data.materialsUsed.length > 0) {
        console.log(`💰 [Economic Singularity] Persistiendo ${data.materialsUsed.length} materiales...`);
        await this.persistTreatmentMaterials(
          client,
          dbRow.id,
          data.materialsUsed,
          data.practitionerId
        );
      }

      await client.query("COMMIT");


      // ✅ MAPEO COMPLETO
      return {
        id: dbRow.id,
        patientId: dbRow.patient_id,
        practitionerId: dbRow.created_by,
        treatmentType: dbRow.procedure_category,
        description: dbRow.diagnosis,
        status: dbRow.treatment_status,
        startDate: dbRow.visit_date,
        endDate: dbRow.follow_up_date,
        cost: dbRow.estimated_cost,
        notes: dbRow.clinical_notes,
        aiRecommendations: [],
        veritasScore: 0,
        createdAt: dbRow.created_at,
        updatedAt: dbRow.updated_at,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("💥 Failed to create treatment:", error as Error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * ✏️ UPDATE TREATMENT - GraphQL Migration v1.0
   * ✅ MAPEO COMPLETO con updatedAt (CRITICAL!)
   */
  public async updateTreatment(id: string, data: any): Promise<any> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.treatmentType !== undefined) {
        fields.push(`procedure_category = $${paramIndex++}`);
        values.push(data.treatmentType);
      }
      if (data.description !== undefined) {
        fields.push(`diagnosis = $${paramIndex++}`);
        values.push(data.description);
      }
      if (data.status !== undefined) {
        fields.push(`treatment_status = $${paramIndex++}`);
        values.push(data.status);
      }
      if (data.startDate !== undefined) {
        fields.push(`visit_date = $${paramIndex++}`);
        values.push(data.startDate);
      }
      if (data.endDate !== undefined) {
        fields.push(`follow_up_date = $${paramIndex++}`);
        values.push(data.endDate);
      }
      if (data.cost !== undefined) {
        fields.push(`estimated_cost = $${paramIndex++}`);
        values.push(data.cost);
      }
      if (data.notes !== undefined) {
        fields.push(`clinical_notes = $${paramIndex++}`);
        values.push(data.notes);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const result = await client.query(
        `UPDATE medical_records SET ${fields.join(", ")} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
        values,
      );

      await client.query("COMMIT");

      if (result.rows.length === 0) {
        throw new Error("Treatment not found");
      }

      const dbRow = result.rows[0];

      // ✅ MAPEO COMPLETO
      return {
        id: dbRow.id,
        patientId: dbRow.patient_id,
        practitionerId: dbRow.created_by,
        treatmentType: dbRow.procedure_category,
        description: dbRow.diagnosis,
        status: dbRow.treatment_status,
        startDate: dbRow.visit_date,
        endDate: dbRow.follow_up_date,
        cost: dbRow.estimated_cost,
        notes: dbRow.clinical_notes,
        aiRecommendations: [],
        veritasScore: 0,
        createdAt: dbRow.created_at,
        updatedAt: dbRow.updated_at, // 🔥 CRITICAL
      };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("💥 Failed to update treatment:", error as Error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 🗑️ DELETE TREATMENT - GraphQL Migration v1.0
   * ✅ Soft delete
   */
  public async deleteTreatment(id: string): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE medical_records SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
        [id],
      );

      await client.query("COMMIT");

      return result.rows.length > 0;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("💥 Failed to delete treatment:", error as Error);
      return false;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // TREATMENT V3 METHODS - API COMPATIBILITY
  // ============================================================================

  async getTreatmentByIdV3(id: string): Promise<any> {
    const query = `
      SELECT
        id,
        patient_id as "patientId",
        created_by as "practitionerId",
        procedure_category as "treatmentType",
        diagnosis as description,
        treatment_status as status,
        visit_date as "startDate",
        follow_up_date as "endDate",
        estimated_cost as cost,
        clinical_notes as notes,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM medical_records
      WHERE id = $1 AND is_active = true AND deleted_at IS NULL
    `;

    return this.getOne(query, [id]);
  }

  // ============================================================================
  // 🦷💀 ODONTOGRAM 3D V3 METHODS - QUANTUM DENTAL VISUALIZATION
  // ============================================================================

  /**
   * Get or create odontogram data for patient (stored as JSON in medical_records)
   */
  async getOdontogramData(patientId: string): Promise<any> {
    const query = `
      SELECT id, clinical_notes, created_at, updated_at
      FROM medical_records
      WHERE patient_id = $1 AND procedure_category = 'ODONTOGRAM_DATA'
        AND is_active = true AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `;
    const result = await this.pool.query(query, [patientId]);

    if (result.rows.length > 0) {
      const row = result.rows[0];
      let teeth = [];
      try {
        teeth = row.clinical_notes ? JSON.parse(row.clinical_notes) : [];
      } catch (e) {
        console.warn('⚠️ Failed to parse odontogram, creating new');
        teeth = [];
      }
      if (teeth.length === 0) {
        teeth = this.createDefaultTeeth();
      }
      return {
        id: row.id,
        patientId,
        teeth,
        lastUpdated: row.updated_at,
        createdAt: row.created_at,
      };
    }

    // Create new odontogram
    const teeth = this.createDefaultTeeth();
    const insertQuery = `
      INSERT INTO medical_records (
        id, patient_id, created_by, procedure_category, diagnosis,
        treatment_status, visit_date, clinical_notes, is_active,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, 'system', 'ODONTOGRAM_DATA',
        'Odontograma Digital 3D', 'active', CURRENT_TIMESTAMP, $2,
        true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING id, created_at, updated_at
    `;
    const insertResult = await this.pool.query(insertQuery, [
      patientId,
      JSON.stringify(teeth),
    ]);

    return {
      id: insertResult.rows[0].id,
      patientId,
      teeth,
      lastUpdated: insertResult.rows[0].updated_at,
      createdAt: insertResult.rows[0].created_at,
    };
  }

  /**
   * Update specific tooth status in odontogram
   */
  async updateToothStatus(
    patientId: string,
    toothNumber: number,
    status: string,
    condition: string | null,
    notes: string | null
  ): Promise<any> {
    const odontogram = await this.getOdontogramData(patientId);
    const teeth = odontogram.teeth.map((tooth: any) => {
      if (tooth.toothNumber === toothNumber) {
        return {
          ...tooth,
          status,
          condition: condition || tooth.condition,
          notes: notes || tooth.notes,
          lastTreatmentDate: new Date().toISOString(),
          color: this.getToothColor(status),
        };
      }
      return tooth;
    });

    const query = `
      UPDATE medical_records
      SET clinical_notes = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    await this.pool.query(query, [JSON.stringify(teeth), odontogram.id]);

    return teeth.find((t: any) => t.toothNumber === toothNumber);
  }

  /**
   * Create 32 default healthy teeth
   */
  private createDefaultTeeth(): any[] {
    const teeth = [];
    for (let i = 1; i <= 32; i++) {
      teeth.push({
        id: `tooth-${i}`,
        toothNumber: i,
        status: 'HEALTHY',
        condition: null,
        surfaces: [],
        notes: null,
        lastTreatmentDate: null,
        color: '#10B981',
        position: this.calculateToothPosition(i),
      });
    }
    return teeth;
  }

  /**
   * Calculate 3D position for tooth (simplified grid)
   */
  private calculateToothPosition(toothNumber: number): { x: number; y: number; z: number } {
    const isUpper = toothNumber <= 16;
    const posInJaw = isUpper ? toothNumber : toothNumber - 16;
    const isLeft = posInJaw <= 8;
    const posInSide = isLeft ? posInJaw : 17 - posInJaw;
    return {
      x: (posInSide - 4.5) * 0.8,
      y: isUpper ? 0.5 : -0.5,
      z: 0,
    };
  }

  /**
   * Get color for tooth status (matches frontend CYBERPUNK_COLORS)
   */
  private getToothColor(status: string): string {
    const colors: Record<string, string> = {
      HEALTHY: '#10B981',
      CAVITY: '#EF4444',
      FILLING: '#3B82F6',
      CROWN: '#8B5CF6',
      EXTRACTED: '#6B7280',
      IMPLANT: '#00FFFF',
      ROOT_CANAL: '#EC4899',
      CHIPPED: '#F59E0B',
      CRACKED: '#F59E0B',
      MISSING: '#1F2937',
    };
    return colors[status] || '#10B981';
  }
}