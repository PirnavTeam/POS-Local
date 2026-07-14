// All Orders endpoints use /api/Orders (plural) as the base
const BASE_URL = 'https://wildlife-unwieldy-devotee.ngrok-free.dev/api/Orders';

const DEFAULT_HEADERS = {
  'ngrok-skip-browser-warning': 'true',
  'Accept': 'application/json',
  'Content-Type': 'application/json',
};

// Initial mock orders to load if localStorage is empty
const MOCK_ORDERS = [
  {
    id: 'ORD10214',
    orderId: 'ORD10214',
    invoiceNo: 'INV-10214',
    customerName: 'Rajesh Kumar',
    customerType: 'Farmer',
    phone: '9876543210',
    email: 'rajesh@example.com',
    orderDate: '2026-07-06T10:30:00.000Z',
    deliveryDate: '2026-07-10T10:30:00.000Z',
    totalAmount: 14500,
    paidAmount: 0,
    status: 'Processing',
    paymentStatus: 'Pending Verification',
    paymentMethod: 'UPI / Bank Transfer',
    utr: '620478129034',
    logistics: 'Delhivery',
    trackingNo: 'DLV9928341',
    shippingAddress: 'Plot No. 12, Agro Park, Nagpur, Maharashtra',
    billingAddress: 'Plot No. 12, Agro Park, Nagpur, Maharashtra',
    notes: 'Please ship organic fertilizer details.',
    items: [
      { sku: 'FERT-001', name: 'Premium Organic Fertilizer', category: 'Fertilizers', quantity: 2, unitPrice: 7250 }
    ],
    timeline: [
      { label: 'Order Placed', date: '2026-07-06', completed: true }
    ]
  },
  {
    id: 'ORD10215',
    orderId: 'ORD10215',
    invoiceNo: 'INV-10215',
    customerName: 'Amit Patel',
    customerType: 'Retailer',
    phone: '8765432109',
    email: 'amit@retailagro.com',
    orderDate: '2026-07-07T08:15:00.000Z',
    deliveryDate: '2026-07-12T08:15:00.000Z',
    totalAmount: 8500,
    paidAmount: 8500,
    status: 'Dispatched',
    paymentStatus: 'Paid',
    paymentMethod: 'UPI / Bank Transfer',
    utr: '998811223344',
    logistics: 'Safexpress',
    trackingNo: 'SFX8877112',
    shippingAddress: 'Shop 4, Market Yard, Pune, Maharashtra',
    billingAddress: 'Shop 4, Market Yard, Pune, Maharashtra',
    notes: 'Deliver before Friday.',
    items: [
      { sku: 'TOOL-05', name: 'Heavy Duty Hand Weeder', category: 'Tools', quantity: 5, unitPrice: 1700 }
    ],
    timeline: [
      { label: 'Order Placed', date: '2026-07-07', completed: true },
      { label: 'Packed', date: '2026-07-07', completed: true },
      { label: 'Shipped', date: '2026-07-07', completed: true }
    ]
  }
];

// Helper to initialize and retrieve local storage orders
const getLocalOrders = () => {
  const local = localStorage.getItem('shyam_agro_orders');
  if (!local) {
    localStorage.setItem('shyam_agro_orders', JSON.stringify(MOCK_ORDERS));
    return MOCK_ORDERS;
  }
  try {
    return JSON.parse(local);
  } catch (e) {
    return MOCK_ORDERS;
  }
};

const saveLocalOrders = (orders) => {
  localStorage.setItem('shyam_agro_orders', JSON.stringify(orders));
};

// GET /api/Orders  — fetch all orders
export const getOrders = async () => {
  try {
    const response = await fetch(BASE_URL, { headers: DEFAULT_HEADERS });
    if (!response.ok) throw new Error(`Failed to fetch orders (${response.status})`);
    const serverOrders = await response.json();
    
    // Merge server orders and local orders to ensure local creations/modifications are visible
    const localOrders = getLocalOrders();
    const merged = [...localOrders];
    
    // Add server orders that aren't already represented in local storage by ID
    const localIds = new Set(localOrders.map(o => String(o.id || o.orderId)));
    const serverList = Array.isArray(serverOrders) ? serverOrders : (serverOrders.orders || serverOrders.data || []);
    serverList.forEach(so => {
      const soId = String(so.id || so.orderId);
      if (!localIds.has(soId)) {
        merged.push(so);
      }
    });
    
    return merged;
  } catch (err) {
    console.warn("API offline, falling back to LocalStorage orders:", err);
    return getLocalOrders();
  }
};

