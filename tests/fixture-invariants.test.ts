import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeCartPricing,
  calculateFinalPricing,
  recalculateOrderFinancials,
  calculateStateTax,
  calculateShippingCost,
  getNextOrderStatus,
  canRefundOrder,
  getMockProducts,
  getMockOrders,
  createMockOrder,
  updateMockOrderStatus,
  refundMockOrder,
  resetMockDb,
  CartItem,
} from '../fixtures/vibe-mart/src/index';

describe('VibeMart Fixture Invariants & Anti-Pattern Verification', () => {
  beforeEach(() => {
    resetMockDb();
  });

  const makeItem = (price: number, quantity: number = 1): CartItem => ({
    id: `item-${price}`,
    productId: `prod-${price}`,
    sku: `SKU-${price}`,
    name: `Test Product $${price}`,
    price,
    quantity,
    category: 'electronics',
  });

  describe('Duplicated Pricing Algorithm Invariance across all 3 locations', () => {
    it('calculates 0% discount for subtotal < $100 across all 3 components', () => {
      const items = [makeItem(90, 1)];

      const r1 = computeCartPricing(items);
      const r2 = calculateFinalPricing(items);
      const r3 = recalculateOrderFinancials(items);

      expect(r1).toEqual({ subtotal: 90, discountPercent: 0, discountAmount: 0, netTotal: 90 });
      expect(r2).toEqual(r1);
      expect(r3).toEqual(r1);
    });

    it('calculates 10% volume tier discount for $100 <= subtotal < $200', () => {
      const items = [makeItem(60, 2)]; // 120

      const r1 = computeCartPricing(items);
      const r2 = calculateFinalPricing(items);
      const r3 = recalculateOrderFinancials(items);

      expect(r1).toEqual({ subtotal: 120, discountPercent: 10, discountAmount: 12, netTotal: 108 });
      expect(r2).toEqual(r1);
      expect(r3).toEqual(r1);
    });

    it('calculates 15% volume tier discount for subtotal >= $200', () => {
      const items = [makeItem(250, 1)];

      const r1 = computeCartPricing(items);
      const r2 = calculateFinalPricing(items);
      const r3 = recalculateOrderFinancials(items);

      expect(r1).toEqual({ subtotal: 250, discountPercent: 15, discountAmount: 37.5, netTotal: 212.5 });
      expect(r2).toEqual(r1);
      expect(r3).toEqual(r1);
    });

    it('correctly stacks coupon code VIBE20 (+20%) on $200 subtotal (35% total)', () => {
      const items = [makeItem(100, 2)]; // 200

      const r1 = computeCartPricing(items, 'VIBE20');
      const r2 = calculateFinalPricing(items, 'VIBE20');
      const r3 = recalculateOrderFinancials(items, 'VIBE20');

      expect(r1).toEqual({ subtotal: 200, discountPercent: 35, discountAmount: 70, netTotal: 130 });
      expect(r2).toEqual(r1);
      expect(r3).toEqual(r1);
    });

    it('correctly stacks coupon code SAVE10 (+10%) on $100 subtotal (20% total)', () => {
      const items = [makeItem(100, 1)]; // 100

      const r1 = computeCartPricing(items, 'SAVE10');
      const r2 = calculateFinalPricing(items, 'SAVE10');
      const r3 = recalculateOrderFinancials(items, 'SAVE10');

      expect(r1).toEqual({ subtotal: 100, discountPercent: 20, discountAmount: 20, netTotal: 80 });
      expect(r2).toEqual(r1);
      expect(r3).toEqual(r1);
    });

    it('correctly stacks VIP loyalty bonus (+5%) reaching exactly 40%', () => {
      const items = [makeItem(200, 1)]; // 200 -> 15% + 20% (VIBE20) + 5% (VIP) = 40%

      const r1 = computeCartPricing(items, 'VIBE20', true);
      const r2 = calculateFinalPricing(items, 'VIBE20', true);
      const r3 = recalculateOrderFinancials(items, 'VIBE20', true);

      expect(r1).toEqual({ subtotal: 200, discountPercent: 40, discountAmount: 80, netTotal: 120 });
      expect(r2).toEqual(r1);
      expect(r3).toEqual(r1);
    });

    it('strictly enforces 40% discount cap', () => {
      const items = [makeItem(300, 1)]; // 15% tier + 20% coupon + 5% VIP = 40%, even if another bonus applies

      const r1 = computeCartPricing(items, 'VIBE20', true);
      expect(r1.discountPercent).toBeLessThanOrEqual(40);
      expect(r1.discountPercent).toBe(40);
      expect(r1.netTotal).toBe(180);
    });
  });

  describe('Tax & Shipping Rules', () => {
    it('applies exact tax rates by state', () => {
      expect(calculateStateTax('CA', 100)).toEqual({ taxRate: 0.095, taxAmount: 9.5 });
      expect(calculateStateTax('NY', 100)).toEqual({ taxRate: 0.08875, taxAmount: 8.88 });
      expect(calculateStateTax('TX', 100)).toEqual({ taxRate: 0.0625, taxAmount: 6.25 });
      expect(calculateStateTax('WA', 100)).toEqual({ taxRate: 0.05, taxAmount: 5.0 });
    });

    it('applies standard vs express shipping thresholds', () => {
      // Subtotal < 150
      expect(calculateShippingCost(140, 'standard')).toBe(5.99);
      expect(calculateShippingCost(140, 'express')).toBe(14.99);

      // Subtotal >= 150
      expect(calculateShippingCost(150, 'standard')).toBe(0.00);
      expect(calculateShippingCost(200, 'standard')).toBe(0.00);
      expect(calculateShippingCost(200, 'express')).toBe(14.99);
    });
  });

  describe('Order Lifecycle & In-Memory Backend', () => {
    it('fetches initial seed catalog and orders', () => {
      const products = getMockProducts();
      expect(products.length).toBeGreaterThanOrEqual(6);

      const orders = getMockOrders();
      expect(orders.length).toBeGreaterThanOrEqual(2);
    });

    it('creates a new order with pending status and computes correct order number', () => {
      const created = createMockOrder({
        items: [makeItem(100, 1)],
        subtotal: 100,
        totalAmount: 105,
      });

      expect(created.orderNumber).toMatch(/^#ORD-\d+$/);
      expect(created.status).toBe('pending');
      expect(getMockOrders().some((o) => o.id === created.id)).toBe(true);
    });

    it('transitions order status pending -> processing -> completed', () => {
      expect(getNextOrderStatus('pending')).toBe('processing');
      expect(getNextOrderStatus('processing')).toBe('completed');
      expect(getNextOrderStatus('completed')).toBeNull();

      const created = createMockOrder({ totalAmount: 50 });
      const step1 = updateMockOrderStatus(created.id, 'processing');
      expect(step1.status).toBe('processing');

      const step2 = updateMockOrderStatus(created.id, 'completed');
      expect(step2.status).toBe('completed');
    });

    it('handles refund order and forbids refunding an already refunded order', () => {
      const created = createMockOrder({ totalAmount: 50 });
      expect(canRefundOrder(created)).toBe(true);

      const refunded = refundMockOrder(created.id);
      expect(refunded.status).toBe('refunded');
      expect(canRefundOrder(refunded)).toBe(false);

      expect(() => refundMockOrder(created.id)).toThrow('Order is already refunded');
    });
  });
});
