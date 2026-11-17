/**
 * VibeMart Mock REST Server & In-Memory Database
 * Deterministic in-memory backend providing REST API simulation for products, orders, coupons, and tax calculations.
 */

import { Product, Order, OrderStatus, CartItem, CustomerProfile } from './types';

// Initial Seed Products
export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    sku: 'ELEC-HEADPHONE-PRO',
    name: 'AcousticMax Wireless Noise-Cancelling Headphones',
    description: 'High-fidelity audio with active noise cancellation and 40-hour battery life.',
    category: 'electronics',
    price: 199.99,
    stockCount: 45,
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
    rating: 4.8,
    tags: ['audio', 'wireless', 'bluetooth'],
    featured: true
  },
  {
    id: 'prod-002',
    sku: 'ELEC-KEYBOARD-MECH',
    name: 'TactileKey RGB Mechanical Gaming Keyboard',
    description: 'Hot-swappable switches with customizable per-key RGB and aluminum frame.',
    category: 'electronics',
    price: 129.50,
    stockCount: 30,
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3',
    rating: 4.7,
    tags: ['gaming', 'mechanical', 'keyboard'],
    featured: true
  },
  {
    id: 'prod-003',
    sku: 'APP-HOODIE-URBAN',
    name: 'Heavyweight Fleece Minimalist Hoodie',
    description: '450 GSM ultra-soft organic cotton fleece with relaxed boxy silhouette.',
    category: 'apparel',
    price: 85.00,
    stockCount: 110,
    imageUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2',
    rating: 4.6,
    tags: ['apparel', 'cotton', 'streetwear']
  },
  {
    id: 'prod-004',
    sku: 'APP-TEE-OVERSIZED',
    name: 'Vintage Wash Heavyweight Boxy Tee',
    description: 'Pre-shrunk 100% combed cotton with reinforced collar and dropped shoulders.',
    category: 'apparel',
    price: 42.00,
    stockCount: 150,
    imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518',
    rating: 4.5,
    tags: ['apparel', 'summer', 'basics']
  },
  {
    id: 'prod-005',
    sku: 'ACC-BACKPACK-ROLL',
    name: 'Weatherproof Urban Commuter Roll-Top Backpack',
    description: 'Water-resistant Cordura ballistic nylon with padded 16-inch laptop compartment.',
    category: 'accessories',
    price: 145.00,
    stockCount: 22,
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62',
    rating: 4.9,
    tags: ['travel', 'waterproof', 'bag'],
    featured: true
  },
  {
    id: 'prod-006',
    sku: 'ACC-WALLET-SLIM',
    name: 'Minimalist RFID-Blocking Cardholder Wallet',
    description: 'Aerospace-grade aluminum cardholder with integrated elastic cash strap.',
    category: 'accessories',
    price: 38.50,
    stockCount: 65,
    imageUrl: 'https://images.unsplash.com/photo-1627123424574-724758594e93',
    rating: 4.4,
    tags: ['wallet', 'edc', 'minimal']
  }
];

