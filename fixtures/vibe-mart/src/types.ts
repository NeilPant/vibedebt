/**
 * VibeMart Domain & API Types
 * Core entities for product catalog, shopping cart, customer profiles, order lifecycle, and pricing rules.
 */

export type ProductCategory = 'electronics' | 'apparel' | 'accessories' | 'home' | 'footwear';

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: ProductCategory;
  price: number;
  stockCount: number;
  imageUrl?: string;
  rating?: number;
  tags?: string[];
  featured?: boolean;
}

export interface CartItem {
  id: string;
  productId: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  category: ProductCategory;
  selectedOptions?: Record<string, string>;
}

export interface CustomerAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
}

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address: CustomerAddress;
  isVip: boolean;
  loyaltyPoints?: number;
  memberSince?: string;
}

export interface DiscountRules {
  tier1Threshold: number; // e.g. 100
  tier1Percent: number;   // e.g. 10
  tier2Threshold: number; // e.g. 200
  tier2Percent: number;   // e.g. 15
  validCoupons: Record<string, number>; // { 'VIBE20': 20, 'SAVE10': 10 }
  vipBonusPercent: number; // e.g. 5
  maxDiscountCapPercent: number; // e.g. 40
}

export interface TaxRules {
  stateRates: Record<string, number>;
  defaultRate: number;
}

export interface ShippingRules {
  standardRate: number; // 5.99
  expressRate: number;  // 14.99
  freeShippingThreshold: number; // 150.00
}

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'refunded';

export type ShippingMethod = 'standard' | 'express';

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  updatedAt?: string;
  customer: CustomerProfile;
  items: CartItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  couponCode?: string;
  taxRate: number;
  taxAmount: number;
  shippingMethod: ShippingMethod;
  shippingCost: number;
  totalAmount: number;
  status: OrderStatus;
  paymentMethod?: string;
  notes?: string;
}

export interface PricingCalculationResult {
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  netTotal: number;
  taxAmount?: number;
  shippingCost?: number;
  finalTotal?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}
