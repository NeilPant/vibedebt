export interface Scenario { name: string; expression: string }

/** Inputs for the supported public VibeMart profile; expected outputs are captured, never recomputed. */
export function scenarios(): Scenario[] {
  const cases: Scenario[] = [];
  const add = (name: string, expression: string): void => { cases.push({ name, expression }); };
  for (const price of [0, -1, 99.99, 100, 149.99, 199.99, 200, 300, 0.335]) {
    for (const coupon of ['', 'VIBE20', 'SAVE10', ' vibe20 ']) {
      for (const vip of [false, true]) {
        add(`pricing ${price}/${coupon}/${vip}`, `[api.computeCartPricing, api.calculateFinalPricing,
          api.recalculateOrderFinancials].map(fn => fn([item(${price})], ${JSON.stringify(coupon)}, ${vip}))`);
      }
    }
  }
  add('empty cart', '[api.computeCartPricing, api.calculateFinalPricing, api.recalculateOrderFinancials].map(fn => fn([]))');
  add('multiple quantities', '[api.computeCartPricing, api.calculateFinalPricing, api.recalculateOrderFinancials].map(fn => fn([item(60, 2), item(0.335, 3)], "SAVE10", true))');
  for (const state of ['CA', 'NY', 'TX', 'WA', '', ' ca ']) {
    add(`tax ${state}`, `api.calculateStateTax(${JSON.stringify(state)}, 123.45)`);
  }
  for (const amount of [0, 149.99, 150, 200]) for (const method of ['standard', 'express']) {
    add(`shipping ${amount}/${method}`, `api.calculateShippingCost(${amount}, '${method}')`);
  }
  for (const status of ['pending', 'processing', 'completed', 'refunded']) {
    add(`status ${status}`, `({next: api.getNextOrderStatus('${status}'),
      refundable: api.canRefundOrder({...api.INITIAL_ORDERS[0], status: '${status}'})})`);
  }
  for (const code of ['VIBE20', ' save10 ', 'UNKNOWN', '']) {
    add(`coupon ${code}`, `api.validateMockCoupon(${JSON.stringify(code)})`);
  }
  add('seed catalogs and lookups', `({products: api.getMockProducts(), orders: api.getMockOrders(),
    product: api.getMockProductById('prod-001'), sku: api.getMockProductById('ELEC-HEADPHONE-PRO'),
    order: api.getMockOrderById('#ORD-1001'), missing: api.getMockOrderById('missing')})`);
  add('create defaults and explicit zero behavior', `({created: api.createMockOrder({totalAmount: 50, taxRate: 0}), orders: api.getMockOrders('pending')})`);
  add('order transitions and refund errors', `(() => {
    const order = api.createMockOrder({items: [item(100)], subtotal: 100, totalAmount: 105});
    const processing = {...api.updateMockOrderStatus(order.orderNumber, 'processing')};
    const completed = {...api.updateMockOrderStatus(order.id, 'completed')};
    const refunded = {...api.refundMockOrder(order.id)};
    return {processing, completed, refunded, duplicate: errorOf(() => api.refundMockOrder(order.id)),
      missing: errorOf(() => api.updateMockOrderStatus('missing', 'completed'))}; })()`);
  for (const base of ['/api/orders', '/api/v1/orders']) {
    add(`REST ${base} get/filter/create`, `(async () => ({
      list: await api.handleMockRestRequest('${base}'),
      filter: await api.handleMockRestRequest('${base}?status=pending'),
      created: await api.handleMockRestRequest('${base}', 'POST', JSON.stringify({totalAmount: 45}))
    }))()`);
    add(`REST ${base} status/refund/errors`, `(async () => {
      const order = api.createMockOrder({totalAmount: 60});
      const next = JSON.parse(JSON.stringify(await api.handleMockRestRequest('${base}/' + order.id + '/status', 'POST', {status:'completed'})));
      const refund = JSON.parse(JSON.stringify(await api.handleMockRestRequest('${base}/' + order.id + '/refund', 'POST')));
      return {next, refund, duplicate: await api.handleMockRestRequest('${base}/' + order.id + '/refund', 'POST'),
        missing: await api.handleMockRestRequest('${base}/missing/status', 'POST', {status:'processing'})}; })()`);
  }
  for (const url of ['/api/products', '/api/v1/products', '/api/unknown']) {
    add(`REST ${url}`, `api.handleMockRestRequest('${url}')`);
  }
  add('mockFetch response', `(async () => { const res = await api.mockFetch('/api/v1/orders');
    return {status: res.status, type: res.headers.get('content-type'), body: await res.json()}; })()`);
  add('interceptor install/restore', `(async () => {
    const original = globalThis.fetch;
    try { api.installMockApiInterceptor(); const res = await fetch('/api/orders?status=completed');
      return {status: res.status, body: await res.json()};
    } finally { api.restoreOriginalFetch(); expect(globalThis.fetch).toBe(original); }
  })()`);
  add('public facade and components', `({version: api.VibeMart.version,
    components: Object.keys(api.VibeMart.components), domain: Object.keys(api.VibeMart.domain),
    types: [typeof api.ShopDashboard, typeof api.CheckoutModal, typeof api.OrderManagement]})`);
  return cases;
}
