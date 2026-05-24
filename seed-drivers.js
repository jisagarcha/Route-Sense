const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function seedDrivers() {
  try {
    console.log('🚀 Starting driver seeding...\n');

    // Check if drivers already exist
    const existingDrivers = await prisma.user.count({
      where: { role: 'DRIVER' }
    });

    if (existingDrivers >= 10) {
      console.log(`ℹ️  Already have ${existingDrivers} drivers. Skipping...`);
      await prisma.$disconnect();
      return;
    }

    const hashedPassword = await bcrypt.hash('1234', 10);

    // 5 drivers with 4-wheelers
    const fourWheelerDrivers = [
      {
        name: 'Ram Bahadur',
        email: 'ram.driver@delivery.com',
        vehicleType: '4-wheeler',
        maxCapacity: 200,
        maxVolume: 80,
        experienceYears: 8,
        rating: 4.9,
        totalDeliveries: 450
      },
      {
        name: 'Shyam Kumar',
        email: 'shyam.driver@delivery.com',
        vehicleType: '4-wheeler',
        maxCapacity: 180,
        maxVolume: 70,
        experienceYears: 6,
        rating: 4.7,
        totalDeliveries: 380
      },
      {
        name: 'Hari Prasad',
        email: 'hari.driver@delivery.com',
        vehicleType: '4-wheeler',
        maxCapacity: 220,
        maxVolume: 90,
        experienceYears: 10,
        rating: 4.95,
        totalDeliveries: 600
      },
      {
        name: 'Gopal Singh',
        email: 'gopal.driver@delivery.com',
        vehicleType: '4-wheeler',
        maxCapacity: 190,
        maxVolume: 75,
        experienceYears: 5,
        rating: 4.6,
        totalDeliveries: 320
      },
      {
        name: 'Krishna Thapa',
        email: 'krishna.driver@delivery.com',
        vehicleType: '4-wheeler',
        maxCapacity: 210,
        maxVolume: 85,
        experienceYears: 7,
        rating: 4.8,
        totalDeliveries: 410
      }
    ];

    // 5 drivers with 2-wheelers
    const twoWheelerDrivers = [
      {
        name: 'Rajesh Karki',
        email: 'rajesh.driver@delivery.com',
        vehicleType: '2-wheeler',
        maxCapacity: 30,
        maxVolume: 15,
        experienceYears: 3,
        rating: 4.5,
        totalDeliveries: 280
      },
      {
        name: 'Suresh Tamang',
        email: 'suresh.driver@delivery.com',
        vehicleType: '2-wheeler',
        maxCapacity: 25,
        maxVolume: 12,
        experienceYears: 4,
        rating: 4.7,
        totalDeliveries: 350
      },
      {
        name: 'Mahesh Rai',
        email: 'mahesh.driver@delivery.com',
        vehicleType: '2-wheeler',
        maxCapacity: 35,
        maxVolume: 18,
        experienceYears: 5,
        rating: 4.8,
        totalDeliveries: 420
      },
      {
        name: 'Dinesh Gurung',
        email: 'dinesh.driver@delivery.com',
        vehicleType: '2-wheeler',
        maxCapacity: 28,
        maxVolume: 14,
        experienceYears: 2,
        rating: 4.4,
        totalDeliveries: 180
      },
      {
        name: 'Ramesh Limbu',
        email: 'ramesh.driver@delivery.com',
        vehicleType: '2-wheeler',
        maxCapacity: 32,
        maxVolume: 16,
        experienceYears: 6,
        rating: 4.9,
        totalDeliveries: 500
      }
    ];

    const allDrivers = [...fourWheelerDrivers, ...twoWheelerDrivers];

    let created = 0;
    let skipped = 0;

    for (const driverData of allDrivers) {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: driverData.email }
      });

      if (existingUser) {
        console.log(`⏭️  Skipping ${driverData.name} - already exists`);
        skipped++;
        continue;
      }

      // Create user
      const user = await prisma.user.create({
        data: {
          name: driverData.name,
          email: driverData.email,
          password: hashedPassword,
          role: 'DRIVER'
        }
      });

      // Create driver profile
      await prisma.driverProfile.create({
        data: {
          userId: user.id,
          vehicleType: driverData.vehicleType,
          maxCapacity: driverData.maxCapacity,
          maxVolume: driverData.maxVolume,
          experienceYears: driverData.experienceYears,
          rating: driverData.rating,
          totalDeliveries: driverData.totalDeliveries,
          isAvailable: true
        }
      });

      console.log(`✅ Created ${driverData.name} (${driverData.vehicleType})`);
      created++;
    }

    console.log(`\n🎉 Driver seeding complete!`);
    console.log(`   Created: ${created} drivers`);
    console.log(`   Skipped: ${skipped} drivers`);
    console.log(`   Total: ${created + skipped} drivers in database`);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error seeding drivers:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

seedDrivers();
