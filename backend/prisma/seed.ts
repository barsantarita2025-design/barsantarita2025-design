import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    // Create default admin
    const admin = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            name: 'Administrador',
            password: 'admin', // En producción esto debería estar hasheado
            role: 'ADMIN',
        },
    });

    console.log({ admin });

    // Create some default products if needed
    const products = [
        { name: 'Cerveza Nacional', category: 'Bebidas', costPrice: 3000, salePrice: 5000 },
        { name: 'Cerveza Importada', category: 'Bebidas', costPrice: 5000, salePrice: 8000 },
        { name: 'Gaseosa', category: 'Bebidas', costPrice: 1500, salePrice: 2500 },
    ];

    for (const p of products) {
        await prisma.product.create({ data: p });
    }

    console.log('Seed completed successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