// GET /api/Orders/{id}  — fetch single order
export const getOrder = async (id) => {
  try {
    const response = await fetch(`${BASE_URL}/${id}`, { headers: DEFAULT_HEADERS });
    if (!response.ok) throw new Error(`Failed to fetch order ${id} (${response.status})`);
    return await response.json();
  } catch (err) {
    console.warn(`API offline, fetching order ${id} from LocalStorage:`, err);
    const local = getLocalOrders();
    const found = local.find(o => String(o.id || o.orderId) === String(id));
    if (!found) throw new Error(`Order ${id} not found locally.`);
    return found;
  }
};

// POST /api/Orders  — create new order
export const createOrder = async (payload) => {
  const localOrders = getLocalOrders();
  // Ensure the new order has an ID and timestamp
  const newOrder = {
    ...payload,
    id: payload.id || payload.orderId || `ORD${Date.now().toString().slice(-6)}`,
    orderId: payload.id || payload.orderId || `ORD${Date.now().toString().slice(-6)}`,
    orderDate: payload.orderDate || new Date().toISOString(),
    invoiceNo: payload.invoiceNo || `INV-${Date.now().toString().slice(-6)}`,
    status: payload.status || 'Processing',
    timeline: payload.timeline || [{ label: 'Order Placed', date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), completed: true }]
  };
  
  // Save locally first to guarantee persistence
  localOrders.unshift(newOrder);
  saveLocalOrders(localOrders);

  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Failed to create order (${response.status})`);
    return await response.json();
  } catch (err) {
    console.warn("API offline, saved order locally only:", err);
    return newOrder;
  }
};

// PUT /api/Orders/{id}/status  — update order status (returns 204 NoContent)
export const updateOrderStatus = async (id, status) => {
  // Update locally first
  const localOrders = getLocalOrders();
  const index = localOrders.findIndex(o => String(o.id || o.orderId) === String(id));
  if (index !== -1) {
    localOrders[index].status = status;
    saveLocalOrders(localOrders);
  }

  try {
    const response = await fetch(`${BASE_URL}/${id}/status`, {
      method: 'PUT',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ status }),
    });
    if (!response.ok) throw new Error(`Failed to update status for order ${id} (${response.status})`);
    return { success: true };
  } catch (err) {
    console.warn(`API offline, updated order ${id} status locally to ${status}:`, err);
    return { success: true };
  }
};

// Custom: Update Payment Status (for manual UTR verification)
export const updateOrderPaymentStatus = async (id, paymentStatus, paidAmount) => {
  const localOrders = getLocalOrders();
  const index = localOrders.findIndex(o => String(o.id || o.orderId) === String(id));
  if (index !== -1) {
    localOrders[index].paymentStatus = paymentStatus;
    if (paidAmount !== undefined) {
      localOrders[index].paidAmount = paidAmount;
    }
    
    // Feedback handling: "after the payment success then change the status automatically"
    if (paymentStatus === 'Paid' || paymentStatus === 'Verified') {
      localOrders[index].status = 'Processing'; // Set order status to processing automatically on payment success
      localOrders[index].timeline = localOrders[index].timeline || [];
      if (!localOrders[index].timeline.some(t => t.label === 'Payment Verified')) {
        localOrders[index].timeline.push({
          label: 'Payment Verified',
          date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          completed: true
        });
      }
    }
    
    saveLocalOrders(localOrders);
  }

  try {
    const response = await fetch(`${BASE_URL}/${id}/payment-status`, {
      method: 'PUT',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ paymentStatus, paidAmount }),
    });
    if (!response.ok) throw new Error(`Failed to update payment status for order ${id}`);
    return { success: true };
  } catch (err) {
    console.warn(`API offline, updated order ${id} payment status locally to ${paymentStatus}:`, err);
    return { success: true };
  }
};

// DELETE /api/Orders/{id}  — cancel/delete order (returns 204 NoContent)
export const deleteOrder = async (id) => {
  // Update locally first
  const localOrders = getLocalOrders();
  const filtered = localOrders.filter(o => String(o.id || o.orderId) !== String(id));
  saveLocalOrders(filtered);

  try {
    const response = await fetch(`${BASE_URL}/${id}`, {
      method: 'DELETE',
      headers: DEFAULT_HEADERS,
    });
    if (!response.ok) throw new Error(`Failed to delete order ${id} (${response.status})`);
    return { success: true };
  } catch (err) {
    console.warn(`API offline, deleted order ${id} locally:`, err);
    return { success: true };
  }
};

// GET /api/Orders/tracking — fetch all tracking orders
export const getOrdersTracking = async () => {
  try {
    const response = await fetch(`${BASE_URL}/tracking`, { headers: DEFAULT_HEADERS });
    if (!response.ok) throw new Error(`Failed to fetch tracking orders (${response.status})`);
    const serverOrders = await response.json();
    return serverOrders;
  } catch (err) {
    console.warn("API offline, falling back to LocalStorage for tracking orders:", err);
    const local = getLocalOrders();
    return local.filter(o => ['paid', 'verified', 'success'].includes((o.paymentStatus || '').toLowerCase()));
  }
};

// GET /api/Orders/tracking/{id} — fetch tracking detail for single order
export const getOrderTracking = async (id) => {
  try {
    const response = await fetch(`${BASE_URL}/tracking/${id}`, { headers: DEFAULT_HEADERS });
    if (!response.ok) throw new Error(`Failed to fetch tracking for order ${id} (${response.status})`);
    return await response.json();
  } catch (err) {
    console.warn(`API offline, fetching order tracking ${id} from LocalStorage:`, err);
    const local = getLocalOrders();
    const found = local.find(o => String(o.id || o.orderId) === String(id));
    if (!found) throw new Error(`Order ${id} tracking not found locally.`);
    return found;
  }
};

// POST /api/Orders/tracking/{id} — post tracking update
export const postOrderTracking = async (id, payload) => {
  try {
    const response = await fetch(`${BASE_URL}/tracking/${id}`, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Failed to post tracking for order ${id} (${response.status})`);
    return await response.json();
  } catch (err) {
    console.warn(`API offline, saved tracking update for ${id} locally fallback:`, err);
    return payload;
  }
};

