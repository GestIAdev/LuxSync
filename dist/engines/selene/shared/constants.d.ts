/**
 * 🏥 VIRTUAL PATIENT CONSTANTS
 *
 * The Virtual Patient is a special entity that acts as a container for
 * administrative documents that don't belong to any specific patient.
 *
 * Created: August 2025
 * Status: Production-ready
 */
export declare const VIRTUAL_PATIENT: {
    /**
     * Unique identifier for the Virtual Patient
     * This ID must match the patient record in the database
     */
    ID: string;
    /**
     * Display name components
     */
    FIRST_NAME: string;
    LAST_NAME: string;
    /**
     * Full display name
     */
    FULL_NAME: string;
    /**
     * Default category for Virtual Patient documents
     */
    DEFAULT_CATEGORY: "administrative";
    /**
     * Icon for UI display
     */
    ICON: string;
    /**
     * Check if a patient ID is the Virtual Patient
     */
    isVirtual: (patientId: string | undefined) => boolean;
    /**
     * Get display name with icon
     */
    getDisplayName: () => string;
    /**
     * Validation: Virtual Patient SHOULD be excluded from:
     * - Normal patient queries/lists
     * - Appointments (cannot have appointments)
     * - Medical Records (no clinical history)
     * - Clinical workflows
     * - Patient Portal access
     */
    EXCLUDED_FROM: readonly ["patient_lists", "patient_search", "appointments", "medical_records", "clinical_workflows", "patient_portal"];
    /**
     * Validation: Virtual Patient SHOULD be included in:
     * - Document uploads (administrative category)
     * - Document selectors (for admin docs)
     * - Billing queries (clinic expenses)
     * - Inventory queries (supplier invoices)
     * - Marketplace operations (purchase orders)
     */
    INCLUDED_IN: readonly ["document_uploads", "document_selectors", "billing_clinic_expenses", "inventory_supplier_invoices", "marketplace_operations"];
    /**
     * Common use cases for Virtual Patient documents
     */
    USE_CASES: {
        readonly legal: readonly ["Pólizas de seguro", "Certificados y licencias", "Contratos de arrendamiento", "Documentos legales"];
        readonly financial: readonly ["Facturas de proveedores", "Estados de cuenta", "Gastos fijos", "Presupuestos"];
        readonly hr: readonly ["Contratos de empleados", "Certificaciones profesionales", "Documentos de formación"];
        readonly operational: readonly ["Manuales de equipos", "Garantías", "Documentos de mantenimiento"];
    };
    /**
     * Security: RBAC permissions required to access Virtual Patient documents
     */
    REQUIRED_PERMISSIONS: readonly ["owner", "admin", "view_clinic_documents"];
};
/**
 * 🔮 FUTURE: Multiple Virtual Entities
 *
 * The Virtual Patient concept is scalable. Additional virtual entities
 * can be created for specialized document storage:
 */
export declare const VIRTUAL_ENTITIES: {
    readonly CLINIC_DOCUMENTS: string;
};
/**
 * Helper function to check if a patient ID is any virtual entity
 */
export declare const isVirtualEntity: (patientId: string | undefined) => boolean;
/**
 * Helper function to filter out virtual entities from patient lists
 */
export declare const filterVirtualEntities: <T extends {
    id?: string;
    patientId?: string;
}>(items: T[]) => T[];
//# sourceMappingURL=constants.d.ts.map