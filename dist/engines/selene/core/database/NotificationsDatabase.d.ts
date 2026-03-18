import { BaseDatabase } from './BaseDatabase.js';
import { Pool } from 'pg';
import { RedisClientType } from 'redis';
export declare class NotificationsDatabase extends BaseDatabase {
    constructor(pool: Pool, redis?: RedisClientType, redisConnectionId?: string);
    /**
     * 🔔 GET NOTIFICATIONS - REAL DATA from database
     * Returns patient notifications with optional status filter
     */
    getNotifications(args: {
        patientId: string;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    /**
     * 🔔 GET NOTIFICATION BY ID
     */
    getNotificationById(id: string): Promise<any>;
    /**
     * 🔔 MARK NOTIFICATION AS READ
     */
    markAsRead(id: string): Promise<any>;
    /**
     * 🔔 GET NOTIFICATION PREFERENCES
     */
    getPreferences(patientId: string): Promise<any>;
    /**
     * 🔔 UPDATE NOTIFICATION PREFERENCES - WITH GDPR AUDIT TRAIL (Gate 4)
     * This method implements the Four-Gate Pattern:
     * Gate 1: Verify patient owns these preferences (authorization)
     * Gate 2: Validate input data
     * Gate 3: Update preferences
     * Gate 4: Create GDPR audit trail entry
     */
    updatePreferences(patientId: string, input: any, auditContext?: {
        userId: string;
        ipAddress: string;
        userAgent: string;
    }): Promise<any>;
    /**
     * 🔔 CREATE GDPR AUDIT TRAIL ENTRY (Gate 4 Support)
     * Logs all preference changes for GDPR compliance
     */
    private createAuditTrail;
    /**
     * 🔔 CREATE NOTIFICATION
     * Backend method to create new notifications (called by resolvers or business logic)
     */
    createNotification(input: {
        patientId: string;
        type: string;
        channel: string;
        title: string;
        message: string;
        priority: string;
        metadata?: any;
    }): Promise<any>;
}
//# sourceMappingURL=NotificationsDatabase.d.ts.map