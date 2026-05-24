const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function seedDrivers() {
  try {
    console.log('🚀 Starting driver seeding...');

    // Driver data with profiles
    const drivers = [
      // 4-wheeler drivers
      {
        name: 'Rajesh Kumar',
        email: 'rajesh.driver@delivery.com',
        password: '1234',
        profile: {
          vehicleType: '4-wheeler',
          maxCapacity: 200,
          maxVolume: 60,
          experienceYears: 8,
          rating: 4.9,
          totalDeliveries: 450,
          isAvailable: true
        }
      },
      {
        name: 'Sita Sharma',
        email: 'sita.driver@delivery.com',
        password: '1234',
        profile: {
          vehicleType: '4-wheeler',
          maxCapacity: 180,
          maxVolume: 55,
          experienceYears: 6,
          rating: 4.7,
          totalDeliveries: 320,
          isAvailable: true
        }
      },
      {
        name: 'Ram Thapa',
        email: 'ram.driver@delivery.com',
        password: '1234',
        profile: {
          vehicleType: '4-wheeler',
          maxCapacity: 220,
          maxVolume: 65,
          experienceYears: 10,
          rating: 4.95,
          totalDeliveries: 580,
          isAvailable: true
        }
      },
      {
        name: 'Maya Gurung',
        email: 'maya.driver@delivery.com',
        password: '1234',
        profile: {
          vehicleType: '4-wheeler',
          maxCapacity: 190,
          maxVolume: 58,
          experienceYears: 5,
          rating: 4.6,
          totalDeliveries: 280,
          isAvailable: false
        }
      },
      {
        name: 'Krishna Rai',
        email: 'krishna.driver@delivery.com',
        password: '1234',
        profile: {
          vehicleType: '4-wheeler',
          maxCapacity: 210,
          maxVolume: 62,
          experienceYears: 7,
          rating: 4.8,
          totalDeliveries: 410,
          isAvailable: true
        }
      },
      // 2-wheeler drivers
      {
        name: 'Bikash Shrestha',
        email: 'bikash.driver@delivery.com',
        password: '1234',
        profile: {
          vehicleType: '2-wheeler',
          maxCapacity: 50,
          maxVolume: 20,
          experienceYears: 4,
          rating: 4.7,
          totalDeliveries: 380,
          isAvailable: true
        }
      },
      {
        name: 'Anjali Tamang',
        email: 'anjali.driver@delivery.com',
        password: '1234',
        profile: {
          vehicleType: '2-wheeler',
          maxCapacity: 45,
          maxVolume: 18,
          experienceYears: 3,
          rating: 4.5,
          totalDeliveries: 250,
          isAvailable: true
        }
      },
      {
        name: 'Sunil Magar',
        email: 'sunil.driver@delivery.com',
        password: '1234',
        profile: {
          vehicleType: '2-wheeler',
          maxCapacity: 55,
          maxVolume: 22,
          experienceYears: 5,
          rating: 4.8,
          totalDeliveries: 420,
          isAvailable: true
        }
      },
      {
        name: 'Pooja Rana',
        email: 'pooja.driver@delivery.com',
        password: '1234',
        profile: {
          vehicleType: '2-wheeler',
          maxCapacity: 48,
          maxVolume: 19,
          experienceYears: 2,
          rating: 4.4,
          totalDeliveries: 180,
          isAvailable: false
        }
      },
      {
        name: 'Anil Lama',
        email: 'anil.driver@delivery.com',
        password: '1234',
        profile: {
          vehicleType: '2-wheeler',
          maxCapacity: 52,
          maxVolume: 21,
          experienceYears: 6,
          rating: 4.9,
          totalDeliveries: 490,
          isAvailable: true
        }
      }
    ];

    let created = 0;
    let skipped = 0;

    for (const driver of drivers) {
      // Check if driver already exists
      const existing = await prisma.user.findUnique({
        where: { email: driver.email }
      });

      if (existing) {
        console.log(`⏭️  Skipping ${driver.name} - already exists`);
        skipped++;
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(driver.password, 10);

      // Create driver user with profile
      await prisma.user.create({
        data: {
          name: driver.name,
          email: driver.email,
          password: hashedPassword,
          role: 'DRIVER',
          driverProfile: {
            create: driver.profile
          }
        }
      });

      console.log(`✅ Created ${driver.name} (${driver.profile.vehicleType})`);
      created++;
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Created: ${created} drivers`);
    console.log(`   ⏭️  Skipped: ${skipped} drivers (already exist)`);
    console.log('\n🎉 Driver seeding completed!');
    
    // Show summary by vehicle type
    const allDrivers = await prisma.user.findMany({
      where: { role: 'DRIVER' },
      include: { driverProfile: true }
    });

    const fourWheelers = allDrivers.filter(d => d.driverProfile?.vehicleType === '4-wheeler').length;
    const twoWheelers = allDrivers.filter(d => d.driverProfile?.vehicleType === '2-wheeler').length;
    const withoutProfile = allDrivers.filter(d => !d.driverProfile).length;

    console.log('\n📈 Database Status:');
    console.log(`   🚗 4-wheeler drivers: ${fourWheelers}`);
    console.log(`   🏍️  2-wheeler drivers: ${twoWheelers}`);
    console.log(`   ⚠️  Without profile: ${withoutProfile}`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error seeding drivers:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

seedDrivers();