// Initial Seed Orders
export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-1001',
    orderNumber: '#ORD-1001',
    createdAt: '2026-11-01T10:15:00Z',
    customer: {
      id: 'cust-001',
      name: 'Alice Henderson',
      email: 'alice.henderson@example.com',
      phone: '+1-555-0199',
      address: {
        street: '742 Evergreen Terrace',
        city: 'Springfield',
        state: 'CA',
        zip: '90210'
      },
      isVip: true
    },
    items: [
      {
        id: 'ci-101',
        productId: 'prod-001',
        sku: 'ELEC-HEADPHONE-PRO',
        name: 'AcousticMax Wireless Noise-Cancelling Headphones',
        price: 199.99,
        quantity: 1,
        category: 'electronics'
      }
    ],
    subtotal: 199.99,
    discountPercent: 35, // 10% (tier 1 >= 100) + 20% (VIBE20) + 5% (VIP) = 35%
    discountAmount: 70.00,
    couponCode: 'VIBE20',
    taxRate: 0.095,
    taxAmount: 12.35,
    shippingMethod: 'standard',
    shippingCost: 0.00,
    totalAmount: 142.34,
    status: 'completed',
    paymentMethod: 'Credit Card'
  },
  {
    id: 'ord-1002',
    orderNumber: '#ORD-1002',
    createdAt: '2026-11-05T14:30:00Z',
    customer: {
      id: 'cust-002',
      name: 'Brian O\'Connor',
      email: 'brian.oc@example.com',
      address: {
        street: '120 Broadway Ave',
        city: 'New York',
        state: 'NY',
        zip: '10005'
      },
      isVip: false
    },
    items: [
      {
        id: 'ci-102',
        productId: 'prod-003',
        sku: 'APP-HOODIE-URBAN',
        name: 'Heavyweight Fleece Minimalist Hoodie',
        price: 85.00,
        quantity: 1,
        category: 'apparel'
      }
    ],
    subtotal: 85.00,
    discountPercent: 0,
    discountAmount: 0.00,
    taxRate: 0.08875,
    taxAmount: 7.54,
    shippingMethod: 'standard',
    shippingCost: 5.99,
    totalAmount: 98.53,
    status: 'pending',
    paymentMethod: 'PayPal'
  }
];

// Coupon Database
export const VALID_COUPONS: Record<string, number> = {
  'VIBE20': 20,
  'SAVE10': 10
};

// State-level Tax Rates
export const STATE_TAX_RATES: Record<string, number> = {
  'CA': 0.095,
  'NY': 0.08875,
  'TX': 0.0625,
  'DEFAULT': 0.05
};

// In-Memory Database State
let inMemoryProducts: Product[] = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
let inMemoryOrders: Order[] = JSON.parse(JSON.stringify(INITIAL_ORDERS));
let orderIdCounter = 1003;

/**
 * Resets the in-memory database to its initial deterministic state.
 */
export function resetMockDb(): void {
  inMemoryProducts = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
  inMemoryOrders = JSON.parse(JSON.stringify(INITIAL_ORDERS));
  orderIdCounter = 1003;
}

/**
 * Product API operations
 */
export function getMockProducts(): Product[] {
  return [...inMemoryProducts];
}

export function getMockProductById(id: string): Product | undefined {
  return inMemoryProducts.find(p => p.id === id || p.sku === id);
}

/**
 * Order API operations
 */
export function getMockOrders(statusFilter?: OrderStatus): Order[] {
  if (statusFilter) {
    return inMemoryOrders.filter(o => o.status === statusFilter);
  }
  return [...inMemoryOrders];
}

export function getMockOrderById(id: string): Order | undefined {
  return inMemoryOrders.find(o => o.id === id || o.orderNumber === id);
}

export function createMockOrder(orderData: Partial<Order>): Order {
  const newOrderNumber = `#ORD-${orderIdCounter++}`;
  const newOrder: Order = {
    id: `ord-${orderIdCounter}`,
    orderNumber: newOrderNumber,
    createdAt: new Date().toISOString(),
    customer: orderData.customer || {
      id: `cust-${Date.now()}`,
      name: 'Guest Customer',
      email: 'guest@example.com',
      address: { street: '', city: '', state: 'CA', zip: '90001' },
      isVip: false
    },
    items: orderData.items || [],
    subtotal: orderData.subtotal || 0,
    discountPercent: orderData.discountPercent || 0,
    discountAmount: orderData.discountAmount || 0,
    couponCode: orderData.couponCode,
    taxRate: orderData.taxRate || 0.05,
    taxAmount: orderData.taxAmount || 0,
    shippingMethod: orderData.shippingMethod || 'standard',
    shippingCost: orderData.shippingCost || 0,
    totalAmount: orderData.totalAmount || 0,
    status: 'pending',
    paymentMethod: orderData.paymentMethod || 'Credit Card'
  };

  inMemoryOrders.unshift(newOrder);
  return newOrder;
}

