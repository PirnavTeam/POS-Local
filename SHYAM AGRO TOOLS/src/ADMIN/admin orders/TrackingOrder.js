import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  Save,
  ChevronRight,
  ClipboardList,
  Clock,
  Package,
  Truck,
  Compass,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { getOrdersTracking, postOrderTracking, updateOrderStatus } from '../api/orders';
import { OrderStatusBadge, formatCurrency } from './OrdersLedger';
import './adminOrders.css';

const STATUS_DESCRIPTIONS = {
  Processing: 'Order is verified. Inventory is being committed and prepared.',
  Packed: 'Order items are packed, labeled, and prepared for carrier pickup.',
  Shipped: 'Package has been handed over to logistics provider and is in transit.',
  Dispatched: 'Package is dispatched to regional logistics hub.',
  Completed: 'Order delivered to the customer successfully and transaction closed.',
  Cancelled: 'Order cancelled. Reverting stock allocation.'
};

const STATUS_THEMES = {
  Processing: { bg: '#fffbeb', text: '#b45309', border: '#fde68a', icon: Clock },
  Packed: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0', icon: Package },
  Shipped: { bg: '#e0e7ff', text: '#4338ca', border: '#c7d2fe', icon: Truck },
  Dispatched: { bg: '#e0e7ff', text: '#4338ca', border: '#c7d2fe', icon: Compass },
  Completed: { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0', icon: CheckCircle },
  Cancelled: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', icon: AlertCircle }
};

const TrackingOrder = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState({ text: '', isError: false });

  // Status updates states
  const [tempStatus, setTempStatus] = useState('');
  const [notesInput, setNotesInput] = useState('');

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getOrdersTracking();
      const list = Array.isArray(data) ? data : (data.orders || data.data || []);
      
      // We only track verified success orders
      const verifiedList = list.filter(o => 
        ['paid', 'verified', 'success'].includes((o.paymentStatus || '').toLowerCase())
      );
      
      setOrders(verifiedList);
      
      if (verifiedList.length > 0 && !selectedOrderId) {
        setSelectedOrderId(verifiedList[0].id || verifiedList[0].orderId);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return orders.filter(o => 
      String(o.id || o.orderId).toLowerCase().includes(q) ||
      (o.customerName || o.customer || '').toLowerCase().includes(q)
    );
  }, [orders, searchTerm]);

  const activeOrder = useMemo(() => {
    return orders.find(o => String(o.id || o.orderId) === String(selectedOrderId)) || null;
  }, [orders, selectedOrderId]);

  // Sync edit state when active order changes
  useEffect(() => {
    if (activeOrder) {
      setTempStatus(activeOrder.status || 'Processing');
      setNotesInput('');
      setUpdateMsg({ text: '', isError: false });
    }
  }, [activeOrder]);

  const handleUpdateStatus = async () => {
    if (!activeOrder) return;
    setUpdating(true);
    setUpdateMsg({ text: '', isError: false });
    try {
      // 1. Update order status in core API (updates server & local storage)
      await updateOrderStatus(activeOrder.id, tempStatus);

      // Sync via tracking post API
      await postOrderTracking(activeOrder.id, {
        status: tempStatus,
        description: notesInput || STATUS_DESCRIPTIONS[tempStatus] || ''
      });

      // 2. Fetch updated orders list from local storage to update state
      const local = localStorage.getItem('shyam_agro_orders');
      if (local) {
        const parsed = JSON.parse(local);
        const matchIdx = parsed.findIndex(o => String(o.id || o.orderId) === String(activeOrder.id));
        if (matchIdx !== -1) {
          // Append new timeline entry
          const timeline = parsed[matchIdx].timeline || [];
          const statusText = `Status updated to ${tempStatus}`;
          
          if (!timeline.some(t => t.label === statusText)) {
            timeline.push({
              label: statusText,
              date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
              completed: true,
              description: notesInput || STATUS_DESCRIPTIONS[tempStatus] || ''
            });
            parsed[matchIdx].timeline = timeline;
          }
          
          // Save back
          localStorage.setItem('shyam_agro_orders', JSON.stringify(parsed));
        }
      }

      setUpdateMsg({ text: 'Order status updated and customer timeline refreshed!', isError: false });
      
      // Reload lists
      await loadOrders();
    } catch (err) {
      setUpdateMsg({ text: err.message || 'Status update failed.', isError: true });
    } finally {
      setUpdating(false);
    }
  };

  if (loading && orders.length === 0) {
    return (
      <div className="orders-mgmt-container" style={{ padding: '24px' }}>
        <h2>Order Tracking Hub</h2>
        <p>Loading tracking ledger...</p>
      </div>
    );
  }

  return (
    <div className="orders-mgmt-container" style={{ padding: '24px' }}>
      
      {/* Header */}
      <div className="orders-mgmt-header" style={{ marginBottom: '24px' }}>
        <div className="orders-mgmt-title">
          <h1>Tracking Order</h1>
          <p>Real-time order status updates and customer timeline synchronization.</p>
        </div>
        <button
          onClick={loadOrders}
          className="date-preset-btn"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={14} /> Refresh Data
        </button>
      </div>

      {error && <div style={{ color: '#dc2626', marginBottom: '16px', fontWeight: 600 }}>{error}</div>}

      <div className="shipping-grid">
        
        {/* Left Side: Order Selector */}
        <div className="orders-card-table-wrap" style={{ padding: '16px', background: 'white' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 800 }}>Orders ledger</h3>
          <div className="orders-search-wrapper" style={{ marginBottom: '16px' }}>
            <Search size={16} className="orders-search-icon" />
            <input
              type="text"
              className="orders-search-input"
              style={{ padding: '8px 12px 8px 38px', fontSize: '13px' }}
              placeholder="Search ID or Customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '550px', overflowY: 'auto', paddingRight: '4px' }}>
            {filteredOrders.map(o => (
              <div
                key={o.id}
                onClick={() => setSelectedOrderId(o.id)}
                className={`orders-stat-card order-picker-card ${String(o.id || o.orderId) === String(selectedOrderId) ? 'active' : ''}`}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <strong style={{ fontSize: '13px', display: 'block', color: '#1e293b' }}>Order #{o.id || o.orderId}</strong>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                    {o.customerName || o.customer || 'Unknown'} • {formatCurrency(o.totalAmount || o.total)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <OrderStatusBadge status={o.status} />
                  <ChevronRight size={14} style={{ color: '#94a3b8' }} />
                </div>
              </div>
            ))}
            {filteredOrders.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '13px' }}>
                No active tracking orders matching search.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Tracking Details & Status Form */}
        {activeOrder ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Status Info Card */}
            <div className="orders-card-table-wrap" style={{ padding: '24px', background: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Active Track</span>
                  <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '2px 0 0 0' }}>Order #{activeOrder.id}</h2>
                  <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>
                    {activeOrder.customerName || activeOrder.customer} ({activeOrder.phone})
                  </span>
                </div>
                <OrderStatusBadge status={activeOrder.status} />
              </div>

              {/* Status Update Form */}
              <div className="shipping-action-card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <h3 className="shipping-action-title">
                  <ClipboardList size={16} style={{ color: '#10b981' }} />
                  Update Order Fulfillment Status
                </h3>
                
                <div className="action-form-group">
                  {/* Redesigned Visual Selector Grid */}
                  <div>
                    <label className="action-label" style={{ display: 'block', marginBottom: '8px' }}>Select Fulfillment Phase</label>
                    <div className="status-select-grid">
                      {Object.keys(STATUS_THEMES).map((s) => {
                        const theme = STATUS_THEMES[s];
                        const Icon = theme.icon;
                        const isActive = tempStatus === s;
                        return (
                          <div
                            key={s}
                            onClick={() => setTempStatus(s)}
                            className={`status-select-card ${isActive ? 'active' : ''}`}
                            style={{
                              '--theme-bg': theme.bg,
                              '--theme-text': theme.text,
                              '--theme-border': theme.border
                            }}
                          >
                            <Icon size={18} style={{ color: isActive ? theme.text : '#64748b' }} />
                            <span>{s}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="action-label" style={{ display: 'block', marginBottom: '6px' }}>
                      Status Notes / Description (Will be displayed to customer)
                    </label>
                    <textarea
                      rows={3}
                      className="action-input"
                      style={{ resize: 'none', background: 'white', fontFamily: 'inherit' }}
                      placeholder="e.g. Stock verified. Order package has been dispatched from Nagpur warehouse."
                      value={notesInput}
                      onChange={(e) => setNotesInput(e.target.value)}
                    />
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Leave blank to auto-fill with standard descriptions.
                    </span>
                  </div>

                  <button
                    onClick={handleUpdateStatus}
                    disabled={updating}
                    className="date-preset-btn active"
                    style={{
                      width: '100%',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      marginTop: '6px'
                    }}
                  >
                    <Save size={16} />
                    {updating ? 'Updating...' : 'Save & Publish Tracking Update'}
                  </button>

                  {updateMsg.text && (
                    <div
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        marginTop: '8px',
                        background: updateMsg.isError ? '#fef2f2' : '#f0fdf4',
                        color: updateMsg.isError ? '#b91c1c' : '#166534',
                        border: updateMsg.isError ? '1px solid #fecaca' : '1px solid #bbf7d0'
                      }}
                    >
                      {updateMsg.text}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Explanation Card */}
              {tempStatus && (
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    background: STATUS_THEMES[tempStatus]?.bg || '#f8fafc',
                    color: STATUS_THEMES[tempStatus]?.text || '#475569',
                    border: `1px solid ${STATUS_THEMES[tempStatus]?.border || '#cbd5e1'}`
                  }}
                >
                  <strong>Fulfillment Stage: {tempStatus}</strong>
                  <p style={{ margin: '4px 0 0 0' }}>{STATUS_DESCRIPTIONS[tempStatus]}</p>
                </div>
              )}

            </div>

            {/* Current Timeline View */}
            <div className="orders-card-table-wrap" style={{ padding: '24px', background: 'white' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.05em' }}>
                Customer Timeline Logs
              </h3>

              <div className="modern-timeline" style={{ paddingLeft: '20px' }}>
                {activeOrder.timeline && activeOrder.timeline.map((event, idx) => (
                  <div key={idx} className="timeline-event completed">
                    <span className="timeline-dot" />
                    <div className="timeline-info">
                      <span className="timeline-title" style={{ color: '#0f172a' }}>{event.label}</span>
                      <span className="timeline-time">{event.date}</span>
                      {event.description && (
                        <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#64748b', background: '#f8fafc', padding: '4px 8px', borderRadius: '4px' }}>
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Initial Timeline Items if empty */}
                {(!activeOrder.timeline || activeOrder.timeline.length === 0) && (
                  <>
                    <div className="timeline-event completed">
                      <span className="timeline-dot" />
                      <div className="timeline-info">
                        <span className="timeline-title">Order Placed</span>
                        <span className="timeline-time">{activeOrder.orderDate?.slice(0, 10) || 'Date Placed'}</span>
                      </div>
                    </div>
                    <div className="timeline-event completed">
                      <span className="timeline-dot" />
                      <div className="timeline-info">
                        <span className="timeline-title">Payment Verified</span>
                        <span className="timeline-time">Verified Success</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>
        ) : (
          <div className="orders-card-table-wrap" style={{ padding: '32px', background: 'white', textAlign: 'center', color: '#64748b' }}>
            Select an order to view tracking dashboard and update logistics statuses.
          </div>
        )}
      </div>

    </div>
  );
};

export default TrackingOrder;
