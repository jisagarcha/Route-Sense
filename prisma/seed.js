const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Load seed data
const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'seeds', 'products.json'), 'utf-8')
);
const locationsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'seeds', 'locations.json'), 'utf-8')
);

const locations = [
  {
    name: 'dhumbarahi',
    latitude: 27.735138950517738,
    longitude: 85.36292057359928,
    description: 'delivery location'
  },
  {
    name: 'kalanki',
    latitude: 27.693351872948167,
    longitude: 85.28179785603616,
    description: 'delivery location'
  },
  {
    name: 'gongabu',
    latitude: 27.733335738032666,
    longitude: 85.30837522315716,
    description: 'delivery location'
  },
  {
    name: 'balaju',
    latitude: 27.72911243604947,
    longitude: 85.29483611976752,
    description: 'delivery location'
  },
  {
    name: 'lajimpat',
    latitude: 27.722718411505298,
    longitude: 85.32109682040095,
    description: 'delivery location'
  },
  {
    name: 'jhamsikhel',
    latitude: 27.685937805691114,
    longitude: 85.30361685020991,
    description: 'delivery location'
  },
  {
    name: 'ekantakuna',
    latitude: 27.666155857163805,
    longitude: 85.30818277987929,
    description: 'delivery location'
  },
  {
    name: 'jorpati',
    latitude: 27.721918341590559,
    longitude: 85.37275124124872,
    description: 'delivery location'
  }
];

async function seed() {
  console.log('Starting database seed...');
  
  try {
    // Delete all existing locations first (optional)
    console.log('Clearing existing locations...');
    await prisma.location.deleteMany({});
    
    // Insert new locations
    console.log('Inserting new locations...');
    for (const location of locations) {
      const created = await prisma.location.create({
        data: location
      });
      console.log(`✅ Created: ${created.name} (ID: ${created.id})`);
    }
    
    // Seed additional Kathmandu locations
    console.log('\n📍 Seeding additional Kathmandu Valley locations...');
    for (const loc of locationsData) {
      const existing = await prisma.location.findUnique({
        where: { name: loc.name }
      });
      
      if (!existing) {
        await prisma.location.create({
          data: loc
        });
        console.log(`✅ Created location: ${loc.name}`);
      }
    }

    // Seed Products with delivery locations
    console.log('\n📦 Seeding product catalog...');
    for (const product of products) {
      const existing = await prisma.product.findFirst({
        where: { name: product.name }
      });
      
      if (!existing) {
        // Extract location data
        const productData = {
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          weight: product.weight,
          size: product.size,
          volumeCubicFt: product.volumeCubicFt,
          category: product.category,
          isCritical: product.isCritical,
          // Add delivery location if provided
          ...(product.location && {
            deliveryLat: product.location.lat,
            deliveryLong: product.location.long,
          }),
        };

        await prisma.product.create({
          data: productData
        });
        console.log(`✅ Created product: ${product.name} ${product.location ? `(${product.location.lat}, ${product.location.long})` : ''}`);
      }
    }

    // Create sample driver profiles (if drivers exist)
    console.log('\n🚗 Creating sample driver profiles...');
    const drivers = await prisma.user.findMany({
      where: { role: 'DRIVER' }
    });

    const sampleDriverProfiles = [
      {
        vehicleType: '2-wheeler',
        maxCapacity: 50,
        maxVolume: 20,
        experienceYears: 5,
        rating: 4.8,
        totalDeliveries: 245
      },
      {
        vehicleType: '4-wheeler',
        maxCapacity: 200,
        maxVolume: 100,
        experienceYears: 3,
        rating: 4.6,
        totalDeliveries: 156
      },
      {
        vehicleType: '2-wheeler',
        maxCapacity: 40,
        maxVolume: 15,
        experienceYears: 2,
        rating: 4.9,
        totalDeliveries: 178
      }
    ];

    for (let i = 0; i < Math.min(drivers.length, sampleDriverProfiles.length); i++) {
      const existing = await prisma.driverProfile.findUnique({
        where: { userId: drivers[i].id }
      });

      if (!existing) {
        await prisma.driverProfile.create({
          data: {
            userId: drivers[i].id,
            ...sampleDriverProfiles[i]
          }
        });
        console.log(`✅ Created driver profile for: ${drivers[i].name || drivers[i].email}`);
      }
    }

    console.log('\n✨ Database seeding completed successfully!');
    console.log(`Total locations added: ${locations.length + locationsData.length}`);
    console.log(`Total products added: ${products.length}`);
    console.log(`Total driver profiles created: ${Math.min(drivers.length, sampleDriverProfiles.length)}`);
    
    // Display statistics
    const allLocations = await prisma.location.findMany({
      orderBy: { name: 'asc' }
    });
    
    const allProducts = await prisma.product.findMany();
    const allDriverProfiles = await prisma.driverProfile.findMany();
    
    console.log('\n📊 Database Statistics:');
    console.log(`- Locations: ${allLocations.length}`);
    console.log(`- Products: ${allProducts.length}`);
    console.log(`- Driver Profiles: ${allDriverProfiles.length}`);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
