/**
 * 🏥 VIRTUAL PATIENT CONSTANTS
 *
 * The Virtual Patient is a special entity that acts as a container for
 * administrative documents that don't belong to any specific patient.
 *
 * Created: August 2025
 * Status: Production-ready
 */
export const VIRTUAL_PATIENT = {
    /**
     * Unique identifier for the Virtual Patient
     * This ID must match the patient record in the database
     */
    ID: 'd76a8a03-1411-4143-85ba-6f064c7b564b',
    /**
     * Display name components
     */
    FIRST_NAME: 'Documentos',
    LAST_NAME: 'Clínica',
    /**
     * Full display name
     */
    FULL_NAME: 'Documentos Clínica',
    /**
     * Default category for Virtual Patient documents
     */
    DEFAULT_CATEGORY: 'administrative',
    /**
     * Icon for UI display
     */
    ICON: '📁',
    /**
     * Check if a patient ID is the Virtual Patient
     */
    isVirtual: (patientId) => {
        return patientId === VIRTUAL_PATIENT.ID;
    },
    /**
     * Get display name with icon
     */
    getDisplayName: () => {
        return `${VIRTUAL_PATIENT.ICON} ${VIRTUAL_PATIENT.FULL_NAME}`;
    },
    /**
     * Validation: Virtual Patient SHOULD be excluded from:
     * - Normal patient queries/lists
     * - Appointments (cannot have appointments)
     * - Medical Records (no clinical history)
     * - Clinical workflows
     * - Patient Portal access
     */
    EXCLUDED_FROM: [
        'patient_lists',
        'patient_search',
        'appointments',
        'medical_records',
        'clinical_workflows',
        'patient_portal'
    ],
    /**
     * Validation: Virtual Patient SHOULD be included in:
     * - Document uploads (administrative category)
     * - Document selectors (for admin docs)
     * - Billing queries (clinic expenses)
     * - Inventory queries (supplier invoices)
     * - Marketplace operations (purchase orders)
     */
    INCLUDED_IN: [
        'document_uploads',
        'document_selectors',
        'billing_clinic_expenses',
        'inventory_supplier_invoices',
        'marketplace_operations'
    ],
    /**
     * Common use cases for Virtual Patient documents
     */
    USE_CASES: {
        legal: [
            'Pólizas de seguro',
            'Certificados y licencias',
            'Contratos de arrendamiento',
            'Documentos legales'
        ],
        financial: [
            'Facturas de proveedores',
            'Estados de cuenta',
            'Gastos fijos',
            'Presupuestos'
        ],
        hr: [
            'Contratos de empleados',
            'Certificaciones profesionales',
            'Documentos de formación'
        ],
        operational: [
            'Manuales de equipos',
            'Garantías',
            'Documentos de mantenimiento'
        ]
    },
    /**
     * Security: RBAC permissions required to access Virtual Patient documents
     */
    REQUIRED_PERMISSIONS: [
        'owner',
        'admin',
        'view_clinic_documents'
    ],
};
/**
 * 🔮 FUTURE: Multiple Virtual Entities
 *
 * The Virtual Patient concept is scalable. Additional virtual entities
 * can be created for specialized document storage:
 */
export const VIRTUAL_ENTITIES = {
    CLINIC_DOCUMENTS: VIRTUAL_PATIENT.ID,
    // HR_DOCUMENTS: '...', // Future: Human Resources
    // LEGAL_DOCUMENTS: '...', // Future: Legal department
    // MARKETING: '...', // Future: Marketing materials
};
/**
 * Helper function to check if a patient ID is any virtual entity
 */
export const isVirtualEntity = (patientId) => {
    if (!patientId)
        return false;
    return Object.values(VIRTUAL_ENTITIES).includes(patientId);
};
/**
 * Helper function to filter out virtual entities from patient lists
 */
export const filterVirtualEntities = (items) => {
    return items.filter(item => {
        const id = item.id || item.patientId;
        return id && !isVirtualEntity(id);
    });
};
//# sourceMappingURL=constants.js.map