import { BaseDatabase } from './BaseDatabase.js';

export class CustomCalendarDatabase extends BaseDatabase {
  // ============================================================================
  // CUSTOM CALENDAR VIEWS V3 METHODS
  // ============================================================================

  async getCustomCalendarViewsV3(args: {
    userId?: string;
    isPublic?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const { userId, isPublic = false, limit = 50, offset = 0 } = args;

    let query = `
      SELECT
        id, user_id, name, description, is_public, is_default,
        view_type, date_range_start, date_range_end, filters,
        color_scheme, created_at, updated_at
      FROM custom_calendar_views
      WHERE 1=1
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (userId) {
      conditions.push(`(user_id = $${params.length + 1} OR is_public = true)`);
      params.push(userId);
    } else if (!isPublic) {
      conditions.push(`is_public = true`);
    }

    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY is_default DESC, created_at DESC`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    return await this.getAll(query, params);
  }

  async getCustomCalendarViewV3ById(id: string): Promise<any> {
    const query = `SELECT * FROM custom_calendar_views WHERE id = $1`;
    return await this.getOne(query, [id]);
  }

  async createCustomCalendarViewV3(input: any): Promise<any> {
    const {
      userId,
      name,
      description,
      isPublic,
      isDefault,
      viewType,
      dateRangeStart,
      dateRangeEnd,
      filters,
      colorScheme
    } = input;

    const query = `
      INSERT INTO custom_calendar_views (
        user_id, name, description, is_public, is_default,
        view_type, date_range_start, date_range_end, filters,
        color_scheme, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `;
    const params = [
      userId, name, description, isPublic || false, isDefault || false,
      viewType || 'MONTH', dateRangeStart, dateRangeEnd,
      JSON.stringify(filters || {}), JSON.stringify(colorScheme || {})
    ];

    const result = await this.runQuery(query, params);
    return result.rows[0];
  }

  async updateCustomCalendarViewV3(id: string, input: any): Promise<any> {
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
    if (input.isPublic !== undefined) {
      updates.push(`is_public = $${paramIndex++}`);
      values.push(input.isPublic);
    }
    if (input.isDefault !== undefined) {
      updates.push(`is_default = $${paramIndex++}`);
      values.push(input.isDefault);
    }
    if (input.viewType !== undefined) {
      updates.push(`view_type = $${paramIndex++}`);
      values.push(input.viewType);
    }
    if (input.dateRangeStart !== undefined) {
      updates.push(`date_range_start = $${paramIndex++}`);
      values.push(input.dateRangeStart);
    }
    if (input.dateRangeEnd !== undefined) {
      updates.push(`date_range_end = $${paramIndex++}`);
      values.push(input.dateRangeEnd);
    }
    if (input.filters !== undefined) {
      updates.push(`filters = $${paramIndex++}`);
      values.push(JSON.stringify(input.filters));
    }
    if (input.colorScheme !== undefined) {
      updates.push(`color_scheme = $${paramIndex++}`);
      values.push(JSON.stringify(input.colorScheme));
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE custom_calendar_views
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.runQuery(query, values);
    return result.rows[0];
  }

  async deleteCustomCalendarViewV3(id: string): Promise<void> {
    const query = `DELETE FROM custom_calendar_views WHERE id = $1`;
    await this.runQuery(query, [id]);
  }

  // ============================================================================
  // CALENDAR EVENTS V3 METHODS
  // ============================================================================

  async getCalendarEventsV3(args: {
    userId?: string;
    viewId?: string;
    startDate?: Date;
    endDate?: Date;
    eventType?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const { userId, viewId, startDate, endDate, eventType, limit = 100, offset = 0 } = args;

    let query = `
      SELECT
        ce.id, ce.user_id, ce.view_id, ce.title, ce.description,
        ce.event_type, ce.start_date, ce.end_date, ce.all_day,
        ce.location, ce.attendees, ce.reminders, ce.color,
        ce.is_recurring, ce.recurrence_rule, ce.status,
        ce.created_at, ce.updated_at,
        ccv.name as view_name
      FROM calendar_events ce
      LEFT JOIN custom_calendar_views ccv ON ce.view_id = ccv.id
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (userId) {
      conditions.push(`ce.user_id = $${params.length + 1}`);
      params.push(userId);
    }
    if (viewId) {
      conditions.push(`ce.view_id = $${params.length + 1}`);
      params.push(viewId);
    }
    if (startDate) {
      conditions.push(`ce.start_date >= $${params.length + 1}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`ce.end_date <= $${params.length + 1}`);
      params.push(endDate);
    }
    if (eventType) {
      conditions.push(`ce.event_type = $${params.length + 1}`);
      params.push(eventType);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY ce.start_date ASC`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    return await this.getAll(query, params);
  }

  async getCalendarEventV3ById(id: string): Promise<any> {
    const query = `
      SELECT
        ce.*,
        ccv.name as view_name, ccv.user_id as view_owner_id
      FROM calendar_events ce
      LEFT JOIN custom_calendar_views ccv ON ce.view_id = ccv.id
      WHERE ce.id = $1
    `;
    return await this.getOne(query, [id]);
  }

  async createCalendarEventV3(input: any): Promise<any> {
    const {
      userId,
      viewId,
      title,
      description,
      eventType,
      startDate,
      endDate,
      allDay,
      location,
      attendees,
      reminders,
      color,
      isRecurring,
      recurrenceRule,
      status
    } = input;

    const query = `
      INSERT INTO calendar_events (
        user_id, view_id, title, description, event_type,
        start_date, end_date, all_day, location, attendees,
        reminders, color, is_recurring, recurrence_rule,
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
      RETURNING *
    `;
    const params = [
      userId, viewId, title, description, eventType || 'APPOINTMENT',
      startDate, endDate, allDay || false, location,
      JSON.stringify(attendees || []), JSON.stringify(reminders || []),
      color || '#3174ad', isRecurring || false, recurrenceRule, status || 'CONFIRMED'
    ];

    const result = await this.runQuery(query, params);
    return result.rows[0];
  }

  async updateCalendarEventV3(id: string, input: any): Promise<any> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.eventType !== undefined) {
      updates.push(`event_type = $${paramIndex++}`);
      values.push(input.eventType);
    }
    if (input.startDate !== undefined) {
      updates.push(`start_date = $${paramIndex++}`);
      values.push(input.startDate);
    }
    if (input.endDate !== undefined) {
      updates.push(`end_date = $${paramIndex++}`);
      values.push(input.endDate);
    }
    if (input.allDay !== undefined) {
      updates.push(`all_day = $${paramIndex++}`);
      values.push(input.allDay);
    }
    if (input.location !== undefined) {
      updates.push(`location = $${paramIndex++}`);
      values.push(input.location);
    }
    if (input.attendees !== undefined) {
      updates.push(`attendees = $${paramIndex++}`);
      values.push(JSON.stringify(input.attendees));
    }
    if (input.reminders !== undefined) {
      updates.push(`reminders = $${paramIndex++}`);
      values.push(JSON.stringify(input.reminders));
    }
    if (input.color !== undefined) {
      updates.push(`color = $${paramIndex++}`);
      values.push(input.color);
    }
    if (input.isRecurring !== undefined) {
      updates.push(`is_recurring = $${paramIndex++}`);
      values.push(input.isRecurring);
    }
    if (input.recurrenceRule !== undefined) {
      updates.push(`recurrence_rule = $${paramIndex++}`);
      values.push(input.recurrenceRule);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE calendar_events
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.runQuery(query, values);
    return result.rows[0];
  }

  async deleteCalendarEventV3(id: string): Promise<void> {
    const query = `DELETE FROM calendar_events WHERE id = $1`;
    await this.runQuery(query, [id]);
  }

  // ============================================================================
  // CALENDAR FILTERS V3 METHODS
  // ============================================================================

  async getCalendarFiltersV3(args: {
    userId?: string;
    viewId?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const { userId, viewId, limit = 50, offset = 0 } = args;

    let query = `
      SELECT
        id, user_id, view_id, name, description, filter_type,
        filter_criteria, is_active, sort_order, created_at, updated_at
      FROM calendar_filters
      WHERE 1=1
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (userId) {
      conditions.push(`user_id = $${params.length + 1}`);
      params.push(userId);
    }
    if (viewId) {
      conditions.push(`view_id = $${params.length + 1}`);
      params.push(viewId);
    }

    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY sort_order ASC, created_at DESC`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    return await this.getAll(query, params);
  }

  async getCalendarFilterV3ById(id: string): Promise<any> {
    const query = `SELECT * FROM calendar_filters WHERE id = $1`;
    return await this.getOne(query, [id]);
  }

  async createCalendarFilterV3(input: any): Promise<any> {
    const {
      userId,
      viewId,
      name,
      description,
      filterType,
      filterCriteria,
      isActive,
      sortOrder
    } = input;

    const query = `
      INSERT INTO calendar_filters (
        user_id, view_id, name, description, filter_type,
        filter_criteria, is_active, sort_order, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `;
    const params = [
      userId, viewId, name, description, filterType,
      JSON.stringify(filterCriteria || {}), isActive !== false, sortOrder || 0
    ];

    const result = await this.runQuery(query, params);
    return result.rows[0];
  }

  async updateCalendarFilterV3(id: string, input: any): Promise<any> {
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
    if (input.filterType !== undefined) {
      updates.push(`filter_type = $${paramIndex++}`);
      values.push(input.filterType);
    }
    if (input.filterCriteria !== undefined) {
      updates.push(`filter_criteria = $${paramIndex++}`);
      values.push(JSON.stringify(input.filterCriteria));
    }
    if (input.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(input.isActive);
    }
    if (input.sortOrder !== undefined) {
      updates.push(`sort_order = $${paramIndex++}`);
      values.push(input.sortOrder);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE calendar_filters
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.runQuery(query, values);
    return result.rows[0];
  }

  async deleteCalendarFilterV3(id: string): Promise<void> {
    const query = `DELETE FROM calendar_filters WHERE id = $1`;
    await this.runQuery(query, [id]);
  }

  // ============================================================================
  // CALENDAR SETTINGS V3 METHODS
  // ============================================================================

  async getCalendarSettingsV3(userId: string): Promise<any> {
    const query = `
      SELECT
        id, user_id, timezone, week_starts_on, default_view,
        working_hours_start, working_hours_end, show_weekends,
        default_event_duration, reminder_defaults, theme,
        created_at, updated_at
      FROM calendar_settings
      WHERE user_id = $1
    `;
    return await this.getOne(query, [userId]);
  }

  async updateCalendarSettingsV3(userId: string, input: any): Promise<any> {
    // Check if settings exist
    const existing = await this.getCalendarSettingsV3(userId);

    if (existing) {
      // Update existing settings
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (input.timezone !== undefined) {
        updates.push(`timezone = $${paramIndex++}`);
        values.push(input.timezone);
      }
      if (input.weekStartsOn !== undefined) {
        updates.push(`week_starts_on = $${paramIndex++}`);
        values.push(input.weekStartsOn);
      }
      if (input.defaultView !== undefined) {
        updates.push(`default_view = $${paramIndex++}`);
        values.push(input.defaultView);
      }
      if (input.workingHoursStart !== undefined) {
        updates.push(`working_hours_start = $${paramIndex++}`);
        values.push(input.workingHoursStart);
      }
      if (input.workingHoursEnd !== undefined) {
        updates.push(`working_hours_end = $${paramIndex++}`);
        values.push(input.workingHoursEnd);
      }
      if (input.showWeekends !== undefined) {
        updates.push(`show_weekends = $${paramIndex++}`);
        values.push(input.showWeekends);
      }
      if (input.defaultEventDuration !== undefined) {
        updates.push(`default_event_duration = $${paramIndex++}`);
        values.push(input.defaultEventDuration);
      }
      if (input.reminderDefaults !== undefined) {
        updates.push(`reminder_defaults = $${paramIndex++}`);
        values.push(JSON.stringify(input.reminderDefaults));
      }
      if (input.theme !== undefined) {
        updates.push(`theme = $${paramIndex++}`);
        values.push(JSON.stringify(input.theme));
      }

      updates.push(`updated_at = NOW()`);
      values.push(userId);

      const query = `
        UPDATE calendar_settings
        SET ${updates.join(', ')}
        WHERE user_id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.runQuery(query, values);
      return result.rows[0];
    } else {
      // Create new settings
      const query = `
        INSERT INTO calendar_settings (
          user_id, timezone, week_starts_on, default_view,
          working_hours_start, working_hours_end, show_weekends,
          default_event_duration, reminder_defaults, theme,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING *
      `;
      const params = [
        userId,
        input.timezone || 'Europe/Madrid',
        input.weekStartsOn || 'monday',
        input.defaultView || 'month',
        input.workingHoursStart || '09:00',
        input.workingHoursEnd || '18:00',
        input.showWeekends !== false,
        input.defaultEventDuration || 60,
        JSON.stringify(input.reminderDefaults || []),
        JSON.stringify(input.theme || {})
      ];

      const result = await this.runQuery(query, params);
      return result.rows[0];
    }
  }

  // ============================================================================
  // CALENDAR HELPER METHODS
  // ============================================================================

  async getUserDefaultCalendarViewV3(userId: string): Promise<any> {
    const query = `
      SELECT * FROM custom_calendar_views
      WHERE user_id = $1 AND is_default = true
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return await this.getOne(query, [userId]);
  }

  async getCalendarEventsByDateRangeV3(args: {
    userId: string;
    startDate: Date;
    endDate: Date;
    eventTypes?: string[];
  }): Promise<any[]> {
    const { userId, startDate, endDate, eventTypes } = args;

    let query = `
      SELECT
        ce.*,
        ccv.name as view_name
      FROM calendar_events ce
      LEFT JOIN custom_calendar_views ccv ON ce.view_id = ccv.id
      WHERE ce.user_id = $1
        AND ce.start_date <= $2
        AND ce.end_date >= $3
    `;

    const params: any[] = [userId, endDate, startDate];

    if (eventTypes && eventTypes.length > 0) {
      query += ` AND ce.event_type = ANY($${params.length + 1})`;
      params.push(eventTypes);
    }

    query += ` ORDER BY ce.start_date ASC`;

    return await this.getAll(query, params);
  }

  async getUpcomingCalendarEventsV3(args: {
    userId: string;
    limit?: number;
    daysAhead?: number;
  }): Promise<any[]> {
    const { userId, limit = 10, daysAhead = 7 } = args;

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const query = `
      SELECT
        ce.*,
        ccv.name as view_name
      FROM calendar_events ce
      LEFT JOIN custom_calendar_views ccv ON ce.view_id = ccv.id
      WHERE ce.user_id = $1
        AND ce.start_date >= NOW()
        AND ce.start_date <= $2
        AND ce.status = 'CONFIRMED'
      ORDER BY ce.start_date ASC
      LIMIT $3
    `;
    return await this.getAll(query, [userId, futureDate, limit]);
  }

  async getCalendarEventsWithRemindersV3(userId: string): Promise<any[]> {
    const query = `
      SELECT
        ce.*,
        ccv.name as view_name
      FROM calendar_events ce
      LEFT JOIN custom_calendar_views ccv ON ce.view_id = ccv.id
      WHERE ce.user_id = $1
        AND ce.reminders IS NOT NULL
        AND JSON_ARRAY_LENGTH(ce.reminders) > 0
        AND ce.start_date > NOW()
        AND ce.status = 'CONFIRMED'
      ORDER BY ce.start_date ASC
    `;
    return await this.getAll(query, [userId]);
  }

  async duplicateCalendarViewV3(viewId: string, newName: string, userId: string): Promise<any> {
    // Get original view
    const originalView = await this.getCustomCalendarViewV3ById(viewId);
    if (!originalView) {
      throw new Error('Calendar view not found');
    }

    // Create duplicate
    const duplicate = await this.createCustomCalendarViewV3({
      userId,
      name: newName,
      description: `Copy of ${originalView.name}`,
      isPublic: false,
      isDefault: false,
      viewType: originalView.view_type,
      dateRangeStart: originalView.date_range_start,
      dateRangeEnd: originalView.date_range_end,
      filters: originalView.filters,
      colorScheme: originalView.color_scheme
    });

    return duplicate;
  }

  async applyCalendarFilterV3(viewId: string, filterId: string): Promise<any[]> {
    // Get filter criteria
    const filter = await this.getCalendarFilterV3ById(filterId);
    if (!filter) {
      throw new Error('Calendar filter not found');
    }

    // Apply filter to events in the view
    const filterCriteria = filter.filter_criteria;
    let query = `
      SELECT
        ce.*,
        ccv.name as view_name
      FROM calendar_events ce
      LEFT JOIN custom_calendar_views ccv ON ce.view_id = ccv.id
      WHERE ce.view_id = $1
    `;

    const params: any[] = [viewId];
    const conditions: string[] = [];

    // Apply filter criteria
    if (filterCriteria.eventType) {
      conditions.push(`ce.event_type = $${params.length + 1}`);
      params.push(filterCriteria.eventType);
    }
    if (filterCriteria.status) {
      conditions.push(`ce.status = $${params.length + 1}`);
      params.push(filterCriteria.status);
    }
    if (filterCriteria.color) {
      conditions.push(`ce.color = $${params.length + 1}`);
      params.push(filterCriteria.color);
    }
    if (filterCriteria.dateRange) {
      if (filterCriteria.dateRange.start) {
        conditions.push(`ce.start_date >= $${params.length + 1}`);
        params.push(filterCriteria.dateRange.start);
      }
      if (filterCriteria.dateRange.end) {
        conditions.push(`ce.end_date <= $${params.length + 1}`);
        params.push(filterCriteria.dateRange.end);
      }
    }

    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY ce.start_date ASC`;

    return await this.getAll(query, params);
  }

  async getCalendarViewStatsV3(viewId: string): Promise<any> {
    const query = `
      SELECT
        COUNT(*) as total_events,
        COUNT(CASE WHEN event_type = 'APPOINTMENT' THEN 1 END) as appointments,
        COUNT(CASE WHEN event_type = 'MEETING' THEN 1 END) as meetings,
        COUNT(CASE WHEN event_type = 'REMINDER' THEN 1 END) as reminders,
        COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END) as confirmed_events,
        COUNT(CASE WHEN status = 'TENTATIVE' THEN 1 END) as tentative_events,
        COUNT(CASE WHEN is_recurring = true THEN 1 END) as recurring_events
      FROM calendar_events
      WHERE view_id = $1
    `;
    const result = await this.runQuery(query, [viewId]);
    return result.rows[0];
  }

  async bulkUpdateCalendarEventsV3(eventIds: string[], updates: any): Promise<any[]> {
    const updatedEvents: any[] = [];

    for (const eventId of eventIds) {
      const updated = await this.updateCalendarEventV3(eventId, updates);
      updatedEvents.push(updated);
    }

    return updatedEvents;
  }

  async getCalendarConflictsV3(args: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<any[]> {
    const { userId, startDate, endDate } = args;

    const query = `
      SELECT
        ce1.id as event1_id, ce1.title as event1_title,
        ce1.start_date as event1_start, ce1.end_date as event1_end,
        ce2.id as event2_id, ce2.title as event2_title,
        ce2.start_date as event2_start, ce2.end_date as event2_end
      FROM calendar_events ce1
      INNER JOIN calendar_events ce2 ON ce1.id < ce2.id
      WHERE ce1.user_id = $1 AND ce2.user_id = $1
        AND ce1.status = 'CONFIRMED' AND ce2.status = 'CONFIRMED'
        AND (
          (ce1.start_date <= ce2.start_date AND ce1.end_date > ce2.start_date) OR
          (ce2.start_date <= ce1.start_date AND ce2.end_date > ce1.start_date)
        )
        AND ce1.start_date >= $2 AND ce1.end_date <= $3
      ORDER BY ce1.start_date ASC
    `;
    return await this.getAll(query, [userId, startDate, endDate]);
  }

  // ============================================================================
  // ADDITIONAL V3 METHODS FOR API COMPATIBILITY
  // ============================================================================

  async setDefaultCalendarViewV3(userId: string, viewId: string): Promise<void> {
    // First, unset any existing default
    await this.runQuery(
      `UPDATE custom_calendar_views SET is_default = false WHERE user_id = $1`,
      [userId]
    );

    // Set the new default
    await this.runQuery(
      `UPDATE custom_calendar_views SET is_default = true WHERE id = $1 AND user_id = $2`,
      [viewId, userId]
    );
  }

  async getCalendarAvailabilityV3(userId: string, date: string): Promise<any[]> {
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const query = `
      SELECT
        start_date, end_date, title
      FROM calendar_events
      WHERE user_id = $1
        AND status = 'CONFIRMED'
        AND start_date >= $2
        AND end_date <= $3
      ORDER BY start_date ASC
    `;
    return await this.getAll(query, [userId, startOfDay, endOfDay]);
  }

  async toggleCalendarFilterV3(filterId: string): Promise<any> {
    // Get current filter
    const filter = await this.getCalendarFilterV3ById(filterId);
    if (!filter) {
      throw new Error('Calendar filter not found');
    }

    // Toggle enabled status
    const newEnabled = !filter.is_enabled;
    const result = await this.runQuery(
      `UPDATE calendar_filters SET is_enabled = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newEnabled, filterId]
    );

    return result.rows[0];
  }
}