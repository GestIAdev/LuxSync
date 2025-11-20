import { BaseDatabase } from './BaseDatabase.js';

export class PatientsDatabase extends BaseDatabase {
  /**
   * 👥 Get all patients with filtering and pagination
   */
  public async getPatients(filters?: any): Promise<any[]> {
    const cacheKey = `patients:${JSON.stringify(filters || {})}`;

    try {
      // Try cache first
      const cached = await this.safeRedisOperation(
        () => this.getRedis().get(cacheKey),
        null
      );
      if (cached) {
        console.log("⚡ Patients served from cache");
        return JSON.parse(cached);
      }

      // Query database using APOLLO_PATIENTS VIEW - V169 Schema Bridge
      let query = "SELECT * FROM apollo_patients";
      const params: any[] = [];

      if (filters) {
        if (filters.search) {
          query += " WHERE (name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)";
          params.push(`%${filters.search}%`);
        }
        if (filters.status) {
          const whereClause = filters.search ? " AND" : " WHERE";
          query += `${whereClause} is_active = $${params.length + 1}`;
          params.push(filters.status === "active");
        }
      }

      query += " ORDER BY created_at DESC";

      if (filters?.limit) {
        query += ` LIMIT $${params.length + 1}`;
        params.push(filters.limit);
      }

      const result = await this.pool.query(query, params);
      const patients = result.rows;

      // Map database fields to GraphQL format
      const graphqlPatients = patients.map((dbPatient) => ({
        id: dbPatient.id,
        firstName: dbPatient.first_name,
        lastName: dbPatient.last_name,
        name: dbPatient.name || `${dbPatient.first_name || ''} ${dbPatient.last_name || ''}`.trim() || 'Unknown Patient', // 🔥 FIX: Use name from view directly
        fullName: dbPatient.name || `${dbPatient.first_name} ${dbPatient.last_name}`,
        email: dbPatient.email,
        phone: dbPatient.phone_primary,
        phoneSecondary: dbPatient.phone_secondary,
        dateOfBirth: dbPatient.date_of_birth,
        age: null, // Will be calculated if needed
        gender: dbPatient.gender,
        addressStreet: dbPatient.address_street,
        addressCity: dbPatient.address_city,
        addressState: dbPatient.address_state,
        addressPostalCode: dbPatient.address_postal_code,
        addressCountry: dbPatient.address_country,
        fullAddress: null, // Will be computed if needed
        emergencyContactName: dbPatient.emergency_contact_name,
        emergencyContactPhone: dbPatient.emergency_contact_phone,
        emergencyContactRelationship: dbPatient.emergency_contact_relationship,
        medicalConditions: dbPatient.medical_history,
        medicationsCurrent: dbPatient.current_medications,
        allergies: dbPatient.allergies,
        anxietyLevel: dbPatient.anxiety_level,
        specialNeeds: dbPatient.special_needs,
        insuranceProvider: dbPatient.insurance_provider,
        policyNumber: dbPatient.insurance_policy_number, // Corrected field name
        insuranceGroupNumber: dbPatient.insurance_group_number,
        insuranceStatus: dbPatient.insurance_provider
          ? "private"
          : "no_insurance",
        consentToTreatment: dbPatient.consent_to_treatment || false,
        consentToContact: dbPatient.consent_to_contact || true,
        preferredContactMethod: dbPatient.preferred_contact_method,
        notes: dbPatient.notes,
        isActive: dbPatient.is_active,
        createdAt: dbPatient.created_at,
        updatedAt: dbPatient.updated_at,
        hasInsurance: !!dbPatient.insurance_provider,
        requiresSpecialCare: !!(
          dbPatient.special_needs || dbPatient.anxiety_level
        ),
      }));

      // Cache results (don't fail if Redis is down)
      await this.safeRedisOperation(
        () => this.getRedis().setEx(cacheKey, 300, JSON.stringify(graphqlPatients)),
        undefined
      );

      return graphqlPatients;
    } catch (error) {
      console.error("💥 Failed to get patients:", error as Error);
      throw error;
    }
  }

