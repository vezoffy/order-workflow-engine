import React, { useState, useEffect, useCallback } from 'react';
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
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PaymentIcon from '@mui/icons-material/Payment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HistoryIcon from '@mui/icons-material/History';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import PendingIcon from '@mui/icons-material/Pending';

const API_BASE = 'http://localhost:8000/api/v1';

const STEPS = ['PENDING', 'PAID', 'SHIPPED'];
const TERMINAL_STATES = ['SHIPPED', 'FAILED'];

/* ─── MUI Dark Theme ─── */
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#6366f1', light: '#818cf8', dark: '#4f46e5' },
    secondary: { main: '#a855f7', light: '#c084fc', dark: '#9333ea' },
    success: { main: '#10b981', light: '#34d399', dark: '#059669' },
    error: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
    warning: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
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
  },
});

/* ─── Status Chip Config ─── */
const statusConfig = {
  PENDING: { color: 'warning', icon: <PendingIcon sx={{ fontSize: 16 }} /> },
  PAID:    { color: 'info',    icon: <PaymentIcon sx={{ fontSize: 16 }} /> },
  SHIPPED: { color: 'success', icon: <CheckCircleIcon sx={{ fontSize: 16 }} /> },
  FAILED:  { color: 'error',   icon: <ErrorIcon sx={{ fontSize: 16 }} /> },
};

