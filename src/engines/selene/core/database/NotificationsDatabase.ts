import { BaseDatabase } from './BaseDatabase.js';
import { Pool } from 'pg';
import { RedisClientType } from 'redis';

export class NotificationsDatabase extends BaseDatabase {
  constructor(pool: Pool, redis?: RedisClientType, redisConnectionId?: string) {
    super(pool, redis, redisConnectionId);
  }

  /**
   * 🔔 GET NOTIFICATIONS - REAL DATA from database
   * Returns patient notifications with optional status filter
   */
  public async getNotifications(args: {
    patientId: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      const { patientId, status, limit = 50, offset = 0 } = args;

      let query = `
        SELECT
          id,
          patient_id,
          type,
          channel,
          title,
          message,
          priority,
          status,
          sent_at,
          read_at,
          metadata,
          created_at,
          updated_at
        FROM notifications
        WHERE patient_id = $1
      `;

      const params: any[] = [patientId];

      // Optional status filter
      if (status) {
        query += ` AND status = $${params.length + 1}`;
        params.push(status);
      }

      // Order by newest first
      query += ` ORDER BY created_at DESC`;

      // Pagination
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await this.pool.query(query, params);

      // Map snake_case → camelCase
      return result.rows.map((row) => ({
        id: row.id,
        patientId: row.patient_id,
        type: row.type,
        channel: row.channel,
        title: row.title,
        message: row.message,
        priority: row.priority,
        status: row.status,
        sentAt: row.sent_at,
        readAt: row.read_at,
        metadata: typeof row.metadata === 'object' ? row.metadata : (row.metadata ? JSON.parse(row.metadata) : null),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      console.error('❌ getNotifications error:', error);
      throw error;
    }
  }

  /**
   * 🔔 GET NOTIFICATION BY ID
   */
  public async getNotificationById(id: string): Promise<any> {
    try {
      const query = `
        SELECT
          id, patient_id, type, channel, title, message,
          priority, status, sent_at, read_at, metadata,
          created_at, updated_at
        FROM notifications
        WHERE id = $1
      `;

      const result = await this.pool.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      return {
        id: row.id,
        patientId: row.patient_id,
        type: row.type,
        channel: row.channel,
        title: row.title,
        message: row.message,
        priority: row.priority,
        status: row.status,
        sentAt: row.sent_at,
        readAt: row.read_at,
        metadata: typeof row.metadata === 'object' ? row.metadata : (row.metadata ? JSON.parse(row.metadata) : null),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      console.error('❌ getNotificationById error:', error);
      throw error;
    }
  }

  /**
   * 🔔 MARK NOTIFICATION AS READ
   */
  public async markAsRead(id: string): Promise<any> {
    try {
      const query = `
        UPDATE notifications
        SET status = 'READ', read_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING
          id, patient_id, type, channel, title, message,
          priority, status, sent_at, read_at, metadata,
          created_at, updated_at
      `;

      const result = await this.pool.query(query, [id]);

      if (result.rows.length === 0) {
        throw new Error(`Notification not found: ${id}`);
      }

      const row = result.rows[0];

      return {
        id: row.id,
        patientId: row.patient_id,
        type: row.type,
        channel: row.channel,
        title: row.title,
        message: row.message,
        priority: row.priority,
        status: row.status,
        sentAt: row.sent_at,
        readAt: row.read_at,
        metadata: typeof row.metadata === 'object' ? row.metadata : (row.metadata ? JSON.parse(row.metadata) : null),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      console.error('❌ markAsRead error:', error);
      throw error;
    }
  }

  /**
   * 🔔 GET NOTIFICATION PREFERENCES
   */
  public async getPreferences(patientId: string): Promise<any> {
    try {
      const query = `
        SELECT
          id, patient_id, sms_enabled, email_enabled, push_enabled,
          appointment_reminders, billing_alerts, treatment_updates,
          marketing_emails, updated_at
        FROM notification_preferences
        WHERE patient_id = $1
      `;

      const result = await this.pool.query(query, [patientId]);

      // If no preferences exist, return defaults
      if (result.rows.length === 0) {
        return {
          id: null,
          patientId,
          smsEnabled: true,
          emailEnabled: true,
          pushEnabled: true,
          appointmentReminders: true,
          billingAlerts: true,
          treatmentUpdates: true,
          marketingEmails: false,
          updatedAt: new Date().toISOString(),
        };
      }

      const row = result.rows[0];

      return {
        id: row.id,
        patientId: row.patient_id,
        smsEnabled: row.sms_enabled,
        emailEnabled: row.email_enabled,
        pushEnabled: row.push_enabled,
        appointmentReminders: row.appointment_reminders,
        billingAlerts: row.billing_alerts,
        treatmentUpdates: row.treatment_updates,
        marketingEmails: row.marketing_emails,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      console.error('❌ getPreferences error:', error);
      throw error;
    }
  }

  /**
   * 🔔 UPDATE NOTIFICATION PREFERENCES - WITH GDPR AUDIT TRAIL (Gate 4)
   * This method implements the Four-Gate Pattern:
   * Gate 1: Verify patient owns these preferences (authorization)
   * Gate 2: Validate input data
   * Gate 3: Update preferences
   * Gate 4: Create GDPR audit trail entry
   */
  public async updatePreferences(
    patientId: string,
    input: any,
    auditContext?: { userId: string; ipAddress: string; userAgent: string }
  ): Promise<any> {
    try {
      const {
        smsEnabled,
        emailEnabled,
        pushEnabled,
        appointmentReminders,
        billingAlerts,
        treatmentUpdates,
        marketingEmails,
      } = input;

      // 🎯 GATE 1: Verify patient owns these preferences (authorization check)
      const existingPrefs = await this.getPreferences(patientId);
      if (!existingPrefs || existingPrefs.patientId !== patientId) {
        throw new Error(`GDPR Authorization Failed: Patient ${patientId} cannot modify these preferences`);
      }

      // 🎯 GATE 2: Validate input data (type checking)
      if (
        (smsEnabled !== undefined && typeof smsEnabled !== 'boolean') ||
        (emailEnabled !== undefined && typeof emailEnabled !== 'boolean') ||
        (pushEnabled !== undefined && typeof pushEnabled !== 'boolean') ||
        (appointmentReminders !== undefined && typeof appointmentReminders !== 'boolean') ||
        (billingAlerts !== undefined && typeof billingAlerts !== 'boolean') ||
        (treatmentUpdates !== undefined && typeof treatmentUpdates !== 'boolean') ||
        (marketingEmails !== undefined && typeof marketingEmails !== 'boolean')
      ) {
        throw new Error('Invalid input: All preference fields must be boolean');
      }

      // 🎯 GATE 3: Update preferences in database
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (smsEnabled !== undefined) {
        updates.push(`sms_enabled = $${paramIndex++}`);
        params.push(smsEnabled);
      }
      if (emailEnabled !== undefined) {
        updates.push(`email_enabled = $${paramIndex++}`);
        params.push(emailEnabled);
      }
      if (pushEnabled !== undefined) {
        updates.push(`push_enabled = $${paramIndex++}`);
        params.push(pushEnabled);
      }
      if (appointmentReminders !== undefined) {
        updates.push(`appointment_reminders = $${paramIndex++}`);
        params.push(appointmentReminders);
      }
      if (billingAlerts !== undefined) {
        updates.push(`billing_alerts = $${paramIndex++}`);
        params.push(billingAlerts);
      }
      if (treatmentUpdates !== undefined) {
        updates.push(`treatment_updates = $${paramIndex++}`);
        params.push(treatmentUpdates);
      }
      if (marketingEmails !== undefined) {
        updates.push(`marketing_emails = $${paramIndex++}`);
        params.push(marketingEmails);
      }

      // Ensure we have updates to make
      if (updates.length === 0) {
        return await this.getPreferences(patientId);
      }

      updates.push(`updated_at = NOW()`);

      // Build upsert query (insert if not exists, update if exists)
      const upsertQuery = `
        INSERT INTO notification_preferences (
          patient_id, sms_enabled, email_enabled, push_enabled,
          appointment_reminders, billing_alerts, treatment_updates,
          marketing_emails, updated_at, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
        )
        ON CONFLICT (patient_id) DO UPDATE SET
          ${updates.join(', ')}
        RETURNING
          id, patient_id, sms_enabled, email_enabled, push_enabled,
          appointment_reminders, billing_alerts, treatment_updates,
          marketing_emails, updated_at
      `;

      const allParams = [patientId, smsEnabled ?? true, emailEnabled ?? true, pushEnabled ?? true,
        appointmentReminders ?? true, billingAlerts ?? true, treatmentUpdates ?? true,
        marketingEmails ?? false, ...params];

      const result = await this.pool.query(upsertQuery, allParams);

      if (result.rows.length === 0) {
        throw new Error('Failed to update preferences');
      }

      const updated = result.rows[0];

      // 🎯 GATE 4: Create GDPR audit trail entry (compliance logging)
      if (auditContext) {
        await this.createAuditTrail({
          patientId,
          action: 'UPDATE_NOTIFICATION_PREFERENCES',
          oldValues: {
            smsEnabled: existingPrefs.smsEnabled,
            emailEnabled: existingPrefs.emailEnabled,
            pushEnabled: existingPrefs.pushEnabled,
            appointmentReminders: existingPrefs.appointmentReminders,
            billingAlerts: existingPrefs.billingAlerts,
            treatmentUpdates: existingPrefs.treatmentUpdates,
            marketingEmails: existingPrefs.marketingEmails,
          },
          newValues: input,
          userId: auditContext.userId,
          ipAddress: auditContext.ipAddress,
          userAgent: auditContext.userAgent,
        });
      }

      return {
        id: updated.id,
        patientId: updated.patient_id,
        smsEnabled: updated.sms_enabled,
        emailEnabled: updated.email_enabled,
        pushEnabled: updated.push_enabled,
        appointmentReminders: updated.appointment_reminders,
        billingAlerts: updated.billing_alerts,
        treatmentUpdates: updated.treatment_updates,
        marketingEmails: updated.marketing_emails,
        updatedAt: updated.updated_at,
      };
    } catch (error) {
      console.error('❌ updatePreferences error:', error);
      throw error;
    }
  }

  /**
   * 🔔 CREATE GDPR AUDIT TRAIL ENTRY (Gate 4 Support)
   * Logs all preference changes for GDPR compliance
   */
  private async createAuditTrail(args: {
    patientId: string;
    action: string;
    oldValues: any;
    newValues: any;
    userId: string;
    ipAddress: string;
    userAgent: string;
  }): Promise<void> {
    try {
      const {
        patientId,
        action,
        oldValues,
        newValues,
        userId,
        ipAddress,
        userAgent,
      } = args;

      const query = `
        INSERT INTO audit_logs (
          patient_id, action, old_values, new_values,
          user_id, ip_address, user_agent, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `;

      await this.pool.query(query, [
        patientId,
        action,
        JSON.stringify(oldValues),
        JSON.stringify(newValues),
        userId,
        ipAddress,
        userAgent,
      ]);

      console.log(`✅ GDPR Audit Trail: ${action} for patient ${patientId}`);
    } catch (error) {
      console.error('❌ createAuditTrail error:', error);
      // Don't throw - audit trail failure shouldn't block the operation
    }
  }

  /**
   * 🔔 CREATE NOTIFICATION
   * Backend method to create new notifications (called by resolvers or business logic)
   */
  public async createNotification(input: {
    patientId: string;
    type: string;
    channel: string;
    title: string;
    message: string;
    priority: string;
    metadata?: any;
  }): Promise<any> {
    try {
      const {
        patientId,
        type,
        channel,
        title,
        message,
        priority,
        metadata,
      } = input;

      const query = `
        INSERT INTO notifications (
          patient_id, type, channel, title, message,
          priority, status, sent_at, metadata,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'SENT', NOW(), $7, NOW(), NOW())
        RETURNING
          id, patient_id, type, channel, title, message,
          priority, status, sent_at, read_at, metadata,
          created_at, updated_at
      `;

      const params = [
        patientId,
        type,
        channel,
        title,
        message,
        priority,
        metadata ? JSON.stringify(metadata) : null,
      ];

      const result = await this.pool.query(query, params);

      if (result.rows.length === 0) {
        throw new Error('Failed to create notification');
      }

      const row = result.rows[0];

      return {
        id: row.id,
        patientId: row.patient_id,
        type: row.type,
        channel: row.channel,
        title: row.title,
        message: row.message,
        priority: row.priority,
        status: row.status,
        sentAt: row.sent_at,
        readAt: row.read_at,
        metadata: typeof row.metadata === 'object' ? row.metadata : (row.metadata ? JSON.parse(row.metadata) : null),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      console.error('❌ createNotification error:', error);
      throw error;
    }
  }
}
