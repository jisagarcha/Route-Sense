require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedWarehouses() {
  try {
    console.log('🏢 Seeding warehouses...');
    const warehousesData = [
      {
        name: 'Central Warehouse - Kalanki Hub',
        address: 'Kalanki Ring Road, Kathmandu',
        lat: 27.6934,
        lng: 85.2818,
      },
      {
        name: 'North Depot - Balaju Logistics',
        address: 'Balaju Industrial Area, Kathmandu',
        lat: 27.7291,
        lng: 85.2948,
      },
      {
        name: 'East Fulfillment - Koteshwor',
        address: 'Koteshwor Chowk, Kathmandu',
        lat: 27.6750,
        lng: 85.3450,
      },
      {
        name: 'Patan Distribution Center',
        address: 'Jawalakhel, Lalitpur',
        lat: 27.6662,
        lng: 85.3036,
      },
    ];

    for (const w of warehousesData) {
      const existing = await prisma.warehouse.findFirst({
        where: { name: w.name },
      });
      if (!existing) {
        await prisma.warehouse.create({ data: w });
        console.log(`✅ Created warehouse: ${w.name}`);
      } else {
        await prisma.warehouse.update({
          where: { id: existing.id },
          data: { lat: w.lat, lng: w.lng, address: w.address },
        });
        console.log(`ℹ️ Updated warehouse: ${w.name}`);
      }
    }
    console.log('🎉 Warehouses seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding warehouses:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedWarehouses();
