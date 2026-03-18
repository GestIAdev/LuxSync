/**
 * 🔥 THE GUARDIAN OF INTEGRITY - PHASE 3 VERIFICATION ENGINE
 * ============================================================================
 * File: selene/src/core/VerificationEngine.ts
 * Created: November 10, 2025
 * Author: PunkClaude + Radwulf
 *
 * PHILOSOPHY:
 * The art is DECOUPLING. This engine doesn't know about business logic.
 * The RULES (stored in integrity_checks table) know EVERYTHING.
 * This engine simply reads rules and executes them with poetic precision.
 *
 * MISSION:
 * 1. Load 31+ verification rules from integrity_checks table on startup
 * 2. For EVERY mutation, verify fields against their rules
 * 3. Log verification results to data_audit_logs
 * 4. Block invalid operations with CRITICAL severity
 * 5. Warn on WARNING severity violations
 * 6. Replace removed @veritas system with real verification logic
 *
 * STATUS: PRODUCTION-READY
 * ============================================================================
 */
import { Pool } from 'pg';
/**
 * A verification rule loaded from integrity_checks table
 */
export interface IntegrityRule {
    id: string;
    entity_type: string;
    field_name: string;
    check_type: string;
    check_name: string;
    check_rule: Record<string, any>;
    severity: 'WARNING' | 'ERROR' | 'CRITICAL';
    error_message: string;
    active: boolean;
    created_at: string;
}
/**
 * Result of a single verification
 */
export interface VerificationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    severity: 'NONE' | 'WARNING' | 'ERROR' | 'CRITICAL';
    rulesPassed: number;
    rulesFailed: number;
    executionTimeMs: number;
}
/**
 * Batch verification result for multiple fields
 */
export interface BatchVerificationResult {
    valid: boolean;
    fieldResults: Map<string, VerificationResult>;
    totalErrors: number;
    totalWarnings: number;
    criticalFields: string[];
    overallSeverity: 'NONE' | 'WARNING' | 'ERROR' | 'CRITICAL';
    executionTimeMs: number;
}
/**
 * Result of dependency checking (for cascade deletes)
 */
export interface DependencyCheckResult {
    hasDependents: boolean;
    dependents: Array<{
        table: string;
        field: string;
        count: number;
    }>;
    affectedIds: string[];
}
/**
 * State machine transition validation
 */
export interface StateTransitionResult {
    valid: boolean;
    currentState: string;
    requestedState: string;
    allowedTransitions: string[];
    error?: string;
}
export declare class VerificationEngine {
    private db;
    private rules;
    private rulesByType;
    private isInitialized;
    private lastRuleLoadTime;
    private ruleLoadIntervalMs;
    private verificationCache;
    constructor(databaseConnection: Pool);
    /**
     * Load ALL verification rules from integrity_checks table
     * Call this on server startup
     */
    loadRules(): Promise<void>;
    /**
     * Auto-reload rules every hour (or when cache is stale)
     */
    private reloadRulesIfStale;
    /**
     * CORE METHOD: Verify a single field value against ALL its rules
     * This is called from every mutation to validate input
     */
    verify(entityType: string, fieldName: string, value: any, context?: {
        entityId?: string;
        operation?: string;
    }): Promise<VerificationResult>;
    /**
     * Verify MULTIPLE fields at once (for batch mutations)
     * Optimized for performance: runs in parallel where possible
     */
    verifyBatch(entityType: string, input: Record<string, any>, context?: {
        entityId?: string;
        operation?: string;
    }): Promise<BatchVerificationResult>;
    /**
     * Verify Foreign Key constraint
     * Checks if referenced entity exists AND is active
     */
    verifyForeignKey(referencedTable: string, referencedId: string, checkFields?: {
        field: string;
        value: any;
    }[]): Promise<VerificationResult>;
    /**
     * Verify state machine transition is valid
     * Example: PurchaseOrder PENDING -> APPROVED is allowed, but RECEIVED -> PENDING is not
     */
    verifyStateTransition(currentState: string, requestedState: string, transitionRules: Record<string, string[]>): Promise<StateTransitionResult>;
    /**
     * Check if entity has dependent records (for cascade delete logic)
     * Returns what would be affected if entity is deleted
     */
    checkDependencies(entityType: string, entityId: string, dependencyMap: Record<string, {
        table: string;
        field: string;
    }[]>): Promise<DependencyCheckResult>;
    /**
     * Verify immutable field - field cannot change once set
     */
    verifyImmutable(oldValue: any, newValue: any, fieldName: string): Promise<VerificationResult>;
    /**
     * Verify file hash integrity (for documents)
     * Check if SHA256 hash matches expected value
     */
    verifyHashIntegrity(fileContent: Buffer | string, expectedHash: string, algorithm?: string): Promise<VerificationResult>;
    /**
     * Verify date is in valid range
     * Check: notFuture, notBefore, mustBeAfter another date
     */
    verifyDateRange(date: Date | string, rules: {
        notFuture?: boolean;
        notBefore?: Date | string;
        mustBeAfter?: Date | string;
        mustBeBefore?: Date | string;
    }): Promise<VerificationResult>;
    /**
     * Verify enum value (in allowed list)
     */
    verifyEnum(value: any, allowedValues: any[]): Promise<VerificationResult>;
    /**
     * Verify numeric range (with optional decimal places)
     */
    verifyRange(value: any, rules: {
        min?: number;
        max?: number;
        decimals?: number;
        type?: 'integer' | 'decimal';
    }): Promise<VerificationResult>;
    /**
     * Verify uniqueness (check if value already exists)
     */
    verifyUnique(table: string, field: string, value: any, excludeId?: string): Promise<VerificationResult>;
    /**
     * INTERNAL: Execute a single rule against a value
     * This is where the actual verification logic lives
     */
    private executeRule;
    /**
     * Clear the verification cache (useful for testing)
     */
    clearCache(): void;
    /**
     * Get cache statistics (for monitoring)
     */
    getCacheStats(): {
        size: number;
        rules: number;
        types: number;
    };
    /**
     * Healthcheck - verify engine is working
     */
    healthcheck(): Promise<boolean>;
}
/**
 * Export a function to create singleton instance in GraphQL context
 * Usage in graphql/server.ts:
 *
 * const verificationEngine = new VerificationEngine(database.pool);
 * await verificationEngine.loadRules();
 *
 * Then in context:
 * context = { verificationEngine, ... }
 */
export declare function createVerificationEngine(pool: Pool): VerificationEngine;
/**
 * Export default instance factory
 */
export default VerificationEngine;
//# sourceMappingURL=VerificationEngine.d.ts.map