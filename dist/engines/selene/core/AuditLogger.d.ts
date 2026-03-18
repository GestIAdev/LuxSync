/**
 * 🎭 THE CHRONICLER - PHASE 3 AUDIT LOGGER
 * ============================================================================
 * File: selene/src/core/AuditLogger.ts
 * Created: November 10, 2025
 * Author: PunkClaude + Radwulf
 *
 * PHILOSOPHY:
 * The Guardian (VerificationEngine) prevents bad mutations.
 * The Chronicler (AuditLogger) records EVERYTHING that happens.
 *
 * This isn't logging for debug. This is forensics. This is history.
 * Every single mutation is tracked with before/after state.
 * Every cascade is traced. Every integrity violation is recorded.
 *
 * MISSION:
 * 1. Log every CREATE, UPDATE, DELETE, SOFT_DELETE mutation
 * 2. Record BEFORE and AFTER state in JSONB
 * 3. Track cascade operations and their impacts
 * 4. Log state transitions and integrity violations
 * 5. Support audit trail queries for compliance
 * 6. Enable recovery operations (UNDO)
 *
 * STATUS: PRODUCTION-READY
 * ============================================================================
 */
import { Pool } from 'pg';
/**
 * An audit log entry
 */
export interface AuditLogEntry {
    id?: string;
    entity_type: string;
    entity_id: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'SOFT_DELETE' | 'RESTORE' | 'BATCH' | 'BULK';
    old_values?: Record<string, any>;
    new_values?: Record<string, any>;
    changed_fields?: string[];
    user_id?: string;
    user_email?: string;
    ip_address?: string;
    integrity_status: 'VALID' | 'PASSED' | 'WARNED' | 'FAILED' | 'BLOCKED';
    violation_details?: Record<string, any>;
    cascade_parent_id?: string;
    cascade_parent_type?: string;
    affected_count?: number;
    transaction_id?: string;
    created_at?: string;
    duration_ms?: number;
}
/**
 * Batch operation result
 */
export interface BatchOperationResult {
    transaction_id: string;
    operation: string;
    total_count: number;
    success_count: number;
    failed_count: number;
    duration_ms: number;
    affected_entities: Array<{
        entity_type: string;
        entity_id: string;
    }>;
}
/**
 * Audit trail for an entity (history)
 */
export interface EntityAuditTrail {
    entity_type: string;
    entity_id: string;
    total_mutations: number;
    first_mutation: AuditLogEntry;
    last_mutation: AuditLogEntry;
    history: AuditLogEntry[];
    current_state?: Record<string, any>;
    state_transitions?: Array<{
        from: Record<string, any>;
        to: Record<string, any>;
        operation: string;
        timestamp: string;
        user_id?: string;
    }>;
}
/**
 * Cascade impact report
 */
