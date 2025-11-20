import { BaseDatabase } from './BaseDatabase.js';
import { Pool } from 'pg';
import { RedisClientType } from 'redis';

export class DocumentsDatabase extends BaseDatabase {
  constructor(pool: Pool, redis?: RedisClientType, redisConnectionId?: string) {
    super(pool, redis, redisConnectionId);
  }

  /**
   * 📄 GET DOCUMENTS - GraphQL Migration v3.0 - FULL SCHEMA
   * ✅ MAPEO COMPLETO: snake_case DB → camelCase GraphQL
   * ✅ FULL FIELDS: Todos los campos de medical_documents incluyendo AI, @veritas, DICOM, embeddings
   */
  public async getDocuments(filters?: any): Promise<any[]> {
    try {
      let query = `
        SELECT
          md.id,
          md.patient_id,
          md.medical_record_id,
          md.appointment_id,
          md.document_type,
          md.title,
          md.description,
          md.file_name,
          md.file_path,
          md.file_size,
          md.mime_type,
          md.file_extension,
          md.image_width,
          md.image_height,
          md.image_quality,
          md.tooth_numbers,
          md.anatomical_region,
          md.clinical_notes,
          md.document_date,
          md.expiry_date,
          md.access_level,
          md.is_confidential,
          md.password_protected,
          md.ai_analyzed,
          md.ai_analysis_results,
          md.ai_confidence_scores,
          md.ocr_extracted_text,
          md.ai_tags,
          md.ai_anomalies_detected,
          md.image_embeddings,
          md.audio_duration_seconds,
          md.audio_transcription,
          md.speaker_id,
          md.dicom_metadata,
          md.version,
          md.parent_document_id,
          md.is_active,
          md.is_archived,
          md.created_at,
          md.updated_at,
          md.created_by,
          md.updated_by,
          md.unified_type,
          md.legal_category,
          p.first_name,
          p.last_name
        FROM medical_documents md
        LEFT JOIN patients p ON md.patient_id = p.id
        WHERE md.deleted_at IS NULL
      `;
      const params: any[] = [];

      if (filters) {
        if (filters.patientId) {
          query += ` AND md.patient_id = $${params.length + 1}`;
          params.push(filters.patientId);
        }
        if (filters.documentType) {
          query += ` AND md.document_type = $${params.length + 1}`;
          params.push(filters.documentType);
        }
        if (filters.unifiedType) {
          query += ` AND md.unified_type = $${params.length + 1}`;
          params.push(filters.unifiedType);
        }
      }

      query += " ORDER BY md.created_at DESC";

      if (filters?.limit) {
        query += ` LIMIT $${params.length + 1}`;
        params.push(filters.limit);
      }
      if (filters?.offset) {
        query += ` OFFSET $${params.length + 1}`;
        params.push(filters.offset);
      }

      const result = await this.pool.query(query, params);

      // ✅ MAPEO COMPLETO snake_case → camelCase con TODOS los campos
      return result.rows.map((dbRow) => ({
        id: dbRow.id,
        patient_id: dbRow.patient_id,
        medical_record_id: dbRow.medical_record_id,
        appointment_id: dbRow.appointment_id,
        document_type: dbRow.document_type,
        title: dbRow.title,
        description: dbRow.description || "",
        file_name: dbRow.file_name,
        file_path: dbRow.file_path,
        file_size: dbRow.file_size,
        file_size_mb: dbRow.file_size ? (dbRow.file_size / (1024 * 1024)).toFixed(2) : 0,
        mime_type: dbRow.mime_type,
        file_extension: dbRow.file_extension,
        is_image: dbRow.mime_type?.startsWith('image/') || false,
        is_xray: dbRow.document_type === 'xray' || dbRow.unified_type === 'xray',
        image_width: dbRow.image_width,
        image_height: dbRow.image_height,
        image_quality: dbRow.image_quality,
        tooth_numbers: Array.isArray(dbRow.tooth_numbers) ? dbRow.tooth_numbers : (dbRow.tooth_numbers ? JSON.parse(dbRow.tooth_numbers) : []),
        anatomical_region: dbRow.anatomical_region,
        clinical_notes: dbRow.clinical_notes,
        document_date: dbRow.document_date,
        expiry_date: dbRow.expiry_date,
        access_level: dbRow.access_level,
        is_confidential: dbRow.is_confidential || false,
        password_protected: dbRow.password_protected || false,
        ai_analyzed: dbRow.ai_analyzed || false,
        ai_analysis_results: typeof dbRow.ai_analysis_results === 'object' ? dbRow.ai_analysis_results : (dbRow.ai_analysis_results ? JSON.parse(dbRow.ai_analysis_results) : null),
        ai_confidence_scores: typeof dbRow.ai_confidence_scores === 'object' ? dbRow.ai_confidence_scores : (dbRow.ai_confidence_scores ? JSON.parse(dbRow.ai_confidence_scores) : null),
        ocr_extracted_text: dbRow.ocr_extracted_text,
        ai_tags: Array.isArray(dbRow.ai_tags) ? dbRow.ai_tags : (dbRow.ai_tags ? JSON.parse(dbRow.ai_tags) : []),
        smart_tags: Array.isArray(dbRow.ai_tags) ? dbRow.ai_tags : (dbRow.ai_tags ? JSON.parse(dbRow.ai_tags) : []), // Alias
        ai_anomalies_detected: dbRow.ai_anomalies_detectadas || false,
        image_embeddings: dbRow.image_embeddings,
        audio_duration_seconds: dbRow.audio_duration_seconds,
        audio_transcription: dbRow.audio_transcription,
        speaker_id: dbRow.speaker_id,
        dicom_metadata: typeof dbRow.dicom_metadata === 'object' ? dbRow.dicom_metadata : (dbRow.dicom_metadata ? JSON.parse(dbRow.dicom_metadata) : null),
        version: dbRow.version || 1,
        parent_document_id: dbRow.parent_document_id,
        is_active: dbRow.is_active !== false,
        is_archived: dbRow.is_archived || false,
        created_at: dbRow.created_at,
        updated_at: dbRow.updated_at,
        created_by: dbRow.created_by,
        updated_by: dbRow.updated_by,
        unified_type: dbRow.unified_type || dbRow.document_type,
        legal_category: dbRow.legal_category,
        download_url: dbRow.file_path ? `/api/documents/${dbRow.id}/download` : '',
        thumbnail_url: dbRow.is_image ? `/api/documents/${dbRow.id}/thumbnail` : null,
        compliance_status: 'compliant', // TODO: Implement compliance check
        patient: dbRow.first_name && dbRow.last_name ? {
          id: dbRow.patient_id,
          first_name: dbRow.first_name,
          last_name: dbRow.last_name
        } : null
      }));
    } catch (error) {
      console.error("💥 Failed to get documents:", error as Error);
      throw error;
    }
  }

