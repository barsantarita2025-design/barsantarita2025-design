// =============================================================================
// BARFLOW - INTERFAZ DEL PUNTO DE VENTA (POS)
// =============================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Minus, Trash2, Search, CreditCard, DollarSign, Receipt, X, Calculator, AlertTriangle, Settings, RefreshCw, Usb, Play, CheckCircle, XCircle, Save, Database } from 'lucide-react';
import type { POSProduct, ProductCategory, SaleItem, POSSale, DailyStats } from '../types-pos';
import { User } from '../types';
import type { SerialDrawerService } from '../services/serialDrawerService';
import { getProducts } from '../services/productService';
import { saveSale, getDailyStats } from '../services/posService';

// -------------------------------------------------------------------------------------------------------------
// CONFIGURACIÓN DE CATEGORÍAS - IGUAL A Products.tsx
// -------------------------------------------------------------------------------------------------------------
import { DEFAULT_CATEGORIES } from '../constants';

const getCategoriesFromStorage = (): string[] => {
  try {
    const saved = localStorage.getItem('barflow_custom_categories');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Combinar categorías por defecto con las personalizadas
        // Usamos Set para evitar duplicados por si acaso
        return Array.from(new Set([...DEFAULT_CATEGORIES, ...parsed]));
      }
    }
  } catch (e) {
    console.error('Error al leer categorías de localStorage:', e);
  }
  return DEFAULT_CATEGORIES;
};

const saveCategoriesToStorage = (categories: string[]): void => {
  try {
    localStorage.setItem('barflow_custom_categories', JSON.stringify(categories));
  } catch (e) {
    console.error('Error al guardar categorías en localStorage:', e);
  }
};

// Mapeo de categorías a iconos y colores
const getCategoryConfig = (categoryName: string): { icon: string; color: string } => {
  const configs: Record<string, { icon: string; color: string }> = {
    'Cervezas': { icon: '🍺', color: '#F59E0B' },
    'Licores': { icon: '🥃', color: '#EF4444' },
    'Sin Alcohol': { icon: '🥤', color: '#10B981' },
    'Comida': { icon: '🍔', color: '#F97316' },
    'Others': { icon: '📦', color: '#6366F1' },
  };
  return configs[categoryName] || { icon: '📦', color: '#6366F1' };
};

// -------------------------------------------------------------------------------------------------------------
// FORMATO DE MONEDA COLOMBIANA
// -------------------------------------------------------------------------------------------------------------
const formatCOP = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// -------------------------------------------------------------------------------------------------------------
// DATOS DE EJEMPLO (MOCK DATA) - SOLO PARA MODO DE PRUEBA
// -------------------------------------------------------------------------------------------------------------


// Tipo local para items del carrito
interface CartItem {
  product: POSProduct;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

// -------------------------------------------------------------------------------------------------------------
// COMPONENTE PRINCIPAL DEL POS
// -------------------------------------------------------------------------------------------------------------
export function POS({ user }: { user: User }) {
  // Estados para productos y categorías
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);


  // Estados del POS
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [cashReceived, setCashReceived] = useState(0);
  const [tipAmount, setTipAmount] = useState(0);
  const [showDrawerAlert, setShowDrawerAlert] = useState(false);
  const [drawerStatus, setDrawerStatus] = useState<'CLOSED' | 'OPEN'>('CLOSED');
  const [showSettings, setShowSettings] = useState(false);
  const [isSimulationMode, setIsSimulationMode] = useState(true);
  const [drawerService, setDrawerService] = useState<SerialDrawerService | null>(null);
  const [drawerConfig, setDrawerConfig] = useState({
    cashDrawerPort: localStorage.getItem('barflow_drawer_port') || 'COM1',
    cashDrawerBaudRate: parseInt(localStorage.getItem('barflow_drawer_baud') || '9600'),
  });
  const [testResults, setTestResults] = useState<{ test: string; status: 'pending' | 'success' | 'error'; message: string }[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [todayStats, setTodayStats] = useState<DailyStats>({
    totalSales: 0,
    totalRevenue: 0,
    totalCash: 0,
    totalCard: 0,
    totalTransfer: 0,
    totalTips: 0,
    transactionCount: 0,
    averageTicket: 0,
    drawerOpenCount: 0,
  });

  // -------------------------------------------------------------------------------------------------------------
  // CARGAR DATOS DESDE LA BASE DE DATOS
  // -------------------------------------------------------------------------------------------------------------
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);

