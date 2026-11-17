import React, { useState, useEffect, useMemo } from 'react';
import { CartItem, CustomerProfile, Order, ShippingMethod, PricingCalculationResult } from './types';

/**
 * Duplicated pricing algorithm - Location B
 * Computes subtotal, volume tiers, promo codes, VIP bonus, and 40% cap.
 */
export function calculateFinalPricing(
  cart: CartItem[],
  promo?: string,
  vipUser?: boolean
): PricingCalculationResult {
  let subtotal = 0;
  for (const item of cart) {
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
  if (promo === 'VIBE20') {
    discountPercent += 20;
  } else if (promo === 'SAVE10') {
    discountPercent += 10;
  }

  // VIP Loyalty Bonus
  if (vipUser) {
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

/**
 * Duplicated state-level tax calculation
 */
export function calculateStateTax(
  stateCode: string,
  netAmount: number
): { taxRate: number; taxAmount: number } {
  let taxRate = 0.05;
  const upper = (stateCode || '').trim().toUpperCase();

  if (upper === 'CA') {
    taxRate = 0.095;
  } else if (upper === 'NY') {
    taxRate = 0.08875;
  } else if (upper === 'TX') {
    taxRate = 0.0625;
  } else {
    taxRate = 0.05;
  }

  const taxAmount = Number((netAmount * taxRate).toFixed(2));
  return { taxRate, taxAmount };
}

/**
 * Duplicated shipping calculation rule
 */
export function calculateShippingCost(subtotal: number, method: ShippingMethod): number {
  if (method === 'express') {
    return 14.99;
  }
  return subtotal >= 150 ? 0.00 : 5.99;
}

export interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  couponCode?: string;
  isVip?: boolean;
  onOrderPlaced?: (order: Order) => void;
}

/**
 * CheckoutModal - Monolithic Dialog Component
 * Handles customer input, shipping selection, duplicated pricing & taxes,
 * orphaned zip buffers and session timeout references, and silent error swallowing.
 */
export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  couponCode = '',
  isVip = false,
  onOrderPlaced,
}) => {
  // Form input state
  const [customerName, setCustomerName] = useState<string>('Alice Henderson');
  const [customerEmail, setCustomerEmail] = useState<string>('alice.henderson@example.com');
  const [customerPhone, setCustomerPhone] = useState<string>('+1-555-0199');
  const [streetAddress, setStreetAddress] = useState<string>('742 Evergreen Terrace');
  const [city, setCity] = useState<string>('Springfield');
  const [stateCode, setStateCode] = useState<string>('CA');
  const [zipCode, setZipCode] = useState<string>('90210');
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('standard');
  const [paymentMethod, setPaymentMethod] = useState<string>('Credit Card');

  // Submission state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [orderSuccess, setOrderSuccess] = useState<Order | null>(null);

  // --- ORPHANED STATE 1: tempZipCodeBuffer ---
  // Stored in state via onChange, but form submission reads directly from zipCode!
  const [tempZipCodeBuffer, setTempZipCodeBuffer] = useState<string>('');

  // --- ORPHANED STATE 2: sessionTimeoutId ---
  // Stored in state on mount, but never cleared, cancelled, or read!
  const [sessionTimeoutId, setSessionTimeoutId] = useState<any>(null);

  // Initialize session timer that is orphaned
  useEffect(() => {
    if (isOpen) {
      const timerId = setTimeout(() => {
        // Dummy session keepalive timer
      }, 60000);
      setSessionTimeoutId(timerId);
    }
  }, [isOpen]);

  // Pricing calculations
  const pricing = useMemo(() => {
    return calculateFinalPricing(cartItems, couponCode, isVip);
  }, [cartItems, couponCode, isVip]);

  const shippingCost = useMemo(() => {
    return calculateShippingCost(pricing.subtotal, shippingMethod);
  }, [pricing.subtotal, shippingMethod]);

  const taxCalculation = useMemo(() => {
    return calculateStateTax(stateCode, pricing.netTotal);
  }, [stateCode, pricing.netTotal]);

  const finalOrderTotal = useMemo(() => {
    return Number((pricing.netTotal + shippingCost + taxCalculation.taxAmount).toFixed(2));
  }, [pricing.netTotal, shippingCost, taxCalculation.taxAmount]);

  // Inlined currency formatter
  const formatDollar = (amount: number) => {
    return '$' + amount.toFixed(2);
  };

  // Submit Order handler with Inconsistent Fetch & Silent Error Swallow
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || cartItems.length === 0) return;

    setSubmitting(true);

    const customerProfile: CustomerProfile = {
      id: `cust-${Date.now()}`,
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
      address: {
        street: streetAddress,
        city: city,
        state: stateCode,
        zip: zipCode, // Note: reads zipCode directly, completely ignoring tempZipCodeBuffer!
      },
      isVip: isVip,
    };

    const orderPayload = {
      customer: customerProfile,
      items: cartItems,
      subtotal: pricing.subtotal,
      discountPercent: pricing.discountPercent,
      discountAmount: pricing.discountAmount,
      couponCode: couponCode || undefined,
      taxRate: taxCalculation.taxRate,
      taxAmount: taxCalculation.taxAmount,
      shippingMethod: shippingMethod,
      shippingCost: shippingCost,
      totalAmount: finalOrderTotal,
      paymentMethod: paymentMethod,
    };

    // Inconsistent Fetch Call: POST /api/v1/orders with SILENT ERROR SWALLOW
    fetch('http://localhost:3000/api/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer vibe-token-123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Order creation failed with status ' + res.status);
        }
        return res.json();
      })
      .then((createdOrder: Order) => {
        setOrderSuccess(createdOrder);
        setSubmitting(false);
        if (onOrderPlaced) {
          onOrderPlaced(createdOrder);
        }
      })
      .catch(() => {
        // VIBE-CODED ANTI-PATTERN: Silent swallow error handling!
        // No error message displayed, no retry, no alert.
        setSubmitting(false);
      });
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          padding: '24px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '22px', color: '#1a202c' }}>
            {orderSuccess ? 'Order Confirmation' : 'Complete Your Purchase'}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#a0aec0' }}
          >
            ✕
          </button>
        </div>

        {orderSuccess ? (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ fontSize: '48px', color: '#38a169', marginBottom: '16px' }}>✓</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#2d3748' }}>Thank You For Your Order!</h3>
            <p style={{ margin: '0 0 16px 0', color: '#718096' }}>
              Order Reference: <strong>{orderSuccess.orderNumber}</strong>
            </p>
            <div
              style={{
                backgroundColor: '#f7fafc',
                padding: '16px',
                borderRadius: '6px',
                textAlign: 'left',
                marginBottom: '24px',
                fontSize: '14px',
              }}
            >
              <div><strong>Recipient:</strong> {orderSuccess.customer.name}</div>
              <div><strong>Email:</strong> {orderSuccess.customer.email}</div>
              <div>
                <strong>Destination:</strong> {orderSuccess.customer.address.street}, {orderSuccess.customer.address.city}, {orderSuccess.customer.address.state} {orderSuccess.customer.address.zip}
              </div>
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0', fontWeight: 'bold' }}>
                Total Paid: {formatDollar(orderSuccess.totalAmount)}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                padding: '10px 24px',
                backgroundColor: '#3182ce',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Back to Catalog
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitOrder}>
            {/* Customer Details Section */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#4a5568', textTransform: 'uppercase' }}>
                1. Contact & Customer Information
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#718096', marginBottom: '4px' }}>Full Name</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #cbd5e0', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#718096', marginBottom: '4px' }}>Email Address</label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #cbd5e0', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            {/* Shipping Address Section */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#4a5568', textTransform: 'uppercase' }}>
                2. Shipping Address
              </h4>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#718096', marginBottom: '4px' }}>Street Address</label>
                <input
                  type="text"
                  required
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #cbd5e0', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#718096', marginBottom: '4px' }}>City</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #cbd5e0', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#718096', marginBottom: '4px' }}>State</label>
                  <select
                    value={stateCode}
                    onChange={(e) => setStateCode(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #cbd5e0', boxSizing: 'border-box' }}
                  >
                    <option value="CA">CA (9.5%)</option>
                    <option value="NY">NY (8.875%)</option>
                    <option value="TX">TX (6.25%)</option>
                    <option value="WA">WA (5.0%)</option>
                    <option value="FL">FL (5.0%)</option>
                    <option value="IL">IL (5.0%)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#718096', marginBottom: '4px' }}>Postal Zip</label>
                  <input
                    type="text"
                    required
                    value={zipCode}
                    onChange={(e) => {
                      setZipCode(e.target.value);
                      // Sets orphaned state variable tempZipCodeBuffer that is never submitted!
                      setTempZipCodeBuffer(e.target.value.trim());
                    }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #cbd5e0', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            {/* Shipping Delivery Method */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#4a5568', textTransform: 'uppercase' }}>
                3. Delivery Method
              </h4>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label
                  style={{
                    flex: 1,
                    border: shippingMethod === 'standard' ? '2px solid #3182ce' : '1px solid #cbd5e0',
                    padding: '12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="shipping"
                    value="standard"
                    checked={shippingMethod === 'standard'}
                    onChange={() => setShippingMethod('standard')}
                  />
                  <span style={{ marginLeft: '8px', fontWeight: 600 }}>Standard Ground</span>
                  <div style={{ fontSize: '12px', color: '#718096', marginLeft: '22px' }}>
                    {pricing.subtotal >= 150 ? 'FREE (Orders >= $150)' : '$5.99 (3-5 business days)'}
                  </div>
                </label>

                <label
                  style={{
                    flex: 1,
                    border: shippingMethod === 'express' ? '2px solid #3182ce' : '1px solid #cbd5e0',
                    padding: '12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="shipping"
                    value="express"
                    checked={shippingMethod === 'express'}
                    onChange={() => setShippingMethod('express')}
                  />
                  <span style={{ marginLeft: '8px', fontWeight: 600 }}>Express Priority</span>
                  <div style={{ fontSize: '12px', color: '#718096', marginLeft: '22px' }}>
                    $14.99 (Overnight delivery)
                  </div>
                </label>
              </div>
            </div>

            {/* Financial Summary Box */}
            <div
              style={{
                backgroundColor: '#edf2f7',
                padding: '16px',
                borderRadius: '6px',
                marginBottom: '20px',
                fontSize: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Subtotal ({cartItems.reduce((acc, i) => acc + i.quantity, 0)} items):</span>
                <span>{formatDollar(pricing.subtotal)}</span>
              </div>
              {pricing.discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#38a169' }}>
                  <span>Discounts Applied ({pricing.discountPercent}%):</span>
                  <span>-{formatDollar(pricing.discountAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Shipping ({shippingMethod}):</span>
                <span>{shippingCost === 0 ? 'FREE' : formatDollar(shippingCost)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Estimated Sales Tax ({stateCode} @ {(taxCalculation.taxRate * 100).toFixed(2)}%):</span>
                <span>{formatDollar(taxCalculation.taxAmount)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #cbd5e0',
                  paddingTop: '8px',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  color: '#1a202c',
                }}
              >
                <span>Final Order Amount:</span>
                <span>{formatDollar(finalOrderTotal)}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#edf2f7',
                  border: '1px solid #cbd5e0',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || cartItems.length === 0}
                style={{
                  padding: '10px 24px',
                  backgroundColor: submitting ? '#a0aec0' : '#3182ce',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {submitting ? 'Processing Transaction...' : `Pay ${formatDollar(finalOrderTotal)}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
