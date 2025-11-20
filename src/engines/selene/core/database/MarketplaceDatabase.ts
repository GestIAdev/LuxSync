import { BaseDatabase } from './BaseDatabase.js';

export class MarketplaceDatabase extends BaseDatabase {
  // ============================================================================
  // SUPPLIERS V3 METHODS
  // ============================================================================

  async getSuppliersV3(args: {
    limit?: number;
    offset?: number;
    isActive?: boolean;
  }): Promise<any[]> {
    const { limit = 50, offset = 0, isActive } = args;

    let query = `
      SELECT
        id, name, contact_person, email, phone, address,
        is_active, payment_terms, delivery_time_days, 
        minimum_order_value, rating, notes, created_at, updated_at
      FROM suppliers
    `;

    const params: any[] = [];

    if (isActive !== undefined) {
      query += ` WHERE is_active = $${params.length + 1}`;
      params.push(isActive);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    return await this.getAll(query, params);
  }

  async getSupplierV3ById(id: string): Promise<any> {
    const query = `SELECT * FROM suppliers WHERE id = $1`;
    return await this.getOne(query, [id]);
  }

  async createSupplierV3(input: any): Promise<any> {
    const {
      name,
      contactPerson,
      email,
      phone,
      address,
      isActive = true,
      paymentTerms,
      deliveryTimeDays,
      minimumOrderValue,
      rating,
      notes
    } = input;

    const query = `
      INSERT INTO suppliers (
        name, contact_person, email, phone, address,
        is_active, payment_terms, delivery_time_days, 
        minimum_order_value, rating, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *
    `;
    const params = [
      name, contactPerson, email, phone, address, 
      isActive, paymentTerms, deliveryTimeDays, 
      minimumOrderValue, rating, notes
    ];

    const result = await this.runQuery(query, params);
    return result.rows[0];
  }

  async updateSupplierV3(id: string, input: any): Promise<any> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.contactPerson !== undefined) {
      updates.push(`contact_person = $${paramIndex++}`);
      values.push(input.contactPerson);
    }
    if (input.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(input.email);
    }
    if (input.phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(input.phone);
    }
    if (input.address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      values.push(input.address);
    }
    if (input.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(input.isActive);
    }
    if (input.paymentTerms !== undefined) {
      updates.push(`payment_terms = $${paramIndex++}`);
      values.push(input.paymentTerms);
    }
    if (input.deliveryTimeDays !== undefined) {
      updates.push(`delivery_time_days = $${paramIndex++}`);
      values.push(input.deliveryTimeDays);
    }
    if (input.minimumOrderValue !== undefined) {
      updates.push(`minimum_order_value = $${paramIndex++}`);
      values.push(input.minimumOrderValue);
    }
    if (input.rating !== undefined) {
      updates.push(`rating = $${paramIndex++}`);
      values.push(input.rating);
    }
    if (input.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(input.notes);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE suppliers
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.runQuery(query, values);
    return result.rows[0];
  }

  async deleteSupplierV3(id: string): Promise<void> {
    const query = `DELETE FROM suppliers WHERE id = $1`;
    await this.runQuery(query, [id]);
  }

  // ============================================================================
  // PURCHASE ORDERS V3 METHODS
  // ============================================================================

