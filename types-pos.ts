// =============================================================================
// BARFLOW - TIPOS TYPESCRIPT PARA PUNTO DE VENTA (POS)
// =============================================================================

// -----------------------------------------------------------------------------
// PRODUCTOS (Extiende los tipos existentes)
// -----------------------------------------------------------------------------

export interface POSProduct {
  id: string;
  name: string;
  category: string;
  costPrice: number;
  salePrice: number;
  active: boolean;
  quickSale: boolean;      // Visible en pantalla POS
  displayOrder: number;    // Orden de visualización
  imageUrl?: string;       // Imagen del producto
  stock?: number;          // Stock actual (opcional)
  barcode?: string;        // Código de barras (opcional)
}

// -----------------------------------------------------------------------------
// CATEGORÍAS DE PRODUCTOS
// -----------------------------------------------------------------------------

export interface ProductCategory {
  id: string;
  name: string;
  color: string;           // Color para visualización en UI
  icon: string;            // Icono (emoji o nombre de librería)
  displayOrder: number;
}

// -----------------------------------------------------------------------------
// VENTAS (POS SALES)
// -----------------------------------------------------------------------------

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED';

export interface SalePayment {
  id: string;
  saleId: string;
  method: PaymentMethod;
  amount: number;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  costPrice?: number;      // Para calcular margen de ganancia
}

export interface POSSale {
  id: string;
  sessionId?: string;      // Turno asociado
  employeeId: string;
  employeeName: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  paymentMethod: PaymentMethod;
  payments: SalePayment[];
  cashReceived: number;
  change: number;
  createdAt: string;       // ISO 8601 timestamp
  drawerOpened: boolean;
  notes?: string;
}

// -----------------------------------------------------------------------------
// SESIONES DE CAJA (CASH DRAWER SESSIONS)
// -----------------------------------------------------------------------------

export type SessionStatus = 'OPEN' | 'CLOSED' | 'SUSPENDED';

export interface CashDrawerSession {
  id: string;
  employeeId: string;
  employeeName: string;
  openTime: string;
  closeTime?: string;
  status: SessionStatus;
  initialCash: number;
  finalCash?: number;
  totalSales: number;
  totalCashIn: number;
  totalCashOut: number;
  expectedBalance?: number;
  actualBalance?: number;
  difference?: number;
  transactionCount: number;
  notes?: string;
}

export interface CashMovement {
  id: string;
  sessionId: string;
  type: 'IN' | 'OUT';
  amount: number;
  reason: string;
  employeeId: string;
  employeeName: string;
  timestamp: string;
  authorizedBy?: string;    // Supervisor que autorizó
}

// -----------------------------------------------------------------------------
// LOGS DE GAVETA DE DINERO (CASH DRAWER LOGS)
// -----------------------------------------------------------------------------

export type DrawerEventType = 'SALE' | 'MANUAL' | 'UNKNOWN' | 'SENSOR_AUTO';

export interface DrawerLog {
  id: string;
  date: string;                   // ISO 8601 timestamp
  eventType: DrawerEventType;
  status: 'OPEN' | 'CLOSED' | 'JAMMED';
  userId?: string;                // Usuario que autorizó
  userName?: string;
  durationMs: number;             // Duración de la apertura
  isAuthorized: boolean;
  notes?: string;
  saleId?: string;                // Venta asociada
}

// -----------------------------------------------------------------------------
// ALERTAS DE SEGURIDAD (SECURITY ALERTS)
// -----------------------------------------------------------------------------

export type AlertType = 
  | 'UNAUTHORIZED_OPEN'    // Apertura no autorizada
  | 'LONG_OPEN'            // Gaveta abierta mucho tiempo
  | 'JAMMED'               // Gaveta atascada
  | 'SENSOR_ERROR'         // Error del sensor
  | 'CASH_MISMATCH'        // Diferencia en arqueo
  | 'SUSPICIOUS_PATTERN';  // Patrón sospechoso

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface DrawerAlert {
  id: string;
  date: string;                   // ISO 8601 timestamp
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  userId?: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  drawerLogId?: string;
  metadata?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// CONFIGURACIÓN DE HARDWARE (HARDWARE CONFIG)
// -----------------------------------------------------------------------------

export interface HardwareConfig {
  id: string;
  cashDrawerEnabled: boolean;
  cashDrawerPort: string;         // Puerto serial (Windows: COM1, Linux: /dev/ttyUSB0)
  cashDrawerBaudRate: number;
  drawerOpenPulseMs: number;      // Duración del pulso de apertura
  drawerSensorEnabled: boolean;   // Habilitar sensor de estado
  drawerSensorPin: number;        // Pin del sensor (para GPIO en Raspberry Pi)
  pollingIntervalMs: number;      // Intervalo de polling del sensor
  maxDrawerOpenMs: number;        // Tiempo máximo abierto antes de alerta
  updatedAt: string;
}

export interface DrawerStatus {
  isOpen: boolean;
  lastOpenTime?: string;
  lastCloseTime?: string;
  isSensorConnected: boolean;
  lastActivity?: DrawerLog;
}

// -----------------------------------------------------------------------------
// ESTADO GLOBAL DEL POS (REDUX/ZUSTAND)
// -----------------------------------------------------------------------------

export interface POSState {
  // Productos
  products: POSProduct[];
  categories: ProductCategory[];
  
  // Carrito actual
  cart: SaleItem[];
  cartNote?: string;
  tipAmount: number;
  
  // Sesión
  currentSession?: CashDrawerSession;
  
  // UI State
  selectedCategory: string | null;
  searchQuery: string;
  isProcessingPayment: boolean;
  showCashDrawer: boolean;
  
  // Hardware
  drawerStatus: DrawerStatus;
  hardwareConfig: HardwareConfig;
  
  // Reportes del día
  todaySales: POSSale[];
  todayStats: DailyStats;
}

export interface DailyStats {
  totalSales: number;
  totalRevenue: number;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  totalTips: number;
  transactionCount: number;
  averageTicket: number;
  drawerOpenCount: number;
}

// -----------------------------------------------------------------------------
// EVENTOS DE COMUNICACIÓN SERIAL (SERIAL EVENTS)
// -----------------------------------------------------------------------------

export type SerialEventType = 
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'ERROR'
  | 'DRAWER_OPENED'
  | 'DRAWER_CLOSED'
  | 'DATA_RECEIVED';

export interface SerialEvent {
  type: SerialEventType;
  port?: string;
  data?: string;
  error?: string;
  timestamp: string;
}

// -----------------------------------------------------------------------------
// RESPUESTAS DE API (API RESPONSES)
// -----------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// -----------------------------------------------------------------------------
// FILTROS PARA REPORTES
// -----------------------------------------------------------------------------

export interface SalesReportFilter {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  paymentMethod?: PaymentMethod;
  minAmount?: number;
  maxAmount?: number;
}

export interface AlertsReportFilter {
  startDate?: string;
  endDate?: string;
  type?: AlertType;
  severity?: AlertSeverity;
  acknowledged?: boolean;
}