  /**
   * 👤 Get patient by ID
   */
  public async getPatientById(id: string): Promise<any> {
    const cacheKey = `patient:${id}`;

    try {
      // Try cache first
      const cached = await this.safeRedisOperation(
        () => this.getRedis().get(cacheKey),
        null
      );
      if (cached) {
        return JSON.parse(cached);
      }

      const result = await this.pool.query(
        "SELECT * FROM patients WHERE id = $1 AND deleted_at IS NULL",
        [id],
      );

      if (result.rows.length === 0) {
        return null;
      }

      const dbPatient = result.rows[0];

      // Map database fields to GraphQL format
      const patient = {
        id: dbPatient.id,
        firstName: dbPatient.first_name,
        lastName: dbPatient.last_name,
        fullName: `${dbPatient.first_name} ${dbPatient.last_name}`,
        email: dbPatient.email,
        phone: dbPatient.phone_primary,
        phoneSecondary: dbPatient.phone_secondary,
        dateOfBirth: dbPatient.date_of_birth,
        age: null, // Will be calculated if needed
        gender: dbPatient.gender,
        addressStreet: dbPatient.address_street,
        addressCity: dbPatient.address_city,
        addressState: dbPatient.address_state,
        addressPostalCode: dbPatient.address_postal_code,
        addressCountry: dbPatient.address_country,
        fullAddress: null, // Will be computed if needed
        emergencyContactName: dbPatient.emergency_contact_name,
        emergencyContactPhone: dbPatient.emergency_contact_phone,
        emergencyContactRelationship: dbPatient.emergency_contact_relationship,
        medicalConditions: dbPatient.medical_history,
        medicationsCurrent: dbPatient.current_medications,
        allergies: dbPatient.allergies,
        anxietyLevel: dbPatient.anxiety_level,
        specialNeeds: dbPatient.special_needs,
        insuranceProvider: dbPatient.insurance_provider,
        policyNumber: dbPatient.insurance_policy_number, // Corrected field name
        insuranceGroupNumber: dbPatient.insurance_group_number,
        insuranceStatus: dbPatient.insurance_provider
          ? "private"
          : "no_insurance",
        consentToTreatment: dbPatient.consent_to_treatment || false,
        consentToContact: dbPatient.consent_to_contact || true,
        preferredContactMethod: dbPatient.preferred_contact_method,
        notes: dbPatient.notes,
        isActive: dbPatient.is_active,
        createdAt: dbPatient.created_at,
        updatedAt: dbPatient.updated_at,
        hasInsurance: !!dbPatient.insurance_provider,
        requiresSpecialCare: !!(
          dbPatient.special_needs || dbPatient.anxiety_level
        ),
      };

      // Cache result (don't fail if Redis is down)
      await this.safeRedisOperation(
        () => this.getRedis().setEx(cacheKey, 600, JSON.stringify(patient)),
        undefined
      );

      return patient;
    } catch (error) {
      console.error("💥 Failed to get patient:", error as Error);
      throw error;
    }
  }

  /**
   * ➕ Create new patient
   */
  public async createPatient(patientData: any): Promise<any> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
        INSERT INTO patients (
          id, first_name, last_name, email, phone_primary, date_of_birth,
          address_country, medical_history, is_active, created_at, updated_at
        ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *
      `,
        [
          patientData.firstName || patientData.first_name,
          patientData.lastName || patientData.last_name,
          patientData.email,
          patientData.phone,
          patientData.dateOfBirth || patientData.date_of_birth,
          "México", // Default country
          patientData.medicalHistory || patientData.medical_history || "",
          true, // is_active default to true
        ],
      );

      const dbPatient = result.rows[0];

      await client.query("COMMIT");

      // Invalidate cache
      await this.safeRedisOperation(() => this.invalidatePatientCache(), undefined);

      // Emit real-time update
      await this.emitRealtimeUpdate("patients", "created", dbPatient);

      // Map database fields to GraphQL format
      const graphqlPatient = {
        id: dbPatient.id,
        firstName: dbPatient.first_name,
        lastName: dbPatient.last_name,
        fullName: `${dbPatient.first_name} ${dbPatient.last_name}`,
        email: dbPatient.email,
        phone: dbPatient.phone_primary,
        phoneSecondary: dbPatient.phone_secondary,
        dateOfBirth: dbPatient.date_of_birth,
        age: null, // Will be calculated if needed
        gender: dbPatient.gender,
        addressStreet: dbPatient.address_street,
        addressCity: dbPatient.address_city,
        addressState: dbPatient.address_state,
        addressPostalCode: dbPatient.address_postal_code,
        addressCountry: dbPatient.address_country,
        fullAddress: null, // Will be computed if needed
        emergencyContactName: dbPatient.emergency_contact_name,
        emergencyContactPhone: dbPatient.emergency_contact_phone,
        emergencyContactRelationship: dbPatient.emergency_contact_relationship,
        medicalConditions: dbPatient.medical_history,
        medicationsCurrent: dbPatient.current_medications,
        allergies: dbPatient.allergies,
        anxietyLevel: dbPatient.anxiety_level,
        specialNeeds: dbPatient.special_needs,
        insuranceProvider: dbPatient.insurance_provider,
        policyNumber: dbPatient.insurance_policy_number, // Corrected field name
        insuranceGroupNumber: dbPatient.insurance_group_number,
        insuranceStatus: dbPatient.insurance_provider
          ? "private"
          : "no_insurance",
        consentToTreatment: dbPatient.consent_to_treatment || false,
        consentToContact: dbPatient.consent_to_contact || true,
        preferredContactMethod: dbPatient.preferred_contact_method,
        notes: dbPatient.notes,
        isActive: dbPatient.is_active,
        createdAt: dbPatient.created_at,
        updatedAt: dbPatient.updated_at,
        hasInsurance: !!dbPatient.insurance_provider,
        requiresSpecialCare: !!(
          dbPatient.special_needs || dbPatient.anxiety_level
        ),
      };

      return graphqlPatient;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("💥 Failed to create patient:", error as Error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * ✏️ Update patient
   */
  public async updatePatient(id: string, patientData: any): Promise<any> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
        UPDATE patients SET
          first_name = $1, last_name = $2, email = $3, phone_primary = $4, date_of_birth = $5,
          address_country = $6, medical_history = $7,
          updated_at = NOW()
        WHERE id = $8 AND deleted_at IS NULL
        RETURNING *
      `,
        [
          patientData.firstName || patientData.first_name,
          patientData.lastName || patientData.last_name,
          patientData.email,
          patientData.phone,
          patientData.dateOfBirth || patientData.date_of_birth,
          "México", // Default country
          patientData.medicalHistory || patientData.medical_history,
          id,
        ],
      );

