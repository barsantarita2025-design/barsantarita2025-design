export type Role = 'ADMIN' | 'EMPLOYEE';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  password?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  costPrice: number;
  salePrice: number;
  active: boolean;
  image?: string;
}

export interface InventoryItem {
  productId: string;
  productName: string;
  count: number;
}

export interface AuditEntry {
  date: string;
  userId: string;
  userName: string;
  action: string;
  reason: string;
}

export interface ShiftSession {
  id: string;
  openedBy: string;
  closedBy?: string;
  openedAt: string;
  closedAt?: string;
  status: 'OPEN' | 'CLOSED' | 'PENDING_APPROVAL';
  initialInventory: InventoryItem[];
  finalInventory: InventoryItem[];
  salesReport?: SalesReport;
  closingObservation?: string;
  realCash?: number;
  auditLog?: AuditEntry[];
}

export interface SalesReport {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalCreditSales: number;
  totalCashPayments: number;
  totalNonCashPayments: number;
  cashToDeliver: number;
  difference?: number;
  itemsSold: {
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
    profit: number;
  }[];
}

export interface AppConfig {
  barName: string;
  lastExportDate: string;
  cashDrawerEnabled: boolean;
  cashDrawerPort: string;
  inventoryBase?: Record<string, number>;
}

// --- FIAO SYSTEM ---

export interface CreditCustomer {
  id: string;
  name: string;
  documentId?: string;
  phone?: string;
  maxLimit: number;
  currentUsed: number;
  observations?: string;
  active: boolean;
}

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD';

export interface CreditTransaction {
  id: string;
  customerId: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  date: string;
  type: 'DEBT' | 'PAYMENT';
  paymentMethod?: PaymentMethod;
  observation: string;
}

// --- ACCOUNTING SYSTEM ---

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  paymentDay: string;
  type: 'EXPENSE' | 'BANK_COMMITMENT';
}

export type PayrollStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface WorkShift {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  hoursWorked: number;
  hourlyRate: number;
  surcharges: number;
  totalPay: number;
  status: PayrollStatus;
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface Purchase {
  id: string;
  date: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  observations?: string;
}

// ======================
// POS SYSTEM TYPES
// ======================

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export type POSPaymentMethod = 'CASH' | 'TRANSFER' | 'CARD' | 'MIXED';

export interface POSPayment {
  method: POSPaymentMethod;
  cashAmount: number;
  transferAmount: number;
  cardAmount: number;
  tipAmount: number;
}

export interface POSSale {
  id: string;
  sessionId: string;
  employeeId: string;
  employeeName: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  paymentMethod: POSPaymentMethod;
  cashReceived?: number;
  change?: number;
  createdAt: string;
}

// Cash Drawer & Security Types
export type DrawerEventType = 'SALE' | 'MANUAL' | 'UNKNOWN';
export type DrawerStatus = 'CLOSED' | 'OPEN' | 'JAMMED';

export interface DrawerLog {
  id: string;
  date: string;
  eventType: DrawerEventType;
  status: DrawerStatus;
  userId?: string;
  userName?: string;
  durationMs: number;
  isAuthorized: boolean;
  notes?: string;
}

export interface DrawerAlert {
  id: string;
  date: string;
  type: 'UNAUTHORIZED_OPEN' | 'LONG_OPEN' | 'JAMMED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  userId?: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface SerialDevice {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
}
