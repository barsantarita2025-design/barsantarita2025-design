import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const prisma = new PrismaClient();

async function check() {
    try {
        await prisma.user.findMany();
        fs.writeFileSync('prisma_error.txt', 'SUCCESS');
    } catch (e: any) {
        fs.writeFileSync('prisma_error.txt', `ERROR: ${e.message}\nCODE: ${e.code}\nSTACK: ${e.stack}`);
    } finally {
        await prisma.$disconnect();
    }
}

check();
