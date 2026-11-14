require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedPackages() {
  try {
    console.log('📦 Seeding active delivery packages...');

    const dispatcher = await prisma.user.findUnique({
      where: { email: 'dispatcher@gmail.com' },
    });
    const driver = await prisma.user.findUnique({
      where: { email: 'rajesh.driver@delivery.com' },
    });
    const warehouse = await prisma.warehouse.findFirst();
    const products = await prisma.product.findMany({ take: 10 });

    if (!dispatcher || !driver || !warehouse || products.length === 0) {
      console.error('Missing prereqs for package seed.');
      return;
    }

    // Clean old demo packages
    await prisma.package.deleteMany({
      where: { packageName: { in: ['KTM-DEL-101', 'KTM-DEL-102'] } },
    });

    // Package 1: IN_TRANSIT with 3 items/stops
    const pkg1 = await prisma.package.create({
      data: {
        packageName: 'KTM-DEL-101',
        recipientName: 'Aayush Shrestha',
        recipientPhone: '9841234567',
        status: 'IN_TRANSIT',
        priority: 'HIGH',
        totalWeight: 14.5,
        totalVolume: 5.2,
        isCritical: true,
        notes: 'Priority electronics & documents - Thamel & Naxal area',
        dispatcherId: dispatcher.id,
        driverId: driver.id,
        warehouseLat: warehouse.lat,
        warehouseLong: warehouse.lng,
        warehouseAddress: warehouse.name,
        deliveryLat: 27.7172,
        deliveryLong: 85.3120,
        deliveryLng: 85.3120,
        deliveryAddress: 'Thamel Commercial Center, Kathmandu',
        totalDistance: 7.8,
        estimatedDuration: 35,
        routeAlgorithm: '2-opt',
        items: {
          create: [
            {
              productId: products[0].id,
              quantity: 1,
              recipientName: 'Aayush Shrestha',
              recipientPhone: '9841234567',
              deliveryAddress: 'Thamel Commercial Center',
              deliveryLat: 27.7172,
              deliveryLong: 85.3120,
              sequence: 1,
              deliveryStatus: 'COLLECTED_FROM_WAREHOUSE',
            },
            {
              productId: products[1].id,
              quantity: 1,
              recipientName: 'Sunita Maharjan',
              recipientPhone: '9851098765',
              deliveryAddress: 'Lazimpat Embassy Road',
              deliveryLat: 27.7227,
              deliveryLong: 85.3211,
              sequence: 2,
              deliveryStatus: 'PENDING',
            },
            {
              productId: products[2].id,
              quantity: 2,
              recipientName: 'Bikram Thapa',
              recipientPhone: '9801122334',
              deliveryAddress: 'Naxal Bhagawati Chowk',
              deliveryLat: 27.7150,
              deliveryLong: 85.3280,
              sequence: 3,
              deliveryStatus: 'PENDING',
            },
          ],
        },
        delivery: {
          create: {
            status: 'IN_PROGRESS',
            algorithmUsed: '2-opt',
            startedAt: new Date(),
          },
        },
      },
    });

    console.log(`✅ Created Package 1: ${pkg1.packageName}`);

    // Package 2: ASSIGNED with 2 items
    const pkg2 = await prisma.package.create({
      data: {
        packageName: 'KTM-DEL-102',
        recipientName: 'Pooja Karki',
        recipientPhone: '9849988776',
        status: 'ASSIGNED',
        priority: 'NORMAL',
        totalWeight: 8.0,
        totalVolume: 3.5,
        notes: 'Retail products for Pulchowk and Jawalakhel',
        dispatcherId: dispatcher.id,
        driverId: driver.id,
        warehouseLat: warehouse.lat,
        warehouseLong: warehouse.lng,
        warehouseAddress: warehouse.name,
        deliveryLat: 27.6780,
        deliveryLong: 85.3160,
        deliveryLng: 85.3160,
        deliveryAddress: 'Pulchowk Main Road, Lalitpur',
        totalDistance: 9.4,
        estimatedDuration: 42,
        routeAlgorithm: 'nearest-neighbor',
        items: {
          create: [
            {
              productId: products[3].id,
              quantity: 1,
              recipientName: 'Pooja Karki',
              recipientPhone: '9849988776',
              deliveryAddress: 'Pulchowk Main Road',
              deliveryLat: 27.6780,
              deliveryLong: 85.3160,
              sequence: 1,
              deliveryStatus: 'PENDING',
            },
            {
              productId: products[4].id,
              quantity: 3,
              recipientName: 'Roshan Joshi',
              recipientPhone: '9860112233',
              deliveryAddress: 'Jawalakhel Roundabout',
              deliveryLat: 27.6662,
              deliveryLong: 85.3100,
              sequence: 2,
              deliveryStatus: 'PENDING',
            },
          ],
        },
        delivery: {
          create: {
            status: 'PENDING',
            algorithmUsed: 'nearest-neighbor',
          },
        },
      },
    });

    console.log(`✅ Created Package 2: ${pkg2.packageName}`);
    console.log('🎉 Active demo packages seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding demo packages:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedPackages();
