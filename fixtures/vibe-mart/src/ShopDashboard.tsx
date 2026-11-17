import React, { useState, useEffect, useMemo } from 'react';
import { Product, CartItem, ProductCategory, PricingCalculationResult } from './types';

// Module-level orphaned zombie variable (incremented during fetches, never read or exported)
let totalCatalogImpressions = 0;

/**
 * Duplicated pricing algorithm - Location A
 * Computes subtotal, volume tier discounts, promotional coupon codes, VIP loyalty bonus, and 40% cap.
 */
export function computeCartPricing(
  items: CartItem[],
  couponCode?: string,
  isVip?: boolean
): PricingCalculationResult {
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.price * item.quantity;
  }

  let discountPercent = 0;
  // Volume Tier Discount
  if (subtotal >= 200) {
    discountPercent += 15;
  } else if (subtotal >= 100) {
    discountPercent += 10;
  }

  // Coupon Code Validation
  if (couponCode === 'VIBE20') {
    discountPercent += 20;
  } else if (couponCode === 'SAVE10') {
    discountPercent += 10;
  }

  // VIP Loyalty Bonus
  if (isVip) {
    discountPercent += 5;
  }

  // Business Rule: Discount cannot exceed 40%
  if (discountPercent > 40) {
    discountPercent = 40;
  }

  const discountAmount = Number(((subtotal * discountPercent) / 100).toFixed(2));
  const netTotal = subtotal - discountAmount;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    discountPercent,
    discountAmount,
    netTotal: Number(netTotal.toFixed(2)),
  };
}

export interface ShopDashboardProps {
  initialVipStatus?: boolean;
  onOpenCheckout?: (cart: CartItem[], coupon: string, isVip: boolean) => void;
}

/**
 * ShopDashboard - Monolithic God Component
 * Responsible for UI presentation, state, inline API fetching, duplicated business pricing,
 * local storage synchronization, orphaned variables, and ad-hoc formatting.
 */
