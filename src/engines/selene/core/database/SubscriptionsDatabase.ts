import { BaseDatabase } from './BaseDatabase.js';

export class SubscriptionsDatabase extends BaseDatabase {
  // ============================================================================
  // SUBSCRIPTION PLANS V3 METHODS
  // ============================================================================

  async getSubscriptionPlansV3(args: {
    clinicId?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const { clinicId, isActive = true, limit = 50, offset = 0 } = args;

    // DIRECTIVA ENDER-D1-006.9-B: Multi-tenant query
    // Filter by clinic_id for tenant isolation
    let query = `
      SELECT
        id, name, description, price, currency,
        code, max_services_per_month, max_services_per_year,
        features, billing_cycle, is_active,
        clinic_id, created_at, updated_at
      FROM subscription_plans_v3
      WHERE deleted_at IS NULL
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Filter by clinic_id (REQUIRED for multi-tenant)
    if (clinicId) {
      query += ` AND clinic_id = $${paramIndex++}`;
      params.push(clinicId);
    }

    // Filter by is_active
    if (isActive !== undefined) {
      query += ` AND is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    query += ` ORDER BY price ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    return await this.getAll(query, params);
  }

  async getSubscriptionPlanV3ById(id: string): Promise<any> {
    const query = `SELECT * FROM subscription_plans_v3 WHERE id = $1 AND deleted_at IS NULL`;
    return await this.getOne(query, [id]);
  }

  async createSubscriptionPlanV3(input: any): Promise<any> {
    // DIRECTIVA ENDER-D1-006.9-B: Multi-tenant create with clinic_id
    const {
      clinic_id,  // REQUIRED from user context
      name,
      description,
      price,
      currency = 'EUR',
      code,
      consultas_incluidas = 0,  // 0 = unlimited
      max_services_per_month,
      max_services_per_year,
      features = [],
      billing_cycle = 'monthly',
      is_active = true
    } = input;

    if (!clinic_id) {
      throw new Error('clinic_id is required for multi-tenant plan creation');
    }

    const query = `
      INSERT INTO subscription_plans_v3 (
        clinic_id, name, description, price, currency,
        code, max_services_per_month, max_services_per_year,
        features, billing_cycle, is_active,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *
    `;
    const params = [
      clinic_id, name, description, price, currency,
      code, max_services_per_month, max_services_per_year,
      JSON.stringify(features), billing_cycle, is_active
    ];

    const result = await this.runQuery(query, params);
    return result.rows[0];
  }

  async updateSubscriptionPlanV3(id: string, input: any): Promise<any> {
    // DIRECTIVA ENDER-D1-006.9-B: Dynamic update with new schema
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.price !== undefined) {
      updates.push(`price = $${paramIndex++}`);
      values.push(input.price);
    }
    if (input.currency !== undefined) {
      updates.push(`currency = $${paramIndex++}`);
      values.push(input.currency);
    }
    if (input.code !== undefined) {
      updates.push(`code = $${paramIndex++}`);
      values.push(input.code);
    }
    if (input.consultas_incluidas !== undefined) {
      updates.push(`max_services_per_month = $${paramIndex++}`);
      values.push(input.consultas_incluidas);
    }
    if (input.max_services_per_year !== undefined) {
      updates.push(`max_services_per_year = $${paramIndex++}`);
      values.push(input.max_services_per_year);
    }
    if (input.features !== undefined) {
      updates.push(`features = $${paramIndex++}`);
      values.push(JSON.stringify(input.features));
    }
    if (input.billing_cycle !== undefined) {
      updates.push(`billing_cycle = $${paramIndex++}`);
      values.push(input.billing_cycle);
    }
    if (input.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(input.is_active);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE subscription_plans_v3
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.runQuery(query, values);
    return result.rows[0];
  }

  async deleteSubscriptionPlanV3(id: string): Promise<void> {
    // Soft delete (set deleted_at timestamp)
    const query = `UPDATE subscription_plans_v3 SET deleted_at = NOW() WHERE id = $1`;
    await this.runQuery(query, [id]);
  }

  // ============================================================================
  // SUBSCRIPTIONS V3 METHODS
  // ============================================================================

  async getSubscriptionsV3(args: {
    userId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const { userId, status, limit = 50, offset = 0 } = args;

    let query = `
      SELECT
        s.id, s.user_id, s.plan_id, s.status, s.current_period_start,
        s.current_period_end, s.cancel_at_period_end, s.cancelled_at,
        s.trial_start, s.trial_end, s.created_at, s.updated_at,
        sp.name as plan_name, sp.price_monthly, sp.price_yearly,
        sp.features, sp.max_users, sp.max_patients, sp.max_storage_gb
      FROM subscriptions s
      LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (userId) {
      conditions.push(`s.user_id = $${params.length + 1}`);
      params.push(userId);
    }
    if (status) {
      conditions.push(`s.status = $${params.length + 1}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY s.created_at DESC`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    return await this.getAll(query, params);
  }

  async getSubscriptionV3ById(id: string): Promise<any> {
    const query = `
      SELECT
        s.*,
        sp.name as plan_name, sp.price_monthly, sp.price_yearly,
        sp.features, sp.max_users, sp.max_patients, sp.max_storage_gb
      FROM subscriptions s
      LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE s.id = $1
    `;
    return await this.getOne(query, [id]);
  }

  async createSubscriptionV3(input: any): Promise<any> {
    const {
      userId,
      planId,
      paymentMethodId,
      trialDays
    } = input;

    // Get plan details
    const plan = await this.getSubscriptionPlanV3ById(planId);
    if (!plan) {
      throw new Error('Subscription plan not found');
    }

    // Calculate trial period
    const trialStart = new Date();
    const trialEnd = trialDays > 0 ? new Date(trialStart.getTime() + trialDays * 24 * 60 * 60 * 1000) : null;

    // Calculate billing period
    const currentPeriodStart = trialEnd || new Date();
    const currentPeriodEnd = new Date(currentPeriodStart.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const query = `
      INSERT INTO subscriptions (
        user_id, plan_id, status, current_period_start,
        current_period_end, cancel_at_period_end, trial_start,
        trial_end, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `;
    const params = [
      userId, planId, trialDays > 0 ? 'TRIALING' : 'ACTIVE',
      currentPeriodStart, currentPeriodEnd, false,
      trialStart, trialEnd
    ];

    const result = await this.runQuery(query, params);
    const subscription = result.rows[0];

    // Create initial billing cycle
    await this.createBillingCycleV3({
      subscriptionId: subscription.id,
      amount: plan.price_monthly,
      currency: 'EUR',
      periodStart: currentPeriodStart,
      periodEnd: currentPeriodEnd,
      status: trialDays > 0 ? 'TRIAL' : 'PENDING'
    });

    return subscription;
  }

  async updateSubscriptionV3(id: string, input: any): Promise<any> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.cancelAtPeriodEnd !== undefined) {
      updates.push(`cancel_at_period_end = $${paramIndex++}`);
      values.push(input.cancelAtPeriodEnd);
    }
    if (input.cancelledAt !== undefined) {
      updates.push(`cancelled_at = $${paramIndex++}`);
      values.push(input.cancelledAt);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE subscriptions
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.runQuery(query, values);
    return result.rows[0];
  }

  async cancelSubscriptionV3(id: string, immediate: boolean = false): Promise<any> {
    if (immediate) {
      const query = `
        UPDATE subscriptions
        SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      const result = await this.runQuery(query, [id]);
      return result.rows[0];
    } else {
      const query = `
        UPDATE subscriptions
        SET cancel_at_period_end = true, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      const result = await this.runQuery(query, [id]);
      return result.rows[0];
    }
  }

  async reactivateSubscriptionV3(id: string): Promise<any> {
    const query = `
      UPDATE subscriptions
      SET cancel_at_period_end = false, cancelled_at = NULL, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await this.runQuery(query, [id]);
    return result.rows[0];
  }

  async deleteSubscriptionV3(id: string): Promise<void> {
    const query = `DELETE FROM subscriptions WHERE id = $1`;
    await this.runQuery(query, [id]);
  }

  // ============================================================================
  // BILLING CYCLES V3 METHODS
  // ============================================================================

  async getBillingCyclesV3(args: {
    subscriptionId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const { subscriptionId, status, limit = 50, offset = 0 } = args;

    let query = `
      SELECT
        id, subscription_id, amount, currency, period_start,
        period_end, status, paid_at, invoice_url, created_at, updated_at
      FROM billing_cycles
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (subscriptionId) {
      conditions.push(`subscription_id = $${params.length + 1}`);
      params.push(subscriptionId);
    }
    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY period_start DESC`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    return await this.getAll(query, params);
  }

  async getBillingCycleV3ById(id: string): Promise<any> {
    const query = `SELECT * FROM billing_cycles WHERE id = $1`;
    return await this.getOne(query, [id]);
  }

  async createBillingCycleV3(input: any): Promise<any> {
    const {
      subscriptionId,
      amount,
      currency,
      periodStart,
      periodEnd,
      status
    } = input;

    const query = `
      INSERT INTO billing_cycles (
        subscription_id, amount, currency, period_start,
        period_end, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `;
    const params = [subscriptionId, amount, currency || 'EUR', periodStart, periodEnd, status || 'PENDING'];

    const result = await this.runQuery(query, params);
    return result.rows[0];
  }

  async updateBillingCycleV3(id: string, input: any): Promise<any> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.paidAt !== undefined) {
      updates.push(`paid_at = $${paramIndex++}`);
      values.push(input.paidAt);
    }
    if (input.invoiceUrl !== undefined) {
      updates.push(`invoice_url = $${paramIndex++}`);
      values.push(input.invoiceUrl);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE billing_cycles
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.runQuery(query, values);
    return result.rows[0];
  }

  async processBillingCycleV3(id: string): Promise<any> {
    // Get billing cycle details
    const cycle = await this.getBillingCycleV3ById(id);
    if (!cycle) {
      throw new Error('Billing cycle not found');
    }

    if (cycle.status !== 'PENDING') {
      throw new Error('Billing cycle is not in pending status');
    }

    // Process payment (simplified - in real implementation, integrate with payment processor)
    const paidAt = new Date();

    const result = await this.runQuery(
      `UPDATE billing_cycles
       SET status = 'PAID', paid_at = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [paidAt, id]
    );

    // Create next billing cycle if subscription is active
    const subscription = await this.getSubscriptionV3ById(cycle.subscription_id);
    if (subscription && subscription.status === 'ACTIVE') {
      const nextPeriodStart = new Date(cycle.period_end);
      const nextPeriodEnd = new Date(nextPeriodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

      await this.createBillingCycleV3({
        subscriptionId: cycle.subscription_id,
        amount: cycle.amount,
        currency: cycle.currency,
        periodStart: nextPeriodStart,
        periodEnd: nextPeriodEnd,
        status: 'PENDING'
      });
    }

    return result.rows[0];
  }

  async deleteBillingCycleV3(id: string): Promise<void> {
    const query = `DELETE FROM billing_cycles WHERE id = $1`;
    await this.runQuery(query, [id]);
  }

  // ============================================================================
  // USAGE TRACKING V3 METHODS
  // ============================================================================

  async getUsageTrackingV3(args: {
    subscriptionId?: string;
    metric?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const { subscriptionId, metric, startDate, endDate, limit = 100, offset = 0 } = args;

    let query = `
      SELECT
        id, subscription_id, metric, value, recorded_at, created_at
      FROM usage_tracking
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (subscriptionId) {
      conditions.push(`subscription_id = $${params.length + 1}`);
      params.push(subscriptionId);
    }
    if (metric) {
      conditions.push(`metric = $${params.length + 1}`);
      params.push(metric);
    }
    if (startDate) {
      conditions.push(`recorded_at >= $${params.length + 1}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`recorded_at <= $${params.length + 1}`);
      params.push(endDate);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY recorded_at DESC`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    return await this.getAll(query, params);
  }

  async trackServiceUsageV3(input: any): Promise<any> {
    const {
      subscriptionId,
      metric,
      value,
      recordedAt
    } = input;

    const query = `
      INSERT INTO usage_tracking (
        subscription_id, metric, value, recorded_at, created_at
      ) VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;
    const params = [subscriptionId, metric, value, recordedAt || new Date()];

    const result = await this.runQuery(query, params);
    return result.rows[0];
  }

  async getUsageSummaryV3(subscriptionId: string, startDate: Date, endDate: Date): Promise<any> {
    const query = `
      SELECT
        metric,
        SUM(value) as total_value,
        AVG(value) as avg_value,
        MAX(value) as max_value,
        MIN(value) as min_value,
        COUNT(*) as count
      FROM usage_tracking
      WHERE subscription_id = $1
        AND recorded_at >= $2
        AND recorded_at <= $3
      GROUP BY metric
      ORDER BY metric ASC
    `;
    return await this.getAll(query, [subscriptionId, startDate, endDate]);
  }

  // ============================================================================
  // SUBSCRIPTION HELPER METHODS
  // ============================================================================

  async getUserActiveSubscriptionV3(userId: string): Promise<any> {
    const query = `
      SELECT
        s.*,
        sp.name as plan_name, sp.price_monthly, sp.price_yearly,
        sp.features, sp.max_users, sp.max_patients, sp.max_storage_gb
      FROM subscriptions s
      LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE s.user_id = $1 AND s.status IN ('ACTIVE', 'TRIALING')
      ORDER BY s.created_at DESC
      LIMIT 1
    `;
    return await this.getOne(query, [userId]);
  }

  async checkSubscriptionLimitsV3(subscriptionId: string): Promise<any> {
    // Get subscription and plan details
    const subscription = await this.getSubscriptionV3ById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Get current usage counts
    const userCount = await this.runQuery(
      `SELECT COUNT(*) as count FROM users WHERE subscription_id = $1`,
      [subscriptionId]
    );

    const patientCount = await this.runQuery(
      `SELECT COUNT(*) as count FROM patients WHERE subscription_id = $1`,
      [subscriptionId]
    );

    const storageUsage = await this.runQuery(
      `SELECT COALESCE(SUM(file_size), 0) as total FROM documents WHERE subscription_id = $1`,
      [subscriptionId]
    );

    const storageGb = (storageUsage.rows[0].total / (1024 * 1024 * 1024)); // Convert bytes to GB

    return {
      subscriptionId,
      plan: {
        maxUsers: subscription.max_users,
        maxPatients: subscription.max_patients,
        maxStorageGb: subscription.max_storage_gb
      },
      current: {
        users: parseInt(userCount.rows[0].count),
        patients: parseInt(patientCount.rows[0].count),
        storageGb: Math.round(storageGb * 100) / 100
      },
      limits: {
        usersExceeded: parseInt(userCount.rows[0].count) >= subscription.max_users,
        patientsExceeded: parseInt(patientCount.rows[0].count) >= subscription.max_patients,
        storageExceeded: storageGb >= subscription.max_storage_gb
      }
    };
  }

  async getSubscriptionRevenueV3(args: {
    startDate?: Date;
    endDate?: Date;
    planId?: string;
  }): Promise<any> {
    const { startDate, endDate, planId } = args;

    let query = `
      SELECT
        sp.name as plan_name,
        COUNT(DISTINCT s.id) as active_subscriptions,
        SUM(bc.amount) as total_revenue,
        AVG(bc.amount) as avg_revenue_per_cycle
      FROM billing_cycles bc
      INNER JOIN subscriptions s ON bc.subscription_id = s.id
      INNER JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE bc.status = 'PAID'
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (startDate) {
      conditions.push(`bc.paid_at >= $${params.length + 1}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`bc.paid_at <= $${params.length + 1}`);
      params.push(endDate);
    }
    if (planId) {
      conditions.push(`s.plan_id = $${params.length + 1}`);
      params.push(planId);
    }

    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }

    query += ` GROUP BY sp.id, sp.name ORDER BY total_revenue DESC`;

    return await this.getAll(query, params);
  }

  async getTrialExpiringSubscriptionsV3(daysAhead: number = 7): Promise<any[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const query = `
      SELECT
        s.id, s.user_id, s.plan_id, s.trial_end,
        sp.name as plan_name, sp.price_monthly
      FROM subscriptions s
      LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE s.status = 'TRIALING'
        AND s.trial_end <= $1
        AND s.trial_end > NOW()
      ORDER BY s.trial_end ASC
    `;
    return await this.getAll(query, [futureDate]);
  }

  async getExpiredTrialsV3(): Promise<any[]> {
    const query = `
      SELECT
        s.id, s.user_id, s.plan_id, s.trial_end,
        sp.name as plan_name, sp.price_monthly
      FROM subscriptions s
      LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE s.status = 'TRIALING'
        AND s.trial_end <= NOW()
      ORDER BY s.trial_end ASC
    `;
    return await this.getAll(query);
  }

  async convertTrialToPaidV3(subscriptionId: string): Promise<any> {
    // Get subscription details
    const subscription = await this.getSubscriptionV3ById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status !== 'TRIALING') {
      throw new Error('Subscription is not in trial status');
    }

    // Update subscription status
    const result = await this.runQuery(
      `UPDATE subscriptions
       SET status = 'ACTIVE', trial_end = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [subscriptionId]
    );

    // Update first billing cycle from TRIAL to PENDING
    await this.runQuery(
      `UPDATE billing_cycles
       SET status = 'PENDING', updated_at = NOW()
       WHERE subscription_id = $1 AND status = 'TRIAL'`,
      [subscriptionId]
    );

    return result.rows[0];
  }

  async getSubscriptionPlanFeaturesV3(planId: string): Promise<any[]> {
    const query = `
      SELECT
        id,
        name,
        description,
        category,
        value_type,
        value,
        is_enabled,
        sort_order
      FROM subscription_plan_features
      WHERE plan_id = $1
      ORDER BY sort_order ASC, name ASC
    `;

    return await this.getAll(query, [planId]);
  }
}