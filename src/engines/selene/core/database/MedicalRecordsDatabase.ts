import { BaseDatabase } from './BaseDatabase.js';

export class MedicalRecordsDatabase extends BaseDatabase {
  /**
   * 📋 Get all medical records with filtering and pagination
   */
  public async getMedicalRecords(filters?: any): Promise<any[]> {
    try {
      // Query usando medical_records table - COLUMNAS REALES (NO medications/attachments)
      let query = `
        SELECT
          id,
          patient_id,
          created_by,
          procedure_category,
          diagnosis,
          treatment_plan,
          treatment_performed,
          clinical_notes,
          chief_complaint,
          procedure_codes,
          tooth_numbers,
          surfaces_treated,
          follow_up_notes,
          created_at,
          updated_at
        FROM medical_records
        WHERE deleted_at IS NULL
      `;
      const params: any[] = [];

      if (filters) {
        if (filters.patientId) {
          query += ` AND patient_id = $${params.length + 1}`;
          params.push(filters.patientId);
        }
        if (filters.recordType) {
          query += ` AND procedure_category = $${params.length + 1}`;
          params.push(filters.recordType);
        }
      }

      query += " ORDER BY created_at DESC";

      const result = await this.pool.query(query, params);

      // ✅ MAPEO COMPLETO snake_case → camelCase con FALLBACKS para non-nullable fields
      return result.rows.map((dbRow) => ({
        id: dbRow.id,
        patientId: dbRow.patient_id,
        practitionerId: dbRow.created_by || "unknown", // Schema: practitionerId: ID!
        date: dbRow.created_at || new Date().toISOString(), // Schema: date: String! (from visit_date/created_at)
        recordType: dbRow.procedure_category || "general", // Schema: recordType: String!
        title: dbRow.diagnosis || "Medical Record", // Schema: title: String!
        content: dbRow.clinical_notes || "No content", // Schema: content: String!
        diagnosis: dbRow.diagnosis || "",
        treatment: dbRow.treatment_plan || "",
        // ✅ ARRAYS DESDE JSONB (no existen medications/attachments columns)
        medications: [], // No existe en tabla - devolver vacío
        attachments: [], // No existe en tabla - devolver vacío
        // ✅ CAMPOS ADICIONALES DESDE LA TABLA REAL
        chiefComplaint: dbRow.chief_complaint || "",
        treatmentPerformed: dbRow.treatment_performed || "",
        procedureCodes: Array.isArray(dbRow.procedure_codes)
          ? dbRow.procedure_codes
          : dbRow.procedure_codes
            ? JSON.parse(dbRow.procedure_codes)
            : [],
        toothNumbers: Array.isArray(dbRow.tooth_numbers)
          ? dbRow.tooth_numbers
          : dbRow.tooth_numbers
            ? JSON.parse(dbRow.tooth_numbers)
            : [],
        surfacesTreated: dbRow.surfaces_treated || {},
        followUpNotes: dbRow.follow_up_notes || "",
        createdAt: dbRow.created_at || new Date().toISOString(), // Schema: createdAt: String!
        updatedAt: dbRow.updated_at || new Date().toISOString(), // Schema: updatedAt: String!
      }));
    } catch (error) {
      console.error("💥 Failed to get medical records:", error as Error);
      throw error;
    }
  }

