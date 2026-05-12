import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// --- Prisma Singleton para Serverless ---
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['error', 'warn'],
});
// Re-use connection in serverless warm starts
globalForPrisma.prisma = prisma;

const PORT = process.env.PORT || 3001;

// Exportar app para serverless
export { app, prisma };

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Utility to parse body in serverless environments where it might arrive as Buffer
const parseBody = (body: any) => {
  if (!body) return {};
  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString('utf8'));
    } catch (e) {
      console.error('Error parsing Buffer body:', e);
      return {};
    }
  }
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (e) {
      console.error('Error parsing string body:', e);
      return {};
    }
  }
  return body;
};

// --- Health Check ---
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'BarFlow API is running. use /api/... for endpoints' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'BarFlow API is running' });
});

// --- Users ---
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching users' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const data = parseBody(req.body);
    const user = await prisma.user.create({ data });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error creating user' });
  }
});

// --- Products ---
app.get('/api/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { displayOrder: 'asc' }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching products' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const body = parseBody(req.body);
    console.log('POST /api/products - Parsed Body:', JSON.stringify(body));

    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({ error: 'Body is empty or invalid' });
    }

    const product = await prisma.product.create({ data: body });
    console.log('Product created successfully:', product.id);
    res.json(product);
  } catch (error) {
    console.error('CRITICAL ERROR in POST /api/products:', error);
    res.status(500).json({
      error: 'Error creating product',
      details: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV !== 'production' ? (error instanceof Error ? error.stack : undefined) : undefined
    });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const data = parseBody(req.body);
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data
    });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Error updating product' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting product' });
  }
});

// --- Sessions (Inventory) ---
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await prisma.shiftSession.findMany({
      orderBy: { openedAt: 'desc' }
    });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching sessions' });
  }
});

app.get('/api/sessions/active', async (req, res) => {
  try {
    const session = await prisma.shiftSession.findFirst({
      where: { status: 'OPEN' }
    });
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching active session' });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const data = parseBody(req.body);
    const session = await prisma.shiftSession.create({
      data: {
        ...data,
        status: 'OPEN',
        openedAt: new Date()
      }
    });
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: 'Error starting session' });
  }
});

app.post('/api/sessions/:id/close', async (req, res) => {
  try {
    const data = parseBody(req.body);
    const session = await prisma.shiftSession.update({
      where: { id: req.params.id },
      data: {
        ...data,
        status: 'CLOSED',
        closedAt: new Date()
      }
    });
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: 'Error closing session' });
  }
});

app.patch('/api/sessions/:id', async (req, res) => {
  try {
    const data = parseBody(req.body);
    const session = await prisma.shiftSession.update({
      where: { id: req.params.id },
      data
    });
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: 'Error updating session' });
  }
});

// --- Credit / Fiao System ---
app.get('/api/credit/customers', async (req, res) => {
  try {
    const customers = await prisma.creditCustomer.findMany();
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching credit customers' });
  }
});

app.post('/api/credit/customers', async (req, res) => {
  try {
    const data = parseBody(req.body);
    const customer = await prisma.creditCustomer.create({ data });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Error creating credit customer' });
  }
});

app.get('/api/credit/customers/:id/history', async (req, res) => {
  try {
    const history = await prisma.creditTransaction.findMany({
      where: { customerId: req.params.id },
      orderBy: { date: 'desc' }
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching customer history' });
  }
});

app.post('/api/credit/customers/:id/transactions', async (req, res) => {
  try {
    const body = parseBody(req.body);
    const { amount, type, shiftSessionId, originalShiftSessionId, ...data } = body;
    const transaction = await prisma.$transaction(async (tx) => {
      const t = await tx.creditTransaction.create({
        data: {
          ...data,
          amount,
          type,
          shiftSessionId: shiftSessionId || null,
          originalShiftSessionId: originalShiftSessionId || null,
          customerId: req.params.id,
          date: new Date()
        }
      });

      // Update customer balance
      const balanceChange = type === 'DEBT' ? amount : -amount;
      await tx.creditCustomer.update({
        where: { id: req.params.id },
        data: { currentUsed: { increment: balanceChange } }
      });

      return t;
    });
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: 'Error registering transaction' });
  }
});

