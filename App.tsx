import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Products from './pages/Products';
import Users from './pages/Users';
import Reports from './pages/Reports';
import PriceList from './pages/PriceList';
import CreditCustomers from './pages/CreditCustomers';
import Accounting from './pages/Accounting';
import POS from './components/POS';
import AlertsPanel from './components/AlertsPanel';
import { User } from './types';
import { STORAGE_KEYS } from './constants';

interface AdminRouteProps {
  user: User;
  children: React.ReactNode;
}

// Helper component for Admin-only routes
const AdminRoute: React.FC<AdminRouteProps> = ({ user, children }) => {
  if (user.role !== 'ADMIN') {
    return <Navigate to="/inventory" replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
      if (stored && stored !== 'undefined' && stored !== 'null') {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id && parsed.role) {
          setUser(parsed);
        } else {
          // Invalid user object
          localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
        }
      }
    } catch (error) {
      console.error("Error parsing stored user session:", error);
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
  };

  if (loading) return null;

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          {/* Dashboard only for Admin, otherwise Inventory */}
          <Route
            path="/"
            element={user.role === 'ADMIN' ? <Dashboard /> : <Navigate to="/inventory" replace />}
          />

          <Route path="/inventory" element={<Inventory user={user} />} />
          <Route path="/menu" element={<PriceList />} />

          <Route path="/credit" element={<CreditCustomers user={user} />} />

          {/* Reports accessible to both, internal logic handles view */}
          <Route path="/reports" element={<Reports user={user} />} />

          {/* Admin Routes */}
          <Route
            path="/accounting"
            element={<Accounting user={user} />}
          />
          <Route
            path="/products"
            element={<AdminRoute user={user}><Products /></AdminRoute>}
          />

          {/* POS Routes */}
          <Route path="/pos" element={<POS />} />

          {/* Admin-only: Alerts Panel */}
          <Route
            path="/alerts"
            element={<AdminRoute user={user}><AlertsPanel /></AdminRoute>}
          />

          <Route
            path="/users"
            element={<AdminRoute user={user}><Users /></AdminRoute>}
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;