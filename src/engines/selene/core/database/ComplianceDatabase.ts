import { BaseDatabase } from './BaseDatabase.js';

export class ComplianceDatabase extends BaseDatabase {
  /**
   * Get compliance checks with nuclear efficiency
   */
  async getCompliancesV3(args: {
    patientId?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const { patientId, limit = 50, offset = 0 } = args;

    let query = `
      SELECT
        id, patient_id, regulation_id, compliance_status,
        description, last_checked, next_check, created_at, updated_at
      FROM compliance_checks
    `;

    const params: any[] = [];

    // 🎯 GATE 1: Build WHERE clause
    if (patientId) {
      query += ` WHERE patient_id = $1`;
      params.push(patientId);
    }

    // 🎯 GATE 2: Add ORDER BY (BEFORE LIMIT/OFFSET)
    query += ` ORDER BY created_at DESC`;

    // 🎯 GATE 3: Add pagination
    if (patientId) {
      query += ` LIMIT $2 OFFSET $3`;
      params.push(limit, offset);
    } else {
      query += ` LIMIT $1 OFFSET $2`;
      params.push(limit, offset);
    }

    return await this.getAll(query, params);
  }

  /**
   * Get compliance check by ID
   */
  async getComplianceV3ById(id: string): Promise<any> {
    const query = `SELECT * FROM compliance_checks WHERE id = $1`;
    return await this.getOne(query, [id]);
  }

  /**
   * Create new compliance check
   */
  async createComplianceV3(input: any): Promise<any> {
    const {
      patientId,
      regulationId,
      complianceStatus,
      description,
      lastChecked,
      nextCheck
    } = input;

    const query = `
      INSERT INTO compliance_checks (
        patient_id, regulation_id, compliance_status,
        description, last_checked, next_check, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `;
    const params = [patientId, regulationId, complianceStatus || 'PENDING', description, lastChecked, nextCheck];

    const result = await this.runQuery(query, params);
    return result.rows[0];
  }

  /**
   * Update compliance check
   */
  async updateComplianceV3(id: string, input: any): Promise<any> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.regulationId !== undefined) {
      updates.push(`regulation_id = $${paramIndex++}`);
      values.push(input.regulationId);
    }
    if (input.complianceStatus !== undefined) {
      updates.push(`compliance_status = $${paramIndex++}`);
      values.push(input.complianceStatus);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.lastChecked !== undefined) {
      updates.push(`last_checked = $${paramIndex++}`);
      values.push(input.lastChecked);
    }
    if (input.nextCheck !== undefined) {
      updates.push(`next_check = $${paramIndex++}`);
      values.push(input.nextCheck);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE compliance_checks
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.runQuery(query, values);
    return result.rows[0];
  }

  /**
   * Delete compliance check
   */
  async deleteComplianceV3(id: string): Promise<void> {
    const query = `DELETE FROM compliance_checks WHERE id = $1`;
    await this.runQuery(query, [id]);
  }
}