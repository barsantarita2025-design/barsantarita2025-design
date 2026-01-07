import { Product, User } from './types';

export const STORAGE_KEYS = {
  USERS: 'barflow_users',
  PRODUCTS: 'barflow_products',
  SESSIONS: 'barflow_sessions',
  CONFIG: 'barflow_config',
  CURRENT_SESSION: 'barflow_current_session',
  AUTH_USER: 'barflow_auth_user',
  CREDIT_CUSTOMERS: 'barflow_credit_customers',
  CREDIT_TRANSACTIONS: 'barflow_credit_transactions',
  POS_SALES: 'barflow_pos_sales',
  // Accounting Keys
  ACC_EXPENSES: 'barflow_acc_expenses',
  ACC_PAYROLL: 'barflow_acc_payroll',
  ACC_PURCHASES: 'barflow_acc_purchases'
};

// Initial Seed Data if local storage is empty
export const DEFAULT_ADMIN: User = {
  id: 'admin-1',
  username: 'admin',
  name: 'Administrador Principal',
  role: 'ADMIN',
  password: '123'
};

export const DEFAULT_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Cerveza Nacional', category: 'Cervezas', costPrice: 2000, salePrice: 5000, active: true },
  { id: 'p2', name: 'Cerveza Importada', category: 'Cervezas', costPrice: 4000, salePrice: 12000, active: true },
  { id: 'p3', name: 'Ron Añejo (Trago)', category: 'Licores', costPrice: 3000, salePrice: 15000, active: true },
  { id: 'p4', name: 'Aguardiente (Media)', category: 'Licores', costPrice: 25000, salePrice: 60000, active: true },
  { id: 'p5', name: 'Agua', category: 'Sin Alcohol', costPrice: 1000, salePrice: 3000, active: true }
];

export const DEFAULT_CATEGORIES = ['Cervezas', 'Licores', 'Bebidas', 'Sin Alcohol', 'Comida', 'Otros'];