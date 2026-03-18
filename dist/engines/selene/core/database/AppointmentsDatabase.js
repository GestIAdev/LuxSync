import { BaseDatabase } from './BaseDatabase.js';
/**
 * 🎯 APPOINTMENTS DATABASE - Specialized Database Class
 * ✅ MODULARIZED: Extracted from monolithic Database.ts
 * ✅ RESPONSIBILITY: Handle all appointment-related operations
 * ✅ INHERITANCE: Extends BaseDatabase for shared functionality
 */
export class AppointmentsDatabase extends BaseDatabase {
    /**
     * 📅 GET APPOINTMENTS - GraphQL Migration v1.0
     * ✅ MAPEO COMPLETO: snake_case DB → camelCase GraphQL
     * ✅ REAL TABLE: appointments (not medical_records workaround)
     * ✅ FIELDS: id, patientId, practitionerId, date, time, appointmentDate, appointmentTime, duration, type, status, notes, createdAt, updatedAt
     */
    async getAppointments(filters) {
        try {
            // ✅ REAL QUERY: Using appointments table with proper schema
            let query = `
        SELECT
          id,
          patient_id,
          dentist_id,
          scheduled_date,
          duration_minutes,
          appointment_type,
          status,
          title,
          notes,
          created_at,
          updated_at,
          deleted_at
        FROM appointments
        WHERE deleted_at IS NULL
      `;
            const params = [];
            if (filters) {
                if (filters.patientId) {
                    query += ` AND patient_id = $${params.length + 1}`;
                    params.push(filters.patientId);
                }
                if (filters.date) {
                    query += ` AND DATE(scheduled_date) = $${params.length + 1}`;
                    params.push(filters.date);
                }
                if (filters.status) {
                    query += ` AND status = $${params.length + 1}`;
                    params.push(filters.status);
                }
            }
            query += " ORDER BY scheduled_date DESC";
            const result = await this.pool.query(query, params);
            // ✅ MAPEO COMPLETO: snake_case DB → camelCase GraphQL
            return result.rows.map((dbRow) => {
                const scheduledDate = new Date(dbRow.scheduled_date);
                const appointmentDate = scheduledDate.toISOString().split("T")[0]; // YYYY-MM-DD
                const appointmentTime = scheduledDate.toTimeString().slice(0, 5); // HH:MM
                return {
                    id: dbRow.id,
                    patientId: dbRow.patient_id,
                    practitionerId: dbRow.dentist_id,
                    date: appointmentDate,
                    time: appointmentTime,
                    appointmentDate,
                    appointmentTime,
                    duration: dbRow.duration_minutes,
                    type: dbRow.appointment_type,
                    status: dbRow.status,
                    notes: dbRow.notes || "",
                    createdAt: dbRow.created_at,
                    updatedAt: dbRow.updated_at,
                };
            });
        }
        catch (error) {
            console.error("💥 Failed to get appointments:", error);
            throw error;
        }
    }
    /**
     * ➕ CREATE APPOINTMENT - GraphQL Migration v1.0
     * ✅ MAPEO COMPLETO: camelCase input → snake_case DB → camelCase output
     * ✅ RETURNS: Mapped appointment object with createdAt/updatedAt
     */
    async createAppointment(appointmentData) {
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");
            const result = await client.query(`
        INSERT INTO appointments (
          id, patient_id, dentist_id, scheduled_date,
          duration_minutes, appointment_type, status, priority,
          title, notes, created_at, updated_at, created_by
        ) VALUES (
          gen_random_uuid(),
          $1,
          COALESCE($2::uuid, (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)),
          $3,
          $4,
          $5::appointmenttype,
          $6::appointmentstatus,
          $7::appointmentpriority,
          $8,
          $9,
          NOW(),
          NOW(),
          COALESCE($2::uuid, (SELECT id FROM users ORDER BY created_at ASC LIMIT 1))
        )
        RETURNING *
      `, [
                appointmentData.patientId,
                appointmentData.practitionerId || null,
                `${appointmentData.appointmentDate} ${appointmentData.appointmentTime}`,
                appointmentData.duration || 30,
                appointmentData.type || "CONSULTATION", // ✅ DEFAULT ENUM VALUE
                appointmentData.status || "SCHEDULED", // ✅ DEFAULT ENUM VALUE
                appointmentData.priority || "NORMAL", // ✅ DEFAULT ENUM VALUE (UPPERCASE)
                appointmentData.title || `Appointment on ${appointmentData.appointmentDate}`,
                appointmentData.notes || "",
            ]);
            await client.query("COMMIT");
            const dbRow = result.rows[0];
            // ✅ MAPEO: Extraer fecha y hora de scheduled_date timestamp
            const scheduledDate = new Date(dbRow.scheduled_date);
            const appointmentDate = scheduledDate.toISOString().split('T')[0]; // YYYY-MM-DD
            const appointmentTime = scheduledDate.toTimeString().slice(0, 5); // HH:MM
            // ✅ MAPEO COMPLETO snake_case → camelCase
            const appointment = {
                id: dbRow.id,
                patientId: dbRow.patient_id,
                practitionerId: dbRow.dentist_id,
                appointmentDate,
                appointmentTime,
                duration: dbRow.duration_minutes,
                type: dbRow.appointment_type,
                status: dbRow.status,
                notes: dbRow.notes,
                createdAt: dbRow.created_at,
                updatedAt: dbRow.updated_at,
            };
            // Invalidate cache
            await this.invalidateAppointmentCache();
            // Emit real-time update
            await this.emitRealtimeUpdate("appointments", "created", appointment);
            return appointment;
        }
        catch (error) {
            await client.query("ROLLBACK");
            console.error("💥 Failed to create appointment:", error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * ✏️ UPDATE APPOINTMENT - GraphQL Migration v1.0
     * ✅ MAPEO COMPLETO: camelCase input → snake_case DB → camelCase output
     * ✅ RETURNS: Mapped appointment with updatedAt (CRITICAL!)
     */
    async updateAppointment(id, data) {
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");
            // Build dynamic UPDATE query
            const fields = [];
            const values = [];
            let paramIndex = 1;
            // Handle scheduledDate (timestamp column in DB)
            if (data.scheduledDate !== undefined) {
                fields.push(`scheduled_date = $${paramIndex++}`);
                values.push(data.scheduledDate);
            }
            if (data.duration !== undefined) {
                fields.push(`duration_minutes = $${paramIndex++}`);
                values.push(data.duration);
            }
            if (data.type !== undefined) {
                fields.push(`appointment_type = $${paramIndex++}::appointmenttype`);
                values.push(data.type);
            }
            if (data.status !== undefined) {
                fields.push(`status = $${paramIndex++}::appointmentstatus`);
                values.push(data.status);
            }
            if (data.notes !== undefined) {
                fields.push(`notes = $${paramIndex++}`);
                values.push(data.notes);
            }
            fields.push(`updated_at = NOW()`);
            values.push(id);
            const result = await client.query(`UPDATE appointments SET ${fields.join(", ")} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`, values);
            await client.query("COMMIT");
            if (result.rows.length === 0) {
                throw new Error("Appointment not found");
            }
            const dbRow = result.rows[0];
            // ✅ MAPEO COMPLETO snake_case → camelCase
            // Extract date and time from scheduled_date timestamp
            const scheduledDate = new Date(dbRow.scheduled_date);
            const appointmentDate = scheduledDate.toISOString().split("T")[0];
            const appointmentTime = scheduledDate.toTimeString().slice(0, 5);
            const appointment = {
                id: dbRow.id,
                patientId: dbRow.patient_id,
                practitionerId: dbRow.dentist_id,
                appointmentDate: appointmentDate,
                appointmentTime: appointmentTime,
                duration: dbRow.duration_minutes,
                type: dbRow.appointment_type,
                status: dbRow.status,
                notes: dbRow.notes,
                createdAt: dbRow.created_at,
                updatedAt: dbRow.updated_at, // 🔥 CRITICAL - GraphQL espera esto
            };
            console.log("💥 UPDATE APPOINTMENT RETURNING:", JSON.stringify(appointment, null, 2));
            // Invalidate cache
            await this.invalidateAppointmentCache();
            // Emit real-time update
            await this.emitRealtimeUpdate("appointments", "updated", appointment);
            return appointment;
        }
        catch (error) {
            await client.query("ROLLBACK");
            console.error("💥 Failed to update appointment:", error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * 🗑️ DELETE APPOINTMENT - GraphQL Migration v1.0
     * ✅ Soft delete with deleted_at timestamp
     * ✅ RETURNS: boolean success
     */
    async deleteAppointment(id) {
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");
            const result = await client.query(`UPDATE appointments SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`, [id]);
            await client.query("COMMIT");
            if (result.rows.length === 0) {
                throw new Error("Appointment not found");
            }
            // Invalidate cache
            await this.invalidateAppointmentCache();
            // Emit real-time update
            await this.emitRealtimeUpdate("appointments", "deleted", { id });
            return true;
        }
        catch (error) {
            await client.query("ROLLBACK");
            console.error("💥 Failed to delete appointment:", error);
            return false;
        }
        finally {
            client.release();
        }
    }
    /**
     * 🗑️ Invalidate appointment cache
     */
    async invalidateAppointmentCache() {
        try {
            const keys = await this.getRedis().keys("appointments:*");
            if (keys.length > 0) {
                await this.getRedis().del(keys);
            }
        }
        catch (error) {
            console.error("⚠️ Failed to invalidate appointment cache:", error);
        }
    }
    /**
     * 📡 Emit real-time updates
     */
    async emitRealtimeUpdate(_room, _event, _data) {
        try {
            // This will be connected to Socket.IO in the main server
            await this.getRedis().publish(`realtime:${_room}`, JSON.stringify({
                _event,
                _data,
                timestamp: new Date().toISOString(),
            }));
        }
        catch (error) {
            console.warn("⚠️ Failed to emit realtime update:", error instanceof Error ? error.message : String(error));
        }
    }
    // ============================================================================
    // APPOINTMENT V3 METHODS - API COMPATIBILITY
    // ============================================================================
    async getAppointmentByIdV3(id) {
        const query = `
      SELECT
        id,
        patient_id as "patientId",
        dentist_id as "practitionerId",
        scheduled_date as "appointmentDate",
        duration_minutes as "duration",
        appointment_type as "type",
        status,
        notes,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM appointments
      WHERE id = $1 AND deleted_at IS NULL
    `;
        const result = await this.pool.query(query, [id]);
        if (result.rows.length === 0) {
            return null;
        }
        const dbRow = result.rows[0];
        const scheduledDate = new Date(dbRow.appointmentDate);
        const appointmentDate = scheduledDate.toISOString().split("T")[0];
        const appointmentTime = scheduledDate.toTimeString().slice(0, 5);
        return {
            id: dbRow.id,
            patientId: dbRow.patientId,
            practitionerId: dbRow.practitionerId,
            appointmentDate,
            appointmentTime,
            duration: dbRow.duration,
            type: dbRow.type,
            status: dbRow.status,
            notes: dbRow.notes || "",
            createdAt: dbRow.createdAt,
            updatedAt: dbRow.updatedAt,
        };
    }
    async getAppointmentsByDateV3(date) {
        const query = `
      SELECT
        id,
        patient_id as "patientId",
        dentist_id as "practitionerId",
        scheduled_date as "appointmentDate",
        duration_minutes as "duration",
        appointment_type as "type",
        status,
        notes,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM appointments
      WHERE DATE(scheduled_date) = $1 AND deleted_at IS NULL
      ORDER BY scheduled_date ASC
    `;
        const result = await this.pool.query(query, [date]);
        return result.rows.map((dbRow) => {
            const scheduledDate = new Date(dbRow.appointmentDate);
            const appointmentDate = scheduledDate.toISOString().split("T")[0];
            const appointmentTime = scheduledDate.toTimeString().slice(0, 5);
            return {
                id: dbRow.id,
                patientId: dbRow.patientId,
                practitionerId: dbRow.practitionerId,
                appointmentDate,
                appointmentTime,
                duration: dbRow.duration,
                type: dbRow.type,
                status: dbRow.status,
                notes: dbRow.notes || "",
                createdAt: dbRow.createdAt,
                updatedAt: dbRow.updatedAt,
            };
        });
    }
}
//# sourceMappingURL=AppointmentsDatabase.js.map