// --- Credit Transactions Range (for shift closing) ---
app.get('/api/credit/transactions/range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    
    const transactions = await prisma.creditTransaction.findMany({
      where: {
        date: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string)
        }
      },
      orderBy: { date: 'asc' }
    });
    
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching credit transactions by range:', error);
    res.status(500).json({ error: 'Error fetching credit transactions' });
  }
});

// --- Accounting ---
app.get('/api/accounting/expenses', async (req, res) => {
  try {
    const expenses = await prisma.fixedExpense.findMany();
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching expenses' });
  }
});

app.post('/api/accounting/expenses', async (req, res) => {
  try {
    const data = parseBody(req.body);
    const expense = await prisma.fixedExpense.create({ data });
    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: 'Error creating expense' });
  }
});

app.get('/api/accounting/payroll', async (req, res) => {
  try {
    const payroll = await prisma.workShift.findMany();
    res.json(payroll);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching payroll' });
  }
});

app.post('/api/accounting/payroll', async (req, res) => {
  try {
    const data = parseBody(req.body);
    // Remove id and potential relation objects
    const { id, employee, ...cleanData } = data;
    const shift = await prisma.workShift.create({
      data: {
        ...cleanData,
        date: new Date(cleanData.date),
        hoursWorked: Number(cleanData.hoursWorked),
        hourlyRate: Number(cleanData.hourlyRate),
        surcharges: Number(cleanData.surcharges),
        totalPay: Number(cleanData.totalPay),
        status: cleanData.status || 'PENDING'
      }
    });
    res.json(shift);
  } catch (error) {
    console.error('Error creating work shift:', error);
    res.status(500).json({ error: 'Error creating work shift' });
  }
});

app.put('/api/accounting/payroll/:id', async (req, res) => {
  try {
    const data = parseBody(req.body);
    const { id, employee, ...updateData } = data;

    let finalData = { ...updateData };

    if (updateData.status === 'APPROVED') {
      // 1. Get current shift and config
      const [currentShift, config] = await Promise.all([
        prisma.workShift.findUnique({ where: { id: req.params.id } }),
        prisma.payrollConfig.findFirst()
      ]);

      if (currentShift && config) {
        const date = new Date(currentShift.date);
        const day = date.getUTCDay(); // 0: Sunday, 6: Saturday
        const isWeekend = day === 0 || day === 6;
        const baseRate = isWeekend ? config.weekendRate : config.weekdayRate;

        // Parse times
        const [startH, startM] = currentShift.startTime.split(':').map(Number);
        const [endH, endM] = currentShift.endTime.split(':').map(Number);
        const startInMinutes = startH * 60 + startM;
        let endInMinutes = endH * 60 + endM;

        let normalMinutes = 0;
        let overnightMinutes = 0;

        if (endInMinutes < startInMinutes) {
          // Crosses midnight (e.g., 22:00 to 02:00)
          normalMinutes = 1440 - startInMinutes; // Minutes until midnight
          overnightMinutes = endInMinutes;      // Minutes after midnight
        } else {
          // Same day (e.g., 18:00 to 23:00 OR 01:00 to 05:00)
          // If the shift is entirely after midnight (before 6am)
          if (startInMinutes < 360) {
            overnightMinutes = endInMinutes - startInMinutes;
          } else {
            normalMinutes = endInMinutes - startInMinutes;
          }
        }

        const calculatedTotal = (normalMinutes / 60) * baseRate + (overnightMinutes / 60) * config.overnightRate;
        const totalWithSurcharges = calculatedTotal + (Number(updateData.surcharges) || 0);

        finalData.hourlyRate = baseRate;
        finalData.totalPay = Math.round(totalWithSurcharges);
      }
    }

    const shift = await prisma.workShift.update({
      where: { id: req.params.id },
      data: {
        ...finalData,
        date: new Date(finalData.date)
      }
    });
    res.json(shift);
  } catch (error) {
    console.error('Error updating work shift:', error);
    res.status(500).json({ error: 'Error updating work shift' });
  }
});