export interface CascadeImpactReport {
    parent_entity_type: string;
    parent_entity_id: string;
    operation: string;
    affected_children: Array<{
        table: string;
        count: number;
        ids: string[];
    }>;
    total_affected: number;
    was_successful: boolean;
}
export declare class AuditLogger {
    private db;
    private batchLogs;
    private maxBatchSize;
    constructor(databaseConnection: Pool);
    /**
     * Log a simple CREATE mutation
     * For new entities coming into the world
     */
    logCreate(entityType: string, entityId: string, newValues: Record<string, any>, userId?: string, userEmail?: string, ipAddress?: string): Promise<AuditLogEntry>;
    /**
     * Log an UPDATE mutation with before/after tracking
     * The REAL before/after comparison happens here
     */
    logUpdate(entityType: string, entityId: string, oldValues: Record<string, any>, newValues: Record<string, any>, userId?: string, userEmail?: string, ipAddress?: string): Promise<AuditLogEntry>;
    /**
     * Log a DELETE mutation
     * HARD delete - entity is gone forever
     */
    logDelete(entityType: string, entityId: string, oldValues: Record<string, any>, userId?: string, userEmail?: string, ipAddress?: string): Promise<AuditLogEntry>;
    /**
     * Log a SOFT_DELETE mutation
     * Entity is marked deleted but data remains (for compliance/recovery)
     */
    logSoftDelete(entityType: string, entityId: string, deletedReason: string, oldValues: Record<string, any>, userId?: string, userEmail?: string, ipAddress?: string): Promise<AuditLogEntry>;
    /**
     * Log a RESTORE operation (soft delete recovery)
     */
    logRestore(entityType: string, entityId: string, oldValues: Record<string, any>, // Should have deleted_at, is_active=false
    userId?: string, userEmail?: string, ipAddress?: string): Promise<AuditLogEntry>;
    /**
     * Log CASCADE operation impact
     * When parent is deleted, what children are affected?
     */
    logCascadeOperation(parentType: string, parentId: string, cascadeImpact: Array<{
        table: string;
        count: number;
        ids: string[];
    }>, userId?: string, userEmail?: string, ipAddress?: string): Promise<CascadeImpactReport>;
    /**
     * Log STATE TRANSITION
     * Track status/state changes with context
     */
    logStateTransition(entityType: string, entityId: string, fromStatus: string, toStatus: string, contextData?: Record<string, any>, userId?: string, userEmail?: string, ipAddress?: string): Promise<AuditLogEntry>;
    /**
     * Log INTEGRITY VIOLATION
     * Something tried to violate a rule - record the attempt
     */
    logIntegrityViolation(entityType: string, entityId: string, fieldName: string, attemptedValue: any, violationReason: string, severity: 'WARNING' | 'ERROR' | 'CRITICAL', userId?: string, userEmail?: string, ipAddress?: string): Promise<AuditLogEntry>;
    /**
     * Log FIELD ACCESS (for sensitive fields)
     * Track who accessed what sensitive data
     */
    logFieldAccess(entityType: string, entityId: string, fieldName: string, operation: 'READ' | 'WRITE', userId?: string, userEmail?: string, ipAddress?: string, sensitivityLevel?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SECRET'): Promise<AuditLogEntry>;
    /**
     * Log BATCH OPERATION result
     * When multiple mutations happen in one transaction
     */
    logBatchOperation(batchResults: Array<{
        entity_type: string;
        entity_id: string;
        operation: string;
        success: boolean;
        error?: string;
    }>, userId?: string, userEmail?: string, ipAddress?: string): Promise<BatchOperationResult>;
    /**
     * CORE METHOD: Log any mutation to data_audit_logs
     * All other methods call this one
     */
    private logMutation;
    /**
     * Retrieve full audit trail for an entity
     * Shows complete history: CREATE -> UPDATE -> UPDATE -> DELETE
     */
    getEntityAuditTrail(entityType: string, entityId: string, limit?: number): Promise<EntityAuditTrail>;
    /**
     * Find all integrity violations in a time period
     * Useful for compliance audits
     */
    getIntegrityViolations(startDate?: Date, endDate?: Date, severity?: 'WARNING' | 'ERROR' | 'CRITICAL', limit?: number): Promise<AuditLogEntry[]>;
    /**
     * Get cascade operation impact report
     * Show what happened when a parent entity was deleted
     */
    getCascadeImpactReport(parentEntityType: string, parentEntityId: string): Promise<CascadeImpactReport | null>;
    /**
     * Get audit summary statistics
     * Good for dashboards: total mutations, by type, by user, etc.
     */
    getAuditSummary(startDate?: Date, endDate?: Date): Promise<Record<string, any>>;
    /**
     * Export audit logs to JSON
     * For compliance/archival purposes
     */
    exportToJSON(entityType?: string, startDate?: Date, endDate?: Date): Promise<string>;
    /**
     * Healthcheck - verify logging is working
     */
    healthcheck(): Promise<boolean>;
}
export declare function createAuditLogger(pool: Pool): AuditLogger;
export default AuditLogger;
//# sourceMappingURL=AuditLogger.d.ts.map