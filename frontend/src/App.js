import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Fade from '@mui/material/Fade';
import LinearProgress from '@mui/material/LinearProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import InputAdornment from '@mui/material/InputAdornment';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineOppositeContent from '@mui/lab/TimelineOppositeContent';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PaymentIcon from '@mui/icons-material/Payment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HistoryIcon from '@mui/icons-material/History';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import PendingIcon from '@mui/icons-material/Pending';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import TimelineIcon from '@mui/icons-material/Timeline';
import ReplayIcon from '@mui/icons-material/Replay';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import InfoIcon from '@mui/icons-material/Info';
import BlockIcon from '@mui/icons-material/Block';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

const API_BASE = 'http://localhost:8000/api/v1';
const WS_BASE = 'ws://localhost:8000/ws';

const STEPS = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED'];
const TERMINAL_STATES = ['DELIVERED', 'FAILED', 'CANCELLED'];
const ALL_STATUSES = ['ALL', 'PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'FAILED', 'CANCELLED'];

/* ─── MUI Dark Theme ─── */
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#6366f1', light: '#818cf8', dark: '#4f46e5' },
    secondary: { main: '#a855f7', light: '#c084fc', dark: '#9333ea' },
    success: { main: '#10b981', light: '#34d399', dark: '#059669' },
    error: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
    warning: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
    info: { main: '#3b82f6', light: '#60a5fa', dark: '#2563eb' },
    background: { default: '#0a0f1c', paper: 'rgba(17, 24, 39, 0.8)' },
    text: { primary: '#f1f5f9', secondary: '#94a3b8' },
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    h4: { fontWeight: 800, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
    subtitle2: { fontWeight: 500, color: '#94a3b8' },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, borderRadius: 10 },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
            '&:hover fieldset': { borderColor: 'rgba(99,102,241,0.5)' },
            '&.Mui-focused fieldset': { borderColor: '#6366f1' },
          },
        },
      },
    },
    MuiStepIcon: {
      styleOverrides: {
        root: {
          color: 'rgba(255,255,255,0.15)',
          '&.Mui-active': { color: '#6366f1' },
          '&.Mui-completed': { color: '#10b981' },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: '1px solid rgba(255,255,255,0.06)' },
        head: { fontWeight: 600, color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          background: 'rgba(17, 24, 39, 0.95)',
          backdropFilter: 'blur(30px)',
          border: '1px solid rgba(255,255,255,0.1)',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
  },
});

/* ─── Status Config ─── */
const statusConfig = {
  PENDING:   { color: 'warning', icon: <PendingIcon sx={{ fontSize: 16 }} />,      dotColor: '#f59e0b' },
  PAID:      { color: 'info',    icon: <PaymentIcon sx={{ fontSize: 16 }} />,       dotColor: '#3b82f6' },
  SHIPPED:   { color: 'success', icon: <LocalShippingIcon sx={{ fontSize: 16 }} />, dotColor: '#10b981' },
  DELIVERED: { color: 'success', icon: <CheckCircleIcon sx={{ fontSize: 16 }} />,   dotColor: '#059669' },
  FAILED:    { color: 'error',   icon: <ErrorIcon sx={{ fontSize: 16 }} />,          dotColor: '#ef4444' },
  CANCELLED: { color: 'default', icon: <BlockIcon sx={{ fontSize: 16 }} />,          dotColor: '#64748b' },
};

const eventTypeLabels = {
  'order.created': 'Order Created',
  'payment.processed': 'Payment Processed',
  'payment.retry': 'Payment Retry',
  'payment.failed': 'Payment Failed',
  'order.shipped': 'Order Shipped',
  'order.delivered': 'Order Delivered',
  'shipping.retry': 'Shipping Retry',
  'shipping.failed': 'Shipping Failed',
  'order.cancelled': 'Order Cancelled',
  'order.updated': 'Order Updated',
};