app.delete('/api/accounting/payroll/:id', async (req, res) => {
  try {
    await prisma.workShift.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting work shift:', error);
    res.status(500).json({ error: 'Error deleting work shift' });
  }
});

app.get('/api/accounting/purchases', async (req, res) => {
  try {
    const purchases = await prisma.purchase.findMany({
      orderBy: { date: 'desc' }
    });
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching purchases' });
  }
});

app.post('/api/accounting/purchases', async (req, res) => {
  try {
    const data = parseBody(req.body);
    const { id, ...cleanData } = data;
    const purchase = await prisma.purchase.create({
      data: {
        ...cleanData,
        date: new Date(cleanData.date),
        quantity: Number(cleanData.quantity),
        unitCost: Number(cleanData.unitCost),
        totalCost: Number(cleanData.totalCost)
      }
    });
    res.json(purchase);
  } catch (error) {
    console.error('Error creating purchase:', error);
    res.status(500).json({ error: 'Error creating purchase' });
  }
});

app.put('/api/accounting/purchases/:id', async (req, res) => {
  try {
    const data = parseBody(req.body);
    const { id, ...updateData } = data;
    const purchase = await prisma.purchase.update({
      where: { id: req.params.id },
      data: {
        ...updateData,
        date: new Date(updateData.date)
      }
    });
    res.json(purchase);
  } catch (error) {
    console.error('Error updating purchase:', error);
    res.status(500).json({ error: 'Error updating purchase' });
  }
});

app.delete('/api/accounting/purchases/:id', async (req, res) => {
  try {
    await prisma.purchase.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting purchase:', error);
    res.status(500).json({ error: 'Error deleting purchase' });
  }
});

// --- Payroll Config ---
app.get('/api/payroll-config', async (req, res) => {
  try {
    const payrollConfig = (prisma as any).payrollConfig;
    if (!payrollConfig) {
      console.warn('PayrollConfig model not available in Prisma client yet.');
      return res.json({ weekdayRate: 0, weekendRate: 0, overnightRate: 0, updatedBy: 'System' });
    }

    let config = await payrollConfig.findFirst();
    if (!config) {
      return res.json({
        weekdayRate: 0,
        weekendRate: 0,
        overnightRate: 0,
        updatedBy: 'System'
      });
    }
    res.json(config);
  } catch (error) {
    console.error('Error fetching payroll config:', error);
    // If the table doesn't exist yet, don't crash
    res.json({
      weekdayRate: 0,
      weekendRate: 0,
      overnightRate: 0,
      updatedBy: 'System'
    });
  }
});

app.post('/api/payroll-config', async (req, res) => {
  try {
    const payrollConfig = (prisma as any).payrollConfig;
    if (!payrollConfig) {
      return res.status(500).json({ error: 'PayrollConfig model not available in Prisma client' });
    }

    const data = parseBody(req.body);
    const { weekdayRate, weekendRate, overnightRate, updatedBy } = data;
    
    const config = await payrollConfig.upsert({
      where: { id: 'default-config' },
      update: {
        weekdayRate: Number(weekdayRate),
        weekendRate: Number(weekendRate),
        overnightRate: Number(overnightRate),
        updatedBy,
        updatedAt: new Date()
      },
      create: {
        id: 'default-config',
        weekdayRate: Number(weekdayRate),
        weekendRate: Number(weekendRate),
        overnightRate: Number(overnightRate),
        updatedBy
      }
    });
    res.json(config);
  } catch (error) {
    console.error('Error saving payroll config:', error);
    res.status(500).json({ error: 'Error saving payroll config' });
  }
});