export function updateMockOrderStatus(orderId: string, nextStatus: OrderStatus): Order {
  const order = inMemoryOrders.find(o => o.id === orderId || o.orderNumber === orderId);
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }
  order.status = nextStatus;
  order.updatedAt = new Date().toISOString();
  return order;
}

export function refundMockOrder(orderId: string): Order {
  const order = inMemoryOrders.find(o => o.id === orderId || o.orderNumber === orderId);
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }
  if (order.status === 'refunded') {
    throw new Error('Order is already refunded');
  }
  order.status = 'refunded';
  order.updatedAt = new Date().toISOString();
  return order;
}

/**
 * Coupon validation operation
 */
export function validateMockCoupon(code: string): { valid: boolean; discountPercent: number } {
  const upper = code.trim().toUpperCase();
  if (upper in VALID_COUPONS) {
    return { valid: true, discountPercent: VALID_COUPONS[upper] };
  }
  return { valid: false, discountPercent: 0 };
}

/**
 * Mock Request Handler simulating REST HTTP routing.
 * Parses paths like /api/v1/products, /api/v1/orders, /api/orders?status=...
 */
export async function handleMockRestRequest(
  urlStr: string,
  method: string = 'GET',
  body?: any
): Promise<{ status: number; headers: Record<string, string>; data: any }> {
  // Normalize URL
  const parsedUrl = new URL(urlStr, 'http://localhost:3000');
  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;

  // GET /api/v1/products or /api/products
  if ((pathname === '/api/v1/products' || pathname === '/api/products') && method === 'GET') {
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      data: getMockProducts()
    };
  }

  // GET /api/v1/orders or /api/orders
  if ((pathname === '/api/v1/orders' || pathname === '/api/orders') && method === 'GET') {
    const statusParam = searchParams.get('status') as OrderStatus | undefined;
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      data: getMockOrders(statusParam || undefined)
    };
  }

  // POST /api/v1/orders or /api/orders
  if ((pathname === '/api/v1/orders' || pathname === '/api/orders') && method === 'POST') {
    const payload = typeof body === 'string' ? JSON.parse(body) : (body || {});
    const order = createMockOrder(payload);
    return {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
      data: order
    };
  }

  // POST /api/v1/orders/:id/refund or /api/orders/:id/refund
  const refundMatch = pathname.match(/^\/api(?:\/v1)?\/orders\/([^/]+)\/refund$/);
  if (refundMatch && method === 'POST') {
    const orderId = refundMatch[1];
    try {
      const order = refundMockOrder(orderId);
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        data: order
      };
    } catch (err: any) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        data: { error: err.message }
      };
    }
  }

  // POST /api/v1/orders/:id/status
  const statusMatch = pathname.match(/^\/api(?:\/v1)?\/orders\/([^/]+)\/status$/);
  if (statusMatch && method === 'POST') {
    const orderId = statusMatch[1];
    const payload = typeof body === 'string' ? JSON.parse(body) : (body || {});
    try {
      const order = updateMockOrderStatus(orderId, payload.status);
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        data: order
      };
    } catch (err: any) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        data: { error: err.message }
      };
    }
  }

  // Fallback 404
  return {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
    data: { error: `Not Found: ${method} ${pathname}` }
  };
}

/**
 * Universal Mock Fetch dispatcher
 */
export async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString();
  const method = (init?.method || 'GET').toUpperCase();
  const body = init?.body;

  const result = await handleMockRestRequest(url, method, body);

  return new Response(JSON.stringify(result.data), {
    status: result.status,
    headers: result.headers
  });
}

/**
 * Installs global fetch interceptor in Node/Browser environments
 */
let originalFetch: typeof globalThis.fetch | null = null;

export function installMockApiInterceptor(): void {
  if (!originalFetch) {
    originalFetch = globalThis.fetch;
  }
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input.toString();
    if (urlStr.includes('/api/')) {
      return mockFetch(input, init);
    }
    return originalFetch!(input, init);
  };
}

export function restoreOriginalFetch(): void {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
}
