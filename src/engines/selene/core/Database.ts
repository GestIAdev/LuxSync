/**
 * 🗄️ SELENE DATABASE - TOTAL CONTROL MODULE
 * By PunkClaude & RaulVisionario - September 18, 2025
 *
 * MISSION: Complete database control (PostgreSQL + Redis)
 * STRATEGY: Nuclear-powered data management
 */

import { Pool } from "pg";
import { RedisClientType } from "redis";
import { redisManager } from "../RedisConnectionManager.js";

// Import specialized database classes
import { AppointmentsDatabase } from "./database/AppointmentsDatabase.js";
import { PatientsDatabase } from "./database/PatientsDatabase.js";
import { MedicalRecordsDatabase } from "./database/MedicalRecordsDatabase.js";
import { TreatmentsDatabase } from "./database/TreatmentsDatabase.js";
import { DocumentsDatabase } from "./database/DocumentsDatabase.js";
import { BillingDatabase } from "./database/BillingDatabase.js";
import { InventoryDatabase } from "./database/InventoryDatabase.js";
import { ComplianceDatabase } from "./database/ComplianceDatabase.js";
import { MarketplaceDatabase } from "./database/MarketplaceDatabase.js";
import { SubscriptionsDatabase } from "./database/SubscriptionsDatabase.js";
import { CustomCalendarDatabase } from "./database/CustomCalendarDatabase.js";
import { NotificationsDatabase } from "./database/NotificationsDatabase.js";

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
}

interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
}

/**
 * 🌟 SELENE DATABASE - THE DATA GOD
 * Complete control over PostgreSQL + Redis
 * Now acts as orchestrator delegating to specialized database classes
 */
export class SeleneDatabase {
  private pool!: Pool;
  private redis!: RedisClientType | null; // 🔥 SANITACIÓN-QUIRÚRGICA: Allow null for lazy init
  private isConnected: boolean = false;
  private isRedisConnected: boolean = false;
  private lastRedisCheck: number = 0;
  private redisCheckInterval: number = 30000; // Check Redis every 30 seconds
  private dbConfig: DatabaseConfig;
  private cacheConfig: CacheConfig;
  private redisConnectionId: string;

  // Specialized database instances
  public appointments!: AppointmentsDatabase;
  public patients!: PatientsDatabase;
  public medicalRecords!: MedicalRecordsDatabase;
  public treatments!: TreatmentsDatabase;
  public documents!: DocumentsDatabase;
  public billing!: BillingDatabase;
  public inventory!: InventoryDatabase;
  public compliance!: ComplianceDatabase;
  public marketplace!: MarketplaceDatabase;
  public subscriptions!: SubscriptionsDatabase;
  public customCalendar!: CustomCalendarDatabase;
  public notifications!: NotificationsDatabase;

  constructor() {
    console.log("🗄️ Initializing Selene Database...");

    this.dbConfig = {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "dentiagest",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "11111111",
      ssl: process.env.DB_SSL === "true",
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || "20"),
    };

