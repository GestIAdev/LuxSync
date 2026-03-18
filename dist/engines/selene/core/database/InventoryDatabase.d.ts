import { BaseDatabase } from './BaseDatabase.js';
export declare class InventoryDatabase extends BaseDatabase {
    getInventoriesV3(args: {
        limit?: number;
        offset?: number;
        category?: string;
    }): Promise<any[]>;
    getInventoryV3ById(id: string): Promise<any>;
    createInventoryV3(input: any): Promise<any>;
    updateInventoryV3(id: string, input: any): Promise<any>;
    deleteInventoryV3(id: string): Promise<void>;
    adjustInventoryStockV3(id: string, adjustment: number, reason: string): Promise<any>;
    getMaterialsV3(args: {
        limit?: number;
        offset?: number;
        category?: string;
        supplierId?: string;
    }): Promise<any[]>;
    getMaterialV3ById(id: string): Promise<any>;
    createMaterialV3(input: any): Promise<any>;
    updateMaterialV3(id: string, input: any): Promise<any>;
    deleteMaterialV3(id: string): Promise<void>;
    reorderMaterialV3(materialId: string, quantity: number, supplierId?: string): Promise<any>;
    getInventoryDashboardV3(): Promise<any>;
    getInventoryAlertsV3(args: {
        limit?: number;
    }): Promise<any[]>;
    acknowledgeInventoryAlertV3(alertId: string): Promise<void>;
    getEquipmentsV3(args: {
        limit?: number;
        offset?: number;
        category?: string;
        status?: string;
    }): Promise<any[]>;
    getEquipmentV3ById(id: string): Promise<any>;
    createEquipmentV3(input: any): Promise<any>;
    updateEquipmentV3(id: string, input: any): Promise<any>;
    deleteEquipmentV3(id: string): Promise<void>;
    getMaintenancesV3(args: {
        equipmentId?: string;
        limit?: number;
        offset?: number;
        status?: string;
    }): Promise<any[]>;
    getMaintenanceV3ById(id: string): Promise<any>;
    createMaintenanceV3(input: any): Promise<any>;
    updateMaintenanceV3(id: string, input: any): Promise<any>;
    completeMaintenanceV3(id: string, completionNotes?: string): Promise<any>;
    scheduleMaintenanceV3(equipmentId: string, scheduledDate: string, maintenanceType: string, description?: string): Promise<any>;
    cancelMaintenanceV3(id: string, reason?: string): Promise<void>;
    getEquipmentMaintenanceScheduleV3(equipmentId: string): Promise<any[]>;
    getMaintenanceHistoryV3(args: {
        equipmentId: string;
        limit?: number;
    }): Promise<any[]>;
    getEquipmentCurrentStatusV3(equipmentId: string): Promise<any>;
    getEquipmentNextMaintenanceDueV3(equipmentId: string): Promise<string | null>;
    getSupplierById(id: string): Promise<any>;
    getMaterialSuppliersV3(materialId: string): Promise<any[]>;
    getMaterialStockLevelsV3(materialId: string): Promise<any[]>;
    getUserById(id: string): Promise<any>;
    getSuppliers(args: {
        limit?: number;
        offset?: number;
        category?: string;
        status?: string;
    }): Promise<any[]>;
    createSupplier(input: any): Promise<any>;
    updateSupplier(id: string, input: any): Promise<any>;
    deleteSupplier(id: string): Promise<void>;
    getPurchaseOrders(args: {
        supplierId?: string;
        limit?: number;
        offset?: number;
        status?: string;
    }): Promise<any[]>;
    getPurchaseOrderById(id: string): Promise<any>;
    createPurchaseOrder(input: any): Promise<any>;
    updatePurchaseOrder(id: string, input: any): Promise<any>;
    approvePurchaseOrder(id: string, approverId: string): Promise<any>;
    cancelPurchaseOrder(id: string, reason?: string): Promise<any>;
    receivePurchaseOrder(id: string, receivedBy: string): Promise<any>;
    deletePurchaseOrder(id: string): Promise<void>;
    getPurchaseOrderItems(purchaseOrderId: string): Promise<any[]>;
    getPurchaseOrderItemById(id: string): Promise<any>;
    addPurchaseOrderItem(purchaseOrderId: string, input: any): Promise<any>;
    updatePurchaseOrderItem(id: string, input: any): Promise<any>;
    removePurchaseOrderItem(id: string): Promise<void>;
    updatePurchaseOrderTotal(purchaseOrderId: string): Promise<void>;
    getSupplierPurchaseOrders(args: {
        supplierId: string;
        limit?: number;
    }): Promise<any[]>;
    getSupplierMaterials(supplierId: string): Promise<any[]>;
    getSupplierTotalOrders(supplierId: string): Promise<number>;
    getSupplierTotalSpent(supplierId: string): Promise<number>;
    getSuppliersV3(args: {
        limit?: number;
        offset?: number;
        category?: string;
        status?: string;
    }): Promise<any[]>;
    getSupplierV3ById(id: string): Promise<any>;
    createSupplierV3(input: any): Promise<any>;
    updateSupplierV3(id: string, input: any): Promise<any>;
    deleteSupplierV3(id: string): Promise<void>;
    getPurchaseOrdersV3(args: {
        supplierId?: string;
        limit?: number;
        offset?: number;
        status?: string;
    }): Promise<any[]>;
    getPurchaseOrderV3ById(id: string): Promise<any>;
    createPurchaseOrderV3(input: any): Promise<any>;
    updatePurchaseOrderV3(id: string, input: any): Promise<any>;
    approvePurchaseOrderV3(id: string, approverId: string): Promise<any>;
    cancelPurchaseOrderV3(id: string, reason?: string): Promise<any>;
    receivePurchaseOrderV3(id: string, receivedBy: string): Promise<any>;
    deletePurchaseOrderV3(id: string): Promise<void>;
    getPurchaseOrderItemsV3(purchaseOrderId: string): Promise<any[]>;
    getPurchaseOrderItemV3ById(id: string): Promise<any>;
    addPurchaseOrderItemV3(purchaseOrderId: string, input: any): Promise<any>;
    updatePurchaseOrderItemV3(id: string, input: any): Promise<any>;
    removePurchaseOrderItemV3(id: string): Promise<void>;
    updatePurchaseOrderTotalV3(purchaseOrderId: string): Promise<void>;
    getSupplierPurchaseOrdersV3(args: {
        supplierId: string;
        limit?: number;
    }): Promise<any[]>;
    getSupplierMaterialsV3(supplierId: string): Promise<any[]>;
    getSupplierTotalOrdersV3(supplierId: string): Promise<number>;
    getSupplierTotalSpentV3(supplierId: string): Promise<number>;
}
//# sourceMappingURL=InventoryDatabase.d.ts.map