// --- Financial Movements (Audit System) ---
app.get('/api/financial-movements/pending-count', async (req, res) => {
  try {
    const count = await (prisma as any).financialMovement.count({
      where: { status: 'PENDING' }
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching pending count' });
  }
});

app.get('/api/financial-movements/pending', async (req, res) => {
  try {
    const movements = await (prisma as any).financialMovement.findMany({
      where: { status: 'PENDING' },
      orderBy: { date: 'desc' },
      include: { employee: true }
    });
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching pending movements' });
  }
});

app.get('/api/financial-movements', async (req, res) => {
  try {
    const movements = await (prisma as any).financialMovement.findMany({
      orderBy: { date: 'desc' },
      include: { employee: true }
    });
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching all movements' });
  }
});

app.get('/api/financial-movements/session/:sessionId', async (req, res) => {
  try {
    const movements = await (prisma as any).financialMovement.findMany({
      where: { 
        sessionId: req.params.sessionId
      }
    });
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching session movements' });
  }
});

app.post('/api/financial-movements', async (req, res) => {
  try {
    const data = parseBody(req.body);
    const movement = await (prisma as any).financialMovement.create({
      data: {
        ...data,
        date: new Date(data.date || new Date()),
        status: 'PENDING'
      }
    });
    res.json(movement);
  } catch (error) {
    console.error('Error creating financial movement:', error);
    res.status(500).json({ error: 'Error creating financial movement' });
  }
});

app.patch('/api/financial-movements/:id/status', async (req, res) => {
  try {
    const { status, approvedById, rejectionReason } = parseBody(req.body);
    const movement = await (prisma as any).financialMovement.update({
      where: { id: req.params.id },
      data: {
        status,
        approvedById,
        rejectionReason,
        approvedAt: status === 'APPROVED' ? new Date() : null
      }
    });
    res.json(movement);
  } catch (error) {
    res.status(500).json({ error: 'Error updating movement status' });
  }
});

app.patch('/api/financial-movements/:id/request-correction', async (req, res) => {
  try {
    const { correctionRequestedAmount, correctionReason } = parseBody(req.body);
    const current = await (prisma as any).financialMovement.findUnique({
      where: { id: req.params.id }
    });
    
    if (!current) {
      return res.status(404).json({ error: 'Movement not found' });
    }

    const movement = await (prisma as any).financialMovement.update({
      where: { id: req.params.id },
      data: {
        originalAmount: current.amount,
        correctionRequestedAmount,
        correctionReason,
        correctionStatus: 'PENDING',
        correctionRequestedAt: new Date()
      }
    });
    res.json(movement);
  } catch (error) {
    console.error('Error requesting correction:', error);
    res.status(500).json({ error: 'Error requesting correction' });
  }
});

app.patch('/api/financial-movements/:id/approve-correction', async (req, res) => {
  try {
    const { status, approvedById } = parseBody(req.body);
    const current = await (prisma as any).financialMovement.findUnique({
      where: { id: req.params.id }
    });

    if (!current) {
      return res.status(404).json({ error: 'Movement not found' });
    }

    const updateData: any = {
      correctionStatus: status,
      correctionApprovedById: approvedById
    };

    if (status === 'APPROVED') {
      updateData.amount = current.correctionRequestedAmount;
    }

    const movement = await (prisma as any).financialMovement.update({
      where: { id: req.params.id },
      data: updateData
    });
    res.json(movement);
  } catch (error) {
    console.error('Error approving correction:', error);
    res.status(500).json({ error: 'Error approving correction' });
  }
});

// --- Config ---
app.get('/api/config', async (req, res) => {
  try {
    console.log('Fetching AppConfig...');
    let config = await prisma.appConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      console.log('Default config not found, creating...');
      try {
        config = await prisma.appConfig.create({
          data: {
            id: 'default',
            barName: 'Bar Flow',
            lastExportDate: new Date().toISOString(),
            cashDrawerEnabled: false,
            cashDrawerPort: 'COM1'
          }
        });
        console.log('Config created successfully:', config);
      } catch (createError) {
        console.error('Error creating config:', createError);
        // If creation fails, return a default config without saving
        return res.json({
          id: 'default',
          barName: 'Bar Flow',
          lastExportDate: new Date().toISOString(),
          cashDrawerEnabled: false,
          cashDrawerPort: 'COM1',
          inventoryBase: null
        });
      }
    }
    res.json(config);
  } catch (error) {
    console.error('CRITICAL ERROR fetching config:', error);
    // Return a default config instead of 500 error to prevent blank screen
    res.json({
      id: 'default',
      barName: 'Bar Flow',
      lastExportDate: new Date().toISOString(),
      cashDrawerEnabled: false,
      cashDrawerPort: 'COM1',
      inventoryBase: null
    });
  }
});

app.patch('/api/config', async (req, res) => {
  // Removes undefined, converts NaN/Infinity to null, and normalizes empty strings
  const sanitizeForJson = (value: any): any => {
    if (value === undefined) return null;
    if (value === '') return null;

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null; // handles NaN/Infinity
    }

    if (typeof value === 'string') {
      // If it's a numeric string like "12" or "12.5", convert to number
      const trimmed = value.trim();
      if (trimmed !== '' && /^-?\d+(\.\d+)?$/.test(trimmed)) {
        const n = Number(trimmed);
        return Number.isFinite(n) ? n : null;
      }
      return value;
    }

    if (Array.isArray(value)) return value.map(sanitizeForJson);

    if (value && typeof value === 'object') {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = sanitizeForJson(v);
      }
      return out;
    }

    return value;
  };

  try {
    const raw = parseBody(req.body);

    if (!raw || Object.keys(raw).length === 0) {
      return res.status(400).json({ error: 'Body is empty or invalid' });
    }

    // Only allow known fields to avoid accidentally sending bad/extra keys
    const data: any = {};
    if (raw.barName !== undefined) data.barName = raw.barName;
    if (raw.lastExportDate !== undefined) data.lastExportDate = raw.lastExportDate;
    if (raw.cashDrawerEnabled !== undefined) data.cashDrawerEnabled = raw.cashDrawerEnabled;
    if (raw.cashDrawerPort !== undefined) data.cashDrawerPort = raw.cashDrawerPort;

    if (raw.inventoryBase !== undefined) {
      if (raw.inventoryBase && typeof raw.inventoryBase === 'object') {
        const sanitizedInventoryBase: Record<string, any> = {};
        for (const [key, value] of Object.entries(raw.inventoryBase)) {
          if (value === undefined || value === '') {
            sanitizedInventoryBase[key] = null;
          } else if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed === '') {
              sanitizedInventoryBase[key] = null;
            } else if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
              const n = Number(trimmed);
              sanitizedInventoryBase[key] = Number.isFinite(n) ? n : null;
            } else {
              sanitizedInventoryBase[key] = value;
            }
          } else if (typeof value === 'number') {
            sanitizedInventoryBase[key] = Number.isFinite(value) ? value : null;
          } else {
            sanitizedInventoryBase[key] = value;
          }
        }
        data.inventoryBase = sanitizedInventoryBase;
      } else {
        data.inventoryBase = sanitizeForJson(raw.inventoryBase);
      }
    }

    console.log('PATCH /api/config - sanitized data:', JSON.stringify(data));

    const config = await prisma.appConfig.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        barName: 'Bar Flow',
        lastExportDate: new Date().toISOString(),
        cashDrawerEnabled: false,
        cashDrawerPort: 'COM1',
        ...data
      },
      update: data
    });

    res.json(config);
  } catch (error) {
    console.error('CRITICAL ERROR updating config:', error);
    res.status(500).json({
      error: 'Error updating config',
      details: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV !== 'production'
        ? (error instanceof Error ? error.stack : undefined)
        : undefined
    });
  }
});

// --- POS Sales ---
app.get('/api/pos/sales', async (req, res) => {
  const { date } = req.query;
  try {
    const sales = await prisma.pOSSale.findMany({
      where: date ? {
        createdAt: {
          gte: new Date(`${date}T00:00:00Z`),
          lt: new Date(`${date}T23:59:59Z`)
        }
      } : {},
      include: { items: true, payments: true }
    });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching sales' });
  }
});

app.post('/api/pos/sales', async (req, res) => {
  try {
    const body = parseBody(req.body);
    const { items, payments, ...saleData } = body;
    const sale = await prisma.pOSSale.create({
      data: {
        ...saleData,
        items: { create: items },
        payments: { create: payments }
      },
      include: { items: true, payments: true }
    });
    res.json(sale);
  } catch (error) {
    res.status(500).json({ error: 'Error creating sale' });
  }
});

// --- Global Error Handler ---
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('UNHANDLED ERROR:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });
});

// --- Start Server (Solo en desarrollo local) ---
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

export default app;