  async getPurchaseOrdersV3(args: {
    supplierId?: string;
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<any[]> {
    const { supplierId, limit = 50, offset = 0, status } = args;

    let query = `
      SELECT
        id, order_number, supplier_id, status, order_date,
        expected_delivery_date, actual_delivery_date, total_amount, 
        tax_amount, discount_amount, notes, 
        approved_by, received_by, created_at, updated_at
      FROM purchase_orders
    `;

    const params: any[] = [];

    if (supplierId || status) {
      query += ` WHERE`;
      const conditions: string[] = [];

      if (supplierId) {
        conditions.push(` supplier_id = $${params.length + 1}`);
        params.push(supplierId);
      }
      if (status) {
        conditions.push(` status = $${params.length + 1}`);
        params.push(status);
      }

      query += conditions.join(' AND ');
    }

    query += ` ORDER BY order_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    return await this.getAll(query, params);
  }

  async getPurchaseOrderV3ById(id: string): Promise<any> {
    const query = `SELECT * FROM purchase_orders WHERE id = $1`;
    return await this.getOne(query, [id]);
  }

  async createPurchaseOrderV3(input: any): Promise<any> {
    const {
      supplierId,
      orderDate,
      expectedDeliveryDate,
      notes,
      items
    } = input;

    // Generate order number
    const orderNumber = `PO-${Date.now()}`;

    // Calculate total amount from items
    let totalAmount = 0;
    if (items && items.length > 0) {
      totalAmount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
    }

    const query = `
      INSERT INTO purchase_orders (
        order_number, supplier_id, status, order_date,
        expected_delivery_date, total_amount, notes,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `;
    const params = [orderNumber, supplierId, 'DRAFT', orderDate, expectedDeliveryDate, totalAmount, notes];

    const result = await this.runQuery(query, params);
    const purchaseOrder = result.rows[0];

    // Add items if provided
    if (items && items.length > 0) {
      for (const item of items) {
        await this.addPurchaseOrderItemV3(purchaseOrder.id, item);
      }
    }

    return purchaseOrder;
  }

  async updatePurchaseOrderV3(id: string, input: any): Promise<any> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.expectedDeliveryDate !== undefined) {
      updates.push(`expected_delivery_date = $${paramIndex++}`);
      values.push(input.expectedDeliveryDate);
    }
    if (input.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(input.notes);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE purchase_orders
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.runQuery(query, values);
    return result.rows[0];
  }

  async approvePurchaseOrderV3(id: string, approverId: string): Promise<any> {
    const query = `
      UPDATE purchase_orders
      SET status = 'APPROVED', approved_by = $1, approved_at = NOW(), updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await this.runQuery(query, [approverId, id]);
    return result.rows[0];
  }

  async cancelPurchaseOrderV3(id: string, reason?: string): Promise<any> {
    const query = `
      UPDATE purchase_orders
      SET status = 'CANCELLED', cancellation_reason = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await this.runQuery(query, [reason, id]);
    return result.rows[0];
  }

  async receivePurchaseOrderV3(id: string, receivedItems: any[]): Promise<any> {
    // Update received quantities for items
    for (const item of receivedItems) {
      await this.runQuery(
        `UPDATE purchase_order_items
         SET received_quantity = received_quantity + $1, updated_at = NOW()
         WHERE id = $2`,
        [item.receivedQuantity, item.id]
      );
    }

    // Check if all items are fully received
    const itemsResult = await this.runQuery(
      `SELECT COUNT(*) as total, COUNT(CASE WHEN quantity <= received_quantity THEN 1 END) as received
       FROM purchase_order_items
       WHERE purchase_order_id = $1`,
      [id]
    );

    const { total, received } = itemsResult.rows[0];
    const status = total === received ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

    const result = await this.runQuery(
      `UPDATE purchase_orders
       SET status = $1, actual_delivery_date = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    return result.rows[0];
  }

  async deletePurchaseOrderV3(id: string): Promise<void> {
    const query = `DELETE FROM purchase_orders WHERE id = $1`;
    await this.runQuery(query, [id]);
  }

  // ============================================================================
  // PURCHASE ORDER ITEMS V3 METHODS
  // ============================================================================

  async getPurchaseOrderItemsV3(purchaseOrderId: string): Promise<any[]> {
    const query = `
      SELECT
        id, purchase_order_id, material_id, quantity,
        unit_price, total_price, received_quantity, created_at, updated_at
      FROM purchase_order_items
      WHERE purchase_order_id = $1
      ORDER BY created_at ASC
    `;
    return await this.getAll(query, [purchaseOrderId]);
  }

  async getPurchaseOrderItemV3ById(id: string): Promise<any> {
    const query = `
      SELECT
        id, purchase_order_id, material_id, quantity,
        unit_price, total_price, received_quantity, created_at, updated_at
      FROM purchase_order_items
      WHERE id = $1
    `;
    return await this.getOne(query, [id]);
  }

  async addPurchaseOrderItemV3(purchaseOrderId: string, input: any): Promise<any> {
    const { materialId, quantity, unitPrice } = input;
    const totalPrice = quantity * unitPrice;

    const query = `
      INSERT INTO purchase_order_items (
        purchase_order_id, material_id, quantity, unit_price,
        total_price, received_quantity, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `;
    const params = [purchaseOrderId, materialId, quantity, unitPrice, totalPrice, 0];

    const result = await this.runQuery(query, params);

    // Update purchase order total
    await this.updatePurchaseOrderTotalV3(purchaseOrderId);

    return result.rows[0];
  }

  async updatePurchaseOrderItemV3(id: string, input: any): Promise<any> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.quantity !== undefined) {
      updates.push(`quantity = $${paramIndex++}`);
      values.push(input.quantity);
      // Recalculate total price
      if (input.unitPrice !== undefined) {
        updates.push(`total_price = $${paramIndex++}`);
        values.push(input.quantity * input.unitPrice);
      } else {
        // Get current unit price and recalculate
        const current = await this.runQuery(
          `SELECT unit_price FROM purchase_order_items WHERE id = $1`,
          [id]
        );
        if (current.rows[0]) {
          updates.push(`total_price = $${paramIndex++}`);
          values.push(input.quantity * current.rows[0].unit_price);
        }
      }
    }

    if (input.unitPrice !== undefined) {
      updates.push(`unit_price = $${paramIndex++}`);
      values.push(input.unitPrice);
      // Recalculate total price
      const current = await this.runQuery(
        `SELECT quantity FROM purchase_order_items WHERE id = $1`,
        [id]
      );
      if (current.rows[0]) {
        updates.push(`total_price = $${paramIndex++}`);
        values.push(current.rows[0].quantity * input.unitPrice);
      }
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE purchase_order_items
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.runQuery(query, values);

    // Update purchase order total
    const item = result.rows[0];
    await this.updatePurchaseOrderTotalV3(item.purchase_order_id);

    return item;
  }

  async removePurchaseOrderItemV3(id: string): Promise<void> {
    // Get purchase order ID before deleting
    const itemResult = await this.runQuery(
      `SELECT purchase_order_id FROM purchase_order_items WHERE id = $1`,
      [id]
    );

    if (itemResult.rows[0]) {
      const purchaseOrderId = itemResult.rows[0].purchase_order_id;

      await this.runQuery(
        `DELETE FROM purchase_order_items WHERE id = $1`,
        [id]
      );

      // Update purchase order total
      await this.updatePurchaseOrderTotalV3(purchaseOrderId);
    }
  }

  // ============================================================================
  // PURCHASE ORDER HELPER METHODS
  // ============================================================================

  async updatePurchaseOrderTotalV3(purchaseOrderId: string): Promise<void> {
    const result = await this.runQuery(
      `SELECT COALESCE(SUM(total_price), 0) as total FROM purchase_order_items
       WHERE purchase_order_id = $1`,
      [purchaseOrderId]
    );

    const total = result.rows[0].total;

    await this.runQuery(
      `UPDATE purchase_orders SET total_amount = $1, updated_at = NOW() WHERE id = $2`,
      [total, purchaseOrderId]
    );
  }

  // ============================================================================
  // SUPPLIER HELPER METHODS
  // ============================================================================

  async getSupplierPurchaseOrdersV3(args: { supplierId: string; limit?: number }): Promise<any[]> {
    const { supplierId, limit = 20 } = args;

    const query = `
      SELECT
        id, order_number, status, order_date, total_amount
      FROM purchase_orders
      WHERE supplier_id = $1
      ORDER BY order_date DESC
      LIMIT $2
    `;
    return await this.getAll(query, [supplierId, limit]);
  }

  async getSupplierMaterialsV3(supplierId: string): Promise<any[]> {
    const query = `
      SELECT DISTINCT
        m.id, m.name, m.description, m.category, m.unit
      FROM materials m
      INNER JOIN purchase_order_items poi ON m.id = poi.material_id
      INNER JOIN purchase_orders po ON poi.purchase_order_id = po.id
      WHERE po.supplier_id = $1
    `;
    return await this.getAll(query, [supplierId]);
  }

  async getSupplierTotalOrdersV3(supplierId: string): Promise<number> {
    const result = await this.runQuery(
      `SELECT COUNT(*) as total FROM purchase_orders WHERE supplier_id = $1`,
      [supplierId]
    );

    return parseInt(result.rows[0].total) || 0;
  }

  async getSupplierTotalSpentV3(supplierId: string): Promise<number> {
    const result = await this.runQuery(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_orders
       WHERE supplier_id = $1 AND status IN ('RECEIVED', 'PARTIALLY_RECEIVED')`,
      [supplierId]
    );

    return parseFloat(result.rows[0].total) || 0;
  }

  // ============================================================================
  // MARKETPLACE PRODUCTS V3 METHODS - B2B DENTAL SUPPLY SYSTEM
  // ============================================================================

  async getMarketplaceProductsV3(args: {
    supplierId?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const { supplierId, category, limit = 50, offset = 0 } = args;

    let query = `
      SELECT
        mp.id, mp.name, mp.description, mp.category, mp.unit_price,
        mp.unit, mp.minimum_order_quantity, mp.lead_time_days,
        mp.supplier_id, mp.is_active, mp.created_at, mp.updated_at,
        s.name as supplier_name, s.contact_email, s.contact_phone
      FROM marketplace_products mp
      LEFT JOIN suppliers s ON mp.supplier_id = s.id
      WHERE mp.is_active = true
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (supplierId) {
      conditions.push(`mp.supplier_id = $${params.length + 1}`);
      params.push(supplierId);
    }

    if (category) {
      conditions.push(`mp.category = $${params.length + 1}`);
      params.push(category);
    }

    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY mp.name ASC`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    return await this.getAll(query, params);
  }

  async getMarketplaceProductV3(id: string): Promise<any> {
    const query = `
      SELECT
        mp.*,
        s.name as supplier_name, s.contact_email, s.contact_phone,
        s.address, s.rating, s.is_verified
      FROM marketplace_products mp
      LEFT JOIN suppliers s ON mp.supplier_id = s.id
      WHERE mp.id = $1 AND mp.is_active = true
    `;
    return await this.getOne(query, [id]);
  }

  // ============================================================================
  // CART V3 METHODS
  // ============================================================================

  async addToCartV3(input: any): Promise<any> {
    const {
      marketplaceProductId,
      quantity,
      unitPrice
    } = input;

    // Check if item already exists in cart
    const existing = await this.runQuery(
      `SELECT id, quantity FROM cart_items WHERE marketplace_product_id = $1`,
      [marketplaceProductId]
    );

    if (existing.rows.length > 0) {
      // Update existing item
      const newQuantity = existing.rows[0].quantity + quantity;
      const totalPrice = newQuantity * unitPrice;

      const result = await this.runQuery(
        `UPDATE cart_items
         SET quantity = $1, total_price = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [newQuantity, totalPrice, existing.rows[0].id]
      );

      return result.rows[0];
    } else {
      // Add new item
      const totalPrice = quantity * unitPrice;

      const result = await this.runQuery(
        `INSERT INTO cart_items (
          marketplace_product_id, quantity, unit_price, total_price, added_at
        ) VALUES ($1, $2, $3, $4, NOW())
        RETURNING *`,
        [marketplaceProductId, quantity, unitPrice, totalPrice]
      );

      return result.rows[0];
    }
  }

  async updateCartItemV3(id: string, input: any): Promise<any> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.quantity !== undefined) {
      updates.push(`quantity = $${paramIndex++}`);
      values.push(input.quantity);

      // Get current unit price to recalculate total
      const current = await this.runQuery(
        `SELECT unit_price FROM cart_items WHERE id = $1`,
        [id]
      );
      if (current.rows[0]) {
        updates.push(`total_price = $${paramIndex++}`);
        values.push(input.quantity * current.rows[0].unit_price);
      }
    }

