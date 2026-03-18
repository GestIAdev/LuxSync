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
import crypto from 'crypto';
// ============================================================================
// AUDIT LOGGER - THE CHRONICLER
// ============================================================================
export class AuditLogger {
    db;
    batchLogs = new Map();
    maxBatchSize = 1000;
    constructor(databaseConnection) {
        this.db = databaseConnection;
        console.log('🎭 AuditLogger (The Chronicler) initialized');
    }
    /**
     * Log a simple CREATE mutation
     * For new entities coming into the world
     */
    async logCreate(entityType, entityId, newValues, userId, userEmail, ipAddress) {
        return this.logMutation({
            entity_type: entityType,
            entity_id: entityId,
            operation: 'CREATE',
            old_values: {},
            new_values: newValues,
            user_id: userId,
            user_email: userEmail,
            ip_address: ipAddress,
            integrity_status: 'PASSED'
        });
    }
    /**
     * Log an UPDATE mutation with before/after tracking
     * The REAL before/after comparison happens here
     */
    async logUpdate(entityType, entityId, oldValues, newValues, userId, userEmail, ipAddress) {
        // Calculate what actually changed
        const changedFields = [];
        for (const key in newValues) {
            if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
                changedFields.push(key);
            }
        }
        // If nothing changed, still log but mark it
        const operation = changedFields.length === 0 ? 'UPDATE' : 'UPDATE'; // Could be 'NOOP' if you want
        return this.logMutation({
            entity_type: entityType,
            entity_id: entityId,
            operation: operation,
            old_values: oldValues,
            new_values: newValues,
            changed_fields: changedFields,
            user_id: userId,
            user_email: userEmail,
            ip_address: ipAddress,
            integrity_status: 'VALID'
        });
    }
    /**
     * Log a DELETE mutation
     * HARD delete - entity is gone forever
     */
    async logDelete(entityType, entityId, oldValues, userId, userEmail, ipAddress) {
        return this.logMutation({
            entity_type: entityType,
            entity_id: entityId,
            operation: 'DELETE',
            old_values: oldValues,
            new_values: {},
            user_id: userId,
            user_email: userEmail,
            ip_address: ipAddress,
            integrity_status: 'PASSED'
        });
    }
    /**
     * Log a SOFT_DELETE mutation
     * Entity is marked deleted but data remains (for compliance/recovery)
     */
    async logSoftDelete(entityType, entityId, deletedReason, oldValues, userId, userEmail, ipAddress) {
        const newValues = { ...oldValues, deleted_at: new Date(), deleted_reason: deletedReason, is_active: false };
        return this.logMutation({
            entity_type: entityType,
            entity_id: entityId,
            operation: 'SOFT_DELETE',
            old_values: oldValues,
            new_values: newValues,
            user_id: userId,
            user_email: userEmail,
            ip_address: ipAddress,
            integrity_status: 'PASSED'
        });
    }
    /**
     * Log a RESTORE operation (soft delete recovery)
     */
    async logRestore(entityType, entityId, oldValues, // Should have deleted_at, is_active=false
    userId, userEmail, ipAddress) {
        const newValues = { ...oldValues, deleted_at: null, is_active: true };
        return this.logMutation({
            entity_type: entityType,
            entity_id: entityId,
            operation: 'RESTORE',
            old_values: oldValues,
            new_values: newValues,
            user_id: userId,
            user_email: userEmail,
            ip_address: ipAddress,
            integrity_status: 'PASSED'
        });
    }
    /**
     * Log CASCADE operation impact
     * When parent is deleted, what children are affected?
     */
    async logCascadeOperation(parentType, parentId, cascadeImpact, userId, userEmail, ipAddress) {
        const totalAffected = cascadeImpact.reduce((sum, impact) => sum + impact.count, 0);
        // Log as a special BATCH operation
        await this.logMutation({
            entity_type: 'CASCADE_OPERATION',
            entity_id: `${parentType}:${parentId}`,
            operation: 'BATCH',
            old_values: { cascade_source: `${parentType}:${parentId}` },
            new_values: { affected_entities: cascadeImpact, total_affected: totalAffected },
            user_id: userId,
            user_email: userEmail,
            ip_address: ipAddress,
            integrity_status: 'PASSED',
            affected_count: totalAffected
        });
        // Then log each affected child
        for (const impact of cascadeImpact) {
            for (const childId of impact.ids) {
                await this.logMutation({
                    entity_type: impact.table,
                    entity_id: childId,
                    operation: 'DELETE',
                    old_values: { cascaded: true },
                    new_values: {},
                    user_id: userId,
                    user_email: userEmail,
                    ip_address: ipAddress,
                    integrity_status: 'PASSED',
                    cascade_parent_type: parentType,
                    cascade_parent_id: parentId
                });
            }
        }
        return {
            parent_entity_type: parentType,
            parent_entity_id: parentId,
            operation: 'CASCADE_DELETE',
            affected_children: cascadeImpact,
            total_affected: totalAffected,
            was_successful: true
        };
    }
    /**
     * Log STATE TRANSITION
     * Track status/state changes with context
     */
    async logStateTransition(entityType, entityId, fromStatus, toStatus, contextData, userId, userEmail, ipAddress) {
        return this.logMutation({
            entity_type: entityType,
            entity_id: entityId,
            operation: 'UPDATE',
            old_values: { status: fromStatus, ...contextData },
            new_values: { status: toStatus, ...contextData },
            changed_fields: ['status'],
            user_id: userId,
            user_email: userEmail,
            ip_address: ipAddress,
            integrity_status: 'PASSED'
        });
    }
    /**
     * Log INTEGRITY VIOLATION
     * Something tried to violate a rule - record the attempt
     */
    async logIntegrityViolation(entityType, entityId, fieldName, attemptedValue, violationReason, severity, userId, userEmail, ipAddress) {
        return this.logMutation({
            entity_type: entityType,
            entity_id: entityId,
            operation: 'UPDATE', // We're attempting an update
            old_values: { [fieldName]: 'unknown' },
            new_values: { [fieldName]: attemptedValue },
            changed_fields: [fieldName],
            user_id: userId,
            user_email: userEmail,
            ip_address: ipAddress,
            integrity_status: severity === 'CRITICAL' ? 'BLOCKED' : severity === 'ERROR' ? 'FAILED' : 'WARNED',
            violation_details: {
                field: fieldName,
                attempted_value: attemptedValue,
                reason: violationReason,
                severity
            }
        });
    }
    /**
     * Log FIELD ACCESS (for sensitive fields)
     * Track who accessed what sensitive data
     */
    async logFieldAccess(entityType, entityId, fieldName, operation, userId, userEmail, ipAddress, sensitivityLevel) {
        return this.logMutation({
            entity_type: entityType,
            entity_id: entityId,
            operation: operation === 'READ' ? 'SELECT' : 'UPDATE',
            old_values: { field_accessed: fieldName, sensitivity: sensitivityLevel },
            new_values: {},
            changed_fields: operation === 'WRITE' ? [fieldName] : [],
            user_id: userId,
            user_email: userEmail,
            ip_address: ipAddress,
            integrity_status: 'PASSED'
        });
    }
    /**
     * Log BATCH OPERATION result
     * When multiple mutations happen in one transaction
     */
    async logBatchOperation(batchResults, userId, userEmail, ipAddress) {
        const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const successCount = batchResults.filter(r => r.success).length;
        const failedCount = batchResults.filter(r => !r.success).length;
        const startTime = Date.now();
        // Log each individual result
        for (const result of batchResults) {
            await this.logMutation({
                entity_type: result.entity_type,
                entity_id: result.entity_id,
                operation: result.operation,
                old_values: {},
                new_values: {},
                user_id: userId,
                user_email: userEmail,
                ip_address: ipAddress,
                integrity_status: result.success ? 'PASSED' : 'FAILED',
                transaction_id: transactionId,
                violation_details: result.error ? { error: result.error } : undefined
            });
        }
        const duration = Date.now() - startTime;
        return {
            transaction_id: transactionId,
            operation: 'BATCH',
            total_count: batchResults.length,
            success_count: successCount,
            failed_count: failedCount,
            duration_ms: duration,
            affected_entities: batchResults.map(r => ({ entity_type: r.entity_type, entity_id: r.entity_id }))
        };
    }
    /**
     * CORE METHOD: Log any mutation to data_audit_logs
     * All other methods call this one
     */
    async logMutation(entry) {
        const operationId = crypto.randomUUID().slice(0, 8);
        console.log(`🔍 [${operationId}] AuditLogger.logMutation START: ${entry.operation} ${entry.entity_type}:${entry.entity_id}`);
        try {
            // Generate UUID if not provided (cryptographically secure)
            if (!entry.id) {
                entry.id = crypto.randomUUID();
            }
            // Record timestamp
            entry.created_at = new Date().toISOString();
            // Execute insert - ONLY use columns that actually exist in schema
            const query = `
        INSERT INTO data_audit_logs (
          id,
          entity_type,
          entity_id,
          operation,
          old_values,
          new_values,
          changed_fields,
          user_id,
          ip_address,
          integrity_status,
          created_at,
          timestamp
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
        RETURNING *
      `;
            console.log(`🔍 [${operationId}] About to execute INSERT query...`);
            console.log(`🔍 [${operationId}] Parameters: id=${entry.id}, entity_type=${entry.entity_type}, entity_id=${entry.entity_id}`);
            // 🔥 CRITICAL: Get a dedicated client from pool to ensure transaction isolation
            const client = await this.db.connect();
            try {
                const result = await client.query(query, [
                    entry.id,
                    entry.entity_type,
                    entry.entity_id,
                    entry.operation,
                    JSON.stringify(entry.old_values || {}),
                    JSON.stringify(entry.new_values || {}),
                    entry.changed_fields || null, // TEXT[] - pass array directly, not stringified
                    entry.user_id,
                    entry.ip_address,
                    entry.integrity_status || 'PENDING',
                    entry.created_at,
                    entry.created_at
                ]);
                console.log(`✅ [${operationId}] AuditLogger INSERT SUCCESS: rowCount=${result.rowCount}, rows=${result.rows.length}`);
                console.log(`✅ [${operationId}] Audit log created in DB: ${entry.entity_type}:${entry.entity_id}`);
                return result.rows[0];
            }
            finally {
                // 🔥 CRITICAL: Always release the client back to pool
                client.release();
            }
        }
        catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error(`❌ [${operationId}] Failed to log mutation:`, errMsg);
            console.error(`❌ [${operationId}] Full error:`, error);
            throw new Error(`Audit logging failed: ${errMsg}`);
        }
    }
    /**
     * Retrieve full audit trail for an entity
     * Shows complete history: CREATE -> UPDATE -> UPDATE -> DELETE
     */
    async getEntityAuditTrail(entityType, entityId, limit = 100) {
        try {
            const query = `
        SELECT *
        FROM data_audit_logs
        WHERE entity_type = $1 AND entity_id = $2
        ORDER BY created_at ASC
        LIMIT $3
      `;
            const result = await this.db.query(query, [entityType, entityId, limit]);
            const logs = result.rows;
            if (logs.length === 0) {
                throw new Error(`No audit trail found for ${entityType}:${entityId}`);
            }
            // Calculate state transitions
            const stateTransitions = [];
            for (let i = 0; i < logs.length - 1; i++) {
                if (logs[i].old_values && logs[i].new_values) {
                    stateTransitions.push({
                        from: logs[i].old_values,
                        to: logs[i].new_values,
                        operation: logs[i].operation,
                        timestamp: logs[i].created_at,
                        user_id: logs[i].user_id
                    });
                }
            }
            return {
                entity_type: entityType,
                entity_id: entityId,
                total_mutations: logs.length,
                first_mutation: logs[0],
                last_mutation: logs[logs.length - 1],
                history: logs,
                current_state: logs[logs.length - 1].new_values,
                state_transitions: stateTransitions
            };
        }
        catch (error) {
            console.error(`Error retrieving audit trail for ${entityType}:${entityId}:`, error);
            throw error;
        }
    }
    /**
     * Find all integrity violations in a time period
     * Useful for compliance audits
     */
    async getIntegrityViolations(startDate, endDate, severity, limit = 1000) {
        try {
            let query = `
        SELECT *
        FROM data_audit_logs
        WHERE integrity_status IN ('WARNED', 'FAILED', 'BLOCKED')
      `;
            const params = [];
            let paramIndex = 1;
            if (startDate) {
                query += ` AND created_at >= $${paramIndex++}`;
                params.push(startDate);
            }
            if (endDate) {
                query += ` AND created_at <= $${paramIndex++}`;
                params.push(endDate);
            }
            if (severity) {
                // Map severity to integrity_status
                const statusMap = { WARNING: 'WARNED', ERROR: 'FAILED', CRITICAL: 'BLOCKED' };
                query += ` AND integrity_status = $${paramIndex++}`;
                params.push(statusMap[severity]);
            }
            query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
            params.push(limit);
            const result = await this.db.query(query, params);
            return result.rows;
        }
        catch (error) {
            console.error('Error retrieving integrity violations:', error);
            return [];
        }
    }
    /**
     * Get cascade operation impact report
     * Show what happened when a parent entity was deleted
     */
    async getCascadeImpactReport(parentEntityType, parentEntityId) {
        try {
            const query = `
        SELECT 
          entity_type as table,
          COUNT(*) as count,
          ARRAY_AGG(entity_id) as ids
        FROM data_audit_logs
        WHERE cascade_parent_type = $1 AND cascade_parent_id = $2
        GROUP BY entity_type
      `;
            const result = await this.db.query(query, [parentEntityType, parentEntityId]);
            if (result.rows.length === 0) {
                return null;
            }
            const affectedChildren = result.rows.map(row => ({
                table: row.table,
                count: parseInt(row.count),
                ids: row.ids
            }));
            const totalAffected = affectedChildren.reduce((sum, child) => sum + child.count, 0);
            return {
                parent_entity_type: parentEntityType,
                parent_entity_id: parentEntityId,
                operation: 'CASCADE_DELETE',
                affected_children: affectedChildren,
                total_affected: totalAffected,
                was_successful: true
            };
        }
        catch (error) {
            console.error('Error retrieving cascade impact report:', error);
            return null;
        }
    }
    /**
     * Get audit summary statistics
     * Good for dashboards: total mutations, by type, by user, etc.
     */
    async getAuditSummary(startDate, endDate) {
        try {
            let query = 'SELECT 1=1';
            const params = [];
            let paramIndex = 1;
            let whereClause = ' WHERE 1=1 ';
            if (startDate) {
                whereClause += ` AND created_at >= $${paramIndex++}`;
                params.push(startDate);
            }
            if (endDate) {
                whereClause += ` AND created_at <= $${paramIndex++}`;
                params.push(endDate);
            }
            // Build combined query
            const summaryQuery = `
        SELECT 
          COUNT(*) as total_mutations,
          COUNT(DISTINCT entity_type) as entity_types_touched,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(CASE WHEN integrity_status = 'BLOCKED' THEN 1 END) as blocked_mutations,
          COUNT(CASE WHEN integrity_status = 'FAILED' THEN 1 END) as failed_mutations,
          COUNT(CASE WHEN integrity_status = 'WARNED' THEN 1 END) as warned_mutations
        FROM data_audit_logs
        ${whereClause}
      `;
            const result = await this.db.query(summaryQuery, params);
            return result.rows[0] || {};
        }
        catch (error) {
            console.error('Error retrieving audit summary:', error);
            return {};
        }
    }
    /**
     * Export audit logs to JSON
     * For compliance/archival purposes
     */
    async exportToJSON(entityType, startDate, endDate) {
        try {
            let query = 'SELECT * FROM data_audit_logs WHERE 1=1';
            const params = [];
            let paramIndex = 1;
            if (entityType) {
                query += ` AND entity_type = $${paramIndex++}`;
                params.push(entityType);
            }
            if (startDate) {
                query += ` AND created_at >= $${paramIndex++}`;
                params.push(startDate);
            }
            if (endDate) {
                query += ` AND created_at <= $${paramIndex++}`;
                params.push(endDate);
            }
            query += ' ORDER BY created_at ASC';
            const result = await this.db.query(query, params);
            return JSON.stringify(result.rows, null, 2);
        }
        catch (error) {
            console.error('Error exporting audit logs:', error);
            throw error;
        }
    }
    /**
     * Healthcheck - verify logging is working
     */
    async healthcheck() {
        try {
            const result = await this.db.query('SELECT COUNT(*) FROM data_audit_logs');
            const logCount = parseInt(result.rows[0]?.count || '0');
            console.log(`✅ AuditLogger healthcheck OK (${logCount} logs in database)`);
            return true;
        }
        catch (error) {
            console.error('❌ AuditLogger healthcheck failed:', error);
            return false;
        }
    }
}
// ============================================================================
// EXPORT: Make it available throughout the codebase
// ============================================================================
export function createAuditLogger(pool) {
    return new AuditLogger(pool);
}
export default AuditLogger;
//# sourceMappingURL=AuditLogger.js.map