      if (result.rows.length === 0) {
        throw new Error("Patient not found");
      }

      const patient = result.rows[0];

      await client.query("COMMIT");

      // Invalidate cache
      await this.invalidatePatientCache(id);

      // Emit real-time update
      await this.emitRealtimeUpdate("patients", "updated", patient);

      // 🔥 MAP DATABASE FIELDS TO GRAPHQL FORMAT
      return {
        id: patient.id,
        name: patient.name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown Patient',
        firstName: patient.first_name,
        lastName: patient.last_name,
        fullName: patient.name || `${patient.first_name} ${patient.last_name}`,
        email: patient.email,
        phone: patient.phone_primary,
        phoneSecondary: patient.phone_secondary,
        dateOfBirth: patient.date_of_birth,
        age: null,
        gender: patient.gender,
        addressStreet: patient.address_street,
        addressCity: patient.address_city,
        addressState: patient.address_state,
        addressPostalCode: patient.address_postal_code,
        addressCountry: patient.address_country,
        fullAddress: null,
        emergencyContactName: patient.emergency_contact_name,
        emergencyContactPhone: patient.emergency_contact_phone,
        emergencyContact: patient.emergency_contact_name && patient.emergency_contact_phone
          ? JSON.stringify({ name: patient.emergency_contact_name, phone: patient.emergency_contact_phone })
          : null,
        medicalConditions: patient.medical_conditions,
        medicationsCurrent: patient.current_medications,
        allergies: patient.allergies,
        anxietyLevel: patient.anxiety_level,
        insuranceProvider: patient.insurance_provider,
        insuranceStatus: patient.insurance_provider ? 'active' : 'no_insurance',
        policyNumber: patient.policy_number,
        medicalHistory: patient.medical_history,
        billingStatus: 'pending',
        consentToTreatment: patient.consent_to_treatment || false,
        consentToContact: patient.consent_to_contact !== false,
        isActive: patient.is_active !== false,
        createdAt: patient.created_at,
        updatedAt: patient.updated_at
      };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("💥 Failed to update patient:", error as Error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 🗑️ Delete patient (soft delete)
   */
  public async deletePatient(id: string): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
        UPDATE patients SET
          deleted_at = NOW(),
          updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id
      `,
        [id],
      );

      await client.query("COMMIT");

      if (result.rows.length === 0) {
        return false;
      }

      // Invalidate cache
      await this.invalidatePatientCache(id);

      // Emit real-time update
      await this.emitRealtimeUpdate("patients", "deleted", { id });

      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("💥 Failed to delete patient:", error as Error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 🗑️ Invalidate patient cache
   */
  private async invalidatePatientCache(patientId?: string): Promise<void> {
    try {
      const keys = await this.safeRedisOperation(
        () => this.getRedis().keys("patients:*"),
        [],
      );
      if (patientId) {
        keys.push(`patient:${patientId}`);
      }

      if (keys.length > 0) {
        await this.safeRedisOperation(() => this.getRedis().del(keys), undefined);
      }
    } catch (error) {
      console.warn(
        "⚠️ Failed to invalidate patient cache:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}