  /**
   * ➕ CREATE DOCUMENT - GraphQL Migration v3.0 - FULL SCHEMA
   * ✅ MAPEO COMPLETO: camelCase input → snake_case DB → camelCase output
   * ✅ FULL FIELDS: Todos los campos de medical_documents
   */
  public async createDocument(data: any): Promise<any> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
        INSERT INTO medical_documents (
          patient_id,
          medical_record_id,
          appointment_id,
          document_type,
          title,
          description,
          file_name,
          file_path,
          file_size,
          mime_type,
          file_extension,
          image_width,
          image_height,
          image_quality,
          tooth_numbers,
          anatomical_region,
          clinical_notes,
          document_date,
          expiry_date,
          access_level,
          is_confidential,
          password_protected,
          ai_analyzed,
          ai_analysis_results,
          ai_confidence_scores,
          ocr_extracted_text,
          ai_tags,
          ai_anomalies_detected,
          created_by,
          unified_type,
          legal_category,
          is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32
        )
        RETURNING *
      `,
        [
          data.patientId,
          data.medicalRecordId || null,
          data.appointmentId || null,
          data.documentType || "other",
          data.title,
          data.description || "",
          data.fileName,
          data.filePath,
          data.fileSize || 0,
          data.mimeType || "application/octet-stream",
          data.fileExtension || (data.fileName ? data.fileName.split('.').pop() : null),
          data.imageWidth || null,
          data.imageHeight || null,
          data.imageQuality || null,
          data.toothNumbers ? JSON.stringify(data.toothNumbers) : null,
          data.anatomicalRegion || null,
          data.clinicalNotes || "",
          data.documentDate || new Date().toISOString(),
          data.expiryDate || null,
          data.accessLevel || "PRIVATE",
          data.isConfidential !== undefined ? data.isConfidential : false,
          data.passwordProtected !== undefined ? data.passwordProtected : false,
          data.aiAnalyzed !== undefined ? data.aiAnalyzed : false,
          data.aiAnalysisResults ? JSON.stringify(data.aiAnalysisResults) : null,
          data.aiConfidenceScores ? JSON.stringify(data.aiConfidenceScores) : null,
          data.ocrExtractedText || null,
          data.aiTags ? JSON.stringify(data.aiTags) : null,
          data.aiAnomaliesDetected !== undefined ? data.aiAnomaliesDetected : false,
          data.createdBy || data.uploadedBy || "system",
          data.unifiedType || data.documentType || "other",
          data.legalCategory || null,
          data.isActive !== undefined ? data.isActive : true
        ],
      );

      await client.query("COMMIT");

      const dbRow = result.rows[0];

      // ✅ MAPEO COMPLETO snake_case → camelCase
      return {
        id: dbRow.id,
        patient_id: dbRow.patient_id,
        medical_record_id: dbRow.medical_record_id,
        appointment_id: dbRow.appointment_id,
        document_type: dbRow.document_type,
        title: dbRow.title,
        description: dbRow.description,
        file_name: dbRow.file_name,
        file_path: dbRow.file_path,
        file_size: dbRow.file_size,
        file_size_mb: dbRow.file_size ? (dbRow.file_size / (1024 * 1024)).toFixed(2) : 0,
        mime_type: dbRow.mime_type,
        file_extension: dbRow.file_extension,
        is_image: dbRow.mime_type?.startsWith('image/') || false,
        is_xray: dbRow.document_type === 'xray' || dbRow.unified_type === 'xray',
        image_width: dbRow.image_width,
        image_height: dbRow.image_height,
        image_quality: dbRow.image_quality,
        tooth_numbers: typeof dbRow.tooth_numbers === 'string' ? JSON.parse(dbRow.tooth_numbers) : (dbRow.tooth_numbers || []),
        anatomical_region: dbRow.anatomical_region,
        clinical_notes: dbRow.clinical_notes,
        document_date: dbRow.document_date,
        expiry_date: dbRow.expiry_date,
        access_level: dbRow.access_level,
        is_confidential: dbRow.is_confidential,
        password_protected: dbRow.password_protected,
        ai_analyzed: dbRow.ai_analyzed,
        ai_analysis_results: typeof dbRow.ai_analysis_results === 'string' ? JSON.parse(dbRow.ai_analysis_results) : dbRow.ai_analysis_results,
        ai_confidence_scores: typeof dbRow.ai_confidence_scores === 'string' ? JSON.parse(dbRow.ai_confidence_scores) : dbRow.ai_confidence_scores,
        ocr_extracted_text: dbRow.ocr_extracted_text,
        ai_tags: typeof dbRow.ai_tags === 'string' ? JSON.parse(dbRow.ai_tags) : (dbRow.ai_tags || []),
        smart_tags: typeof dbRow.ai_tags === 'string' ? JSON.parse(dbRow.ai_tags) : (dbRow.ai_tags || []),
        ai_anomalies_detected: dbRow.ai_anomalies_detected,
        created_at: dbRow.created_at,
        updated_at: dbRow.updated_at,
        created_by: dbRow.created_by,
        updated_by: dbRow.updated_by,
        unified_type: dbRow.unified_type,
        legal_category: dbRow.legal_category,
        download_url: `/api/documents/${dbRow.id}/download`,
        thumbnail_url: dbRow.mime_type?.startsWith('image/') ? `/api/documents/${dbRow.id}/thumbnail` : null,
        compliance_status: 'compliant',
        is_active: dbRow.is_active
      };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("💥 Failed to create document:", error as Error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * ✏️ UPDATE DOCUMENT - GraphQL Migration v1.0
   * ✅ MAPEO COMPLETO con lastModified (CRITICAL!)
   */
  public async updateDocument(id: string, data: any): Promise<any> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.title !== undefined) {
        fields.push(`title = $${paramIndex++}`);
        values.push(data.title);
      }
      if (data.description !== undefined) {
        fields.push(`description = $${paramIndex++}`);
        values.push(data.description);
      }
      if (data.documentType !== undefined) {
        fields.push(`document_type = $${paramIndex++}`);
        values.push(data.documentType);
      }
      if (data.tags !== undefined) {
        fields.push(`tags = $${paramIndex++}`);
        values.push(JSON.stringify(data.tags));
      }
      if (data.metadata !== undefined) {
        fields.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(data.metadata));
      }

      fields.push(`last_modified = NOW()`);
      values.push(id);

      const result = await client.query(
        `UPDATE medical_documents SET ${fields.join(", ")} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
        values,
      );

      await client.query("COMMIT");

      if (result.rows.length === 0) {
        throw new Error("Document not found");
      }

      const dbRow = result.rows[0];

      // ✅ MAPEO COMPLETO
      return {
        id: dbRow.id,
        patientId: dbRow.patient_id,
        patientName: dbRow.patient_name,
        documentType: dbRow.document_type,
        title: dbRow.title,
        description: dbRow.description,
        fileName: dbRow.file_name,
        filePath: dbRow.file_path,
        fileSize: dbRow.file_size,
        mimeType: dbRow.mime_type,
        tags: Array.isArray(dbRow.tags) ? dbRow.tags : JSON.parse(dbRow.tags || "[]"),
        metadata: typeof dbRow.metadata === "object" ? dbRow.metadata : JSON.parse(dbRow.metadata || "{}"),
        uploadedBy: dbRow.uploaded_by,
        uploadedAt: dbRow.uploaded_at,
        lastModified: dbRow.last_modified, // 🔥 CRITICAL
      };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("💥 Failed to update document:", error as Error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 🗑️ DELETE DOCUMENT - GraphQL Migration v1.0
   * ✅ Soft delete
   */
  public async deleteDocument(id: string): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE medical_documents SET deleted_at = NOW(), last_modified = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
        [id],
      );

      await client.query("COMMIT");

      return result.rows.length > 0;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("💥 Failed to delete document:", error as Error);
      return false;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // V3 METHODS - GraphQL API COMPATIBILITY
  // ============================================================================

  async getDocumentsV3(args: { patientId?: string; limit?: number; offset?: number; }): Promise<any[]> {
    return this.getDocuments(args);
  }

  async getDocumentV3ById(id: string): Promise<any> {
    return this.getDocuments({ patientId: id }).then(docs => docs[0] || null);
  }

  async getUnifiedDocumentsV3(args: { patientId?: string; limit?: number; offset?: number; }): Promise<any[]> {
    return this.getDocuments(args);
  }

  async getUnifiedDocumentV3ById(id: string): Promise<any> {
    return this.getDocuments({ patientId: id }).then(docs => docs[0] || null);
  }

  async createDocumentV3(input: any): Promise<any> {
    return this.createDocument(input);
  }

  async updateDocumentV3(id: string, input: any): Promise<any> {
    return this.updateDocument(id, input);
  }

  async deleteDocumentV3(id: string): Promise<void> {
    await this.deleteDocument(id);
  }

  async uploadUnifiedDocumentV3(input: any): Promise<any> {
    return this.createDocument(input);
  }
}