    if (input.unitPrice !== undefined) {
      updates.push(`unit_price = $${paramIndex++}`);
      values.push(input.unitPrice);

      // Recalculate total with new unit price
      const current = await this.runQuery(
        `SELECT quantity FROM cart_items WHERE id = $1`,
        [id]
      );
      if (current.rows[0]) {
        updates.push(`total_price = $${paramIndex++}`);
        values.push(current.rows[0].quantity * input.unitPrice);
      }
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE cart_items
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.runQuery(query, values);
    return result.rows[0];
  }

  async removeFromCartV3(id: string): Promise<void> {
    const query = `DELETE FROM cart_items WHERE id = $1`;
    await this.runQuery(query, [id]);
  }

  async clearCartV3(): Promise<void> {
    const query = `DELETE FROM cart_items`;
    await this.runQuery(query);
  }

  async getCartItemsV3(args: {
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const { limit = 50, offset = 0 } = args;

    const query = `
      SELECT
        id, marketplace_product_id, quantity, unit_price,
        total_price, added_at, created_at, updated_at
      FROM cart_items
      ORDER BY added_at DESC
      LIMIT $1 OFFSET $2
    `;
    return await this.getAll(query, [limit, offset]);
  }

  async getCartItemById(id: string): Promise<any> {
    const query = `
      SELECT
        id, marketplace_product_id as materialId, quantity, unit_price,
        total_price, added_at, created_at, updated_at
      FROM cart_items
      WHERE id = $1
    `;
    return await this.getOne(query, [id]);
  }
}