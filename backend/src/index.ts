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
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

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
    const { amount, type, ...data } = body;
    const transaction = await prisma.$transaction(async (tx) => {
      const t = await tx.creditTransaction.create({
        data: {
          ...data,
          amount,
          type,
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

app.get('/api/accounting/purchases', async (req, res) => {
  try {
    const purchases = await prisma.purchase.findMany();
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching purchases' });
  }
});

// --- Config ---
app.get('/api/config', async (req, res) => {
  try {
    let config = await prisma.appConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      config = await prisma.appConfig.create({
        data: { id: 'default', barName: 'Bar Flow', lastExportDate: new Date().toISOString() }
      });
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching config' });
  }
});

app.patch('/api/config', async (req, res) => {
  try {
    const data = parseBody(req.body);
    const config = await prisma.appConfig.update({
      where: { id: 'default' },
      data
    });
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Error updating config' });
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
