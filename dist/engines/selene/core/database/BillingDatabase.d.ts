import { BaseDatabase } from './BaseDatabase.js';
export declare class BillingDatabase extends BaseDatabase {
    /**
     * Obtiene datos de facturación con filtros opcionales (SCHEMA COMPLETO)
     */
    getBillingDataV3(args: {
        patientId?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    /**
     * Obtiene un dato de facturación por ID
     */
    getBillingDatumV3ById(id: string): Promise<any>;
    /**
     * 💰 Crea un nuevo dato de facturación con ECONOMIC SINGULARITY (DIRECTIVA #005)
     * Alineado con: BILLING_V_ALL_MIGRATION.md + Economic Singularity
     * Tabla: billing_data (invoice_number, subtotal, tax_amount, total_amount, treatment_id, material_cost, profit_margin, etc.)
     */
    createBillingDataV3(input: any): Promise<any>;
    /**
     * Actualiza un dato de facturación existente (SCHEMA COMPLETO)
     */
    updateBillingDataV3(id: string, input: any): Promise<any>;
    /**
     * Elimina un dato de facturación
     */
    deleteBillingDataV3(id: string): Promise<void>;
    /**
     * Crea un nuevo plan de pagos en la DB
     * Tabla: payment_plans
     * Status por defecto: 'active'
     */
    createPaymentPlan(input: {
        billingId: string;
        patientId: string;
        totalAmount: number;
        installmentsCount: number;
        installmentAmount: number;
        frequency: string;
        startDate: string;
        endDate?: string;
        userId?: string;
    }): Promise<any>;
    /**
     * Obtiene planes de pagos por filtros
     * Filtros: billingId, patientId, status
     */
    getPaymentPlans(filters: {
        billingId?: string;
        patientId?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    /**
     * Obtiene un plan de pagos por ID
     */
    getPaymentPlanById(id: string): Promise<any>;
    /**
     * Actualiza el status de un plan de pagos
     */
    updatePaymentPlanStatus(id: string, status: string): Promise<any>;
    /**
     * Cancela (soft-delete) un plan de pagos
     */
    cancelPaymentPlan(id: string, userId?: string): Promise<boolean>;
    /**
     * Alias para getBillingDatumV3ById (consistencia con naming conventions)
     */
    getBillingDataById(id: string): Promise<any>;
    /**
     * Registra un pago parcial (TRANSACCIONAL - Puente Agnóstico)
     * Esta mutación es crítica porque maneja dinero real del sistema de pagos.
     *
     * FLUJO TRANSACCIONAL (BEGIN/COMMIT):
     * 1. Inserta el pago en 'partial_payments' (status='completed')
     * 2. Recalcula el total pagado de la factura (SUM de partial_payments)
     * 3. Actualiza el status de 'billing_data' (PENDING → PARTIAL → PAID)
     * 4. Actualiza paid_date si la factura queda completamente pagada
     *
     * Si cualquier paso falla, hace ROLLBACK para mantener consistencia.
     *
     * @returns { newPayment, updatedInvoice } - Ambos objetos actualizados
     */
    recordPartialPayment(input: {
        invoiceId: string;
        patientId: string;
        paymentPlanId?: string;
        amount: number;
        currency: string;
        method: string;
        transactionId?: string;
        reference?: string;
        metadata?: any;
        userId?: string;
    }): Promise<{
        newPayment: any;
        updatedInvoice: any;
    }>;
    /**
     * Obtiene todos los pagos parciales de una factura
     */
    getPartialPayments(filters: {
        invoiceId: string;
        patientId?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    /**
     * Obtiene un pago parcial por ID
     */
    getPartialPaymentById(id: string): Promise<any>;
    /**
     * Obtiene recordatorios de pago con filtros opcionales
     */
    getPaymentReminders(filters: {
        billingId?: string;
        patientId?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    /**
     * Programa un nuevo recordatorio de pago
     */
    scheduleReminder(data: {
        billingId: string;
        patientId: string;
        scheduledAt: string;
        reminderType: string;
        messageTemplate: string;
        metadata?: any;
    }): Promise<any>;
    /**
     * Marca un recordatorio como enviado
     */
    sendReminder(reminderId: string): Promise<any>;
    /**
     * Obtiene recibos de pago con filtros opcionales
     */
    getPaymentReceipts(filters: {
        invoiceId: string;
        patientId?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    /**
     * Obtiene un recibo de pago por ID
     */
    getPaymentReceiptById(id: string): Promise<any>;
    /**
     * Genera un recibo de pago con firma Veritas SHA-256
     */
    generateReceipt(data: {
        paymentId: string;
        billingId: string;
        patientId: string;
        receiptNumber: string;
        totalAmount: number;
        paidAmount: number;
        balanceRemaining: number;
        metadata?: any;
    }): Promise<any>;
    /**
     * Genera firma Veritas para recordatorio (SHA-256 hash)
     */
    private generateReminderSignature;
    /**
     * Genera firma Veritas para recibo (SHA-256 hash)
     * Esta es la firma crítica que garantiza inmutabilidad del recibo
     */
    private generateReceiptSignature;
}
//# sourceMappingURL=BillingDatabase.d.ts.map