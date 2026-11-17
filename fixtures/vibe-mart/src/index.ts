/**
 * VibeMart Showcase Application Entry Point & Public Facade
 * Exposes core components, domain pricing functions, lifecycle helpers, mock REST server, and types.
 */

import { ShopDashboard, computeCartPricing, type ShopDashboardProps } from './ShopDashboard';
import { CheckoutModal, calculateFinalPricing, calculateStateTax, calculateShippingCost, type CheckoutModalProps } from './CheckoutModal';
import { OrderManagement, recalculateOrderFinancials, getNextOrderStatus, canRefundOrder, type OrderManagementProps } from './OrderManagement';
import * as mockApi from './mockApi';
import * as types from './types';

// Re-export all types
export * from './types';
export type { ShopDashboardProps, CheckoutModalProps, OrderManagementProps };

// Re-export all mock API utilities and seed data
export * from './mockApi';

// Re-export component functions and calculations for testing and cartography
export {
  computeCartPricing,
  calculateFinalPricing,
  calculateStateTax,
  calculateShippingCost,
  recalculateOrderFinancials,
  getNextOrderStatus,
  canRefundOrder,
  ShopDashboard,
  CheckoutModal,
  OrderManagement,
};

/**
 * Public Facade API for VibeMart
 */
export const VibeMart = {
  version: '1.0.0',
  description: 'VibeMart AI-Coded E-Commerce Showcase Benchmark',
  components: {
    ShopDashboard,
    CheckoutModal,
    OrderManagement,
  },
  domain: {
    computeCartPricing,
    calculateFinalPricing,
    calculateStateTax,
    calculateShippingCost,
    recalculateOrderFinancials,
    getNextOrderStatus,
    canRefundOrder,
  },
  mockApi,
  types,
};

export default VibeMart;