      // Cargar categorías desde localStorage (igual que Products.tsx)
      const savedCategories = getCategoriesFromStorage();
      setCategories(savedCategories);

      // Intentar cargar productos desde la base de datos
      try {
        const dbProducts = await getProducts() as any[];

        if (dbProducts && dbProducts.length > 0) {
          // Mapear productos de la base de datos al formato POSProduct
          const mappedProducts: POSProduct[] = dbProducts.map(p => ({
            id: p.id,
            name: p.name,
            category: p.category || 'Others',
            costPrice: p.costPrice || 0,
            salePrice: p.salePrice || 0,
            active: p.active !== false,
            quickSale: p.quickSale || false,
            displayOrder: p.displayOrder || 0,
            stock: p.stock,
            barcode: p.barcode,
            image: p.image,
          }));
          setProducts(mappedProducts);
        } else {
          // No hay productos en la base de datos
          setProducts([]);
        }
      } catch (dbError) {
        console.error('No se pudo conectar a la base de datos:', dbError);
        setProducts([]);
        setLoadError('Base de datos no disponible');
      }

      // No establecer categoría por defecto para mostrar "Todos" al inicio
      // if (savedCategories.length > 0) {
      //   setSelectedCategory(savedCategories[0]);
      // }

      // Cargar estadísticas del día seleccionado
      const stats = await getDailyStats(selectedDate);
      setTodayStats(stats);

    } catch (error) {
      console.error('Error al cargar datos:', error);
      setProducts([]);
      setLoadError('Error al cargar datos');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  // Cargar datos al montar el componente
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtrar productos por categoría y búsqueda
  const filteredProducts = products.filter(product => {
    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    const matchesSearch = !searchQuery ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode?.includes(searchQuery);
    // Solo mostrar productos activos y con stock > 0 (o sin stock definido)
    return matchesCategory && matchesSearch && product.active && (product.stock === undefined || product.stock === null || product.stock > 0);
  });

  // Agregar producto al carrito
  const addToCart = useCallback((product: POSProduct) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unitPrice }
            : item
        );
      }
      return [...prev, {
        product,
        quantity: 1,
        unitPrice: product.salePrice,
        subtotal: product.salePrice
      }];
    });
  }, []);

  // Actualizar cantidad en carrito
  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = Math.max(0, item.quantity + delta);
          if (newQty === 0) return null;
          return { ...item, quantity: newQty, subtotal: newQty * item.unitPrice };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  }, []);

  // Eliminar producto del carrito
  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  }, []);

  // Limpiar carrito
  const clearCart = useCallback(() => {
    setCart([]);
    setTipAmount(0);
  }, []);

  // Calcular totales
  // Calcular totales
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  // Impuesto incluido (19%) -> Precio = Base * 1.19  =>  Base = Precio / 1.19  =>  Impuesto = Precio - Base
  const tax = subtotal - (subtotal / 1.19);
  const total = subtotal + tipAmount;

  // Procesar pago
  const processPayment = useCallback(() => {
    if (cart.length === 0) return;

    // Abrir gaveta solo si es efectivo
    if (paymentMethod === 'CASH') {
      if (drawerService) {
        drawerService.openDrawer().catch(err => {
          console.error('Error al abrir gaveta:', err);
          // Fallback visual si falla el hardware
          setDrawerStatus('OPEN');
          setShowDrawerAlert(true);
          setTimeout(() => {
            setDrawerStatus('CLOSED');
            setShowDrawerAlert(false);
          }, 5000);
        });
      } else {
        // Fallback si no hay servicio
        setDrawerStatus('OPEN');
        setShowDrawerAlert(true);
        setTimeout(() => {
          setDrawerStatus('CLOSED');
          setShowDrawerAlert(false);
        }, 5000);
      }
    }

    const sale: POSSale = {
      id: `sale-${Date.now()}`,
      sessionId: undefined,
      employeeId: 'emp-001',
      employeeName: 'Juan Pérez',
      items: cart.map(item => ({
        id: `item-${Date.now()}-${Math.random()}`,
        saleId: '',
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        costPrice: item.product.costPrice
      })),
      subtotal,
      tax,
      tip: tipAmount,
      total,
      paymentMethod,
      payments: [],
      cashReceived: paymentMethod === 'CASH' ? cashReceived : 0,
      change: paymentMethod === 'CASH' ? Math.max(0, cashReceived - total) : 0,
      createdAt: new Date().toISOString(),
      drawerOpened: true,
    };

    console.log('Venta procesada:', sale);

    // Guardar venta en la base de datos (localStorage)
    saveSale(sale).then(() => {
      // Recargar estadísticas
      getDailyStats(selectedDate).then(setTodayStats);
    });

    // Simular apertura de gaveta para cambio
    if (paymentMethod === 'CASH' && cashReceived > total) {
      setDrawerStatus('OPEN');
      setTimeout(() => setDrawerStatus('CLOSED'), 5000);
    }

    // Limpiar y mostrar confirmación
    clearCart();
    setShowPayment(false);
    setCashReceived(0);
    setTipAmount(0);
    alert(`Venta procesada!\nTotal: ${formatCOP(total)}\nMétodo: ${paymentMethod}`);
  }, [cart, subtotal, tax, tipAmount, paymentMethod, cashReceived, clearCart, selectedDate]);

  // Abrir gaveta manualmente
  const openDrawer = useCallback(() => {
    if (drawerService) {
      drawerService.openDrawer().catch(err => {
        console.error('Error al abrir gaveta manualmente:', err);
        // Fallback visual
        setDrawerStatus('OPEN');
        setShowDrawerAlert(true);
        setTimeout(() => {
          setDrawerStatus('CLOSED');
          setShowDrawerAlert(false);
        }, 3000);
      });
    } else {
      setDrawerStatus('OPEN');
      setShowDrawerAlert(true);
      setTimeout(() => {
        setDrawerStatus('CLOSED');
        setShowDrawerAlert(false);
      }, 3000);
    }
  }, [drawerService]);

  // -------------------------------------------------------------------------
  // SERVICIO DE GAVETA (USANDO SERIALDRAWERSERVICE REAL)
  // -------------------------------------------------------------------------

  // Inicializar servicio de gaveta
  useEffect(() => {
    const initDrawerService = async () => {
      try {
        const { SerialDrawerService } = await import('../services/serialDrawerService');
        const service = new SerialDrawerService({
          cashDrawerPort: drawerConfig.cashDrawerPort,
          cashDrawerBaudRate: drawerConfig.cashDrawerBaudRate
        });

        // No forzar modo simulación, dejar que el servicio decida según el entorno
        setDrawerService(service);

        // Escuchar eventos de la gaveta
        service.on('event', (event) => {
          console.log('Drawer event:', event);
          if (event.type === 'DRAWER_OPENED') {
            setDrawerStatus('OPEN');
            setShowDrawerAlert(true);
          } else if (event.type === 'DRAWER_CLOSED') {
            setDrawerStatus('CLOSED');
            setShowDrawerAlert(false);
          }
          // Actualizar estado de simulación basado en el servicio
          setIsSimulationMode(service.simulationStatus);
        });

        await service.connect();
        setIsSimulationMode(service.simulationStatus);
        console.log('Drawer service inicializado correctamente en', drawerConfig.cashDrawerPort);
      } catch (error) {
        console.error('Error al inicializar servicio de gaveta:', error);
        setIsSimulationMode(true);
      }
    };

    initDrawerService();

    return () => {
      if (drawerService) {
        drawerService.disconnect();
      }
    };
  }, [drawerConfig]);

  // -------------------------------------------------------------------------
  // PRUEBAS VIRTUALES DE GAVETA (USANDO SERVICIO REAL)
  // -------------------------------------------------------------------------

  const runDrawerTests = useCallback(async () => {
    if (!drawerService) {
      alert('Servicio de gaveta no disponible');
      return;
    }

    setIsTesting(true);
    setTestResults([
      { test: 'Inicialización del servicio', status: 'pending', message: '...' },
      { test: 'Conexión a puerto COM1', status: 'pending', message: '...' },
      { test: 'Envío comando de apertura', status: 'pending', message: '...' },
      { test: 'Verificación de respuesta', status: 'pending', message: '...' },
      { test: 'Cierre de conexión', status: 'pending', message: '...' },
    ]);

    try {
      // Test 1: Verificar inicialización
      await new Promise(resolve => setTimeout(resolve, 500));
      setTestResults(prev => prev.map((r, idx) =>
        idx === 0 ? { ...r, status: 'success', message: '✓ Servicio inicializado' } : r
      ));

      // Test 2: Verificar conexión
      const isConnected = drawerService.connectionStatus;
      await new Promise(resolve => setTimeout(resolve, 500));
      setTestResults(prev => prev.map((r, idx) =>
        idx === 1 ? { ...r, status: isConnected ? 'success' : 'error', message: isConnected ? '✓ Conectado' : '✗ Error de conexión' } : r
      ));

      // Test 3: Enviar comando de apertura
      await drawerService.openDrawer(200);
      await new Promise(resolve => setTimeout(resolve, 300));
      setTestResults(prev => prev.map((r, idx) =>
        idx === 2 ? { ...r, status: 'success', message: '✓ Comando enviado' } : r
      ));

      // Test 4: Verificar estado (debería estar abierta)
      const status = await drawerService.getDrawerStatus();
      await new Promise(resolve => setTimeout(resolve, 300));
      setTestResults(prev => prev.map((r, idx) =>
        idx === 3 ? { ...r, status: status.isOpen ? 'success' : 'error', message: status.isOpen ? '✓ Gaveta abierta' : '✗ Gaveta no respondió' } : r
      ));

      // Test 5: Verificar modo simulación
      const simMode = drawerService.simulationStatus;
      await new Promise(resolve => setTimeout(resolve, 500));
      setTestResults(prev => prev.map((r, idx) =>
        idx === 4 ? { ...r, status: simMode ? 'success' : 'error', message: simMode ? '✓ Modo simulación activo' : '✗ Modo real (requiere hardware)' } : r
      ));

    } catch (error) {
      console.error('Error en pruebas:', error);
      setTestResults(prev => prev.map(r =>
        r.status === 'pending' ? { ...r, status: 'error', message: '✗ Error' } : r
      ));
    }

    setIsTesting(false);
  }, [drawerService]);

  return (
    <div className="h-full flex flex-col bg-gray-900 text-bar-text">
      {/* Header del POS */}
      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-amber-400">🧾 Punto de Venta</h2>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white outline-none focus:border-amber-400"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Receipt className="w-4 h-4" />
            <span>{selectedDate === new Date().toISOString().split('T')[0] ? 'Hoy' : 'Ventas'}: {todayStats.transactionCount}</span>
            <span className="text-green-400">{formatCOP(todayStats.totalRevenue)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openDrawer}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
          >
            <DollarSign className="w-4 h-4" />
            Abrir Gaveta
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-gray-700 rounded-lg"
            title="Configuración de Gaveta"
          >
            <Settings className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Alerta de gaveta */}
      {showDrawerAlert && (
        <div className="bg-amber-500/20 border-b border-amber-500 px-4 py-2 flex items-center justify-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <span className="text-amber-400 font-medium">
            Gaveta {drawerStatus === 'OPEN' ? 'ABIERTA' : 'CERRADA'}
          </span>
        </div>
      )}

      {/* Contenido principal */}
      <div className="flex-1 flex overflow-hidden">
        {/* Panel izquierdo: Productos */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Buscador */}
          <div className="p-3 bg-gray-800/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar producto o código de barras..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Categorías */}
          <div className="flex gap-2 p-3 bg-gray-800/30 overflow-x-auto">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${!selectedCategory
                ? 'bg-amber-500 text-gray-900'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
            >
              Todos
            </button>
            {categories.map(catName => {
              const config = getCategoryConfig(catName);
              return (
                <button
                  key={catName}
                  onClick={() => setSelectedCategory(catName)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === catName
                    ? 'bg-amber-500 text-gray-900'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                  {config.icon} {catName}
                </button>
              );
            })}
          </div>

          {/* Grid de productos */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
              {filteredProducts.map(product => {
                const catConfig = getCategoryConfig(product.category);
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="flex flex-col h-full p-4 bg-gray-800 hover:bg-gray-700 rounded-2xl border border-gray-700 hover:border-amber-500/50 transition-all group text-left shadow-lg hover:shadow-amber-500/10"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="bg-gray-900/50 p-2 rounded-xl">
                        <span className="text-2xl">
                          {product.image ? (
                            product.image.startsWith('http') ? (
                              <img src={product.image} alt={product.name} className="w-10 h-10 object-cover rounded-lg" />
                            ) : (
                              <span>{product.image}</span>
                            )
                          ) : (
                            catConfig.icon
                          )}
                        </span>
                      </div>
                      {product.stock !== undefined && product.stock < 5 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded-full border border-rose-500/30">
                          STOCK: {product.stock}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm text-bar-text group-hover:text-amber-400 mb-1 leading-tight">
                        {product.name}
                      </div>
                      {user.role === 'ADMIN' && (
                        <div className="text-[11px] text-gray-500 mb-2">
                          Costo: {formatCOP(product.costPrice)}
                        </div>
                      )}
                    </div>
                    <div className="mt-auto">
                      <div className="text-lg font-black text-green-400">
                        {formatCOP(product.salePrice)}
                      </div>
                      {product.barcode && (
                        <div className="text-[10px] text-gray-600 mt-1 font-mono truncate">
                          {product.barcode}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Panel derecho: Carrito */}
        <div className="w-96 bg-gray-800 flex flex-col border-l border-gray-700">
          {/* Header del carrito */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">🛒 Carrito</h3>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Vaciar
                </button>
              )}
            </div>
          </div>

          {/* Items del carrito */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Calculator className="w-16 h-16 mb-4 opacity-50" />
                <p>No hay productos en el carrito</p>
                <p className="text-sm">Selecciona productos para comenzar</p>
              </div>
            ) : (
              <div className="p-2">
                {cart.map(item => (
                  <div key={item.product.id} className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.product.name}</div>
                      <div className="text-xs text-gray-400">
                        ${item.unitPrice.toFixed(2)} x {item.quantity}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-400">${item.subtotal.toFixed(2)}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="p-1 bg-gray-600 hover:bg-gray-500 rounded"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="p-1 bg-gray-600 hover:bg-gray-500 rounded"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded ml-2"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer con totales y pago */}
          <div className="p-4 bg-gray-900 border-t border-gray-700">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span>
                <span>{formatCOP(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>IVA (19% Incluido)</span>
                <span>{formatCOP(tax)}</span>
              </div>
              {tipAmount > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Propina</span>
                  <span>{formatCOP(tipAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold pt-2 border-t border-gray-700">
                <span>Total</span>
                <span className="text-green-400">{formatCOP(total)}</span>
              </div>
            </div>

            {/* Campo de propinas */}
            <div className="mb-4">
              <label className="text-xs text-gray-400 block mb-1">Propina</label>
              <div className="flex gap-2">
                {[0, 5, 10, 15].map(pct => (
                  <button
                    key={pct}
                    onClick={() => setTipAmount(pct === 0 ? 0 : subtotal * pct / 100)}
                    className={`flex-1 py-1.5 rounded text-sm font-medium ${(pct === 0 && tipAmount === 0) || (pct > 0 && tipAmount === subtotal * pct / 100)
                      ? 'bg-amber-500 text-gray-900'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                  >
                    {pct === 0 ? 'Sin' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Botones de pago */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setPaymentMethod('CASH')}
                disabled={cart.length === 0}
                className={`py-3 rounded-lg font-medium flex flex-col items-center gap-1 ${paymentMethod === 'CASH'
                  ? 'bg-green-500 text-gray-900'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50'
                  }`}
              >
                <DollarSign className="w-5 h-5" />
                Efectivo
              </button>
              <button
                onClick={() => setPaymentMethod('CARD')}
                disabled={cart.length === 0}
                className={`py-3 rounded-lg font-medium flex flex-col items-center gap-1 ${paymentMethod === 'CARD'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50'
                  }`}
              >
                <CreditCard className="w-5 h-5" />
                Tarjeta
              </button>
              <button
                onClick={() => setPaymentMethod('TRANSFER')}
                disabled={cart.length === 0}
                className={`py-3 rounded-lg font-medium flex flex-col items-center gap-1 ${paymentMethod === 'TRANSFER'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50'
                  }`}
              >
                <RefreshCw className="w-5 h-5" />
                Transfer
              </button>
            </div>

            <button
              onClick={() => {
                if (paymentMethod === 'CASH') {
                  setCashReceived(Math.ceil(total / 1000) * 1000);
                } else {
                  setCashReceived(total);
                }
                setShowPayment(true);
              }}
              disabled={cart.length === 0}
              className="w-full mt-3 py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-lg text-gray-900"
            >
              Cobrar {formatCOP(total)}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de configuración y pruebas de gaveta */}
      {
        showSettings && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-lg">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">⚙️ Configuración de Gaveta</h3>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gray-700 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Estado de la conexión */}
              <div className="mb-6 p-4 bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Usb className="w-5 h-5 text-blue-400" />
                  <span className="font-medium">Estado de Conexión</span>
                </div>
                <div className="flex items-center gap-2">
                  {isSimulationMode ? (
                    <>
                      <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse"></div>
                      <span className="text-amber-400">Modo Simulación (Hardware no detectado)</span>
                    </>
                  ) : (
                    <>
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-green-400">Conectado a {drawerConfig.cashDrawerPort}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Pruebas virtuales */}
              <div className="mb-6">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Play className="w-4 h-4 text-green-400" />
                  Pruebas Virtuales de Gaveta
                </h4>
                <p className="text-sm text-gray-400 mb-4">
                  Ejecuta estas pruebas para verificar que los comandos de la gaveta funcionan correctamente.
                </p>

                <button
                  onClick={runDrawerTests}
                  disabled={isTesting}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 rounded-lg font-medium flex items-center justify-center gap-2 mb-4"
                >
                  {isTesting ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                  {isTesting ? 'Ejecutando pruebas...' : 'Ejecutar pruebas de gaveta'}
                </button>

                {/* Resultados de pruebas */}
                {testResults.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {testResults.map((result, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2 rounded ${result.status === 'success' ? 'bg-green-500/10' : result.status === 'error' ? 'bg-red-500/10' : 'bg-gray-700/30'}`}
                      >
                        <span className="text-sm">{result.test}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{result.message}</span>
                          {result.status === 'success' && <CheckCircle className="w-4 h-4 text-green-400" />}
                          {result.status === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
                          {result.status === 'pending' && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Configuración */}
              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h4 className="font-medium mb-3">Configuración del Puerto</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Puerto COM</label>
                    <select
                      className="w-full px-3 py-2 bg-gray-600 rounded-lg text-sm"
                      value={drawerConfig.cashDrawerPort}
                      onChange={(e) => {
                        const newPort = e.target.value;
                        setDrawerConfig(prev => ({ ...prev, cashDrawerPort: newPort }));
                        localStorage.setItem('barflow_drawer_port', newPort);
                      }}
                    >
                      <option value="COM1">COM1</option>
                      <option value="COM2">COM2</option>
                      <option value="COM3">COM3</option>
                      <option value="COM4">COM4</option>
                      <option value="COM5">COM5</option>
                      <option value="COM6">COM6</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Velocidad (Baudios)</label>
                    <select
                      className="w-full px-3 py-2 bg-gray-600 rounded-lg text-sm"
                      value={drawerConfig.cashDrawerBaudRate}
                      onChange={(e) => {
                        const newBaud = parseInt(e.target.value);
                        setDrawerConfig(prev => ({ ...prev, cashDrawerBaudRate: newBaud }));
                        localStorage.setItem('barflow_drawer_baud', newBaud.toString());
                      }}
                    >
                      <option value="2400">2400</option>
                      <option value="4800">4800</option>
                      <option value="9600">9600</option>
                      <option value="19200">19200</option>
                      <option value="38400">38400</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowSettings(false)}
                className="w-full mt-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        )
      }
      {
        showPayment && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">💳 Completar Pago</h3>
                <button onClick={() => setShowPayment(false)} className="p-2 hover:bg-gray-700 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="text-sm text-gray-400">Total a pagar</div>
                  <div className="text-4xl font-bold text-green-400">{formatCOP(total)}</div>
                </div>

                {paymentMethod === 'CASH' && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Efectivo recibido</label>
                    <input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-xl text-center"
                      placeholder="0.00"
                    />
                    <div className="flex gap-2 mt-2">
                      {[5000, 10000, 20000, 50000].map(amount => (
                        <button
                          key={amount}
                          onClick={() => setCashReceived(amount)}
                          className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                        >
                          {formatCOP(amount)}
                        </button>
                      ))}
                    </div>
                    {cashReceived >= total && (
                      <div className="mt-4 p-3 bg-green-500/20 rounded-lg text-center">
                        <div className="text-sm text-gray-400">Cambio</div>
                        <div className="text-2xl font-bold text-green-400">
                          {formatCOP(cashReceived - total)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === 'CARD' && (
                  <div className="p-4 bg-gray-700 rounded-lg text-center">
                    <CreditCard className="w-12 h-12 mx-auto mb-2 text-blue-400" />
                    <p className="text-sm text-gray-400">Pasarela de pago conectada</p>
                    <p className="text-xs text-gray-500">Tarjeta: **** **** **** 4242</p>
                  </div>
                )}

                {paymentMethod === 'TRANSFER' && (
                  <div className="p-4 bg-gray-700 rounded-lg text-center">
                    <RefreshCw className="w-12 h-12 mx-auto mb-2 text-purple-400" />
                    <p className="text-sm text-gray-400">Transferencia bancaria</p>
                    <p className="text-xs text-gray-500">Referencia: TXN-{Date.now().toString().slice(-8)}</p>
                  </div>
                )}

                <button
                  onClick={processPayment}
                  disabled={paymentMethod === 'CASH' && cashReceived < total}
                  className="w-full py-4 bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-lg text-gray-900"
                >
                  {paymentMethod === 'CASH' ? 'Confirmar y dar cambio' : 'Confirmar pago'}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

export default POS;
