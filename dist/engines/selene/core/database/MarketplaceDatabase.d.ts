import { BaseDatabase } from './BaseDatabase.js';
export declare class MarketplaceDatabase extends BaseDatabase {
    getSuppliersV3(args: {
        limit?: number;
        offset?: number;
        isActive?: boolean;
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
    receivePurchaseOrderV3(id: string, receivedItems: any[]): Promise<any>;
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
    getMarketplaceProductsV3(args: {
        supplierId?: string;
        category?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    getMarketplaceProductV3(id: string): Promise<any>;
    addToCartV3(input: any): Promise<any>;
    updateCartItemV3(id: string, input: any): Promise<any>;
    removeFromCartV3(id: string): Promise<void>;
    clearCartV3(): Promise<void>;
    getCartItemsV3(args: {
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    getCartItemById(id: string): Promise<any>;
}
//# sourceMappingURL=MarketplaceDatabase.d.ts.map