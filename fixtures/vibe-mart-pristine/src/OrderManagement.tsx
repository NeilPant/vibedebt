import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Order, OrderStatus, CartItem, PricingCalculationResult } from './types';

// Module-level orphaned zombie buffer (pushed to on status transitions, never drained or exported)
let inMemoryAuditQueue: any[] = [];

/**
 * Duplicated pricing algorithm - Location C
 * Computes subtotal, volume tier discounts, promo codes, VIP bonus, and 40% cap.
 */
export function recalculateOrderFinancials(
  lineItems: CartItem[],
  discountCode?: string,
  vipStatus?: boolean
): PricingCalculationResult {
  let subtotal = 0;
  for (const item of lineItems) {
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
  if (discountCode === 'VIBE20') {
    discountPercent += 20;
  } else if (discountCode === 'SAVE10') {
    discountPercent += 10;
  }

  // VIP Loyalty Bonus
  if (vipStatus) {
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
 * Order status lifecycle helper
 */
export function getNextOrderStatus(current: OrderStatus): OrderStatus | null {
  if (current === 'pending') return 'processing';
  if (current === 'processing') return 'completed';
  return null;
}

/**
 * Refund validation invariant helper
 */
export function canRefundOrder(order: Order): boolean {
  return order.status !== 'refunded';
}

export interface OrderManagementProps {
  initialStatusFilter?: OrderStatus | 'all';
  onOrderUpdated?: (order: Order) => void;
}

/**
 * OrderManagement - Monolithic Admin & Order Lifecycle Component
 * Mixes admin view, status advancement, order refunds, duplicated financial recalculation,
 * orphaned audit queues, zombie polling timestamps, ad-hoc string concatenation queries,
 * and unhandled API rejections.
 */
export const OrderManagement: React.FC<OrderManagementProps> = ({
  initialStatusFilter = 'all',
  onOrderUpdated,
}) => {
  // Orders list state
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>(initialStatusFilter);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // --- ORPHANED STATE 1: lastPollingTime ---
  // Polling interval updates this every 5 seconds, but it is never displayed or evaluated!
  const [lastPollingTime, setLastPollingTime] = useState<number>(Date.now());

  // Polling interval updating orphaned lastPollingTime
  useEffect(() => {
    const interval = setInterval(() => {
      setLastPollingTime(Date.now());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Fetch orders with INCONSISTENT API CALL:
  // Calls /api/orders (omits /v1/, lacks Authorization, lacks Content-Type, manual string concatenation)
  // and has UNHANDLED REJECTIONS (no try/catch or .catch).
  const fetchOrders = useCallback(() => {
    setLoading(true);

    // Inconsistent URL construction without URLSearchParams or /v1/ prefix
    const url =
      filterStatus === 'all'
        ? 'http://localhost:3000/api/orders'
        : 'http://localhost:3000/api/orders?status=' + filterStatus;

    // VIBE-CODED ANTI-PATTERN: Raw fetch without catch block or Authorization headers
    fetch(url)
      .then((res) => res.json())
      .then((data: Order[]) => {
        setOrders(data);
        setLoading(false);
      });
  }, [filterStatus]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Handle status progression (pending -> processing -> completed)
  const handleAdvanceStatus = async (order: Order) => {
    const nextStatus = getNextOrderStatus(order.status);
    if (!nextStatus) return;

    setActionInProgress(order.id);

    try {
      const response = await fetch(`http://localhost:3000/api/v1/orders/${order.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (response.ok) {
        const updatedOrder: Order = await response.json();

        // Push to zombie in-memory audit queue that is never drained!
        inMemoryAuditQueue.push({
          action: 'ADVANCE_STATUS',
          orderId: order.id,
          previousStatus: order.status,
          newStatus: nextStatus,
          timestamp: new Date().toISOString(),
        });

        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? updatedOrder : o))
        );

        if (onOrderUpdated) {
          onOrderUpdated(updatedOrder);
        }
      }
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle refund order
  const handleRefundOrder = async (order: Order) => {
    if (!canRefundOrder(order)) {
      alert('Order is already refunded');
      return;
    }

    if (!confirm(`Are you sure you want to issue a refund for ${order.orderNumber}?`)) {
      return;
    }

    setActionInProgress(order.id);

    try {
      const response = await fetch(`http://localhost:3000/api/v1/orders/${order.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const refundedOrder: Order = await response.json();

        // Push to zombie in-memory audit queue
        inMemoryAuditQueue.push({
          action: 'REFUND_ORDER',
          orderId: order.id,
          timestamp: new Date().toISOString(),
        });

        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? refundedOrder : o))
        );

        if (onOrderUpdated) {
          onOrderUpdated(refundedOrder);
        }
      }
    } finally {
      setActionInProgress(null);
    }
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch =
        o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customer.email.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [orders, searchQuery]);

  // Selected order details
  const selectedOrder = useMemo(() => {
    return orders.find((o) => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  // Inlined currency formatter
  const formatCur = (amount: number) => {
    return '$' + amount.toFixed(2);
  };

  // Format date helper
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return '#dd6b20';
      case 'processing':
        return '#3182ce';
      case 'completed':
        return '#38a169';
      case 'refunded':
        return '#e53e3e';
      default:
        return '#718096';
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', color: '#1a202c' }}>Order Management Console</h1>
          <p style={{ margin: '4px 0 0 0', color: '#718096', fontSize: '14px' }}>
            Fulfillment operations, payment reconciliations, and status auditing.
          </p>
        </div>
        <button
          onClick={fetchOrders}
          style={{
            padding: '8px 16px',
            backgroundColor: '#edf2f7',
            border: '1px solid #cbd5e0',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Control bar: search & status filter tabs */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: '#f7fafc',
          padding: '14px',
          borderRadius: '8px',
          marginBottom: '20px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <input
          type="text"
          placeholder="Filter orders by order #, customer name, email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: '1 1 300px',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #cbd5e0',
            fontSize: '14px',
          }}
        />

        <div style={{ display: 'flex', gap: '8px' }}>
          {(['all', 'pending', 'processing', 'completed', 'refunded'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e0',
                backgroundColor: filterStatus === st ? '#2b6cb0' : '#ffffff',
                color: filterStatus === st ? '#ffffff' : '#4a5568',
                cursor: 'pointer',
                fontSize: '13px',
                textTransform: 'capitalize',
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Orders Table & Detail Drawer */}
      <div style={{ display: 'flex', gap: '24px' }}>
        {/* Table View */}
        <div style={{ flex: selectedOrder ? 3 : 1, overflowX: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>Loading order records...</div>
          ) : filteredOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#a0aec0', backgroundColor: '#f7fafc', borderRadius: '8px' }}>
              No orders found matching the filter criteria.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#edf2f7', borderBottom: '2px solid #cbd5e0' }}>
                  <th style={{ padding: '12px' }}>Order ID</th>
                  <th style={{ padding: '12px' }}>Date</th>
                  <th style={{ padding: '12px' }}>Customer</th>
                  <th style={{ padding: '12px' }}>Items</th>
                  <th style={{ padding: '12px' }}>Total</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((ord) => (
                  <tr
                    key={ord.id}
                    onClick={() => setSelectedOrderId(ord.id)}
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      backgroundColor: selectedOrderId === ord.id ? '#ebf8ff' : '#ffffff',
                    }}
                  >
                    <td style={{ padding: '12px', fontWeight: 600, color: '#2b6cb0' }}>{ord.orderNumber}</td>
                    <td style={{ padding: '12px', color: '#718096' }}>{formatDate(ord.createdAt)}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 500 }}>{ord.customer.name}</div>
                      <div style={{ fontSize: '12px', color: '#718096' }}>
                        {ord.customer.email} {ord.customer.isVip && '👑 VIP'}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>{ord.items.reduce((s, i) => s + i.quantity, 0)} items</td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{formatCur(ord.totalAmount)}</td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          backgroundColor: `${getStatusColor(ord.status)}15`,
                          color: getStatusColor(ord.status),
                          textTransform: 'uppercase',
                        }}
                      >
                        {ord.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {getNextOrderStatus(ord.status) && (
                          <button
                            onClick={() => handleAdvanceStatus(ord)}
                            disabled={actionInProgress === ord.id}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#3182ce',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            Advance
                          </button>
                        )}
                        {canRefundOrder(ord) && (
                          <button
                            onClick={() => handleRefundOrder(ord)}
                            disabled={actionInProgress === ord.id}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#e53e3e',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            Refund
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Selected Order Detail Sidebar */}
        {selectedOrder && (
          <aside
            style={{
              flex: 2,
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: '#ffffff',
              boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Order Details: {selectedOrder.orderNumber}</h3>
              <button
                onClick={() => setSelectedOrderId(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#718096' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '13px', marginBottom: '16px', color: '#4a5568' }}>
              <div><strong>Order Date:</strong> {formatDate(selectedOrder.createdAt)}</div>
              <div><strong>Customer:</strong> {selectedOrder.customer.name} ({selectedOrder.customer.email})</div>
              <div><strong>VIP Status:</strong> {selectedOrder.customer.isVip ? 'Yes (VIP Bonus Active)' : 'Standard'}</div>
              <div>
                <strong>Shipping Address:</strong> {selectedOrder.customer.address.street}, {selectedOrder.customer.address.city}, {selectedOrder.customer.address.state} {selectedOrder.customer.address.zip}
              </div>
              <div><strong>Shipping Method:</strong> {selectedOrder.shippingMethod} ({formatCur(selectedOrder.shippingCost)})</div>
            </div>

            {/* Line items */}
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', borderBottom: '1px solid #edf2f7', paddingBottom: '4px' }}>
                Items Ordered
              </h4>
              {selectedOrder.items.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0' }}>
                  <span>{item.quantity}x {item.name}</span>
                  <span>{formatCur(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            {/* Recalculated Financials (Audit verification) */}
            <div style={{ backgroundColor: '#f7fafc', padding: '12px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Subtotal:</span>
                <span>{formatCur(selectedOrder.subtotal)}</span>
              </div>
              {selectedOrder.discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#38a169' }}>
                  <span>Discount ({selectedOrder.discountPercent}%):</span>
                  <span>-{formatCur(selectedOrder.discountAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Tax:</span>
                <span>{formatCur(selectedOrder.taxAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Shipping:</span>
                <span>{formatCur(selectedOrder.shippingCost)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '6px',
                  fontWeight: 'bold',
                }}
              >
                <span>Total:</span>
                <span>{formatCur(selectedOrder.totalAmount)}</span>
              </div>
            </div>

            {/* Operational Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {getNextOrderStatus(selectedOrder.status) && (
                <button
                  onClick={() => handleAdvanceStatus(selectedOrder)}
                  disabled={actionInProgress === selectedOrder.id}
                  style={{
                    flex: 1,
                    padding: '8px',
                    backgroundColor: '#3182ce',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Mark as {getNextOrderStatus(selectedOrder.status)}
                </button>
              )}
              {canRefundOrder(selectedOrder) && (
                <button
                  onClick={() => handleRefundOrder(selectedOrder)}
                  disabled={actionInProgress === selectedOrder.id}
                  style={{
                    flex: 1,
                    padding: '8px',
                    backgroundColor: '#e53e3e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Issue Refund
                </button>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