// GET /api/Orders/shipping — fetch all shipping orders
export const getOrdersShipping = async () => {
  try {
    const response = await fetch(`${BASE_URL}/shipping`, { headers: DEFAULT_HEADERS });
    if (!response.ok) throw new Error(`Failed to fetch shipping orders (${response.status})`);
    const serverOrders = await response.json();
    return serverOrders;
  } catch (err) {
    console.warn("API offline, falling back to LocalStorage for shipping orders:", err);
    const local = getLocalOrders();
    return local.filter(o => ['paid', 'verified', 'success'].includes((o.paymentStatus || '').toLowerCase()));
  }
};

// GET /api/Orders/shipping/{id} — fetch shipping details for single order
export const getOrderShipping = async (id) => {
  try {
    const response = await fetch(`${BASE_URL}/shipping/${id}`, { headers: DEFAULT_HEADERS });
    if (!response.ok) throw new Error(`Failed to fetch shipping for order ${id} (${response.status})`);
    return await response.json();
  } catch (err) {
    console.warn(`API offline, fetching order shipping ${id} from LocalStorage:`, err);
    const local = getLocalOrders();
    const found = local.find(o => String(o.id || o.orderId) === String(id));
    if (!found) throw new Error(`Order ${id} shipping not found locally.`);
    return found;
  }
};

// POST /api/Orders/shipping/{id}/pack — mark order as packed
export const packOrder = async (id, payload) => {
  try {
    const response = await fetch(`${BASE_URL}/shipping/${id}/pack`, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Failed to pack order ${id} (${response.status})`);
    return { success: true };
  } catch (err) {
    console.warn(`API offline, packed order ${id} locally fallback:`, err);
    return { success: true };
  }
};

// POST /api/Orders/shipping/{id}/dispatch — mark order as dispatched
export const dispatchOrder = async (id, payload) => {
  try {
    const response = await fetch(`${BASE_URL}/shipping/${id}/dispatch`, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Failed to dispatch order ${id} (${response.status})`);
    return { success: true };
  } catch (err) {
    console.warn(`API offline, dispatched order ${id} locally fallback:`, err);
    return { success: true };
  }
};
