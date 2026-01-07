import { Product, User, ShiftSession, AppConfig, Role, CreditCustomer, CreditTransaction, PaymentMethod, AuditEntry, FixedExpense, WorkShift, Purchase } from '../types';
import { STORAGE_KEYS, DEFAULT_ADMIN, DEFAULT_PRODUCTS } from '../constants';

/**
 * NOTE: This service interacts with the backend API.
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const fetchAPI = async (endpoint: string, options?: RequestInit) => {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`API Error on ${endpoint}:`, response.status, errorData);
      throw new Error(errorData.error || `API Error: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error(`Fetch Error on ${endpoint}:`, error);
    throw error;
  }
};

const get = <T>(key: string): T | null => {
  try {
    const data = localStorage.getItem(key);
    if (!data || data === 'undefined' || data === 'null') return null;
    return JSON.parse(data);
  } catch (e) {
    console.error(`Error reading ${key} from localStorage. Cleaning up corrupt data.`, e);
    try {
      localStorage.removeItem(key);
    } catch (removeError) {
      console.error("Could not remove corrupt key", removeError);
    }
    return null;
  }
};

const set = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Error writing to localStorage", e);
  }
};

const generateId = (): string => {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
};

// --- Initialization ---
export const initializeDB = async () => {
  try {
    // Check if API is up
    const health = await fetch(`${API_URL}/health`).catch(() => null);
    if (!health || !health.ok) {
      console.warn("Backend API is not reachable. Falling back to local mode (not implemented fully).");
    }
  } catch (err) {
    console.error("Critical DB Init Error", err);
  }
};

// --- Products ---
export const getProducts = async (): Promise<Product[]> => {
  return fetchAPI('/products');
};

export const saveProduct = async (product: Product): Promise<void> => {
  if (product.id && !product.id.startsWith('id-')) {
    await fetchAPI(`/products/${product.id}`, {
      method: 'PUT',
      body: JSON.stringify(product),
    });
  } else {
    const { id, ...data } = product;
    await fetchAPI('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
};

export const deleteProduct = async (id: string): Promise<void> => {
  await fetchAPI(`/products/${id}`, { method: 'DELETE' });
};

// --- Users ---
export const getUsers = async (): Promise<User[]> => {
  return fetchAPI('/users');
};

export const saveUser = async (user: User): Promise<void> => {
  if (user.id && !user.id.startsWith('id-')) {
    await fetchAPI(`/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify(user),
    });
  } else {
    const { id, ...data } = user;
    await fetchAPI('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
};

export const deleteUser = async (id: string): Promise<void> => {
  const users = get<User[]>(STORAGE_KEYS.USERS) || [];
  const userToDelete = users.find(u => u.id === id);
  if (userToDelete?.role === 'ADMIN' && users.filter(u => u.role === 'ADMIN').length <= 1) {
    throw new Error("No puedes eliminar al último administrador");
  }
  const filtered = users.filter(u => u.id !== id);
  set(STORAGE_KEYS.USERS, filtered);
}


// --- Sessions (Inventory) ---
export const getSessions = async (): Promise<ShiftSession[]> => {
  return fetchAPI('/sessions');
};

export const getActiveSession = async (): Promise<ShiftSession | null> => {
  return fetchAPI('/sessions/active');
};

export const startSession = async (userId: string, initialInventory: any[]): Promise<ShiftSession> => {
  return fetchAPI('/sessions', {
    method: 'POST',
    body: JSON.stringify({ openedBy: userId, initialInventory }),
  });
};

export const closeSession = async (session: ShiftSession): Promise<void> => {
  await fetchAPI(`/sessions/${session.id}/close`, {
    method: 'POST',
    body: JSON.stringify(session),
  });
};

export const reopenSession = async (sessionId: string, reason: string, adminUser: User): Promise<void> => {
  // 1. Check if there is currently an open session
  const current = get<ShiftSession>(STORAGE_KEYS.CURRENT_SESSION);
  if (current && current.status === 'OPEN') {
    throw new Error("No se puede reabrir un turno mientras exista otro ABIERTO. Cierra el turno actual primero.");
  }

  // 2. Find the session in history
  const sessions = get<ShiftSession[]>(STORAGE_KEYS.SESSIONS) || [];
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);

  if (sessionIndex === -1) {
    throw new Error("Turno no encontrado en el historial.");
  }

  const sessionToReopen = sessions[sessionIndex];

  // 3. Update session properties
  const audit: AuditEntry = {
    date: new Date().toISOString(),
    userId: adminUser.id,
    userName: adminUser.name,
    action: 'REOPENED',
    reason: reason
  };

  const updatedSession: ShiftSession = {
    ...sessionToReopen,
    status: 'OPEN',
    // closedBy: undefined, // Optional: keep previous closer or clear it. Let's keep data but status open implies active.
    // closedAt: undefined, 
    auditLog: [...(sessionToReopen.auditLog || []), audit]
  };

  // 4. Move to Current Session
  set(STORAGE_KEYS.CURRENT_SESSION, updatedSession);

  // 5. Remove from History (temporarily, until closed again)
  const newSessionsHistory = sessions.filter(s => s.id !== sessionId);
  set(STORAGE_KEYS.SESSIONS, newSessionsHistory);
};

export const approveSession = async (sessionId: string, adminUser: User): Promise<void> => {
  const sessions = get<ShiftSession[]>(STORAGE_KEYS.SESSIONS) || [];
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);

  if (sessionIndex === -1) {
    throw new Error("Turno no encontrado.");
  }

  const session = sessions[sessionIndex];

  if (session.status !== 'PENDING_APPROVAL') {
    throw new Error("Este turno no está pendiente de aprobación.");
  }

  const audit: AuditEntry = {
    date: new Date().toISOString(),
    userId: adminUser.id,
    userName: adminUser.name,
    action: 'APPROVED',
    reason: 'Aprobación administrativa'
  };

  const updatedSession: ShiftSession = {
    ...session,
    status: 'CLOSED',
    auditLog: [...(session.auditLog || []), audit]
  };

  sessions[sessionIndex] = updatedSession;
  set(STORAGE_KEYS.SESSIONS, sessions);
};

// --- Credit / Fiao System ---

export const getCreditCustomers = async (): Promise<CreditCustomer[]> => {
  return fetchAPI('/credit/customers');
};

export const saveCreditCustomer = async (customer: CreditCustomer): Promise<void> => {
  if (customer.id && !customer.id.startsWith('id-')) {
    await fetchAPI(`/credit/customers/${customer.id}`, {
      method: 'PUT',
      body: JSON.stringify(customer),
    });
  } else {
    const { id, ...data } = customer;
    await fetchAPI('/credit/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
};

export const getCustomerHistory = async (customerId: string): Promise<CreditTransaction[]> => {
  return fetchAPI(`/credit/customers/${customerId}/history`);
};

// Retrieve transactions within a specific timeframe (used for Shift Closing calculations)
export const getTransactionsInRange = async (startDateISO: string, endDateISO: string): Promise<CreditTransaction[]> => {
  return fetchAPI(`/credit/transactions/range?startDate=${startDateISO}&endDate=${endDateISO}`);
};

// Transactional operation: Add Debt (Fiao)
export const registerCreditTransaction = async (customerId: string, amount: number, observation: string, user: User): Promise<void> => {
  await fetchAPI(`/credit/customers/${customerId}/transactions`, {
    method: 'POST',
    body: JSON.stringify({ amount, observation, employeeId: user.id, employeeName: user.name, type: 'DEBT' }),
  });
};

// Transactional operation: Payment (Abono)
export const registerPaymentTransaction = async (customerId: string, amount: number, method: PaymentMethod, observation: string, user: User): Promise<void> => {
  await fetchAPI(`/credit/customers/${customerId}/transactions`, {
    method: 'POST',
    body: JSON.stringify({ amount, observation, employeeId: user.id, employeeName: user.name, type: 'PAYMENT', paymentMethod: method }),
  });
};

// --- ACCOUNTING MODULE ---

// 1. Fixed Expenses
export const getFixedExpenses = async (): Promise<FixedExpense[]> => {
  return fetchAPI('/accounting/expenses');
};

export const saveFixedExpense = async (expense: FixedExpense): Promise<void> => {
  if (expense.id && !expense.id.startsWith('id-')) {
    await fetchAPI(`/accounting/expenses/${expense.id}`, {
      method: 'PUT',
      body: JSON.stringify(expense),
    });
  } else {
    const { id, ...data } = expense;
    await fetchAPI('/accounting/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
};

export const deleteFixedExpense = async (id: string): Promise<void> => {
  await fetchAPI(`/accounting/expenses/${id}`, { method: 'DELETE' });
};

// 2. Payroll
export const getPayroll = async (): Promise<WorkShift[]> => {
  return fetchAPI('/accounting/payroll');
};

export const saveWorkShift = async (shift: WorkShift): Promise<void> => {
  if (shift.id && !shift.id.startsWith('id-')) {
    await fetchAPI(`/accounting/payroll/${shift.id}`, {
      method: 'PUT',
      body: JSON.stringify(shift),
    });
  } else {
    const { id, ...data } = shift;
    await fetchAPI('/accounting/payroll', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
};

export const deleteWorkShift = async (id: string): Promise<void> => {
  await fetchAPI(`/accounting/payroll/${id}`, { method: 'DELETE' });
};

// 3. Purchases
export const getPurchases = async (): Promise<Purchase[]> => {
  return fetchAPI('/accounting/purchases');
};

export const savePurchase = async (purchase: Purchase): Promise<void> => {
  if (purchase.id && !purchase.id.startsWith('id-')) {
    await fetchAPI(`/accounting/purchases/${purchase.id}`, {
      method: 'PUT',
      body: JSON.stringify(purchase),
    });
  } else {
    const { id, ...data } = purchase;
    await fetchAPI('/accounting/purchases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
};

export const deletePurchase = async (id: string): Promise<void> => {
  await fetchAPI(`/accounting/purchases/${id}`, { method: 'DELETE' });
};

// --- Config ---
export const getConfig = async (): Promise<AppConfig> => {
  return fetchAPI('/config');
};

export const updateConfig = async (config: Partial<AppConfig>) => {
  await fetchAPI('/config', {
    method: 'PATCH',
    body: JSON.stringify(config),
  });
};

export const clearHistoricalData = async () => {
  set(STORAGE_KEYS.SESSIONS, []);
  set(STORAGE_KEYS.CREDIT_TRANSACTIONS, []);
  set(STORAGE_KEYS.ACC_PAYROLL, []);
  set(STORAGE_KEYS.ACC_PURCHASES, []);
  updateConfig({ lastExportDate: new Date().toISOString() });
};