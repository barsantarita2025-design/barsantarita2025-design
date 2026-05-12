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
  AlertCircle,
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
  Menu,
  X
} from 'lucide-react';
import { User, AppConfig } from '../types';
import { getConfig, getPendingFinancialMovementsCount } from '../services/db';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingMovements, setPendingMovements] = React.useState(0);

  React.useEffect(() => {
    const checkPendingMovements = async () => {
      try {
        const count = await getPendingFinancialMovementsCount();
        setPendingMovements(count);
      } catch (err) {
        console.error('Error checking pending movements:', err);
      }
    };

    checkPendingMovements();
    // Check every 5 minutes
    const interval = setInterval(checkPendingMovements, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
    <div className="min-h-screen bg-bar-900 flex flex-col md:flex-row transition-all duration-300 relative">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-bar-950 border-b border-bar-700 sticky top-0 z-[60] shrink-0">
        <div className="flex items-center gap-2">
          <Beer className="text-bar-500" size={24} />
          <h1 className="text-lg font-black text-bar-text uppercase tracking-tight truncate max-w-[150px]">{config.barName}</h1>
        </div>
        <div className="flex items-center gap-3">
            <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-bar-800 text-bar-500"
            >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg bg-bar-800 text-slate-300 hover:bg-bar-700 transition-colors"
            >
                <Menu size={24} />
            </button>
        </div>
      </header>

      {/* Overlay for Mobile Menu */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

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
      <aside className={`
        bg-bar-950 border-r border-bar-700 flex flex-col flex-shrink-0 
        fixed md:sticky top-0 left-0 h-screen z-[80] 
        transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
        ${isMobileMenuOpen ? 'translate-x-0 shadow-[0_0_50px_rgba(0,0,0,0.8)]' : '-translate-x-full md:translate-x-0'}
        ${isCollapsed ? 'md:w-20' : 'w-[280px] md:w-64'}
      `}>
        <div className={`p-6 border-b border-bar-700 flex flex-col items-center shrink-0 ${isCollapsed ? 'md:px-2' : ''}`}>
          <div className={`flex w-full justify-between items-center ${isCollapsed ? 'md:flex-col md:gap-4' : 'flex-row'}`}>
            <div className={isCollapsed ? 'md:flex md:flex-col md:items-center' : ''}>
              <h1 className="text-2xl font-black text-bar-text tracking-tighter flex items-center gap-2 uppercase">
                <Beer className="text-bar-500 shrink-0" size={28} />
                <span className={isCollapsed ? 'md:hidden' : ''}>{config.barName}</span>
              </h1>
              {!isCollapsed && <p className="text-[9px] text-slate-500 mt-1 uppercase font-black tracking-[0.2em] opacity-60">{user.name}</p>}
            </div>
            <div className={`flex items-center gap-1 ${isCollapsed ? 'md:flex-col' : ''}`}>
              <button
                onClick={toggleSidebar}
                className="hidden md:flex p-1.5 rounded-xl bg-bar-900 text-slate-400 hover:bg-bar-800 border border-bar-700 transition-all active:scale-90"
                title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
              >
                {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="md:hidden p-2 rounded-xl bg-bar-900 text-slate-400 border border-bar-700"
              >
                <X size={24} />
              </button>
            </div>
          </div>
        </div>

        <nav 
          className={`flex-1 space-y-1.5 overflow-y-auto no-scrollbar transition-all ${isCollapsed ? 'p-2' : 'p-6'}`}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          {/* Admin Dashboard */}
          {user.role === 'ADMIN' && (
            <Link to="/" className={`flex items-center gap-4 px-5 py-4 md:py-3 rounded-2xl md:rounded-xl transition-all duration-300 group ${isActive('/')} ${isCollapsed ? 'md:justify-center md:px-0' : ''}`} title="Dashboard">
              <LayoutDashboard size={22} className={location.pathname === '/' ? 'text-bar-500' : 'text-slate-500 group-hover:text-bar-text'} />
              {!isCollapsed && <span className="font-black uppercase tracking-widest text-[10px]">Dashboard</span>}
            </Link>
          )}

          {/* Common Links */}
          <Link to="/pos" className={`flex items-center gap-4 px-5 py-4 md:py-3 rounded-2xl md:rounded-xl transition-all duration-300 group ${isActive('/pos')} ${isCollapsed ? 'md:justify-center md:px-0' : ''}`} title="Punto de Venta">
            <ShoppingCart size={22} className={location.pathname === '/pos' ? 'text-bar-500' : 'text-slate-500 group-hover:text-bar-text'} />
            {!isCollapsed && <span className="font-black uppercase tracking-widest text-[10px]">Punto de Venta</span>}
          </Link>

          <Link to="/inventory" className={`flex items-center gap-4 px-5 py-4 md:py-3 rounded-2xl md:rounded-xl transition-all duration-300 group ${isActive('/inventory')} ${isCollapsed ? 'md:justify-center md:px-0' : ''}`} title="Inventario y Turno">
            <ClipboardList size={22} className={location.pathname === '/inventory' ? 'text-bar-500' : 'text-slate-500 group-hover:text-bar-text'} />
            {!isCollapsed && <span className="font-black uppercase tracking-widest text-[10px]">Inventario y Turno</span>}
          </Link>

          <Link to="/menu" className={`flex items-center gap-4 px-5 py-4 md:py-3 rounded-2xl md:rounded-xl transition-all duration-300 group ${isActive('/menu')} ${isCollapsed ? 'md:justify-center md:px-0' : ''}`} title="Consulta de Precios">
            <Search size={22} className={location.pathname === '/menu' ? 'text-bar-500' : 'text-slate-500 group-hover:text-bar-text'} />
            {!isCollapsed && <span className="font-black uppercase tracking-widest text-[10px]">Consulta Precios</span>}
          </Link>

          <Link to="/credit" className={`flex items-center gap-4 px-5 py-4 md:py-3 rounded-2xl md:rounded-xl transition-all duration-300 group ${isActive('/credit')} ${isCollapsed ? 'md:justify-center md:px-0' : ''}`} title="Clientes Fiados">
            <CreditCard size={22} className={location.pathname === '/credit' ? 'text-bar-500' : 'text-slate-500 group-hover:text-bar-text'} />
            {!isCollapsed && <span className="font-black uppercase tracking-widest text-[10px]">Clientes Fiados</span>}
          </Link>

          <Link to="/reports" className={`flex items-center gap-4 px-5 py-4 md:py-3 rounded-2xl md:rounded-xl transition-all duration-300 group ${isActive('/reports')} ${isCollapsed ? 'md:justify-center md:px-0' : ''}`} title={user.role === 'ADMIN' ? 'Reportes Globales' : 'Historial Turnos'}>
            {user.role === 'ADMIN' ? <FileBarChart size={22} className={location.pathname === '/reports' ? 'text-bar-500' : 'text-slate-500 group-hover:text-bar-text'} /> : <History size={22} className={location.pathname === '/reports' ? 'text-bar-500' : 'text-slate-500 group-hover:text-bar-text'} />}
            {!isCollapsed && <span className="font-black uppercase tracking-widest text-[10px]">{user.role === 'ADMIN' ? 'Reportes' : 'Historial'}</span>}
          </Link>

          <Link to="/accounting" className={`flex items-center gap-4 px-5 py-4 md:py-3 rounded-2xl md:rounded-xl transition-all duration-300 group ${isActive('/accounting')} ${isCollapsed ? 'md:justify-center md:px-0' : ''}`} title={user.role === 'ADMIN' ? 'Contabilidad' : 'Nómina'}>
            <Calculator size={22} className={location.pathname === '/accounting' ? 'text-bar-500' : 'text-slate-500 group-hover:text-bar-text'} />
            {!isCollapsed && <span className="font-black uppercase tracking-widest text-[10px]">{user.role === 'ADMIN' ? 'Contabilidad' : 'Nómina'}</span>}
          </Link>

          {/* Admin Only Links */}
          {user.role === 'ADMIN' && (
            <>
              {!isCollapsed && (
                <div className="pt-6 pb-2">
                  <p className="px-5 text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Administración</p>
                </div>
              )}

              <Link to="/products" className={`flex items-center gap-4 px-5 py-4 md:py-3 rounded-2xl md:rounded-xl transition-all duration-300 group ${isActive('/products')} ${isCollapsed ? 'md:justify-center md:px-0 md:mt-4' : ''}`} title="Productos y Precios">
                <Beer size={22} className={location.pathname === '/products' ? 'text-bar-500' : 'text-slate-500 group-hover:text-bar-text'} />
                {!isCollapsed && <span className="font-black uppercase tracking-widest text-[10px]">Productos</span>}
              </Link>

              <Link to="/alerts" className={`flex items-center gap-4 px-5 py-4 md:py-3 rounded-2xl md:rounded-xl transition-all duration-300 group ${isActive('/alerts')} ${isCollapsed ? 'md:justify-center md:px-0' : ''}`} title="Alertas de Gaveta">
                <Shield size={22} className={location.pathname === '/alerts' ? 'text-bar-500' : 'text-slate-500 group-hover:text-bar-text'} />
                {!isCollapsed && <span className="font-black uppercase tracking-widest text-[10px]">Alertas</span>}
              </Link>

              <Link to="/users" className={`flex items-center gap-4 px-5 py-4 md:py-3 rounded-2xl md:rounded-xl transition-all duration-300 group ${isActive('/users')} ${isCollapsed ? 'md:justify-center md:px-0' : ''}`} title="Usuarios">
                <Users size={22} className={location.pathname === '/users' ? 'text-bar-500' : 'text-slate-500 group-hover:text-bar-text'} />
                {!isCollapsed && <span className="font-black uppercase tracking-widest text-[10px]">Usuarios</span>}
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
      <main className={`flex-1 h-screen flex flex-col ${isPOS ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {/* Pending Financial Movements Alert */}
        {pendingMovements > 0 && (
          <div 
            onClick={() => user.role === 'ADMIN' ? navigate('/accounting') : navigate('/inventory')}
            className="flex-shrink-0 bg-gradient-to-r from-amber-600 to-amber-500 p-2 text-center cursor-pointer hover:from-amber-500 hover:to-amber-400 transition-all flex items-center justify-center gap-2 group z-[50]"
          >
            <AlertCircle size={18} className="text-white animate-pulse" />
            <span className="text-white font-bold text-xs md:text-sm">
              {user.role === 'ADMIN' 
                ? `Hay ${pendingMovements} movimientos pendientes`
                : `Tienes ${pendingMovements} movimientos pendientes`}
            </span>
            <ChevronRight size={16} className="text-white group-hover:translate-x-1 transition-transform" />
          </div>
        )}

        <div className={`flex-1 ${isPOS ? 'p-0' : 'p-4 md:p-8'}`}>
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;