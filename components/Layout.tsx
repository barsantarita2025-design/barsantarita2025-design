import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Beer,
  Users,
  FileBarChart,
  LogOut,
  ClipboardList,
  AlertTriangle,
  Search,
  CreditCard,
  History,
  Calculator,
  DollarSign,
  Shield,
  ShoppingCart,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Menu
} from 'lucide-react';
import { User, AppConfig } from '../types';
import { getConfig } from '../services/db';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [config, setConfig] = React.useState<AppConfig | null>(null);
  const [theme, setTheme] = React.useState(() => localStorage.getItem('barflow-theme') || 'dark');
  const [isCollapsed, setIsCollapsed] = React.useState(() => localStorage.getItem('barflow-sidebar-collapsed') === 'true');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadConfig = async () => {
      try {
        const data = await getConfig();
        if (data) {
          setConfig(data);
        } else {
          throw new Error("Configuración no encontrada");
        }
      } catch (err: any) {
        console.error('CRITICAL: Failed to load config:', err);
        setError("Error de conexión con el servidor");
        // Fallback para evitar pantalla en blanco
        setConfig({
          id: 'default',
          barName: 'Bar Flow',
          lastExportDate: new Date().toISOString(),
          cashDrawerEnabled: false,
          cashDrawerPort: 'COM1',
          inventoryBase: {}
        });
      }
    };
    loadConfig();
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('barflow-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('barflow-sidebar-collapsed', String(newState));
  };

  if (!config) {
    return (
      <div className="min-h-screen bg-bar-900 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 border-4 border-bar-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold text-bar-text">Iniciando Bar Flow...</h2>
        <p className="text-slate-500 mt-2">Cargando configuración del sistema</p>
      </div>
    );
  }

  // Check if data export is needed (Example: > 30 days since last export)
  const daysSinceExport = (new Date().getTime() - new Date(config.lastExportDate).getTime()) / (1000 * 3600 * 24);
  const needsExport = daysSinceExport > 30;

  const isPOS = location.pathname.includes('pos') || window.location.hash.includes('pos');
  const isActive = (path: string) => location.pathname === path ? 'bg-bar-800 text-bar-500' : 'text-slate-400 hover:text-bar-text hover:bg-bar-800';

  return (
    <div className="min-h-screen bg-bar-900 flex flex-col md:flex-row transition-all duration-300">
      {/* Error notification if any */}
      {error && (
        <div className="fixed top-4 right-4 z-[9999] bg-rose-900/90 border border-rose-500 p-4 rounded-xl shadow-2xl animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3 text-rose-100">
            <AlertTriangle className="w-5 h-5" />
            <div className="text-sm">
              <p className="font-bold">Aviso del Sistema</p>
              <p>{error}. Trabajando en modo local.</p>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar / Mobile Nav */}
      <aside className={`bg-bar-950 border-r border-bar-700 flex flex-col flex-shrink-0 fixed md:sticky top-0 left-0 h-screen z-10 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-full md:w-64'}`}>
        <div className={`p-4 border-b border-bar-700 flex flex-col items-center ${isCollapsed ? 'px-2' : 'p-6'}`}>
          <div className={`flex w-full justify-between items-center ${isCollapsed ? 'flex-col gap-4' : 'flex-row'}`}>
            <div className={isCollapsed ? 'flex flex-col items-center' : ''}>
              <h1 className="text-2xl font-bold text-bar-text tracking-tight flex items-center gap-2">
                <Beer className="text-bar-500 shrink-0" />
                {!isCollapsed && <span>{config.barName}</span>}
              </h1>
              {!isCollapsed && <p className="text-xs text-slate-500 mt-1">Usuario: {user.name}</p>}
            </div>
            <div className={`flex items-center gap-1 ${isCollapsed ? 'flex-col' : ''}`}>
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg bg-bar-800 text-slate-400 hover:bg-bar-700 transition-colors"
                title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
              >
                {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-lg bg-bar-800 text-bar-500 hover:bg-bar-700 transition-colors"
                title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>
        </div>

        <nav className={`flex-1 space-y-2 overflow-y-auto no-scrollbar transition-all ${isCollapsed ? 'p-2' : 'p-4'}`}>
          {/* Admin Dashboard */}
          {user.role === 'ADMIN' && (
            <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/')} ${isCollapsed ? 'justify-center px-0' : ''}`} title="Dashboard">
              <LayoutDashboard size={20} />
              {!isCollapsed && <span className="font-medium">Dashboard</span>}
            </Link>
          )}

          {/* Common Links */}
          <Link to="/pos" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/pos')} ${isCollapsed ? 'justify-center px-0' : ''}`} title="Punto de Venta">
            <ShoppingCart size={20} />
            {!isCollapsed && <span className="font-medium">Punto de Venta</span>}
          </Link>

          <Link to="/inventory" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/inventory')} ${isCollapsed ? 'justify-center px-0' : ''}`} title="Inventario y Turno">
            <ClipboardList size={20} />
            {!isCollapsed && <span className="font-medium">Inventario y Turno</span>}
          </Link>

          <Link to="/menu" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/menu')} ${isCollapsed ? 'justify-center px-0' : ''}`} title="Consulta de Precios">
            <Search size={20} />
            {!isCollapsed && <span className="font-medium">Consulta de Precios</span>}
          </Link>

          <Link to="/credit" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/credit')} ${isCollapsed ? 'justify-center px-0' : ''}`} title="Clientes Fiados">
            <CreditCard size={20} />
            {!isCollapsed && <span className="font-medium">Clientes Fiados</span>}
          </Link>

          <Link to="/reports" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/reports')} ${isCollapsed ? 'justify-center px-0' : ''}`} title={user.role === 'ADMIN' ? 'Reportes Globales' : 'Historial Turnos'}>
            {user.role === 'ADMIN' ? <FileBarChart size={20} /> : <History size={20} />}
            {!isCollapsed && <span className="font-medium">{user.role === 'ADMIN' ? 'Reportes Globales' : 'Historial Turnos'}</span>}
          </Link>

          <Link to="/accounting" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/accounting')} ${isCollapsed ? 'justify-center px-0' : ''}`} title={user.role === 'ADMIN' ? 'Contabilidad' : 'Nómina'}>
            <Calculator size={20} />
            {!isCollapsed && <span className="font-medium">{user.role === 'ADMIN' ? 'Contabilidad' : 'Nómina'}</span>}
          </Link>

          {/* Admin Only Links */}
          {user.role === 'ADMIN' && (
            <>
              {!isCollapsed && (
                <div className="pt-4 pb-2">
                  <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Administración</p>
                </div>
              )}

              <Link to="/products" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/products')} ${isCollapsed ? 'justify-center px-0 mt-4' : ''}`} title="Productos y Precios">
                <Beer size={20} />
                {!isCollapsed && <span className="font-medium">Productos y Precios</span>}
              </Link>

              <Link to="/alerts" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/alerts')} ${isCollapsed ? 'justify-center px-0' : ''}`} title="Alertas de Gaveta">
                <Shield size={20} />
                {!isCollapsed && <span className="font-medium">Alertas de Gaveta</span>}
              </Link>

              <Link to="/users" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/users')} ${isCollapsed ? 'justify-center px-0' : ''}`} title="Usuarios">
                <Users size={20} />
                {!isCollapsed && <span className="font-medium">Usuarios</span>}
              </Link>
            </>
          )}
        </nav>

        <div className={`p-4 border-t border-bar-700 ${isCollapsed ? 'px-2' : ''}`}>
          {needsExport && user.role === 'ADMIN' && !isCollapsed && (
            <div className="mb-4 bg-rose-900/30 border border-rose-800 p-3 rounded text-sm text-rose-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Alerta: Descarga la información mensual para liberar espacio.</span>
              </div>
              <button
                onClick={() => navigate('/reports')}
                className="text-xs underline mt-1 hover:text-bar-text"
              >
                Ir a reportes
              </button>
            </div>
          )}

          <button
            onClick={onLogout}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 bg-bar-800 text-slate-300 hover:bg-rose-900/50 hover:text-rose-200 rounded-lg transition-colors ${isCollapsed ? 'px-0' : ''}`}
            title="Cerrar Sesión"
          >
            <LogOut size={18} />
            {!isCollapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 h-screen ${isPOS ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <div className={`w-full h-full ${isPOS ? 'p-0' : 'p-4 md:p-6'}`}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;