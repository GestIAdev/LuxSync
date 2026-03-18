/**
 * 🗄️ SELENE DATABASE - TOTAL CONTROL MODULE
 * By PunkClaude & RaulVisionario - September 18, 2025
 *
 * MISSION: Complete database control (PostgreSQL + Redis)
 * STRATEGY: Nuclear-powered data management
 */
import { Pool } from "pg";
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
/**
 * 🌟 SELENE DATABASE - THE DATA GOD
 * Complete control over PostgreSQL + Redis
 * Now acts as orchestrator delegating to specialized database classes
 */
export declare class SeleneDatabase {
    private pool;
    private redis;
    private isConnected;
    private isRedisConnected;
    private lastRedisCheck;
    private redisCheckInterval;
    private dbConfig;
    private cacheConfig;
    private redisConnectionId;
    appointments: AppointmentsDatabase;
    patients: PatientsDatabase;
    medicalRecords: MedicalRecordsDatabase;
    treatments: TreatmentsDatabase;
    documents: DocumentsDatabase;
    billing: BillingDatabase;
    inventory: InventoryDatabase;
    compliance: ComplianceDatabase;
    marketplace: MarketplaceDatabase;
    subscriptions: SubscriptionsDatabase;
    customCalendar: CustomCalendarDatabase;
    notifications: NotificationsDatabase;
    constructor();
    /**
     * 🔌 Initialize database connections
     */
    private initializeConnections;
    /**
     * 🚀 Connect to databases and initialize specialized classes
     */
    connect(): Promise<void>;
    /**
     * 🏗️ Initialize all specialized database classes
     */
    private initializeSpecializedDatabases;
    /**
     * 🔌 Disconnect from databases
     */
    disconnect(): Promise<void>;
    /**
     * ⚡ Safe Redis operation wrapper
     * 🔥 SANITACIÓN-QUIRÚRGICA: Updated for lazy initialization (Bug #2 fix)
     */
    private safeRedisOperation;
    /**
     * 🔥 Get Redis client (helper for null-safety)
     * 🔥 SANITACIÓN-QUIRÚRGICA: Helper method for lazy initialization (Bug #2 fix)
     */
    private getRedis;
    /**
     * 👥 Get all patients with nuclear efficiency (DEPRECATED - use database.patients.getPatients)
     */
    getPatients(filters?: any): Promise<any[]>;
    /**
     * 👤 Get patient by ID (DEPRECATED - use database.patients.getPatientById)
     */
    getPatientById(id: string): Promise<any>;
    /**
     * ➕ Create new patient (DEPRECATED - use database.patients.createPatient)
     */
    createPatient(patientData: any): Promise<any>;
    /**
     * ✏️ Update patient (DEPRECATED - use database.patients.updatePatient)
     */
    updatePatient(id: string, patientData: any): Promise<any>;
    /**
     * 🗑️ Delete patient (soft delete) (DEPRECATED - use database.patients.deletePatient)
     */
    deletePatient(id: string): Promise<boolean>;
    /**
     * 📅 Get all appointments (DEPRECATED - use database.appointments.getAppointments)
     */
    getAppointments(filters?: any): Promise<any[]>;
    /**
     * ➕ CREATE APPOINTMENT (DEPRECATED - use database.appointments.createAppointment)
     */
    createAppointment(appointmentData: any): Promise<any>;
    /**
     * ✏️ UPDATE APPOINTMENT (DEPRECATED - use database.appointments.updateAppointment)
     */
    updateAppointment(id: string, data: any): Promise<any>;
    /**
     * 🗑️ DELETE APPOINTMENT (DEPRECATED - use database.appointments.deleteAppointment)
     */
    deleteAppointment(id: string): Promise<boolean>;
    /**
     * 🩺 GET TREATMENTS (DEPRECATED - use database.treatments.getTreatments)
     */
    getTreatments(filters?: any): Promise<any[]>;
    /**
     * ➕ CREATE TREATMENT (DEPRECATED - use database.treatments.createTreatment)
     */
    createTreatment(data: any): Promise<any>;
    /**
     * ✏️ UPDATE TREATMENT (DEPRECATED - use database.treatments.updateTreatment)
     */
    updateTreatment(id: string, data: any): Promise<any>;
    /**
     * 🗑️ DELETE TREATMENT (DEPRECATED - use database.treatments.deleteTreatment)
     */
    deleteTreatment(id: string): Promise<boolean>;
    /**
     * 📄 GET DOCUMENTS (DEPRECATED - use database.documents.getDocuments)
     */
    getDocuments(filters?: any): Promise<any[]>;
    /**
     * ➕ CREATE DOCUMENT (DEPRECATED - use database.documents.createDocument)
     */
    createDocument(data: any): Promise<any>;
    /**
     * ✏️ UPDATE DOCUMENT (DEPRECATED - use database.documents.updateDocument)
     */
    updateDocument(id: string, data: any): Promise<any>;
    /**
     * 🗑️ DELETE DOCUMENT (DEPRECATED - use database.documents.deleteDocument)
     */
    deleteDocument(id: string): Promise<boolean>;
    /**
     * 🏥 GET MEDICAL RECORDS (DEPRECATED - use database.medicalRecords.getMedicalRecords)
     */
    getMedicalRecords(filters?: any): Promise<any[]>;
    /**
     * ➕ CREATE MEDICAL RECORD (DEPRECATED - use database.medicalRecords.createMedicalRecord)
     */
    createMedicalRecord(data: any): Promise<any>;
    /**
     * ✏️ UPDATE MEDICAL RECORD (DEPRECATED - use database.medicalRecords.updateMedicalRecord)
     */
    updateMedicalRecord(id: string, data: any): Promise<any>;
    /**
     * 🗑️ DELETE MEDICAL RECORD (DEPRECATED - use database.medicalRecords.deleteMedicalRecord)
     */
    deleteMedicalRecord(id: string): Promise<void>;
    /**
     * 🛡️ Get all data for Veritas verification (Merkle Tree building)
     */
    getAllDataForVerification(): Promise<any[]>;
    /**
     * 🛡️ Get data sample for continuous integrity monitoring
     */
    getDataSampleForVerification(): Promise<any[]>;
    /**
     * 🛡️ Get data for specific entity (for lazy Veritas loading)
     * 🎯 DIRECTIVA V164: VERITAS GLOBAL ENTITY HANDLER - OPTIMIZED FOR 34 BD TABLES
     */
    getDataForEntity(entity: string): Promise<any[]>;
    /**
     * 🎯 Convert table name to singular entity name
     */
    private getEntityNameFromTable;
    getDocumentsV3(args: {
        patientId?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    getDocumentV3ById(id: string): Promise<any>;
    getUnifiedDocumentsV3(args: {
        patientId?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    getUnifiedDocumentV3ById(id: string): Promise<any>;
    createDocumentV3(input: any): Promise<any>;
    updateDocumentV3(id: string, input: any): Promise<any>;
    deleteDocumentV3(id: string): Promise<void>;
    uploadUnifiedDocumentV3(input: any): Promise<any>;
    getBillingDataV3(args: {
        patientId?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    getBillingDatumV3ById(id: string): Promise<any>;
    createBillingDataV3(input: any): Promise<any>;
    updateBillingDataV3(id: string, input: any): Promise<any>;
    deleteBillingDataV3(id: string): Promise<void>;
    getCompliancesV3(args: {
        patientId?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    getComplianceV3ById(id: string): Promise<any>;
    createComplianceV3(input: any): Promise<any>;
    updateComplianceV3(id: string, input: any): Promise<any>;
    deleteComplianceV3(id: string): Promise<void>;
    getMedicalRecordsV3(args: {
        patientId?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    getMedicalRecordV3ById(id: string): Promise<any>;
    createMedicalRecordV3(input: any): Promise<any>;
    updateMedicalRecordV3(id: string, input: any): Promise<any>;
    deleteMedicalRecordV3(id: string): Promise<void>;
    getInventoriesV3(args: {
        limit?: number;
        offset?: number;
        category?: string;
    }): Promise<any[]>;
    getInventoryV3ById(id: string): Promise<any>;
    createInventoryV3(input: any): Promise<any>;
    updateInventoryV3(id: string, input: any): Promise<any>;
    deleteInventoryV3(id: string): Promise<void>;
    adjustInventoryStockV3(id: string, adjustment: number, reason: string): Promise<any>;
    getMaterialsV3(args: {
        limit?: number;
        offset?: number;
        category?: string;
        supplierId?: string;
    }): Promise<any[]>;
    getMaterialV3ById(id: string): Promise<any>;
    createMaterialV3(input: any): Promise<any>;
    updateMaterialV3(id: string, input: any): Promise<any>;
    deleteMaterialV3(id: string): Promise<void>;
    reorderMaterialV3(materialId: string, quantity: number, supplierId?: string): Promise<any>;
    getInventoryDashboardV3(): Promise<any>;
    getInventoryAlertsV3(args: {
        limit?: number;
    }): Promise<any[]>;
    acknowledgeInventoryAlertV3(alertId: string): Promise<void>;
    getSupplierById(id: string): Promise<any>;
    getMaterialSuppliersV3(materialId: string): Promise<any[]>;
    getMaterialStockLevelsV3(materialId: string): Promise<any[]>;
    getEquipmentsV3(args: {
        limit?: number;
        offset?: number;
        category?: string;
        status?: string;
    }): Promise<any[]>;
    getEquipmentV3ById(id: string): Promise<any>;
    createEquipmentV3(input: any): Promise<any>;
    updateEquipmentV3(id: string, input: any): Promise<any>;
    deleteEquipmentV3(id: string): Promise<void>;
    getMaintenancesV3(args: {
        equipmentId?: string;
        limit?: number;
        offset?: number;
        status?: string;
    }): Promise<any[]>;
    getMaintenanceV3ById(id: string): Promise<any>;
    createMaintenanceV3(input: any): Promise<any>;
    updateMaintenanceV3(id: string, input: any): Promise<any>;
    completeMaintenanceV3(id: string, completionNotes?: string): Promise<any>;
    scheduleMaintenanceV3(equipmentId: string, scheduledDate: string, maintenanceType: string, description?: string): Promise<any>;
    cancelMaintenanceV3(id: string, reason?: string): Promise<void>;
    getEquipmentMaintenanceScheduleV3(equipmentId: string): Promise<any[]>;
    getMaintenanceHistoryV3(args: {
        equipmentId: string;
        limit?: number;
    }): Promise<any[]>;
    getEquipmentCurrentStatusV3(equipmentId: string): Promise<any>;
    getEquipmentNextMaintenanceDueV3(equipmentId: string): Promise<string | null>;
    getUserById(id: string): Promise<any>;
    getSuppliersV3(args: {
        limit?: number;
        offset?: number;
        category?: string;
        status?: string;
    }): Promise<any[]>;
    getSupplierV3ById(id: string): Promise<any>;
    createSupplierV3(input: any): Promise<any>;
    updateSupplierV3(id: string, input: any): Promise<any>;
    deleteSupplierV3(id: string): Promise<void>;
    getPurchaseOrdersV3(args: {
        supplierId?: string;
        limit?: number;
        offset?: number;
        status?: string;
    }): Promise<any[]>;
    getPurchaseOrderV3ById(id: string): Promise<any>;
    createPurchaseOrderV3(input: any): Promise<any>;
    updatePurchaseOrderV3(id: string, input: any): Promise<any>;
    approvePurchaseOrderV3(id: string, approverId: string): Promise<any>;
    cancelPurchaseOrderV3(id: string, reason?: string): Promise<any>;
    receivePurchaseOrderV3(id: string, receivedBy: string): Promise<any>;
    getPurchaseOrderItemsV3(purchaseOrderId: string): Promise<any[]>;
    getPurchaseOrderItemV3ById(id: string): Promise<any>;
    addPurchaseOrderItemV3(purchaseOrderId: string, input: any): Promise<any>;
    updatePurchaseOrderItemV3(id: string, input: any): Promise<any>;
    removePurchaseOrderItemV3(id: string): Promise<void>;
    updatePurchaseOrderTotalV3(purchaseOrderId: string): Promise<void>;
    getSupplierPurchaseOrdersV3(args: {
        supplierId: string;
        limit?: number;
    }): Promise<any[]>;
    getSupplierMaterialsV3(supplierId: string): Promise<any[]>;
    getSupplierTotalOrdersV3(supplierId: string): Promise<number>;
    getSupplierTotalSpentV3(supplierId: string): Promise<number>;
    getMarketplaceProductsV3(args: {
        supplierId?: string;
        category?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    getMarketplaceProductV3(id: string): Promise<any>;
    deletePurchaseOrderV3(id: string): Promise<void>;
    addToCartV3(input: any): Promise<any>;
    updateCartItemV3(id: string, input: any): Promise<any>;
    removeFromCartV3(id: string): Promise<void>;
    clearCartV3(): Promise<void>;
    getCartItemsV3(args: {
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    getSubscriptionPlansV3(args: {
        activeOnly?: boolean;
    }): Promise<any[]>;
    getSubscriptionPlanV3ById(id: string): Promise<any>;
    getSubscriptionPlanFeaturesV3(planId: string): Promise<any[]>;
    createSubscriptionPlanV3(input: any): Promise<any>;
    updateSubscriptionPlanV3(id: string, input: any): Promise<any>;
    getSubscriptionsV3(args: {
        patientId?: string;
        status?: string;
        planId?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    getSubscriptionV3ById(id: string): Promise<any>;
    createSubscriptionV3(input: any): Promise<any>;
    updateSubscriptionV3(id: string, input: any): Promise<any>;
    cancelSubscriptionV3(id: string, reason?: string): Promise<void>;
    renewSubscriptionV3(id: string): Promise<any>;
    getBillingCyclesV3(args: {
        subscriptionId?: string;
        status?: string;
        dateFrom?: string;
        dateTo?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    processBillingCycleV3(subscriptionId: string): Promise<any>;
    getUsageTrackingV3(args: {
        subscriptionId?: string;
        dateFrom?: string;
        dateTo?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    trackServiceUsageV3(input: any): Promise<any>;
    getCustomCalendarViewsV3(args: {
        userId?: string;
    }): Promise<any[]>;
    getCustomCalendarViewV3ById(id: string): Promise<any>;
    createCustomCalendarViewV3(input: any): Promise<any>;
    updateCustomCalendarViewV3(id: string, input: any): Promise<any>;
    deleteCustomCalendarViewV3(id: string): Promise<void>;
    getCalendarSettingsV3(userId: string): Promise<any>;
    updateCalendarSettingsV3(userId: string, settings: any): Promise<any>;
    getCalendarFiltersV3(userId: string): Promise<any[]>;
    createCalendarFilterV3(input: any): Promise<any>;
    updateCalendarFilterV3(id: string, input: any): Promise<any>;
    deleteCalendarFilterV3(id: string): Promise<void>;
    getCalendarEventsV3(args: {
        userId?: string;
        startDate?: string;
        endDate?: string;
        eventType?: string;
    }): Promise<any[]>;
    createCalendarEventV3(input: any): Promise<any>;
    updateCalendarEventV3(id: string, input: any): Promise<any>;
    deleteCalendarEventV3(id: string): Promise<void>;
    setDefaultCalendarViewV3(userId: string, viewId: string): Promise<void>;
    getCalendarFilterV3ById(id: string): Promise<any>;
    getCalendarEventV3ById(id: string): Promise<any>;
    getCalendarAvailabilityV3(userId: string, date: string): Promise<any[]>;
    toggleCalendarFilterV3(filterId: string): Promise<any>;
    /**
     * 🗑️ Invalidate patient cache
     */
    private invalidatePatientCache;
    /**
     * 🗑️ Invalidate appointment cache
     */
    private invalidateAppointmentCache;
    /**
     * 📡 Emit real-time updates
     */
    private emitRealtimeUpdate;
    /**
     * 📊 Get database status
     */
    getStatus(): Promise<any>;
    /**
     * 🔧 Execute raw query (for advanced operations)
     */
    executeQuery(_query: string, _params?: any[]): Promise<any>;
    /**
     * 📊 Get database statistics
     */
    getStatistics(): Promise<any>;
    /**
     * 🔌 Get database connection pool (for specialized database layers like AuditDatabase)
     */
    getPool(): Pool;
}
//# sourceMappingURL=Database.d.ts.map