function App() {
  // --- State ---
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [activeBatch, setActiveBatch] = useState([]);
  const [activeBatchIndex, setActiveBatchIndex] = useState(0);
  const [retryCounts, setRetryCounts] = useState({});
  const failTriggeredRef = useRef({}); // Track orders that have triggered /fail
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [ordersHistory, setOrdersHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Search & Filter
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // WebSocket
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);

  // Detail Dialog
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailTab, setDetailTab] = useState(0);
  const [timeline, setTimeline] = useState([]);
  const [retries, setRetries] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Timer
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Edit Dialog
  const [editDialog, setEditDialog] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');

  // Cancel Confirm
  const [cancelConfirm, setCancelConfirm] = useState(null);

  // Bulk Order Dialog
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCsv, setBulkCsv] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // --- Fetch History ---
  const fetchHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);
      const url = `${API_BASE}/orders${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrdersHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // --- Global WebSocket ---
  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/orders/all`);
    ws.onopen = () => {
      setWsConnected(true);
      // Heartbeat every 30s
      ws._heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping');
      }, 30000);
    };
    ws.onmessage = (event) => {
      if (event.data === 'pong') return;
      try {
        const data = JSON.parse(event.data);
        
        // Update active batch
        setActiveBatch((prev) => {
          if (!prev || prev.length === 0) return prev;
          const idx = prev.findIndex(o => o.id === data.order_id);
          if (idx === -1) return prev;
          const updated = [...prev];
          updated[idx] = { ...updated[idx] };
          if (data.status) updated[idx].status = data.status;
          if (data.tracking_number) updated[idx].tracking_number = data.tracking_number;
          if (data.item_name) updated[idx].item_name = data.item_name;
          if (data.price !== undefined) updated[idx].price = data.price;
          return updated;
        });

        // Dynamically update history
        setOrdersHistory((prev) => {
          const index = prev.findIndex(o => o.order_id === data.order_id);
          if (index !== -1) {
            const newHistory = [...prev];
            newHistory[index] = { ...newHistory[index], ...data };
            return newHistory;
          }
          // If not found, maybe fetch history again to get it
          return prev;
        });

      } catch (e) {
        console.error('WS parse error:', e);
      }
    };
    ws.onclose = () => {
      setWsConnected(false);
      clearInterval(ws._heartbeat);
    };
    ws.onerror = () => {
      setWsConnected(false);
    };
    wsRef.current = ws;
    return () => {
      clearInterval(ws._heartbeat);
      ws.close();
    };
  }, []);

  // Fallback polling (if WebSocket not connected)
  useEffect(() => {
    if (activeBatch.length === 0 || wsConnected) return;

    const interval = setInterval(async () => {
      try {
        const activeOrder = activeBatch[activeBatchIndex];
        if (!activeOrder || TERMINAL_STATES.includes(activeOrder.status)) return;
        const res = await fetch(`${API_BASE}/orders/${activeOrder.id}`);
        if (!res.ok) throw new Error('Failed to fetch order status.');
        const update = await res.json();
        
        setActiveBatch((prev) => {
          const idx = prev.findIndex(o => o.id === update.order_id);
          if (idx === -1) return prev;
          const newBatch = [...prev];
          newBatch[idx] = {
            ...newBatch[idx],
            status: update.status,
            tracking_number: update.tracking_number,
            item_name: update.item_name,
            price: update.price,
          };
          return newBatch;
        });

        if (TERMINAL_STATES.includes(update.status)) {
          fetchHistory();
        }
      } catch (err) {
        setError(err.message);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeBatch, activeBatchIndex, wsConnected, fetchHistory]);


  // Background trigger for failed retries
  useEffect(() => {
    activeBatch.forEach(o => {
      if (o.status === 'PENDING') {
        let t = o.created_at || new Date().toISOString();
        if (!t.endsWith('Z')) t = t.replace(' ', 'T') + 'Z';
        const expires = new Date(t).getTime() + (o.is_bulk ? 60000 : 30000);
        const remaining = Math.max(0, Math.floor((expires - now) / 1000));
        const retries = retryCounts[o.id] || 0;
        
        if (remaining === 0 && retries >= 3 && !failTriggeredRef.current[o.id]) {
          failTriggeredRef.current[o.id] = true;
          fetch(`${API_BASE}/orders/${o.id}/fail`, { method: 'POST' })
            .then(res => {
              if (res.ok) {
                setActiveBatch(prev => {
                  const newBatch = [...prev];
                  const idx = newBatch.findIndex(x => x.id === o.id);
                  if (idx !== -1) newBatch[idx] = { ...newBatch[idx], status: 'FAILED' };
                  return newBatch;
                });
              }
            })
            .catch(() => {
               failTriggeredRef.current[o.id] = false;
            });
        }
      }
    });
  }, [now, activeBatch, retryCounts]);

  // --- Place Order ---
  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!itemName || !price) {
      setError('Please provide both an item name and a valid price.');
      return;
    }
    if (parseFloat(price) <= 0) {
      setError('Price must be greater than zero.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: itemName, price: parseFloat(price) }),
      });
      if (!res.ok) throw new Error('Failed to submit order.');
      const data = await res.json();
      const newOrder = {
        id: data.order_id,
        item_name: itemName,
        price: parseFloat(price),
        status: data.status,
        tracking_number: null,
        is_bulk: false,
        created_at: new Date().toISOString()
      };
      setActiveBatch(prev => prev.length === 0 ? [newOrder] : [...prev, newOrder]);
      if (activeBatch.length === 0) setActiveBatchIndex(0);
      setSuccessMsg(`Order ${data.order_id.substring(0, 8)}... queued for processing!`);
      setItemName('');
      setPrice('');
      fetchHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Cancel Order ---
  const handleCancelOrder = async (orderId) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to cancel order.');
      }
      setSuccessMsg(`Cancellation request for ${orderId.substring(0, 8)}... queued.`);
      setCancelConfirm(null);
      setTimeout(fetchHistory, 1500);
    } catch (err) {
      setError(err.message);
      setCancelConfirm(null);
    }
  };

  // --- Pay Order ---
  const handlePayOrder = async (orderId) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/pay`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to submit payment.');
      }
      setSuccessMsg(`Payment submitted for ${orderId.substring(0, 8)}...`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRetryOrder = async (orderId) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/retry`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to retry payment.');
      setRetryCounts(prev => ({ ...prev, [orderId]: (prev[orderId] || 0) + 1 }));
      setActiveBatch(prev => {
        const newBatch = [...prev];
        const idx = newBatch.findIndex(o => o.id === orderId);
        if (idx !== -1) {
          newBatch[idx] = { ...newBatch[idx], created_at: new Date().toISOString() };
        }
        return newBatch;
      });
      setSuccessMsg(`Retry initiated for ${orderId.substring(0, 8)}...`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePayAll = async () => {
    try {
      const pendingOrdersToPay = activeBatch.filter(o => {
        if (o.status !== 'PENDING') return false;
        let t = o.created_at || new Date().toISOString();
        if (!t.endsWith('Z')) t = t.replace(' ', 'T') + 'Z';
        const expires = new Date(t).getTime() + (o.is_bulk ? 60000 : 30000);
        const remaining = Math.max(0, Math.floor((expires - now) / 1000));
        return remaining > 0;
      });

      if (pendingOrdersToPay.length === 0) {
        setError("No pending orders available for payment (timers may have expired).");
        return;
      }

      await Promise.all(
        pendingOrdersToPay.map(o =>
          fetch(`${API_BASE}/orders/${o.id}/pay`, { method: 'POST' })
        )
      );
      setSuccessMsg("Payments submitted for all pending orders!");
    } catch (err) {
      setError("Bulk payment failed.");
    }
  };

  // --- Update Order ---
  const handleUpdateOrder = async () => {
    if (!editDialog) return;
    try {
      const body = {};
      if (editName) body.item_name = editName;
      if (editPrice) body.price = parseFloat(editPrice);
      const res = await fetch(`${API_BASE}/orders/${editDialog.order_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to update order.');
      }
      setSuccessMsg(`Update request for ${editDialog.order_id.substring(0, 8)}... queued.`);
      setEditDialog(null);
      setTimeout(fetchHistory, 1500);
    } catch (err) {
      setError(err.message);
      setEditDialog(null);
    }
  };

  // --- Bulk Orders ---
  const handleBulkSubmit = async () => {
    const lines = bulkCsv.trim().split('\n').filter((l) => l.trim());
    if (lines.length === 0) {
      setError('Please enter at least one order (item_name, price).');
      return;
    }
    const orders = [];
    for (const line of lines) {
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length < 2) {
        setError(`Invalid line: "${line}". Format: item_name, price`);
        return;
      }
      const p = parseFloat(parts[1]);
      if (isNaN(p) || p <= 0) {
        setError(`Invalid price in: "${line}"`);
        return;
      }
      orders.push({ item_name: parts[0], price: p });
    }

    setBulkLoading(true);
    try {
      const res = await fetch(`${API_BASE}/orders/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Bulk order failed.');
      }
      const data = await res.json();
      const newOrders = orders.map((o, i) => ({
        id: data.order_ids[i],
        item_name: o.item_name,
        price: o.price,
        status: 'PENDING',
        tracking_number: null,
        is_bulk: true,
        created_at: new Date().toISOString()
      }));
      setActiveBatch(newOrders);
      setActiveBatchIndex(0);
      setSuccessMsg(`${data.created} orders created and queued!`);
      setBulkOpen(false);
      setBulkCsv('');
      fetchHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  // --- Fetch Order Detail (Timeline + Retries) ---
  const openDetailDialog = async (order) => {
    setDetailOrder(order);
    setDetailTab(0);
    setDetailLoading(true);
    setTimeline([]);
    setRetries([]);

    try {
      const [tlRes, rtRes] = await Promise.all([
        fetch(`${API_BASE}/orders/${order.order_id}/timeline`),
        fetch(`${API_BASE}/orders/${order.order_id}/retries`),
      ]);
      if (tlRes.ok) {
        const tlData = await tlRes.json();
        setTimeline(tlData.events || []);
      }
      if (rtRes.ok) {
        const rtData = await rtRes.json();
        setRetries(rtData.retries || []);
      }
    } catch (err) {
      console.error('Failed to load order details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // --- Stepper ---
  const getStepIndex = (status) => {
    if (status === 'FAILED' || status === 'CANCELLED') return -1;
    const idx = STEPS.indexOf(status);
    return idx >= 0 ? idx : 0;
  };

  const activeOrder = activeBatch.length > 0 ? activeBatch[activeBatchIndex] : null;
  const isTerminal = activeOrder && TERMINAL_STATES.includes(activeOrder.status);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Container maxWidth="lg" sx={{ py: 6 }}>

        {/* ─── Header ─── */}
        <Fade in timeout={600}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={5}>
            <Box display="flex" alignItems="center" gap={2}>
              <Box sx={{
                width: 52, height: 52, borderRadius: '14px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 30px rgba(99,102,241,0.3)',
              }}>
                <RocketLaunchIcon sx={{ fontSize: 28, color: '#fff' }} />
              </Box>
              <Box>
                <Typography variant="h4" component="h1" sx={{
                  background: 'linear-gradient(135deg, #f1f5f9 0%, #94a3b8 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  Order Engine
                </Typography>
                <Typography variant="subtitle2" sx={{ mt: -0.3 }}>
                  Event-driven workflow processing v2
                </Typography>
              </Box>
            </Box>
            {/* WebSocket indicator */}
            <Box className={`live-indicator ${wsConnected ? 'connected' : 'disconnected'}`}>
              <span className={`live-dot ${wsConnected ? '' : 'disconnected'}`} />
              {wsConnected ? 'LIVE' : 'POLLING'}
            </Box>
          </Box>
        </Fade>

        {/* ─── Alerts ─── */}
        {error && (
          <Fade in><Alert severity="error" onClose={() => setError('')} sx={{ mb: 3, borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.3)' }}>{error}</Alert></Fade>
        )}
        {successMsg && (
          <Fade in><Alert severity="success" onClose={() => setSuccessMsg('')} sx={{ mb: 3, borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.3)' }}>{successMsg}</Alert></Fade>
        )}

        {/* ─── Order Form + Bulk Button ─── */}
        <Fade in timeout={800}>
          <Paper elevation={0} sx={{ p: 4, mb: 4, background: 'rgba(255,255,255,0.03)', '&:hover': { background: 'rgba(255,255,255,0.05)' }, transition: 'background 0.3s ease' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
              <Box display="flex" alignItems="center" gap={1.5}>
                <AddShoppingCartIcon sx={{ color: '#6366f1' }} />
                <Typography variant="h6">Place a New Order</Typography>
              </Box>
              <Button variant="outlined" size="small" startIcon={<UploadFileIcon />} onClick={() => setBulkOpen(true)}
                sx={{ borderColor: 'rgba(99,102,241,0.4)', color: '#818cf8', '&:hover': { borderColor: '#6366f1', background: 'rgba(99,102,241,0.1)' } }}>
                Bulk Import
              </Button>
            </Box>
            <Box component="form" onSubmit={handlePlaceOrder} noValidate>
              <Box display="flex" gap={2} mb={3}>
                <TextField required fullWidth id="item-name-input" label="Item Name" placeholder="e.g. MacBook Pro M4"
                  value={itemName} onChange={(e) => setItemName(e.target.value)} InputProps={{ sx: { color: '#f1f5f9' } }} />
                <TextField required fullWidth id="price-input" type="number" label="Price ($)" placeholder="0.00"
                  value={price} onChange={(e) => setPrice(e.target.value)}
                  InputProps={{ sx: { color: '#f1f5f9' }, inputProps: { min: 0, step: 0.01 } }} sx={{ maxWidth: 200 }} />
              </Box>
              <Button id="place-order-btn" type="submit" fullWidth variant="contained" disabled={loading} size="large"
                sx={{
                  py: 1.6, fontSize: '1rem',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
                  boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
                  '&:hover': { background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)', boxShadow: '0 6px 30px rgba(99,102,241,0.5)', transform: 'translateY(-1px)' },
                  transition: 'all 0.25s ease',
                }}>
                {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Place Order'}
              </Button>
            </Box>
          </Paper>
        </Fade>

        {/* ─── Active Order Tracker ─── */}
        {activeOrder && (
          <Fade in timeout={600}>
            <Paper elevation={0} sx={{
              p: 4, mb: 4,
              background: activeOrder.status === 'FAILED' ? 'rgba(239,68,68,0.06)' : activeOrder.status === 'CANCELLED' ? 'rgba(100,116,139,0.06)' : 'rgba(99,102,241,0.06)',
              borderLeft: activeOrder.status === 'FAILED' ? '4px solid #ef4444' : activeOrder.status === 'CANCELLED' ? '4px solid #64748b' : '4px solid #6366f1',
            }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {isTerminal ? (activeOrder.status === 'CANCELLED' ? 'Order Cancelled' : activeOrder.status === 'FAILED' ? 'Order Failed' : 'Order Complete') : 'Processing Order...'}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="subtitle2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{activeOrder.id}</Typography>
                    {activeBatch.length > 1 && (
                      <Typography variant="caption" sx={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8', px: 1, borderRadius: 1 }}>
                        Batch of {activeBatch.length}
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Box display="flex" alignItems="center" gap={1.5}>
                  {activeBatch.length > 1 && (
                    <Box display="flex" alignItems="center" mr={1}>
                      <IconButton size="small" disabled={activeBatchIndex === 0} onClick={() => setActiveBatchIndex(i => i - 1)}>
                        <ArrowBackIosIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                      <Typography variant="caption" sx={{ mx: 1 }}>{activeBatchIndex + 1} / {activeBatch.length}</Typography>
                      <IconButton size="small" disabled={activeBatchIndex === activeBatch.length - 1} onClick={() => setActiveBatchIndex(i => i + 1)}>
                        <ArrowForwardIosIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  )}
                  {activeBatch.length > 1 && activeBatch.some(o => o.status === 'PENDING') && (
                    <Button variant="outlined" color="primary" onClick={handlePayAll} size="small" sx={{ mr: 1, fontWeight: 700 }}>
                      Pay All Pending
                    </Button>
                  )}
                  {activeOrder.status === 'PENDING' && (
                    (() => {
                      let t = activeOrder.created_at || new Date().toISOString();
                      if (!t.endsWith('Z')) t = t.replace(' ', 'T') + 'Z';
                      const expires = new Date(t).getTime() + (activeOrder.is_bulk ? 60000 : 30000);
                      const remaining = Math.max(0, Math.floor((expires - now) / 1000));
                      const retries = retryCounts[activeOrder.id] || 0;
                      
                      if (remaining > 0) {
                        return (
                          <Button variant="contained" color="success" onClick={() => handlePayOrder(activeOrder.id)} sx={{ fontWeight: 700, px: 3 }}>
                            Pay ({remaining}s)
                          </Button>
                        );
                      } else {
                        if (retries < 3) {
                          return (
                            <Button variant="contained" color="warning" onClick={() => handleRetryOrder(activeOrder.id)} sx={{ fontWeight: 700 }}>
                              Retry ({3 - retries} left)
                            </Button>
                          );
                        } else {
                          return <Chip label="Payment Timeout" color="error" variant="filled" sx={{ fontWeight: 600 }} />;
                        }
                      }
                    })()
                  )}
                  <Chip icon={statusConfig[activeOrder.status]?.icon} label={activeOrder.status}
                    color={statusConfig[activeOrder.status]?.color || 'default'} variant="outlined" sx={{ fontWeight: 600 }} />
                  {isTerminal && (
                    <Tooltip title="Dismiss Tracker">
                      <IconButton size="small" onClick={() => setActiveBatch([])} sx={{ ml: 0.5, color: '#94a3b8', '&:hover': { color: '#f87171' } }}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 4, mb: 3, p: 2, borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.03)' }}>
                <Box><Typography variant="caption" color="text.secondary">Item</Typography><Typography variant="body1" fontWeight={600}>{activeOrder.item_name}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Amount</Typography><Typography variant="body1" fontWeight={600}>${activeOrder.price.toFixed(2)}</Typography></Box>
                {activeOrder.tracking_number && (
                  <Box><Typography variant="caption" color="text.secondary">Tracking</Typography>
                    <Box display="flex" alignItems="center" gap={0.5}><LocalShippingIcon sx={{ fontSize: 18, color: '#10b981' }} />
                      <Typography variant="body1" fontWeight={600} sx={{ color: '#10b981' }}>{activeOrder.tracking_number}</Typography></Box></Box>
                )}
              </Box>
              {!isTerminal && <LinearProgress sx={{ mb: 3, borderRadius: 2, height: 3, backgroundColor: 'rgba(99,102,241,0.15)', '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #6366f1, #a855f7)' } }} />}
              {activeOrder.status === 'FAILED' && (
                <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 3, borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  Order processing failed after maximum retry attempts.</Alert>
              )}
              {activeOrder.status === 'CANCELLED' && (
                <Alert severity="info" icon={<CancelIcon />} sx={{ mb: 3, borderRadius: 'var(--radius-sm)', border: '1px solid rgba(100,116,139,0.3)' }}>
                  This order has been cancelled.</Alert>
              )}
              {activeOrder.status !== 'FAILED' && activeOrder.status !== 'CANCELLED' && (
                <Stepper activeStep={getStepIndex(activeOrder.status)} alternativeLabel
                  sx={{
                    '& .MuiStepConnector-line': { borderColor: 'rgba(255,255,255,0.1)', borderTopWidth: 2 },
                    '& .Mui-active .MuiStepConnector-line': { borderColor: '#6366f1' },
                    '& .Mui-completed .MuiStepConnector-line': { borderColor: '#10b981' },
                  }}>
                  {STEPS.map((label, index) => {
                    const isActive = index === getStepIndex(activeOrder.status);
                    const isCompleted = index < getStepIndex(activeOrder.status);
                    return (
                      <Step key={label} completed={isCompleted}>
                        <StepLabel StepIconProps={{ sx: { fontSize: 32, ...(isActive && { filter: 'drop-shadow(0 0 8px rgba(99,102,241,0.6))' }), ...(isCompleted && { filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.5))' }) } }}>
                          <Typography variant="caption" sx={{ fontWeight: isActive ? 700 : 500, color: isActive ? '#818cf8' : isCompleted ? '#34d399' : '#64748b', letterSpacing: '0.05em' }}>
                            {label}</Typography>
                        </StepLabel>
                      </Step>
                    );
                  })}
                </Stepper>
              )}
            </Paper>
          </Fade>
        )}

        {/* ─── Search & Filters ─── */}
        <Fade in timeout={900}>
          <Paper elevation={0} sx={{ p: 3, mb: 3, background: 'rgba(255,255,255,0.02)' }}>
            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
              <TextField size="small" placeholder="Search items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#64748b', fontSize: 20 }} /></InputAdornment>,
                  sx: { color: '#f1f5f9', fontSize: '0.85rem' },
                }}
                sx={{ minWidth: 220, '& .MuiOutlinedInput-root': { borderRadius: 8 } }} />
              <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
              {ALL_STATUSES.map((s) => (
                <Chip key={s} label={s} size="small" variant={statusFilter === s ? 'filled' : 'outlined'}
                  onClick={() => setStatusFilter(s)}
                  sx={{
                    fontWeight: 600, fontSize: '0.72rem', cursor: 'pointer',
                    ...(statusFilter === s ? {
                      background: s === 'ALL' ? 'rgba(99,102,241,0.2)' : `${statusConfig[s]?.dotColor || '#6366f1'}25`,
                      color: s === 'ALL' ? '#818cf8' : statusConfig[s]?.dotColor,
                      borderColor: 'transparent',
                      boxShadow: `0 0 12px ${statusConfig[s]?.dotColor || '#6366f1'}30`,
                    } : {
                      borderColor: 'rgba(255,255,255,0.12)',
                      color: '#94a3b8',
                      '&:hover': { borderColor: 'rgba(255,255,255,0.3)' },
                    }),
                  }} />
              ))}
            </Box>
          </Paper>
        </Fade>

        {/* ─── Order History ─── */}
        <Fade in timeout={1000}>
          <Paper elevation={0} sx={{ background: 'rgba(255,255,255,0.03)', overflow: 'hidden' }}>
            <Box p={3} display="flex" alignItems="center" justifyContent="space-between">
              <Box display="flex" alignItems="center" gap={1.5}>
                <HistoryIcon sx={{ color: '#6366f1' }} />
                <Typography variant="h6">Order History</Typography>
                <Chip label={ordersHistory.length} size="small"
                  sx={{ ml: 1, height: 22, fontSize: '0.75rem', fontWeight: 700, background: 'rgba(99,102,241,0.15)', color: '#818cf8' }} />
              </Box>
              <Tooltip title="Refresh History">
                <IconButton onClick={fetchHistory} size="small" sx={{ color: '#818cf8', '&:hover': { background: 'rgba(99,102,241,0.1)' } }}>
                  <ReplayIcon />
                </IconButton>
              </Tooltip>
            </Box>

            {historyLoading ? (
              <Box display="flex" justifyContent="center" p={4}><CircularProgress size={32} sx={{ color: '#6366f1' }} /></Box>
            ) : ordersHistory.length === 0 ? (
              <Box p={4} textAlign="center"><Typography variant="body2" color="text.secondary">No orders found.</Typography></Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ background: 'rgba(255,255,255,0.02)' }}>
                      <TableCell>Order ID</TableCell>
                      <TableCell>Item</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="center">Status</TableCell>
                      <TableCell>Tracking</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ordersHistory.map((order, idx) => (
                      <TableRow key={order.order_id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.03)' }, transition: 'background 0.2s ease', animation: `fadeInUp 0.4s ease-out ${idx * 0.03}s both` }}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#94a3b8' }}>{order.order_id.substring(0, 8)}...</Typography>
                        </TableCell>
                        <TableCell><Typography variant="body2" fontWeight={500}>{order.item_name}</Typography></TableCell>
                        <TableCell align="right"><Typography variant="body2" fontWeight={600} sx={{ color: '#e2e8f0' }}>${parseFloat(order.price).toFixed(2)}</Typography></TableCell>
                        <TableCell align="center">
                          <Chip icon={statusConfig[order.status]?.icon} label={order.status}
                            color={statusConfig[order.status]?.color || 'default'} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.72rem' }} />
                        </TableCell>
                        <TableCell>
                          {order.tracking_number ? (
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <LocalShippingIcon sx={{ fontSize: 16, color: '#10b981' }} />
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#34d399' }}>{order.tracking_number}</Typography>
                            </Box>
                          ) : (<Typography variant="body2" color="text.secondary">—</Typography>)}
                        </TableCell>
                        <TableCell align="center">
                          <Box display="flex" gap={0.5} justifyContent="center" alignItems="center">
                            {order.status === 'PENDING' && (
                              (() => {
                                let t = order.created_at || new Date().toISOString();
                                if (!t.endsWith('Z')) t = t.replace(' ', 'T') + 'Z';
                                const expires = new Date(t).getTime() + (order.is_bulk ? 60000 : 30000);
                                const remaining = Math.max(0, Math.floor((expires - now) / 1000));
                                return remaining > 0 ? (
                                  <Button size="small" variant="contained" color="success" onClick={() => handlePayOrder(order.order_id)} sx={{ minWidth: 80, fontSize: '0.65rem', mr: 1, py: 0.2 }}>
                                    Pay ({remaining}s)
                                  </Button>
                                ) : (
                                  <Chip size="small" label="Timeout" color="error" sx={{ mr: 1, height: 22, fontSize: '0.65rem' }} />
                                );
                              })()
                            )}
                            <Tooltip title="View Details"><IconButton size="small" onClick={() => openDetailDialog(order)} sx={{ color: '#818cf8' }}><InfoIcon fontSize="small" /></IconButton></Tooltip>
                            {order.status === 'PENDING' && (
                              <Tooltip title="Edit Order"><IconButton size="small" onClick={() => { setEditDialog(order); setEditName(order.item_name); setEditPrice(String(order.price)); }} sx={{ color: '#fbbf24' }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                            )}
                            {(order.status === 'PENDING' || order.status === 'PAID' || order.status === 'SHIPPED') && (
                              <Tooltip title="Cancel Order"><IconButton size="small" onClick={() => setCancelConfirm(order)} sx={{ color: '#f87171' }}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Fade>

        {/* ─── Footer ─── */}
        <Box mt={6} textAlign="center">
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.05em' }}>
            POWERED BY FASTAPI • KAFKA • CELERY • REDIS • MYSQL • WEBSOCKET
          </Typography>
        </Box>

        {/* ═══════════════ DIALOGS ═══════════════ */}

        {/* ─── Order Detail Dialog ─── */}
        <Dialog open={!!detailOrder} onClose={() => setDetailOrder(null)} maxWidth="sm" fullWidth>
          {detailOrder && (
            <>
              <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6">Order Details</Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#94a3b8' }}>{detailOrder.order_id}</Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip icon={statusConfig[detailOrder.status]?.icon} label={detailOrder.status}
                    color={statusConfig[detailOrder.status]?.color || 'default'} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                  <IconButton onClick={() => setDetailOrder(null)} size="small"><CloseIcon /></IconButton>
                </Box>
              </DialogTitle>
              <DialogContent>
                {/* Order info */}
                <Box sx={{ display: 'flex', gap: 3, mb: 3, p: 2, borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.03)' }}>
                  <Box><Typography variant="caption" color="text.secondary">Item</Typography><Typography fontWeight={600}>{detailOrder.item_name}</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary">Price</Typography><Typography fontWeight={600}>${parseFloat(detailOrder.price).toFixed(2)}</Typography></Box>
                  {detailOrder.tracking_number && (
                    <Box><Typography variant="caption" color="text.secondary">Tracking</Typography>
                      <Typography fontWeight={600} sx={{ color: '#10b981' }}>{detailOrder.tracking_number}</Typography></Box>
                  )}
                </Box>

                <Tabs value={detailTab} onChange={(_, v) => setDetailTab(v)} sx={{ mb: 2, '& .MuiTabs-indicator': { background: 'linear-gradient(90deg, #6366f1, #a855f7)' } }}>
                  <Tab icon={<TimelineIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Audit Timeline" />
                  <Tab icon={<ReplayIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Retries (${retries.length})`} />
                </Tabs>

                {detailLoading ? (
                  <Box display="flex" justifyContent="center" p={4}><CircularProgress size={28} sx={{ color: '#6366f1' }} /></Box>
                ) : (
                  <>
                    {/* Timeline Tab */}
                    {detailTab === 0 && (
                      <Box>
                        {detailOrder?.status === 'SHIPPED' && (() => {
                          const shippedEvent = timeline.find(e => e.event_type === 'order.shipped');
                          if (!shippedEvent) return null;
                          let t = shippedEvent.created_at || new Date().toISOString();
                          if (!t.endsWith('Z')) t = t.replace(' ', 'T') + 'Z';
                          const expires = new Date(t).getTime() + 300000;
                          const remaining = Math.max(0, Math.floor((expires - now) / 1000));
                          if (remaining <= 0) return null;
                          const mins = Math.floor(remaining / 60);
                          const secs = (remaining % 60).toString().padStart(2, '0');
                          return (
                            <Alert severity="info" icon={<LocalShippingIcon />} sx={{ mx: 3, mt: 3, mb: 0, borderRadius: 2 }}>
                              <Typography variant="body2" fontWeight={600}>
                                Expected Delivery In: {mins}:{secs}
                              </Typography>
                            </Alert>
                          );
                        })()}
                      {timeline.length === 0 ? (
                        <Box p={3} textAlign="center"><Typography variant="body2" color="text.secondary">No events recorded yet.</Typography></Box>
                      ) : (
                        <Timeline position="right" sx={{ p: 0, '& .MuiTimelineItem-root:before': { display: 'none' } }}>
                          {timeline.map((evt, i) => (
                            <TimelineItem key={evt.id}>
                              <TimelineOppositeContent sx={{ flex: 0.3, pt: 1.5 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                  {evt.created_at ? new Date(evt.created_at).toLocaleTimeString() : ''}
                                </Typography>
                              </TimelineOppositeContent>
                              <TimelineSeparator>
                                <TimelineDot sx={{
                                  background: evt.to_status ? (statusConfig[evt.to_status]?.dotColor || '#6366f1') : '#6366f1',
                                  boxShadow: `0 0 8px ${evt.to_status ? (statusConfig[evt.to_status]?.dotColor || '#6366f1') : '#6366f1'}40`,
                                  width: 12, height: 12, p: 0,
                                }} />
                                {i < timeline.length - 1 && <TimelineConnector sx={{ background: 'rgba(255,255,255,0.08)' }} />}
                              </TimelineSeparator>
                              <TimelineContent sx={{ pb: 2 }}>
                                <Box className="timeline-event-card">
                                  <Typography variant="body2" fontWeight={600} sx={{ color: evt.to_status ? (statusConfig[evt.to_status]?.dotColor || '#f1f5f9') : '#f1f5f9' }}>
                                    {eventTypeLabels[evt.event_type] || evt.event_type}
                                  </Typography>
                                  {evt.from_status && evt.to_status && (
                                    <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                                      <Chip label={evt.from_status} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                                      <Typography variant="caption" color="text.secondary">→</Typography>
                                      <Chip label={evt.to_status} size="small" color={statusConfig[evt.to_status]?.color || 'default'} sx={{ height: 18, fontSize: '0.65rem' }} />
                                    </Box>
                                  )}
                                  {evt.detail && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{evt.detail}</Typography>}
                                </Box>
                              </TimelineContent>
                            </TimelineItem>
                          ))}
                        </Timeline>
                      )}
                      </Box>
                    )}

                    {/* Retries Tab */}
                    {detailTab === 1 && (
                      retries.length === 0 ? (
                        <Box p={3} textAlign="center"><Typography variant="body2" color="text.secondary">No retry attempts recorded.</Typography></Box>
                      ) : (
                        <Box>
                          {retries.map((r) => (
                            <Box key={r.id} className={`retry-card ${r.status.toLowerCase()}`}>
                              <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Typography variant="body2" fontWeight={600}>
                                    Attempt {r.attempt}/{r.max_retries}
                                  </Typography>
                                  <Chip label={r.status} size="small"
                                    color={r.status === 'SUCCEEDED' ? 'success' : r.status === 'EXHAUSTED' ? 'error' : 'warning'}
                                    sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }} />
                                </Box>
                                {r.backoff_seconds > 0 && (
                                  <Typography variant="caption" color="text.secondary">Backoff: {r.backoff_seconds}s</Typography>
                                )}
                              </Box>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                {r.task_name.split('.').pop()}
                              </Typography>
                              {r.error_message && (
                                <Typography variant="caption" sx={{ color: '#f87171', display: 'block', mt: 0.5 }}>
                                  {r.error_message}
                                </Typography>
                              )}
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block', mt: 0.5 }}>
                                {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      )
                    )}
                  </>
                )}
              </DialogContent>
            </>
          )}
        </Dialog>

        {/* ─── Edit Order Dialog ─── */}
        <Dialog open={!!editDialog} onClose={() => setEditDialog(null)} maxWidth="xs" fullWidth>
          <DialogTitle>Edit Order</DialogTitle>
          <DialogContent>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Only PENDING orders can be updated.
            </Typography>
            <TextField fullWidth label="Item Name" value={editName} onChange={(e) => setEditName(e.target.value)} sx={{ mb: 2, mt: 1 }} InputProps={{ sx: { color: '#f1f5f9' } }} />
            <TextField fullWidth label="Price ($)" type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} InputProps={{ sx: { color: '#f1f5f9' }, inputProps: { min: 0, step: 0.01 } }} />
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setEditDialog(null)} sx={{ color: '#94a3b8' }}>Cancel</Button>
            <Button onClick={handleUpdateOrder} variant="contained" sx={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>Save Changes</Button>
          </DialogActions>
        </Dialog>

        {/* ─── Cancel Confirmation Dialog ─── */}
        <Dialog open={!!cancelConfirm} onClose={() => setCancelConfirm(null)} maxWidth="xs" fullWidth>
          <DialogTitle>Cancel Order?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              {cancelConfirm?.status === 'PAID' || cancelConfirm?.status === 'SHIPPED'
                ? `This order has already been ${cancelConfirm.status.toLowerCase()}. A refund will be initiated upon cancellation.`
                : 'Are you sure you want to cancel this order?'}
            </Typography>
            {cancelConfirm && (
              <Box sx={{ mt: 2, p: 2, borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.03)' }}>
                <Typography variant="body2" fontWeight={600}>{cancelConfirm.item_name}</Typography>
                <Typography variant="caption" color="text.secondary">${parseFloat(cancelConfirm.price).toFixed(2)}</Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setCancelConfirm(null)} sx={{ color: '#94a3b8' }}>Keep Order</Button>
            <Button onClick={() => handleCancelOrder(cancelConfirm.order_id)} variant="contained" color="error">Confirm Cancel</Button>
          </DialogActions>
        </Dialog>

        {/* ─── Bulk Import Dialog ─── */}
        <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <UploadFileIcon sx={{ color: '#6366f1' }} />
              Bulk Order Import
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter one order per line in the format: <code style={{ color: '#818cf8' }}>item_name, price</code> (max 50)
            </Typography>
            <textarea className="bulk-textarea" value={bulkCsv} onChange={(e) => setBulkCsv(e.target.value)}
              placeholder={"MacBook Pro M4, 2499.99\nAirPods Pro 3, 249.00\niPad Air, 599.99"} />
            {bulkCsv.trim() && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {bulkCsv.trim().split('\n').filter(l => l.trim()).length} order(s) ready
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setBulkOpen(false)} sx={{ color: '#94a3b8' }}>Cancel</Button>
            <Button onClick={handleBulkSubmit} variant="contained" disabled={bulkLoading}
              sx={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
              {bulkLoading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Import Orders'}
            </Button>
          </DialogActions>
        </Dialog>

      </Container>
    </ThemeProvider>
  );
}

export default App;