    this.cacheConfig = {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || "0"),
    };

    // 🔥 SANITACIÓN-QUIRÚRGICA: Lazy init - DON'T create Redis client here (Bug #2 race condition fix)
    // 🔥 SANITACIÓN-QUIRÚRGICA FIX: REUSE client from waitForRedis() with unique node ID
    this.redis = null; // Initialize as null

    this.redisConnectionId = `selene-startup-${"selene-node"}`; // Unique per node: selene-startup-selene-node-1/2/3

    this.initializeConnections();
  }

  /**
   * 🔌 Initialize database connections
   */
  private async initializeConnections(): Promise<void> {
    try {
      // PostgreSQL connection
      this.pool = new Pool({
        host: this.dbConfig.host,
        port: this.dbConfig.port,
        database: this.dbConfig.database,
        user: this.dbConfig.user,
        password: this.dbConfig.password,
        ssl: this.dbConfig.ssl,
        max: this.dbConfig.maxConnections,
      });

      console.log("✅ Database connections initialized");
    } catch (error) {
      console.error("💥 Failed to initialize database connections:", error as Error);
      throw error;
    }
  }

  /**
   * 🚀 Connect to databases and initialize specialized classes
   */
  public async connect(): Promise<void> {
    try {
      console.log("🔌 Connecting to databases...");

      // Test PostgreSQL connection
      const client = await this.pool.connect();
      await client.query("SELECT 1");
      client.release();
      console.log("✅ PostgreSQL connected");

      // 🔥 SANITACIÓN-QUIRÚRGICA FIX v2: REUSE existing client to avoid ECONNRESET
      if (!this.redis) {
        const existingClient = redisManager.getRedisClient(this.redisConnectionId);

        if (existingClient) {
          this.redis = existingClient;
          console.log(`🔌 Redis client REUSED from pool: ${this.redisConnectionId}`);
        } else {
          this.redis = redisManager.createRedisClient(this.redisConnectionId);
          console.log(`🔌 Redis client created (lazy init): ${this.redisConnectionId}`);

          // Connect explicitly
          try {
            const isConnected = await redisManager.ensureConnection(
              this.redis,
              this.redisConnectionId,
            );
            if (isConnected) {
              console.log("✅ Redis connected via RedisConnectionManager");
            } else {
              console.warn("⚠️ Redis connection failed, continuing without cache");
            }
          } catch (redisError) {
            console.warn(
              "⚠️ Redis connection failed, continuing without cache:",
              redisError instanceof Error ? redisError.message : String(redisError),
            );
          }
        }
      }

      // Initialize specialized database classes
      this.initializeSpecializedDatabases();

      this.isConnected = true;
      console.log("🎯 Selene Database operational (Redis optional)");
    } catch (error) {
      console.error("💥 Database connection failed:", error as Error);
      throw error;
    }
  }

  /**
   * 🏗️ Initialize all specialized database classes
   */
  private initializeSpecializedDatabases(): void {
    console.log("🏗️ Initializing specialized database classes...");

    // Create instances of all specialized databases - NOW WITH REDIS! 🔥
    this.appointments = new AppointmentsDatabase(this.pool, this.redis);
    this.patients = new PatientsDatabase(this.pool, this.redis);
    this.medicalRecords = new MedicalRecordsDatabase(this.pool, this.redis);
    this.treatments = new TreatmentsDatabase(this.pool, this.redis);
    this.documents = new DocumentsDatabase(this.pool, this.redis);
    this.billing = new BillingDatabase(this.pool, this.redis);
    this.inventory = new InventoryDatabase(this.pool, this.redis);
    this.compliance = new ComplianceDatabase(this.pool, this.redis);
    this.marketplace = new MarketplaceDatabase(this.pool, this.redis);
    this.subscriptions = new SubscriptionsDatabase(this.pool, this.redis);
    this.customCalendar = new CustomCalendarDatabase(this.pool, this.redis);
    this.notifications = new NotificationsDatabase(this.pool, this.redis); // 🔔 NOTIFICATIONS V3

    console.log("✅ All specialized database classes initialized WITH REDIS");
  }

  /**
   * 🔌 Disconnect from databases
   */
  public async disconnect(): Promise<void> {
    try {
      console.log("🔌 Disconnecting from databases...");

      await this.pool.end();
      await redisManager.closeConnection(this.redisConnectionId);

      this.isConnected = false;
      console.log("✅ Databases disconnected");
    } catch (error) {
      console.error("💥 Database disconnection error:", error as Error);
    }
  }

  /**
   * ⚡ Safe Redis operation wrapper
   * 🔥 SANITACIÓN-QUIRÚRGICA: Updated for lazy initialization (Bug #2 fix)
   */
  private async safeRedisOperation(
    _operation: () => Promise<any>,
    fallback: any = null,
  ): Promise<any> {
    try {
      // 🔥 Guard: If Redis not initialized yet, return fallback (cache miss)
      if (!this.redis) {
        console.warn("⚠️ Redis not initialized, skipping cache operation");
        return fallback;
      }
      return await _operation();
    } catch (error) {
      console.warn(
        "⚠️ Redis operation failed, continuing without cache:",
        error instanceof Error ? error.message : String(error),
      );
      return fallback;
    }
  }

  /**
   * 🔥 Get Redis client (helper for null-safety)
   * 🔥 SANITACIÓN-QUIRÚRGICA: Helper method for lazy initialization (Bug #2 fix)
   */
  private getRedis(): RedisClientType {
    if (!this.redis) {
      throw new Error("Redis client not initialized - call connect() first");
    }
    return this.redis;
  }

  // ============================================================================
  // DEPRECATED METHODS - MAINTAINED FOR BACKWARD COMPATIBILITY
  // These delegate to specialized database classes
  // ============================================================================

  /**
   * 👥 Get all patients with nuclear efficiency (DEPRECATED - use database.patients.getPatients)
   */
  public async getPatients(filters?: any): Promise<any[]> {
    return this.patients.getPatients(filters);
  }

  /**
   * 👤 Get patient by ID (DEPRECATED - use database.patients.getPatientById)
   */
  public async getPatientById(id: string): Promise<any> {
    return this.patients.getPatientById(id);
  }

  /**
   * ➕ Create new patient (DEPRECATED - use database.patients.createPatient)
   */
  public async createPatient(patientData: any): Promise<any> {
    return this.patients.createPatient(patientData);
  }

  /**
   * ✏️ Update patient (DEPRECATED - use database.patients.updatePatient)
   */
  public async updatePatient(id: string, patientData: any): Promise<any> {
    return this.patients.updatePatient(id, patientData);
  }

  /**
   * 🗑️ Delete patient (soft delete) (DEPRECATED - use database.patients.deletePatient)
   */
  public async deletePatient(id: string): Promise<boolean> {
    await this.patients.deletePatient(id);
    return true;
  }

  /**
   * 📅 Get all appointments (DEPRECATED - use database.appointments.getAppointments)
   */
  public async getAppointments(filters?: any): Promise<any[]> {
    return this.appointments.getAppointments(filters);
  }

  /**
   * ➕ CREATE APPOINTMENT (DEPRECATED - use database.appointments.createAppointment)
   */
  public async createAppointment(appointmentData: any): Promise<any> {
    return this.appointments.createAppointment(appointmentData);
  }

  /**
   * ✏️ UPDATE APPOINTMENT (DEPRECATED - use database.appointments.updateAppointment)
   */
  public async updateAppointment(id: string, data: any): Promise<any> {
    return this.appointments.updateAppointment(id, data);
  }

  /**
   * 🗑️ DELETE APPOINTMENT (DEPRECATED - use database.appointments.deleteAppointment)
   */
  public async deleteAppointment(id: string): Promise<boolean> {
    await this.appointments.deleteAppointment(id);
    return true;
  }

  /**
   * 🩺 GET TREATMENTS (DEPRECATED - use database.treatments.getTreatments)
   */
  public async getTreatments(filters?: any): Promise<any[]> {
    return this.treatments.getTreatments(filters);
  }

  /**
   * ➕ CREATE TREATMENT (DEPRECATED - use database.treatments.createTreatment)
   */
  public async createTreatment(data: any): Promise<any> {
    return this.treatments.createTreatment(data);
  }

  /**
   * ✏️ UPDATE TREATMENT (DEPRECATED - use database.treatments.updateTreatment)
   */
  public async updateTreatment(id: string, data: any): Promise<any> {
    return this.treatments.updateTreatment(id, data);
  }

  /**
   * 🗑️ DELETE TREATMENT (DEPRECATED - use database.treatments.deleteTreatment)
   */
  public async deleteTreatment(id: string): Promise<boolean> {
    await this.treatments.deleteTreatment(id);
    return true;
  }

  /**
   * 📄 GET DOCUMENTS (DEPRECATED - use database.documents.getDocuments)
   */
  public async getDocuments(filters?: any): Promise<any[]> {
    return this.documents.getDocuments(filters);
  }

  /**
   * ➕ CREATE DOCUMENT (DEPRECATED - use database.documents.createDocument)
   */
  public async createDocument(data: any): Promise<any> {
    return this.documents.createDocument(data);
  }

  /**
   * ✏️ UPDATE DOCUMENT (DEPRECATED - use database.documents.updateDocument)
   */
  public async updateDocument(id: string, data: any): Promise<any> {
    return this.documents.updateDocument(id, data);
  }

  /**
   * 🗑️ DELETE DOCUMENT (DEPRECATED - use database.documents.deleteDocument)
   */
  public async deleteDocument(id: string): Promise<boolean> {
    await this.documents.deleteDocument(id);
    return true;
  }

  /**
   * 🏥 GET MEDICAL RECORDS (DEPRECATED - use database.medicalRecords.getMedicalRecords)
   */
  public async getMedicalRecords(filters?: any): Promise<any[]> {
    return this.medicalRecords.getMedicalRecords(filters);
  }

  /**
   * ➕ CREATE MEDICAL RECORD (DEPRECATED - use database.medicalRecords.createMedicalRecord)
   */
  public async createMedicalRecord(data: any): Promise<any> {
    return this.medicalRecords.createMedicalRecord(data);
  }

  /**
   * ✏️ UPDATE MEDICAL RECORD (DEPRECATED - use database.medicalRecords.updateMedicalRecord)
   */
  public async updateMedicalRecord(id: string, data: any): Promise<any> {
    return this.medicalRecords.updateMedicalRecord(id, data);
  }

  /**
   * 🗑️ DELETE MEDICAL RECORD (DEPRECATED - use database.medicalRecords.deleteMedicalRecord)
   */
  public async deleteMedicalRecord(id: string): Promise<void> {
    await this.medicalRecords.deleteMedicalRecord(id);
  }

  // ============================================================================
  // VERITAS & UTILITY METHODS - PRESERVED
  // ============================================================================

  /**
   * 🛡️ Get all data for Veritas verification (Merkle Tree building)
   */
  public async getAllDataForVerification(): Promise<any[]> {
    try {
      // Get data from all main tables
      const tables = [
        "patients",
        "appointments",
        "medical_records",
        "documents",
      ];

      const allData: any[] = [];
      const MAX_ALL_RECORDS = 1000; // 🔥 AGRESSIVE LIMIT: Max 1000 records total for verification

      for (const table of tables) {
        try {
          const result = await this.pool.query(
            `SELECT * FROM ${table} LIMIT 100`,
          ); // Reduced from unlimited
          result.rows.forEach((row) => {
            // 🔥 AGRESSIVE MEMORY LIMIT: Check total size
            if (allData.length >= MAX_ALL_RECORDS) {
              return; // Stop adding more records
            }

            allData.push({
              table,
              id: row.id,
              data: row,
              entity: table.slice(0, -1), // Remove 's' from table name
            });
          });
        } catch (error) {
          // Table might not exist, continue
          console.log(`⚠️ Table ${table} not found for verification`);
        }
      }

      return allData;
    } catch (error) {
      console.error("💥 Failed to get data for verification:", error as Error);
      throw error;
    }
  }

  /**
   * 🛡️ Get data sample for continuous integrity monitoring
   */
  public async getDataSampleForVerification(): Promise<any[]> {
    try {
      // Get sample of recent data from all tables (last 100 records each)
      const tables = [
        "patients",
        "appointments",
        "medical_records",
        "documents",
      ];

      const sampleData: any[] = [];
      const MAX_SAMPLE_RECORDS = 200; // 🔥 AGGRESSIVE LIMIT: Max 200 records total for sample

      for (const table of tables) {
        try {
          const result = await this.pool.query(`
            SELECT * FROM ${table}
            ORDER BY COALESCE(updated_at, created_at, now()) DESC
            LIMIT 20
          `);

          result.rows.forEach((row) => {
            // 🔥 AGGRESSIVE MEMORY LIMIT: Check total sample size
            if (sampleData.length >= MAX_SAMPLE_RECORDS) {
              return; // Stop adding more records
            }

            sampleData.push({
              table,
              id: row.id,
              data: row,
              entity: table.slice(0, -1), // Remove 's' from table name
              timestamp: row.created_at || row.updated_at || new Date(),
            });
          });
        } catch (error) {
          // Table might not exist, continue
          console.log(`⚠️ Table ${table} not found for sample verification`);
        }
      }

      return sampleData;
    } catch (error) {
      console.error("💥 Failed to get data sample for verification:", error as Error);
      throw error;
    }
  }

  /**
   * 🛡️ Get data for specific entity (for lazy Veritas loading)
   * 🎯 DIRECTIVA V164: VERITAS GLOBAL ENTITY HANDLER - OPTIMIZED FOR 34 BD TABLES
   */
  public async getDataForEntity(entity: string): Promise<any[]> {
    try {
      // Special handling for 'global' entity - combine data from populated tables only
      if (entity === "global") {
        console.log(
          "🌍 VERITAS GLOBAL REQUEST: Scanning 34 BD tables for data...",
        );

        // Core tables with guaranteed data
        const coreTables = [
          "patients",
          "appointments",
          "medical_records",
          "treatments",
          "users",
          "medical_documents",
          "mouth_scans",
          "odontogramas",
          "odontograma_teeth",
          "tooth_3d_models",
          "treatment_categories",
          "treatment_types",
          "treatment_rooms",
          "dental_equipment",
          "dental_materials",
          "auto_order_rules",
          "suppliers",
          "viewer_sessions",
          "viewer_settings",
          "treatment_materials",
        ];

        let globalData: any[] = [];
        let processedTables = 0;
        const MAX_GLOBAL_RECORDS = 500; // 🔥 AGGRESSIVE LIMIT: Max 500 records total for global entity

        for (const table of coreTables) {
          try {
            const result = await this.pool.query(
              `SELECT * FROM ${table} LIMIT 50`,
            ); // Limit for performance
            if (result.rows.length > 0) {
              const tableData = result.rows.map((row) => ({
                table: table,
                id: row.id,
                data: row,
                entity: this.getEntityNameFromTable(table),
                timestamp: row.created_at || row.updated_at || new Date(),
              }));

              // 🔥 AGGRESSIVE MEMORY LIMIT: Check if adding would exceed total limit
              if (globalData.length + tableData.length > MAX_GLOBAL_RECORDS) {
                const remainingSlots = MAX_GLOBAL_RECORDS - globalData.length;
                if (remainingSlots > 0) {
                  globalData = globalData.concat(
                    tableData.slice(0, remainingSlots),
                  );
                  console.log(
                    `⚠️ ${table}: Limited to ${remainingSlots} records (global limit reached)`,
                  );
                } else {
                  console.log(
                    `🚫 ${table}: Skipped (global limit of ${MAX_GLOBAL_RECORDS} reached)`,
                  );
                }
                break; // Stop processing further tables
              } else {
                globalData = globalData.concat(tableData);
                processedTables++;
                console.log(`✅ ${table}: Added ${tableData.length} records`);
              }
            } else {
              console.log(`⚪ ${table}: Empty, skipped`);
            }
          } catch (tableError) {
            console.log(
              `⚠️ ${table}: Access error, skipped - ${tableError instanceof Error ? tableError.message : String(tableError)}`,
            );
          }
        }

        console.log(
          `🎯 VERITAS GLOBAL: Combined ${globalData.length} records from ${processedTables} tables`,
        );
        return globalData;
      }

      // Map entity names to table names for specific entities
      const tableMap: { [key: string]: string } = {
        patient: "patients",
        appointment: "appointments",
        medical_record: "medical_records",
        document: "documents",
        treatment: "treatments",
        user: "users",
        medical_document: "medical_documents",
        mouth_scan: "mouth_scans",
        tooth_3d_model: "tooth_3d_models",
        odontograma: "odontogramas",
      };

      const tableName = tableMap[entity] || entity;

      const result = await this.pool.query(`SELECT * FROM ${tableName}`);

      return result.rows.map((row) => ({
        table: tableName,
        id: row.id,
        data: row,
        entity: entity,
        timestamp: row.created_at || row.updated_at || new Date(),
      }));
    } catch (error) {
      console.error(`💥 Failed to get data for entity ${entity}:`, error as Error);
      // Return empty array instead of throwing to prevent Veritas failures
      return [];
    }
  }

  /**
   * 🎯 Convert table name to singular entity name
   */
  private getEntityNameFromTable(tableName: string): string {
    const entityMap: { [key: string]: string } = {
      patients: "patient",
      appointments: "appointment",
      medical_records: "medical_record",
      treatments: "treatment",
      users: "user",
      medical_documents: "medical_document",
      mouth_scans: "mouth_scan",
      odontogramas: "odontograma",
      odontograma_teeth: "odontograma_tooth",
      tooth_3d_models: "tooth_3d_model",
      treatment_categories: "treatment_category",
      treatment_types: "treatment_type",
      treatment_rooms: "treatment_room",
      dental_equipment: "dental_equipment",
      dental_materials: "dental_material",
      auto_order_rules: "auto_order_rule",
      suppliers: "supplier",
      viewer_sessions: "viewer_session",
      viewer_settings: "viewer_setting",
      treatment_materials: "treatment_material",
    };

    return entityMap[tableName] || tableName.slice(0, -1); // fallback: remove 's'
  }

  // ============================================================================
  // V3 METHODS - DELEGATE TO SPECIALIZED CLASSES
  // ============================================================================

  // DOCUMENTS V3 METHODS
  async getDocumentsV3(args: { patientId?: string; limit?: number; offset?: number; }): Promise<any[]> {
    return this.documents.getDocumentsV3(args);
  }

  async getDocumentV3ById(id: string): Promise<any> {
    return this.documents.getDocumentV3ById(id);
  }

  async getUnifiedDocumentsV3(args: { patientId?: string; limit?: number; offset?: number; }): Promise<any[]> {
    return this.documents.getUnifiedDocumentsV3(args);
  }

  async getUnifiedDocumentV3ById(id: string): Promise<any> {
    return this.documents.getUnifiedDocumentV3ById(id);
  }

  async createDocumentV3(input: any): Promise<any> {
    return this.documents.createDocumentV3(input);
  }

  async updateDocumentV3(id: string, input: any): Promise<any> {
    return this.documents.updateDocumentV3(id, input);
  }

  async deleteDocumentV3(id: string): Promise<void> {
    return this.documents.deleteDocumentV3(id);
  }

  async uploadUnifiedDocumentV3(input: any): Promise<any> {
    return this.documents.uploadUnifiedDocumentV3(input);
  }

  // BILLING V3 METHODS
  async getBillingDataV3(args: { patientId?: string; limit?: number; offset?: number; }): Promise<any[]> {
    return this.billing.getBillingDataV3(args);
  }

  async getBillingDatumV3ById(id: string): Promise<any> {
    return this.billing.getBillingDatumV3ById(id);
  }

  async createBillingDataV3(input: any): Promise<any> {
    return this.billing.createBillingDataV3(input);
  }

  async updateBillingDataV3(id: string, input: any): Promise<any> {
    return this.billing.updateBillingDataV3(id, input);
  }

  async deleteBillingDataV3(id: string): Promise<void> {
    return this.billing.deleteBillingDataV3(id);
  }

  // COMPLIANCE V3 METHODS
  async getCompliancesV3(args: { patientId?: string; limit?: number; offset?: number; }): Promise<any[]> {
    return this.compliance.getCompliancesV3(args);
  }

  async getComplianceV3ById(id: string): Promise<any> {
    return this.compliance.getComplianceV3ById(id);
  }

  async createComplianceV3(input: any): Promise<any> {
    return this.compliance.createComplianceV3(input);
  }

  async updateComplianceV3(id: string, input: any): Promise<any> {
    return this.compliance.updateComplianceV3(id, input);
  }

  async deleteComplianceV3(id: string): Promise<void> {
    return this.compliance.deleteComplianceV3(id);
  }

  // MEDICAL RECORDS V3 METHODS
  async getMedicalRecordsV3(args: { patientId?: string; limit?: number; offset?: number; }): Promise<any[]> {
    return this.medicalRecords.getMedicalRecordsV3(args);
  }

  async getMedicalRecordV3ById(id: string): Promise<any> {
    return this.medicalRecords.getMedicalRecordV3ById(id);
  }

  async createMedicalRecordV3(input: any): Promise<any> {
    return this.medicalRecords.createMedicalRecordV3(input);
  }

  async updateMedicalRecordV3(id: string, input: any): Promise<any> {
    return this.medicalRecords.updateMedicalRecordV3(id, input);
  }

  async deleteMedicalRecordV3(id: string): Promise<void> {
    return this.medicalRecords.deleteMedicalRecordV3(id);
  }

  // INVENTORY V3 METHODS
  async getInventoriesV3(args: { limit?: number; offset?: number; category?: string; }): Promise<any[]> {
    return this.inventory.getInventoriesV3(args);
  }

  async getInventoryV3ById(id: string): Promise<any> {
    return this.inventory.getInventoryV3ById(id);
  }

  async createInventoryV3(input: any): Promise<any> {
    return this.inventory.createInventoryV3(input);
  }

  async updateInventoryV3(id: string, input: any): Promise<any> {
    return this.inventory.updateInventoryV3(id, input);
  }

  async deleteInventoryV3(id: string): Promise<void> {
    return this.inventory.deleteInventoryV3(id);
  }

  async adjustInventoryStockV3(id: string, adjustment: number, reason: string): Promise<any> {
    return this.inventory.adjustInventoryStockV3(id, adjustment, reason);
  }

  // MATERIALS V3 METHODS
  async getMaterialsV3(args: { limit?: number; offset?: number; category?: string; supplierId?: string; }): Promise<any[]> {
    return this.inventory.getMaterialsV3(args);
  }

  async getMaterialV3ById(id: string): Promise<any> {
    return this.inventory.getMaterialV3ById(id);
  }

  async createMaterialV3(input: any): Promise<any> {
    return this.inventory.createMaterialV3(input);
  }

  async updateMaterialV3(id: string, input: any): Promise<any> {
    return this.inventory.updateMaterialV3(id, input);
  }

  async deleteMaterialV3(id: string): Promise<void> {
    return this.inventory.deleteMaterialV3(id);
  }

  async reorderMaterialV3(materialId: string, quantity: number, supplierId?: string): Promise<any> {
    return this.inventory.reorderMaterialV3(materialId, quantity, supplierId);
  }

  // DASHBOARD & ALERTS METHODS
  async getInventoryDashboardV3(): Promise<any> {
    return this.inventory.getInventoryDashboardV3();
  }

  async getInventoryAlertsV3(args: { limit?: number; }): Promise<any[]> {
    return this.inventory.getInventoryAlertsV3(args);
  }

  async acknowledgeInventoryAlertV3(alertId: string): Promise<void> {
    return this.inventory.acknowledgeInventoryAlertV3(alertId);
  }

  // HELPER METHODS FOR FIELD RESOLVERS
  async getSupplierById(id: string): Promise<any> {
    return this.inventory.getSupplierById(id);
  }

  async getMaterialSuppliersV3(materialId: string): Promise<any[]> {
    return this.inventory.getMaterialSuppliersV3(materialId);
  }

  async getMaterialStockLevelsV3(materialId: string): Promise<any[]> {
    return this.inventory.getMaterialStockLevelsV3(materialId);
  }

  // EQUIPMENT V3 METHODS
  async getEquipmentsV3(args: { limit?: number; offset?: number; category?: string; status?: string; }): Promise<any[]> {
    return this.inventory.getEquipmentsV3(args);
  }

  async getEquipmentV3ById(id: string): Promise<any> {
    return this.inventory.getEquipmentV3ById(id);
  }

  async createEquipmentV3(input: any): Promise<any> {
    return this.inventory.createEquipmentV3(input);
  }

  async updateEquipmentV3(id: string, input: any): Promise<any> {
    return this.inventory.updateEquipmentV3(id, input);
  }

  async deleteEquipmentV3(id: string): Promise<void> {
    return this.inventory.deleteEquipmentV3(id);
  }

  // MAINTENANCE V3 METHODS
  async getMaintenancesV3(args: { equipmentId?: string; limit?: number; offset?: number; status?: string; }): Promise<any[]> {
    return this.inventory.getMaintenancesV3(args);
  }

  async getMaintenanceV3ById(id: string): Promise<any> {
    return this.inventory.getMaintenanceV3ById(id);
  }

  async createMaintenanceV3(input: any): Promise<any> {
    return this.inventory.createMaintenanceV3(input);
  }

  async updateMaintenanceV3(id: string, input: any): Promise<any> {
    return this.inventory.updateMaintenanceV3(id, input);
  }

  async completeMaintenanceV3(id: string, completionNotes?: string): Promise<any> {
    return this.inventory.completeMaintenanceV3(id, completionNotes);
  }

  async scheduleMaintenanceV3(equipmentId: string, scheduledDate: string, maintenanceType: string, description?: string): Promise<any> {
    return this.inventory.scheduleMaintenanceV3(equipmentId, scheduledDate, maintenanceType, description);
  }

  async cancelMaintenanceV3(id: string, reason?: string): Promise<void> {
    return this.inventory.cancelMaintenanceV3(id, reason);
  }

  // EQUIPMENT MAINTENANCE HELPER METHODS
  async getEquipmentMaintenanceScheduleV3(equipmentId: string): Promise<any[]> {
    return this.inventory.getEquipmentMaintenanceScheduleV3(equipmentId);
  }

  async getMaintenanceHistoryV3(args: { equipmentId: string; limit?: number; }): Promise<any[]> {
    return this.inventory.getMaintenanceHistoryV3(args);
  }

  async getEquipmentCurrentStatusV3(equipmentId: string): Promise<any> {
    return this.inventory.getEquipmentCurrentStatusV3(equipmentId);
  }

  async getEquipmentNextMaintenanceDueV3(equipmentId: string): Promise<string | null> {
    return this.inventory.getEquipmentNextMaintenanceDueV3(equipmentId);
  }

  // USER HELPER METHOD
  async getUserById(id: string): Promise<any> {
    return this.inventory.getUserById(id);
  }

  // SUPPLIERS V3 METHODS
  async getSuppliersV3(args: { limit?: number; offset?: number; category?: string; status?: string; }): Promise<any[]> {
    return this.inventory.getSuppliersV3(args);
  }

  async getSupplierV3ById(id: string): Promise<any> {
    return this.inventory.getSupplierV3ById(id);
  }

  async createSupplierV3(input: any): Promise<any> {
    return this.inventory.createSupplierV3(input);
  }

  async updateSupplierV3(id: string, input: any): Promise<any> {
    return this.inventory.updateSupplierV3(id, input);
  }

  async deleteSupplierV3(id: string): Promise<void> {
    return this.inventory.deleteSupplierV3(id);
  }

  // PURCHASE ORDERS V3 METHODS
  async getPurchaseOrdersV3(args: { supplierId?: string; limit?: number; offset?: number; status?: string; }): Promise<any[]> {
    return this.inventory.getPurchaseOrdersV3(args);
  }

  async getPurchaseOrderV3ById(id: string): Promise<any> {
    return this.inventory.getPurchaseOrderV3ById(id);
  }

  async createPurchaseOrderV3(input: any): Promise<any> {
    return this.inventory.createPurchaseOrderV3(input);
  }

  async updatePurchaseOrderV3(id: string, input: any): Promise<any> {
    return this.inventory.updatePurchaseOrderV3(id, input);
  }

  async approvePurchaseOrderV3(id: string, approverId: string): Promise<any> {
    return this.inventory.approvePurchaseOrderV3(id, approverId);
  }

  async cancelPurchaseOrderV3(id: string, reason?: string): Promise<any> {
    return this.inventory.cancelPurchaseOrderV3(id, reason);
  }

  async receivePurchaseOrderV3(id: string, receivedBy: string): Promise<any> {
    return this.inventory.receivePurchaseOrderV3(id, receivedBy);
  }

  // PURCHASE ORDER ITEMS V3 METHODS
  async getPurchaseOrderItemsV3(purchaseOrderId: string): Promise<any[]> {
    return this.inventory.getPurchaseOrderItemsV3(purchaseOrderId);
  }

  async getPurchaseOrderItemV3ById(id: string): Promise<any> {
    return this.inventory.getPurchaseOrderItemV3ById(id);
  }

  async addPurchaseOrderItemV3(purchaseOrderId: string, input: any): Promise<any> {
    return this.inventory.addPurchaseOrderItemV3(purchaseOrderId, input);
  }

  async updatePurchaseOrderItemV3(id: string, input: any): Promise<any> {
    return this.inventory.updatePurchaseOrderItemV3(id, input);
  }

  async removePurchaseOrderItemV3(id: string): Promise<void> {
    return this.inventory.removePurchaseOrderItemV3(id);
  }

  // PURCHASE ORDER HELPER METHODS
  async updatePurchaseOrderTotalV3(purchaseOrderId: string): Promise<void> {
    return this.inventory.updatePurchaseOrderTotalV3(purchaseOrderId);
  }

  // SUPPLIER HELPER METHODS
  async getSupplierPurchaseOrdersV3(args: { supplierId: string; limit?: number; }): Promise<any[]> {
    return this.inventory.getSupplierPurchaseOrdersV3(args);
  }

  async getSupplierMaterialsV3(supplierId: string): Promise<any[]> {
    return this.inventory.getSupplierMaterialsV3(supplierId);
  }

  async getSupplierTotalOrdersV3(supplierId: string): Promise<number> {
    return this.inventory.getSupplierTotalOrdersV3(supplierId);
  }

  async getSupplierTotalSpentV3(supplierId: string): Promise<number> {
    return this.inventory.getSupplierTotalSpentV3(supplierId);
  }

  // MARKETPLACE V3 METHODS
  async getMarketplaceProductsV3(args: { supplierId?: string; category?: string; limit?: number; offset?: number; }): Promise<any[]> {
    return this.marketplace.getMarketplaceProductsV3(args);
  }

  async getMarketplaceProductV3(id: string): Promise<any> {
    return this.marketplace.getMarketplaceProductV3(id);
  }

  async deletePurchaseOrderV3(id: string): Promise<void> {
    return this.inventory.deletePurchaseOrderV3(id);
  }

  async addToCartV3(input: any): Promise<any> {
    return this.marketplace.addToCartV3(input);
  }

  async updateCartItemV3(id: string, input: any): Promise<any> {
    return this.marketplace.updateCartItemV3(id, input);
  }

  async removeFromCartV3(id: string): Promise<void> {
    return this.marketplace.removeFromCartV3(id);
  }

  async clearCartV3(): Promise<void> {
    return this.marketplace.clearCartV3();
  }

  async getCartItemsV3(args: { limit?: number; offset?: number; }): Promise<any[]> {
    return this.marketplace.getCartItemsV3(args);
  }

  // SUBSCRIPTIONS V3 METHODS
  async getSubscriptionPlansV3(args: { activeOnly?: boolean; }): Promise<any[]> {
    return this.subscriptions.getSubscriptionPlansV3({ isActive: args.activeOnly });
  }

  async getSubscriptionPlanV3ById(id: string): Promise<any> {
    return this.subscriptions.getSubscriptionPlanV3ById(id);
  }

  async getSubscriptionPlanFeaturesV3(planId: string): Promise<any[]> {
    return this.subscriptions.getSubscriptionPlanFeaturesV3(planId);
  }

  async createSubscriptionPlanV3(input: any): Promise<any> {
    return this.subscriptions.createSubscriptionPlanV3(input);
  }

  async updateSubscriptionPlanV3(id: string, input: any): Promise<any> {
    return this.subscriptions.updateSubscriptionPlanV3(id, input);
  }

  async getSubscriptionsV3(args: { patientId?: string; status?: string; planId?: string; limit?: number; offset?: number; }): Promise<any[]> {
    return this.subscriptions.getSubscriptionsV3(args);
  }

  async getSubscriptionV3ById(id: string): Promise<any> {
    return this.subscriptions.getSubscriptionV3ById(id);
  }

  async createSubscriptionV3(input: any): Promise<any> {
    return this.subscriptions.createSubscriptionV3(input);
  }

  async updateSubscriptionV3(id: string, input: any): Promise<any> {
    return this.subscriptions.updateSubscriptionV3(id, input);
  }

  async cancelSubscriptionV3(id: string, reason?: string): Promise<void> {
    // Note: reason parameter is ignored in current implementation
    await this.subscriptions.cancelSubscriptionV3(id, false);
  }

  async renewSubscriptionV3(id: string): Promise<any> {
    return this.subscriptions.reactivateSubscriptionV3(id);
  }

  async getBillingCyclesV3(args: { subscriptionId?: string; status?: string; dateFrom?: string; dateTo?: string; limit?: number; offset?: number; }): Promise<any[]> {
    return this.subscriptions.getBillingCyclesV3(args);
  }

  async processBillingCycleV3(subscriptionId: string): Promise<any> {
    return this.subscriptions.processBillingCycleV3(subscriptionId);
  }

  async getUsageTrackingV3(args: { subscriptionId?: string; dateFrom?: string; dateTo?: string; limit?: number; offset?: number; }): Promise<any[]> {
    return this.subscriptions.getUsageTrackingV3(args);
  }

  async trackServiceUsageV3(input: any): Promise<any> {
    return this.subscriptions.trackServiceUsageV3(input);
  }

  // CUSTOM CALENDAR V3 METHODS
  async getCustomCalendarViewsV3(args: { userId?: string; }): Promise<any[]> {
    return this.customCalendar.getCustomCalendarViewsV3(args);
  }

  async getCustomCalendarViewV3ById(id: string): Promise<any> {
    return this.customCalendar.getCustomCalendarViewV3ById(id);
  }

  async createCustomCalendarViewV3(input: any): Promise<any> {
    return this.customCalendar.createCustomCalendarViewV3(input);
  }

  async updateCustomCalendarViewV3(id: string, input: any): Promise<any> {
    return this.customCalendar.updateCustomCalendarViewV3(id, input);
  }

  async deleteCustomCalendarViewV3(id: string): Promise<void> {
    return this.customCalendar.deleteCustomCalendarViewV3(id);
  }

  async getCalendarSettingsV3(userId: string): Promise<any> {
    return this.customCalendar.getCalendarSettingsV3(userId);
  }

  async updateCalendarSettingsV3(userId: string, settings: any): Promise<any> {
    return this.customCalendar.updateCalendarSettingsV3(userId, settings);
  }

  async getCalendarFiltersV3(userId: string): Promise<any[]> {
    return this.customCalendar.getCalendarFiltersV3({ userId });
  }

  async createCalendarFilterV3(input: any): Promise<any> {
    return this.customCalendar.createCalendarFilterV3(input);
  }

  async updateCalendarFilterV3(id: string, input: any): Promise<any> {
    return this.customCalendar.updateCalendarFilterV3(id, input);
  }

  async deleteCalendarFilterV3(id: string): Promise<void> {
    return this.customCalendar.deleteCalendarFilterV3(id);
  }

  async getCalendarEventsV3(args: { userId?: string; startDate?: string; endDate?: string; eventType?: string; }): Promise<any[]> {
    const convertedArgs = {
      ...args,
      startDate: args.startDate ? new Date(args.startDate) : undefined,
      endDate: args.endDate ? new Date(args.endDate) : undefined,
    };
    return this.customCalendar.getCalendarEventsV3(convertedArgs);
  }

  async createCalendarEventV3(input: any): Promise<any> {
    return this.customCalendar.createCalendarEventV3(input);
  }

  async updateCalendarEventV3(id: string, input: any): Promise<any> {
    return this.customCalendar.updateCalendarEventV3(id, input);
  }

  async deleteCalendarEventV3(id: string): Promise<void> {
    return this.customCalendar.deleteCalendarEventV3(id);
  }

  // ADDITIONAL CUSTOMCALENDAR METHODS
  async setDefaultCalendarViewV3(userId: string, viewId: string): Promise<void> {
    return this.customCalendar.setDefaultCalendarViewV3(userId, viewId);
  }

  async getCalendarFilterV3ById(id: string): Promise<any> {
    return this.customCalendar.getCalendarFilterV3ById(id);
  }

  async getCalendarEventV3ById(id: string): Promise<any> {
    return this.customCalendar.getCalendarEventV3ById(id);
  }

  async getCalendarAvailabilityV3(userId: string, date: string): Promise<any[]> {
    return this.customCalendar.getCalendarAvailabilityV3(userId, date);
  }

  async toggleCalendarFilterV3(filterId: string): Promise<any> {
    return this.customCalendar.toggleCalendarFilterV3(filterId);
  }

  // ============================================================================
  // UTILITY METHODS - PRESERVED
  // ============================================================================

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
        await this.safeRedisOperation(() => this.getRedis().del(keys));
      }
    } catch (error) {
      console.warn(
        "⚠️ Failed to invalidate patient cache:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * 🗑️ Invalidate appointment cache
   */
  private async invalidateAppointmentCache(): Promise<void> {
    try {
      const keys = await this.getRedis().keys("appointments:*");
      if (keys.length > 0) {
        await this.getRedis().del(keys);
      }
    } catch (error) {
      console.error("⚠️ Failed to invalidate appointment cache:", error as Error);
    }
  }

  /**
   * 📡 Emit real-time updates
   */
  private async emitRealtimeUpdate(
    _room: string,
    _event: string,
    _data: any,
  ): Promise<void> {
    try {
      // This will be connected to Socket.IO in the main server
      await this.safeRedisOperation(() =>
        this.getRedis().publish(
          `realtime:${_room}`,
          JSON.stringify({
            _event,
            _data,
            timestamp: new Date().toISOString(),
          }),
        ),
      );
    } catch (error) {
      console.warn(
        "⚠️ Failed to emit realtime update:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * 📊 Get database status
   */
  public async getStatus(): Promise<any> {
    try {
      // Test PostgreSQL
      const pgClient = await this.pool.connect();
      await pgClient.query("SELECT 1");
      pgClient.release();

      // Test Redis with throttling - don't spam console
      let redisStatus = "disconnected";
      const now = Date.now();

      if (now - this.lastRedisCheck > this.redisCheckInterval) {
        try {
          // 🔥 SANITACIÓN-QUIRÚRGICA: DON'T try ensureConnection if Redis client doesn't exist yet
          if (!this.redis) {
            redisStatus = "initializing";
            this.isRedisConnected = false;
          } else {
            // Ensure Redis connection before ping
            const isConnected = await redisManager.ensureConnection(
              this.redis,
              this.redisConnectionId,
            );
            if (isConnected) {
              await this.getRedis().ping();
              redisStatus = "connected";
              this.isRedisConnected = true;
            } else {
              redisStatus = "disconnected";
              this.isRedisConnected = false;
            }
          }
        } catch (error) {
          this.isRedisConnected = false;
          console.warn(
            "⚠️ Redis ping failed:",
            error instanceof Error ? error.message : String(error),
          );
        }
        this.lastRedisCheck = now;
      } else {
        // Use cached status
        redisStatus = this.isRedisConnected ? "connected" : "disconnected";
      }

      return {
        connected: true,
        postgresql: "connected",
        redis: redisStatus,
        connectionPool: {
          total: this.pool.totalCount,
          idle: this.pool.idleCount,
          waiting: this.pool.waitingCount,
        },
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error",
        postgresql: "disconnected",
        redis: "disconnected",
      };
    }
  }

  /**
   * 🔧 Execute raw query (for advanced operations)
   */
  public async executeQuery(_query: string, _params?: any[]): Promise<any> {
    try {
      const result = await this.pool.query(_query, _params);
      return { rows: result.rows };
    } catch (error) {
      console.error("💥 Query execution failed:", error as Error);
      throw error;
    }
  }

  /**
   * 📊 Get database statistics
   */
  public async getStatistics(): Promise<any> {
    try {
      const stats = await this.pool.query(`
        SELECT
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes
        FROM pg_stat_user_tables
        ORDER BY schemaname, tablename
      `);

      return {
        tables: stats.rows,
        connectionPool: {
          total: this.pool.totalCount,
          idle: this.pool.idleCount,
          waiting: this.pool.waitingCount,
        },
      };
    } catch (error) {
      console.error("💥 Failed to get statistics:", error as Error);
      throw error;
    }
  }

  /**
   * 🔌 Get database connection pool (for specialized database layers like AuditDatabase)
   */
  public getPool(): Pool {
    return this.pool;
  }
}