export const ShopDashboard: React.FC<ShopDashboardProps> = ({
  initialVipStatus = false,
  onOpenCheckout,
}) => {
  // Core application state
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [couponCode, setCouponCode] = useState<string>('');
  const [isVip, setIsVip] = useState<boolean>(initialVipStatus);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // --- ORPHANED STATE 1: promoInputDraft ---
  // Updated via onChange in the promo input buffer, but never read when applying coupons!
  const [promoInputDraft, setPromoInputDraft] = useState<string>('');

  // --- ORPHANED STATE 2: hoveredProductIndex ---
  // Updated on product card mouse enter/leave, but never bound to any visual property!
  const [hoveredProductIndex, setHoveredProductIndex] = useState<number>(-1);

  // Inlined LocalStorage load effect
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedCart = window.localStorage.getItem('vibe_mart_cart_items');
        if (savedCart) {
          const parsed = JSON.parse(savedCart);
          if (Array.isArray(parsed)) {
            setCart(parsed);
          }
        }
      }
    } catch (e) {
      console.warn('Could not read from localStorage', e);
    }
  }, []);

  // Inlined LocalStorage sync effect
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('vibe_mart_cart_items', JSON.stringify(cart));
      }
    } catch (e) {
      console.warn('Could not write to localStorage', e);
    }
  }, [cart]);

  // Inlined API Fetching with direct fetch and explicit headers
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetch('http://localhost:3000/api/v1/products', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer vibe-token-123',
        'Content-Type': 'application/json',
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data: Product[]) => {
        if (isMounted) {
          setProducts(data);
          setLoading(false);
          // Increment module-level zombie impression tracker
          totalCatalogImpressions += data.length;
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to fetch products from backend:', err);
          setFetchError('Failed to load products');
          setLoading(false);
          if (typeof window !== 'undefined' && typeof window.alert === 'function') {
            window.alert('Failed to load products');
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Inlined cart management handlers
  const handleAddToCart = (product: Product) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.productId === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        const newItem: CartItem = {
          id: `cart-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          productId: product.id,
          sku: product.sku,
          name: product.name,
          price: product.price,
          quantity: 1,
          category: product.category,
        };
        return [...prevCart, newItem];
      }
    });

    setNotificationMsg(`Added "${product.name}" to cart`);
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.productId === productId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);
    });
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // Coupon application handler
  const handleApplyCoupon = (codeToApply: string) => {
    const cleanCode = codeToApply.trim().toUpperCase();
    if (cleanCode === 'VIBE20' || cleanCode === 'SAVE10') {
      setCouponCode(cleanCode);
      setNotificationMsg(`Applied coupon code: ${cleanCode}`);
    } else {
      setCouponCode('');
      setNotificationMsg('Invalid coupon code entered');
    }
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  // Pricing calculation execution
  const pricing = useMemo(() => {
    return computeCartPricing(cart, couponCode, isVip);
  }, [cart, couponCode, isVip]);

  // Inline shipping estimation
  const estimatedShipping = useMemo(() => {
    if (pricing.subtotal === 0) return 0;
    return pricing.subtotal >= 150 ? 0 : 5.99;
  }, [pricing.subtotal]);

  // Inline tax estimation (approx 5%)
  const estimatedTax = useMemo(() => {
    return Number((pricing.netTotal * 0.05).toFixed(2));
  }, [pricing.netTotal]);

  const estimatedGrandTotal = useMemo(() => {
    return Number((pricing.netTotal + estimatedShipping + estimatedTax).toFixed(2));
  }, [pricing.netTotal, estimatedShipping, estimatedTax]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory =
        selectedCategory === 'all' || p.category === selectedCategory;
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Total cart items count
  const totalCartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Inline currency formatter
  const formatMoney = (amount: number) => {
    return '$' + amount.toFixed(2);
  };

  return (
    <div className="vibe-mart-dashboard" style={{ fontFamily: 'system-ui, sans-serif', padding: '24px' }}>
      {/* Header Bar */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #e2e8f0',
          paddingBottom: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', color: '#1a202c' }}>VibeMart Storefront</h1>
          <p style={{ margin: '4px 0 0 0', color: '#718096', fontSize: '14px' }}>
            AI-Engineered Next-Gen Shopping Experience
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* VIP Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={isVip}
              onChange={(e) => setIsVip(e.target.checked)}
            />
            <span style={{ fontWeight: isVip ? 'bold' : 'normal', color: isVip ? '#d69e2e' : '#4a5568' }}>
              👑 VIP Member ({isVip ? 'Active (+5% off)' : 'Inactive'})
            </span>
          </label>

          {/* Cart Drawer Trigger */}
          <button
            onClick={() => setIsCartOpen(!isCartOpen)}
            style={{
              padding: '10px 18px',
              backgroundColor: '#3182ce',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>🛒 Cart</span>
            <span
              style={{
                backgroundColor: '#ffffff',
                color: '#3182ce',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: 'bold',
              }}
            >
              {totalCartCount}
            </span>
          </button>
        </div>
      </header>

      {/* Notifications */}
      {notificationMsg && (
        <div
          style={{
            backgroundColor: '#ebf8ff',
            borderLeft: '4px solid #3182ce',
            color: '#2b6cb0',
            padding: '12px 16px',
            borderRadius: '4px',
            marginBottom: '16px',
            fontSize: '14px',
          }}
        >
          {notificationMsg}
        </div>
      )}

      {/* Main Content Layout */}
      <div style={{ display: 'flex', gap: '24px' }}>
        {/* Left Column: Catalog */}
        <main style={{ flex: 1 }}>
          {/* Filters and Search Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '20px',
              alignItems: 'center',
              backgroundColor: '#f7fafc',
              padding: '14px',
              borderRadius: '8px',
            }}
          >
            <input
              type="text"
              placeholder="Search products by title, sku, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: '1 1 250px',
                padding: '10px 14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e0',
                fontSize: '14px',
              }}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
              {(['all', 'electronics', 'apparel', 'accessories'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e0',
                    backgroundColor: selectedCategory === cat ? '#2b6cb0' : '#ffffff',
                    color: selectedCategory === cat ? '#ffffff' : '#4a5568',
                    cursor: 'pointer',
                    fontSize: '13px',
                    textTransform: 'capitalize',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Loading and Error states */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
              <p>Loading catalog items...</p>
            </div>
          )}

          {fetchError && (
            <div style={{ backgroundColor: '#fff5f5', color: '#c53030', padding: '16px', borderRadius: '6px' }}>
              <p>{fetchError}</p>
            </div>
          )}

          {/* Products Grid */}
          {!loading && !fetchError && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '20px',
              }}
            >
              {filteredProducts.map((prod, idx) => (
                <div
                  key={prod.id}
                  onMouseEnter={() => setHoveredProductIndex(idx)}
                  onMouseLeave={() => setHoveredProductIndex(-1)}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    {prod.imageUrl && (
                      <div
                        style={{
                          height: '140px',
                          backgroundColor: '#edf2f7',
                          borderRadius: '6px',
                          marginBottom: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    )}

                    <div style={{ fontSize: '11px', color: '#718096', textTransform: 'uppercase', marginBottom: '4px' }}>
                      {prod.category} • {prod.sku}
                    </div>

                    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#2d3748', lineHeight: 1.3 }}>
                      {prod.name}
                    </h3>

                    <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#718096', lineHeight: 1.4 }}>
                      {prod.description}
                    </p>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a202c' }}>
                        {formatMoney(prod.price)}
                      </span>
                      <span style={{ fontSize: '12px', color: prod.stockCount > 10 ? '#38a169' : '#e53e3e' }}>
                        {prod.stockCount > 0 ? `${prod.stockCount} in stock` : 'Out of stock'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleAddToCart(prod)}
                      disabled={prod.stockCount <= 0}
                      style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: prod.stockCount > 0 ? '#48bb78' : '#a0aec0',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: prod.stockCount > 0 ? 'pointer' : 'not-allowed',
                        fontWeight: 600,
                        fontSize: '14px',
                      }}
                    >
                      {prod.stockCount > 0 ? 'Add to Cart' : 'Sold Out'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Right Column: Slide-Over Cart Panel */}
        {isCartOpen && (
          <aside
            style={{
              width: '380px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: '#ffffff',
              boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 'calc(100vh - 120px)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>Your Cart ({totalCartCount})</h2>
              <button
                onClick={() => setIsCartOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#718096' }}
              >
                ✕
              </button>
            </div>

            {/* Cart Items List */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', paddingRight: '4px' }}>
              {cart.length === 0 ? (
                <p style={{ color: '#a0aec0', textAlign: 'center', marginTop: '32px' }}>Your cart is empty.</p>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: '1px solid #edf2f7',
                    }}
                  >
                    <div style={{ flex: 1, marginRight: '8px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#2d3748' }}>{item.name}</div>
                      <div style={{ fontSize: '12px', color: '#718096' }}>
                        {formatMoney(item.price)} each • Sub: {formatMoney(item.price * item.quantity)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => handleUpdateQuantity(item.productId, -1)}
                        style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #cbd5e0', cursor: 'pointer' }}
                      >
                        -
                      </button>
                      <span style={{ fontSize: '13px', minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQuantity(item.productId, 1)}
                        style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #cbd5e0', cursor: 'pointer' }}
                      >
                        +
                      </button>
                      <button
                        onClick={() => handleRemoveFromCart(item.productId)}
                        style={{ marginLeft: '6px', background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: '13px' }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Orphaned State Input - promoInputDraft */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#718096', display: 'block', marginBottom: '4px' }}>
                Promotional Code (Draft Input Buffer):
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. VIBE20 or SAVE10"
                  value={promoInputDraft}
                  onChange={(e) => setPromoInputDraft(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e0',
                    fontSize: '13px',
                  }}
                />
                <button
                  onClick={() => handleApplyCoupon(promoInputDraft)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#4a5568',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Apply
                </button>
              </div>
              {couponCode && (
                <div style={{ fontSize: '12px', color: '#38a169', marginTop: '4px' }}>
                  Active Coupon: <strong>{couponCode}</strong>
                </div>
              )}
            </div>

            {/* Financial Breakdown */}
            <div style={{ backgroundColor: '#f7fafc', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Subtotal:</span>
                <span>{formatMoney(pricing.subtotal)}</span>
              </div>
              {pricing.discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#38a169' }}>
                  <span>Discount ({pricing.discountPercent}%):</span>
                  <span>-{formatMoney(pricing.discountAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Net Total:</span>
                <span>{formatMoney(pricing.netTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Est. Shipping:</span>
                <span>{estimatedShipping === 0 ? 'FREE' : formatMoney(estimatedShipping)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Est. Tax (5%):</span>
                <span>{formatMoney(estimatedTax)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '8px',
                  fontWeight: 'bold',
                  fontSize: '15px',
                  color: '#1a202c',
                }}
              >
                <span>Estimated Total:</span>
                <span>{formatMoney(estimatedGrandTotal)}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                onClick={handleClearCart}
                disabled={cart.length === 0}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#edf2f7',
                  color: '#4a5568',
                  border: '1px solid #cbd5e0',
                  borderRadius: '6px',
                  cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
                  fontSize: '13px',
                }}
              >
                Clear
              </button>
              <button
                onClick={() => {
                  if (onOpenCheckout) {
                    onOpenCheckout(cart, couponCode, isVip);
                  }
                }}
                disabled={cart.length === 0}
                style={{
                  flex: 2,
                  padding: '10px',
                  backgroundColor: cart.length > 0 ? '#3182ce' : '#a0aec0',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                  fontSize: '14px',
                }}
              >
                Proceed to Checkout
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
