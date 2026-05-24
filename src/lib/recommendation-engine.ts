/**
 * Driver Recommendation Engine
 * Uses Cosine Similarity algorithm to match packages with suitable drivers
 */

interface PackageAttributes {
  weight: number; // in kg
  volume: number; // in cubic feet
  isCritical: boolean;
  distance: number; // estimated distance in km
}

interface DriverAttributes {
  maxCapacity: number; // in kg
  maxVolume: number; // in cubic feet
  experienceYears: number;
  rating: number;
  totalDeliveries: number;
  vehicleType: string;
  isAvailable: boolean;
}

interface DriverWithProfile {
  id: string;
  name: string | null;
  email: string;
  driverProfile: DriverAttributes;
}

interface DriverRecommendation {
  driver: DriverWithProfile;
  matchScore: number; // 0-100
  reasons: string[];
}

/**
 * Normalize a value to 0-1 range
 */
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return (value - min) / (max - min);
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Convert package attributes to a normalized vector
 */
function packageToVector(pkg: PackageAttributes): number[] {
  return [
    normalize(pkg.weight, 0, 200), // Weight normalized (0-200kg range)
    normalize(pkg.volume, 0, 100), // Volume normalized (0-100 cubic ft range)
    pkg.isCritical ? 1 : 0, // Critical flag
    normalize(pkg.distance, 0, 50), // Distance normalized (0-50km range)
  ];
}

/**
 * Convert driver attributes to a normalized vector
 */
function driverToVector(driver: DriverAttributes): number[] {
  // Calculate capacity utilization (inverse - more capacity = better)
  const capacityScore = normalize(driver.maxCapacity, 0, 200);
  const volumeScore = normalize(driver.maxVolume, 0, 100);

  // Experience and reliability scores
  const experienceScore = normalize(driver.experienceYears, 0, 10);
  const ratingScore = normalize(driver.rating, 0, 5);

  return [
    capacityScore, // Higher capacity = better
    volumeScore, // Higher volume capacity = better
    experienceScore, // More experience = better for critical items
    ratingScore, // Higher rating = better
  ];
}

/**
 * Calculate match reasons based on driver and package attributes
 */
function generateMatchReasons(
  pkg: PackageAttributes,
  driver: DriverAttributes
): string[] {
  const reasons: string[] = [];

  // Check capacity match
  const capacityUtilization = (pkg.weight / driver.maxCapacity) * 100;
  if (capacityUtilization < 50) {
    reasons.push('Excellent capacity match');
  } else if (capacityUtilization < 80) {
    reasons.push('Good capacity match');
  }

  // Check volume match
  const volumeUtilization = (pkg.volume / driver.maxVolume) * 100;
  if (volumeUtilization < 50) {
    reasons.push('Excellent volume capacity');
  }

  // Check vehicle type suitability
  if (pkg.weight < 50 && driver.vehicleType === '2-wheeler') {
    reasons.push('Perfect for 2-wheeler delivery');
  } else if (pkg.weight >= 50 && driver.vehicleType === '4-wheeler') {
    reasons.push('Suitable vehicle for heavy load');
  }

  // Check experience for critical items
  if (pkg.isCritical && driver.experienceYears >= 3) {
    reasons.push('Experienced with critical deliveries');
  }

  // Check rating
  if (driver.rating >= 4.5) {
    reasons.push('High customer rating');
  }

  // Check delivery history
  if (driver.totalDeliveries > 100) {
    reasons.push('Proven track record');
  }

  // Check availability
  if (driver.isAvailable) {
    reasons.push('Currently available');
  }

  return reasons;
}

/**
 * Recommend drivers for a package using cosine similarity
 */
export function recommendDrivers(
  packageAttributes: PackageAttributes,
  availableDrivers: DriverWithProfile[],
  topN: number = 3
): DriverRecommendation[] {
  const packageVector = packageToVector(packageAttributes);

  const recommendations: DriverRecommendation[] = availableDrivers
    .filter((driver) => {
      // Filter out drivers who can't handle the package
      const canHandleWeight = driver.driverProfile.maxCapacity >= packageAttributes.weight;
      const canHandleVolume = driver.driverProfile.maxVolume >= packageAttributes.volume;
      return canHandleWeight && canHandleVolume;
    })
    .map((driver) => {
      const driverVector = driverToVector(driver.driverProfile);
      const similarity = cosineSimilarity(packageVector, driverVector);

      // Convert similarity to percentage (0-100)
      let matchScore = similarity * 100;

      // Bonus points for availability
      if (driver.driverProfile.isAvailable) {
        matchScore += 5;
      }

      // Bonus for critical items with experienced drivers
      if (packageAttributes.isCritical && driver.driverProfile.experienceYears >= 3) {
        matchScore += 5;
      }

      // Cap at 100
      matchScore = Math.min(matchScore, 100);

      const reasons = generateMatchReasons(packageAttributes, driver.driverProfile);

      return {
        driver,
        matchScore: Math.round(matchScore * 100) / 100, // Round to 2 decimal places
        reasons,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, topN);

  return recommendations;
}

/**
 * Calculate estimated distance based on coordinates (Haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}
