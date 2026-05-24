const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Haversine formula to calculate distance in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return parseFloat(d.toFixed(2));
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

// Define the connections we want to build
const roadConnections = [
  // Thamel area
  { from: 'Thamel', to: 'Lazimpat' },
  { from: 'Thamel', to: 'Asan' },
  { from: 'Thamel', to: 'Durbar Marg' },
  { from: 'Thamel', to: 'Naxal' },

  // Lazimpat area
  { from: 'Lazimpat', to: 'Maharajgunj' },
  { from: 'Lazimpat', to: 'Durbar Marg' },
  { from: 'Lazimpat', to: 'lajimpat' }, // handling casing differences if both exist

  // Durbar Marg / Naxal
  { from: 'Durbar Marg', to: 'Asan' },
  { from: 'Durbar Marg', to: 'New Road' },
  { from: 'Durbar Marg', to: 'Putalisadak' },
  { from: 'Durbar Marg', to: 'Naxal' },
  
  // Asan & Basantapur
  { from: 'Asan', to: 'Basantapur' },
  { from: 'Asan', to: 'New Road' },
  { from: 'Basantapur', to: 'New Road' },
  { from: 'Basantapur', to: 'Kalimati' },
  { from: 'Basantapur', to: 'Tripureshwor' },

  // New Road / Putalisadak
  { from: 'New Road', to: 'Putalisadak' },
  { from: 'New Road', to: 'Tripureshwor' },
  { from: 'Putalisadak', to: 'Dillibazar' },
  { from: 'Putalisadak', to: 'Tripureshwor' },
  { from: 'Putalisadak', to: 'Naxal' },

  // Naxal / Chabahil / Gaushala
  { from: 'Naxal', to: 'Chabahil' },
  { from: 'Naxal', to: 'Gaushala' },
  
  // Maharajgunj / Chabahil / Balaju
  { from: 'Maharajgunj', to: 'Chabahil' },
  { from: 'Maharajgunj', to: 'Balaju' },
  { from: 'Maharajgunj', to: 'maharajgunj' }, // handle case variations if any

  // Chabahil / Bouddha / Gaushala
  { from: 'Chabahil', to: 'Bouddha' },
  { from: 'Chabahil', to: 'Gaushala' },
  { from: 'Bouddha', to: 'Gaushala' },
  { from: 'Bouddha', to: 'jorpati' },

  // Gaushala / Baneshwor
  { from: 'Gaushala', to: 'Baneshwor' },
  
  // Baneshwor / Koteshwor / Putalisadak
  { from: 'Baneshwor', to: 'Koteshwor' },
  { from: 'Baneshwor', to: 'Putalisadak' },
  { from: 'Baneshwor', to: 'Tripureshwor' },

  // Koteshwor / Satdobato / Bhaktapur
  { from: 'Koteshwor', to: 'Satdobato' },
  { from: 'Koteshwor', to: 'Bhaktapur Durbar Square' },

  // Tripureshwor / Kupondole / Kalimati
  { from: 'Tripureshwor', to: 'Kupondole' },
  { from: 'Tripureshwor', to: 'Kalimati' },
  
  // Kupondole / Pulchowk / Patan Dhoka
  { from: 'Kupondole', to: 'Pulchowk' },
  { from: 'Kupondole', to: 'Patan Dhoka' },
  
  // Pulchowk / Patan Dhoka / Jawalakhel
  { from: 'Pulchowk', to: 'Patan Dhoka' },
  { from: 'Pulchowk', to: 'Jawalakhel' },
  { from: 'Patan Dhoka', to: 'Jawalakhel' },
  { from: 'Patan Dhoka', to: 'jhamsikhel' },

  // Jawalakhel / Satdobato / Ekantakuna / Jhamsikhel
  { from: 'Jawalakhel', to: 'Satdobato' },
  { from: 'Jawalakhel', to: 'Ekantakuna' },
  { from: 'Jawalakhel', to: 'jhamsikhel' },
  { from: 'jhamsikhel', to: 'ekantakuna' },

  // Satdobato / Ekantakuna
  { from: 'Satdobato', to: 'Ekantakuna' },
  { from: 'Satdobato', to: 'ekantakuna' },
  { from: 'ekantakuna', to: 'ekantakuna' }, // self skip handled programmatically
  
  // Ekantakuna / Kalanki
  { from: 'ekantakuna', to: 'Kalanki' },
  { from: 'Ekantakuna', to: 'Kalanki' },

  // Kalanki / Kalimati / Balaju
  { from: 'Kalanki', to: 'Kalimati' },
  { from: 'Kalanki', to: 'kalanki' }, // variations
  { from: 'Kalanki', to: 'Balaju' },

  // Balaju / Gongabu / Maharajgunj
  { from: 'Balaju', to: 'gongabu' },
  { from: 'Balaju', to: 'balaju' },
  { from: 'gongabu', to: 'Maharajgunj' },
  { from: 'gongabu', to: 'dhumbarahi' },

  // Dhumbarahi / Gongabu / Chabahil
  { from: 'dhumbarahi', to: 'Maharajgunj' },
  { from: 'dhumbarahi', to: 'Chabahil' }
];

async function seedRoads() {
  try {
    console.log('🚀 Seeding roads...');
    
    // Clear existing roads to start clean
    console.log('🧹 Clearing existing roads...');
    await prisma.road.deleteMany({});

    // Fetch all locations in the database
    const locations = await prisma.location.findMany();
    console.log(`ℹ️  Found ${locations.length} locations in the database.`);

    // Build case-insensitive location map
    const locationMap = {};
    locations.forEach(loc => {
      locationMap[loc.name.toLowerCase().trim()] = loc;
    });

    let createdRoads = 0;
    const addedPairs = new Set();

    for (const conn of roadConnections) {
      const fromName = conn.from.toLowerCase().trim();
      const toName = conn.to.toLowerCase().trim();

      // Skip self loops
      if (fromName === toName) continue;

      const locFrom = locationMap[fromName];
      const locTo = locationMap[toName];

      if (!locFrom || !locTo) {
        // Some locations might not exist in database depending on what was seeded, just skip silently
        continue;
      }

      // Check unique pair to prevent duplicates
      const pairKey1 = `${locFrom.id}-${locTo.id}`;
      const pairKey2 = `${locTo.id}-${locFrom.id}`;
      if (addedPairs.has(pairKey1) || addedPairs.has(pairKey2)) {
        continue;
      }

      // Calculate distance based on latitude & longitude
      const distance = calculateDistance(
        locFrom.latitude,
        locFrom.longitude,
        locTo.latitude,
        locTo.longitude
      );

      // Create bidirectional road connection
      await prisma.road.create({
        data: {
          fromLocationId: locFrom.id,
          toLocationId: locTo.id,
          distance: distance,
          isBidirectional: true
        }
      });

      addedPairs.add(pairKey1);
      createdRoads++;
      console.log(`✅ Road created: ${locFrom.name} ↔️ ${locTo.name} (${distance} km)`);
    }

    console.log(`\n🎉 Roads seeding completed successfully! Total created: ${createdRoads}`);

  } catch (error) {
    console.error('❌ Error seeding roads:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedRoads();