function App() {
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [activeOrder, setActiveOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [ordersHistory, setOrdersHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  /* ─── Load order history on mount ─── */
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/orders`);
      if (res.ok) {
        const data = await res.json();
        setOrdersHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  /* ─── Place Order ─── */
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

      if (!res.ok) throw new Error('Failed to submit order. Please try again.');

      const data = await res.json();
      setActiveOrder({
        id: data.order_id,
        item_name: itemName,
        price: parseFloat(price),
        status: data.status,
        tracking_number: null,
      });
      setSuccessMsg(`Order ${data.order_id.substring(0, 8)}... queued for processing!`);
      setItemName('');
      setPrice('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ─── Poll active order status ─── */
  useEffect(() => {
    if (!activeOrder || TERMINAL_STATES.includes(activeOrder.status)) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/orders/${activeOrder.id}`);
        if (!res.ok) throw new Error('Failed to fetch order status.');

        const update = await res.json();
        setActiveOrder((prev) => ({
          ...prev,
          status: update.status,
          tracking_number: update.tracking_number,
        }));

        if (TERMINAL_STATES.includes(update.status)) {
          clearInterval(interval);
          fetchHistory(); // Refresh history table
        }
      } catch (err) {
        setError(err.message);
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeOrder, fetchHistory]);

  /* ─── Stepper index ─── */
  const getStepIndex = (status) => {
    if (status === 'FAILED') return -1;
    const idx = STEPS.indexOf(status);
    return idx >= 0 ? idx : 0;
  };

  const isTerminal = activeOrder && TERMINAL_STATES.includes(activeOrder.status);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ py: 6 }}>

        {/* ─── Header ─── */}
        <Fade in timeout={600}>
          <Box display="flex" alignItems="center" gap={2} mb={5}>
            <Box
              sx={{
                width: 52, height: 52, borderRadius: '14px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 30px rgba(99,102,241,0.3)',
              }}
            >
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
                Event-driven workflow processing
              </Typography>
            </Box>
          </Box>
        </Fade>

        {/* ─── Alerts ─── */}
        {error && (
          <Fade in>
            <Alert
              severity="error"
              onClose={() => setError('')}
              sx={{ mb: 3, borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              {error}
            </Alert>
          </Fade>
        )}
        {successMsg && (
          <Fade in>
            <Alert
              severity="success"
              onClose={() => setSuccessMsg('')}
              sx={{ mb: 3, borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.3)' }}
            >
              {successMsg}
            </Alert>
          </Fade>
        )}

        {/* ─── Order Form ─── */}
        <Fade in timeout={800}>
          <Paper
            elevation={0}
            sx={{
              p: 4, mb: 4,
              background: 'rgba(255,255,255,0.03)',
              '&:hover': { background: 'rgba(255,255,255,0.05)' },
              transition: 'background 0.3s ease',
            }}
          >
            <Box display="flex" alignItems="center" gap={1.5} mb={3}>
              <AddShoppingCartIcon sx={{ color: '#6366f1' }} />
              <Typography variant="h6">Place a New Order</Typography>
            </Box>

            <Box component="form" onSubmit={handlePlaceOrder} noValidate>
              <Box display="flex" gap={2} mb={3}>
                <TextField
                  required fullWidth
                  id="item-name-input"
                  label="Item Name"
                  placeholder="e.g. MacBook Pro M4"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  InputProps={{ sx: { color: '#f1f5f9' } }}
                />
                <TextField
                  required fullWidth
                  id="price-input"
                  type="number"
                  label="Price ($)"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  InputProps={{ sx: { color: '#f1f5f9' }, inputProps: { min: 0, step: 0.01 } }}
                  sx={{ maxWidth: 200 }}
                />
              </Box>
              <Button
                id="place-order-btn"
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                size="large"
                sx={{
                  py: 1.6, fontSize: '1rem',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
                  boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)',
                    boxShadow: '0 6px 30px rgba(99,102,241,0.5)',
                    transform: 'translateY(-1px)',
                  },
                  transition: 'all 0.25s ease',
                }}
              >
                {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Place Order'}
              </Button>
            </Box>
          </Paper>
        </Fade>

        {/* ─── Active Order Tracker ─── */}
        {activeOrder && (
          <Fade in timeout={600}>
            <Paper
              elevation={0}
              sx={{
                p: 4, mb: 4,
                background: activeOrder.status === 'FAILED'
                  ? 'rgba(239,68,68,0.06)'
                  : 'rgba(99,102,241,0.06)',
                borderLeft: activeOrder.status === 'FAILED'
                  ? '4px solid #ef4444'
                  : '4px solid #6366f1',
              }}
            >
              {/* Header row */}
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {isTerminal ? 'Order Complete' : 'Processing Order...'}
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {activeOrder.id}
                  </Typography>
                </Box>
                <Chip
                  icon={statusConfig[activeOrder.status]?.icon}
                  label={activeOrder.status}
                  color={statusConfig[activeOrder.status]?.color || 'default'}
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
              </Box>

              {/* Order details */}
              <Box
                sx={{
                  display: 'flex', gap: 4, mb: 3, p: 2,
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">Item</Typography>
                  <Typography variant="body1" fontWeight={600}>{activeOrder.item_name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Amount</Typography>
                  <Typography variant="body1" fontWeight={600}>${activeOrder.price.toFixed(2)}</Typography>
                </Box>
                {activeOrder.tracking_number && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Tracking</Typography>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <LocalShippingIcon sx={{ fontSize: 18, color: '#10b981' }} />
                      <Typography variant="body1" fontWeight={600} sx={{ color: '#10b981' }}>
                        {activeOrder.tracking_number}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>

              {/* Polling indicator */}
              {!isTerminal && (
                <LinearProgress
                  sx={{
                    mb: 3, borderRadius: 2, height: 3,
                    backgroundColor: 'rgba(99,102,241,0.15)',
                    '& .MuiLinearProgress-bar': {
                      background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                    },
                  }}
                />
              )}

              {/* Failed state alert */}
              {activeOrder.status === 'FAILED' && (
                <Alert
                  severity="error"
                  icon={<ErrorIcon />}
                  sx={{
                    mb: 3, borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(239,68,68,0.3)',
                  }}
                >
                  Order processing failed after maximum retry attempts. Payment or shipping could not be completed.
                </Alert>
              )}

              {/* Stepper */}
              {activeOrder.status !== 'FAILED' && (
                <Stepper
                  activeStep={getStepIndex(activeOrder.status)}
                  alternativeLabel
                  sx={{
                    '& .MuiStepConnector-line': {
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderTopWidth: 2,
                    },
                    '& .Mui-active .MuiStepConnector-line': {
                      borderColor: '#6366f1',
                    },
                    '& .Mui-completed .MuiStepConnector-line': {
                      borderColor: '#10b981',
                    },
                  }}
                >
                  {STEPS.map((label, index) => {
                    const isActive = index === getStepIndex(activeOrder.status);
                    const isCompleted = index < getStepIndex(activeOrder.status);
                    return (
                      <Step key={label} completed={isCompleted}>
                        <StepLabel
                          StepIconProps={{
                            sx: {
                              fontSize: 32,
                              ...(isActive && {
                                filter: 'drop-shadow(0 0 8px rgba(99,102,241,0.6))',
                              }),
                              ...(isCompleted && {
                                filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.5))',
                              }),
                            },
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: isActive ? 700 : 500,
                              color: isActive ? '#818cf8' : isCompleted ? '#34d399' : '#64748b',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {label}
                          </Typography>
                        </StepLabel>
                      </Step>
                    );
                  })}
                </Stepper>
              )}
            </Paper>
          </Fade>
        )}

        {/* ─── Order History ─── */}
        <Fade in timeout={1000}>
          <Paper elevation={0} sx={{ background: 'rgba(255,255,255,0.03)', overflow: 'hidden' }}>
            <Box p={3} display="flex" alignItems="center" gap={1.5}>
              <HistoryIcon sx={{ color: '#6366f1' }} />
              <Typography variant="h6">Order History</Typography>
              <Chip
                label={ordersHistory.length}
                size="small"
                sx={{
                  ml: 1, height: 22, fontSize: '0.75rem', fontWeight: 700,
                  background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                }}
              />
            </Box>

            {historyLoading ? (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress size={32} sx={{ color: '#6366f1' }} />
              </Box>
            ) : ordersHistory.length === 0 ? (
              <Box p={4} textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  No orders yet. Place your first order above!
                </Typography>
              </Box>
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
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ordersHistory.map((order, idx) => (
                      <TableRow
                        key={order.order_id}
                        sx={{
                          '&:hover': { background: 'rgba(255,255,255,0.03)' },
                          transition: 'background 0.2s ease',
                          animation: `fadeInUp 0.4s ease-out ${idx * 0.05}s both`,
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#94a3b8' }}>
                            {order.order_id.substring(0, 8)}...
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {order.item_name}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={600} sx={{ color: '#e2e8f0' }}>
                            ${parseFloat(order.price).toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            icon={statusConfig[order.status]?.icon}
                            label={order.status}
                            color={statusConfig[order.status]?.color || 'default'}
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 600, fontSize: '0.72rem' }}
                          />
                        </TableCell>
                        <TableCell>
                          {order.tracking_number ? (
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <LocalShippingIcon sx={{ fontSize: 16, color: '#10b981' }} />
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#34d399' }}>
                                {order.tracking_number}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">—</Typography>
                          )}
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
            POWERED BY FASTAPI • KAFKA • CELERY • REDIS • MYSQL
          </Typography>
        </Box>

      </Container>
    </ThemeProvider>
  );
}

export default App;
