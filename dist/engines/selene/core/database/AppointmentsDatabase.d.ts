import { BaseDatabase } from './BaseDatabase.js';
/**
 * 🎯 APPOINTMENTS DATABASE - Specialized Database Class
 * ✅ MODULARIZED: Extracted from monolithic Database.ts
 * ✅ RESPONSIBILITY: Handle all appointment-related operations
 * ✅ INHERITANCE: Extends BaseDatabase for shared functionality
 */
export declare class AppointmentsDatabase extends BaseDatabase {
    /**
     * 📅 GET APPOINTMENTS - GraphQL Migration v1.0
     * ✅ MAPEO COMPLETO: snake_case DB → camelCase GraphQL
     * ✅ REAL TABLE: appointments (not medical_records workaround)
     * ✅ FIELDS: id, patientId, practitionerId, date, time, appointmentDate, appointmentTime, duration, type, status, notes, createdAt, updatedAt
     */
    getAppointments(filters?: any): Promise<any[]>;
    /**
     * ➕ CREATE APPOINTMENT - GraphQL Migration v1.0
     * ✅ MAPEO COMPLETO: camelCase input → snake_case DB → camelCase output
     * ✅ RETURNS: Mapped appointment object with createdAt/updatedAt
     */
    createAppointment(appointmentData: any): Promise<any>;
    /**
     * ✏️ UPDATE APPOINTMENT - GraphQL Migration v1.0
     * ✅ MAPEO COMPLETO: camelCase input → snake_case DB → camelCase output
     * ✅ RETURNS: Mapped appointment with updatedAt (CRITICAL!)
     */
    updateAppointment(id: string, data: any): Promise<any>;
    /**
     * 🗑️ DELETE APPOINTMENT - GraphQL Migration v1.0
     * ✅ Soft delete with deleted_at timestamp
     * ✅ RETURNS: boolean success
     */
    deleteAppointment(id: string): Promise<boolean>;
    /**
     * 🗑️ Invalidate appointment cache
     */
    private invalidateAppointmentCache;
    /**
     * 📡 Emit real-time updates
     */
    protected emitRealtimeUpdate(_room: string, _event: string, _data: any): Promise<void>;
    getAppointmentByIdV3(id: string): Promise<any>;
    getAppointmentsByDateV3(date: string): Promise<any[]>;
}
//# sourceMappingURL=AppointmentsDatabase.d.ts.map