  /**
   * ➕ Create new medical record
   */
  public async createMedicalRecord(data: any): Promise<any> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
        INSERT INTO medical_records (
          patient_id, created_by, procedure_category,
          diagnosis, treatment_plan, treatment_performed,
          clinical_notes, chief_complaint, procedure_codes,
          tooth_numbers, surfaces_treated, follow_up_notes,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        RETURNING *
      `,
        [
          data.patientId,
          data.practitionerId,
          data.recordType || "general",
          data.diagnosis || data.title || "",
          data.treatment || "",
          data.treatmentPerformed || "",
          data.content || data.notes || "",
          data.chiefComplaint || "",
          data.procedureCodes ? JSON.stringify(data.procedureCodes) : "[]",
          data.toothNumbers ? JSON.stringify(data.toothNumbers) : "[]",
          data.surfacesTreated ? JSON.stringify(data.surfacesTreated) : "{}",
          data.followUpNotes || "",
        ],
      );

      await client.query("COMMIT");

      const dbRow = result.rows[0];

      // ✅ MAPEO COMPLETO
      return {
        id: dbRow.id,
        patientId: dbRow.patient_id,
        practitionerId: dbRow.created_by || "unknown",
        date: dbRow.created_at || new Date().toISOString(),
        recordType: dbRow.procedure_category || "general",
        title: dbRow.diagnosis || "Medical Record",
        content: dbRow.clinical_notes || "",
        diagnosis: dbRow.diagnosis || "",
        treatment: dbRow.treatment_plan || "",
        medications: [], // No existe en tabla
        attachments: [], // No existe en tabla
        chiefComplaint: dbRow.chief_complaint || "",
        treatmentPerformed: dbRow.treatment_performed || "",
        procedureCodes: Array.isArray(dbRow.procedure_codes)
          ? dbRow.procedure_codes
          : [],
        toothNumbers: Array.isArray(dbRow.tooth_numbers)
          ? dbRow.tooth_numbers
          : [],
        surfacesTreated: dbRow.surfaces_treated || {},
        followUpNotes: dbRow.follow_up_notes || "",
        createdAt: dbRow.created_at || new Date().toISOString(),
        updatedAt: dbRow.updated_at || new Date().toISOString(),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("💥 Failed to create medical record:", error as Error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * ✏️ Update medical record
   */
  public async updateMedicalRecord(id: string, data: any): Promise<any> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.recordType !== undefined) {
        fields.push(`procedure_category = $${paramIndex++}`);
        values.push(data.recordType);
      }
      if (data.diagnosis !== undefined) {
        fields.push(`diagnosis = $${paramIndex++}`);
        values.push(data.diagnosis);
      }
      if (data.treatment !== undefined) {
        fields.push(`treatment_plan = $${paramIndex++}`);
        values.push(data.treatment);
      }
      if (data.treatmentPerformed !== undefined) {
        fields.push(`treatment_performed = $${paramIndex++}`);
        values.push(data.treatmentPerformed);
      }
      if (data.content !== undefined || data.notes !== undefined) {
        fields.push(`clinical_notes = $${paramIndex++}`);
        values.push(data.content || data.notes);
      }
      if (data.chiefComplaint !== undefined) {
        fields.push(`chief_complaint = $${paramIndex++}`);
        values.push(data.chiefComplaint);
      }
      if (data.procedureCodes !== undefined) {
        fields.push(`procedure_codes = $${paramIndex++}`);
        values.push(JSON.stringify(data.procedureCodes));
      }
      if (data.toothNumbers !== undefined) {
        fields.push(`tooth_numbers = $${paramIndex++}`);
        values.push(JSON.stringify(data.toothNumbers));
      }
      if (data.surfacesTreated !== undefined) {
        fields.push(`surfaces_treated = $${paramIndex++}`);
        values.push(JSON.stringify(data.surfacesTreated));
      }
      if (data.followUpNotes !== undefined) {
        fields.push(`follow_up_notes = $${paramIndex++}`);
        values.push(data.followUpNotes);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const result = await client.query(
        `UPDATE medical_records SET ${fields.join(", ")} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
        values,
      );

      await client.query("COMMIT");

      if (result.rows.length === 0) {
        throw new Error("Medical record not found");
      }

      const dbRow = result.rows[0];

      // ✅ MAPEO COMPLETO
      return {
        id: dbRow.id,
        patientId: dbRow.patient_id,
        practitionerId: dbRow.created_by || "unknown",
        date: dbRow.created_at || new Date().toISOString(),
        recordType: dbRow.procedure_category || "general",
        title: dbRow.diagnosis || "Medical Record",
        content: dbRow.clinical_notes || "",
        diagnosis: dbRow.diagnosis || "",
        treatment: dbRow.treatment_plan || "",
        medications: [], // No existe en tabla
        attachments: [], // No existe en tabla
        chiefComplaint: dbRow.chief_complaint || "",
        treatmentPerformed: dbRow.treatment_performed || "",
        procedureCodes: Array.isArray(dbRow.procedure_codes)
          ? dbRow.procedure_codes
          : [],
        toothNumbers: Array.isArray(dbRow.tooth_numbers)
          ? dbRow.tooth_numbers
          : [],
        surfacesTreated: dbRow.surfaces_treated || {},
        followUpNotes: dbRow.follow_up_notes || "",
        createdAt: dbRow.created_at || new Date().toISOString(),
        updatedAt: dbRow.updated_at || new Date().toISOString(), // 🔥 CRITICAL
      };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("💥 Failed to update medical record:", error as Error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 🗑️ Delete medical record (soft delete)
   */
  public async deleteMedicalRecord(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE medical_records SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
  }

  // ============================================================================
  // V3 METHODS - GraphQL API COMPATIBILITY
  // ============================================================================

  async getMedicalRecordsV3(args: { patientId?: string; limit?: number; offset?: number; }): Promise<any[]> {
    return this.getMedicalRecords(args);
  }

  async getMedicalRecordV3ById(id: string): Promise<any> {
    return this.getMedicalRecords({ patientId: id }).then(records => records[0] || null);
  }

  async createMedicalRecordV3(input: any): Promise<any> {
    return this.createMedicalRecord(input);
  }

  async updateMedicalRecordV3(id: string, input: any): Promise<any> {
    return this.updateMedicalRecord(id, input);
  }

  async deleteMedicalRecordV3(id: string): Promise<void> {
    await this.deleteMedicalRecord(id);
  }
}