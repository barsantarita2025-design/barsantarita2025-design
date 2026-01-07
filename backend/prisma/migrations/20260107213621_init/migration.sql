-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EMPLOYEE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salePrice" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "image" TEXT,
    "quickSale" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "stock" INTEGER,
    "barcode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftSession" (
    "id" TEXT NOT NULL,
    "openedBy" TEXT NOT NULL,
    "closedBy" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "initialInventory" JSONB NOT NULL,
    "finalInventory" JSONB,
    "salesReport" JSONB,
    "closingObservation" TEXT,
    "realCash" DOUBLE PRECISION,
    "auditLog" JSONB,

    CONSTRAINT "ShiftSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCustomer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentId" TEXT,
    "phone" TEXT,
    "maxLimit" DOUBLE PRECISION NOT NULL,
    "currentUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observations" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "observation" TEXT NOT NULL,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedExpense" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDay" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "FixedExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkShift" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "hoursWorked" DOUBLE PRECISION NOT NULL,
    "hourlyRate" DOUBLE PRECISION NOT NULL,
    "surcharges" DOUBLE PRECISION NOT NULL,
    "totalPay" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "WorkShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "observations" TEXT,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "POSSale" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL,
    "tip" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "cashReceived" DOUBLE PRECISION,
    "change" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "drawerOpened" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "POSSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "POSSaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "costPrice" DOUBLE PRECISION,

    CONSTRAINT "POSSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "POSPayment" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "POSPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawerLog" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CLOSED',
    "userId" TEXT,
    "userName" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "isAuthorized" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "saleId" TEXT,

    CONSTRAINT "DrawerLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawerAlert" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "DrawerAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "barName" TEXT NOT NULL DEFAULT 'Bar Flow',
    "lastExportDate" TEXT NOT NULL,
    "cashDrawerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cashDrawerPort" TEXT NOT NULL DEFAULT 'COM1',

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "ShiftSession" ADD CONSTRAINT "ShiftSession_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSession" ADD CONSTRAINT "ShiftSession_openedBy_fkey" FOREIGN KEY ("openedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CreditCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkShift" ADD CONSTRAINT "WorkShift_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POSSaleItem" ADD CONSTRAINT "POSSaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POSSaleItem" ADD CONSTRAINT "POSSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "POSSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POSPayment" ADD CONSTRAINT "POSPayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "POSSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawerLog" ADD CONSTRAINT "DrawerLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawerAlert" ADD CONSTRAINT "DrawerAlert_acknowledgedBy_fkey" FOREIGN KEY ("acknowledgedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawerAlert" ADD CONSTRAINT "DrawerAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
