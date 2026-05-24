/**
 * Traveling Salesman Problem (TSP) Solver
 * Implements multiple algorithms for finding optimal routes through multiple locations
 */

export interface TSPLocation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
}

export interface TSPResult {
  path: number[]; // Ordered array of location IDs
  totalDistance: number;
  algorithm: string;
  executionTime: number;
  iterations?: number;
}

export interface DistanceMatrix {
  [fromId: number]: {
    [toId: number]: number;
  };
}

/**
 * Calculate distance matrix between all locations
 */
export function buildDistanceMatrix(
  locations: TSPLocation[],
  distanceFunction: (loc1: TSPLocation, loc2: TSPLocation) => number
): DistanceMatrix {
  const matrix: DistanceMatrix = {};

  locations.forEach((loc1) => {
    matrix[loc1.id] = {};
    locations.forEach((loc2) => {
      if (loc1.id !== loc2.id) {
        matrix[loc1.id][loc2.id] = distanceFunction(loc1, loc2);
      } else {
        matrix[loc1.id][loc2.id] = 0;
      }
    });
  });

  return matrix;
}

/**
 * Calculate total distance for a given path
 */
export function calculatePathDistance(
  path: number[],
  distanceMatrix: DistanceMatrix
): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += distanceMatrix[path[i]][path[i + 1]];
  }
  return total;
}

/**
 * Nearest Neighbor Algorithm (Greedy approach)
 * Time Complexity: O(n²)
 * Good for quick approximations
 */
export function nearestNeighbor(
  locations: TSPLocation[],
  distanceMatrix: DistanceMatrix,
  startLocationId?: number
): TSPResult {
  const startTime = performance.now();

  if (locations.length === 0) {
    return {
      path: [],
      totalDistance: 0,
      algorithm: "Nearest Neighbor",
      executionTime: 0,
    };
  }

  if (locations.length === 1) {
    return {
      path: [locations[0].id],
      totalDistance: 0,
      algorithm: "Nearest Neighbor",
      executionTime: performance.now() - startTime,
    };
  }

  const unvisited = new Set(locations.map((l) => l.id));
  const path: number[] = [];

  // Start from specified location or first location
  let current = startLocationId || locations[0].id;
  path.push(current);
  unvisited.delete(current);

  // Greedy: always go to nearest unvisited location
  while (unvisited.size > 0) {
    let nearest: number | null = null;
    let minDistance = Infinity;

    unvisited.forEach((locationId) => {
      const distance = distanceMatrix[current][locationId];
      if (distance < minDistance) {
        minDistance = distance;
        nearest = locationId;
      }
    });

    if (nearest !== null) {
      path.push(nearest);
      unvisited.delete(nearest);
      current = nearest;
    }
  }

  const totalDistance = calculatePathDistance(path, distanceMatrix);
  const executionTime = performance.now() - startTime;

  return {
    path,
    totalDistance,
    algorithm: "Nearest Neighbor",
    executionTime,
  };
}

/**
 * 2-Opt Algorithm for route optimization
 * Iteratively improves an initial route
 * Time Complexity: O(n²) per iteration
 */
export function twoOpt(
  initialPath: number[],
  distanceMatrix: DistanceMatrix,
  maxIterations: number = 1000
): TSPResult {
  const startTime = performance.now();
  let path = [...initialPath];
  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 1; i < path.length - 1; i++) {
      for (let j = i + 1; j < path.length; j++) {
        // Try reversing the segment between i and j
        const newPath = twoOptSwap(path, i, j);
        const currentDistance = calculatePathDistance(path, distanceMatrix);
        const newDistance = calculatePathDistance(newPath, distanceMatrix);

        if (newDistance < currentDistance) {
          path = newPath;
          improved = true;
        }
      }
    }
  }

  const totalDistance = calculatePathDistance(path, distanceMatrix);
  const executionTime = performance.now() - startTime;

  return {
    path,
    totalDistance,
    algorithm: "2-Opt",
    executionTime,
    iterations,
  };
}

/**
 * Helper function for 2-Opt: reverse segment between i and j
 */
function twoOptSwap(path: number[], i: number, j: number): number[] {
  const newPath = [...path.slice(0, i), ...path.slice(i, j + 1).reverse(), ...path.slice(j + 1)];
  return newPath;
}

/**
 * Simulated Annealing for TSP
 * Probabilistic algorithm that can escape local minima
 * Time Complexity: O(n² * iterations)
 */
export function simulatedAnnealing(
  locations: TSPLocation[],
  distanceMatrix: DistanceMatrix,
  initialTemperature: number = 10000,
  coolingRate: number = 0.995,
  startLocationId?: number
): TSPResult {
  const startTime = performance.now();

  // Start with nearest neighbor solution
  const initial = nearestNeighbor(locations, distanceMatrix, startLocationId);
  let currentPath = initial.path;
  let currentDistance = initial.totalDistance;
  let bestPath = [...currentPath];
  let bestDistance = currentDistance;

  let temperature = initialTemperature;
  let iterations = 0;

  while (temperature > 1) {
    iterations++;

    // Generate neighbor solution by swapping two random locations
    const newPath = [...currentPath];
    const i = Math.floor(Math.random() * (newPath.length - 1)) + 1;
    const j = Math.floor(Math.random() * (newPath.length - 1)) + 1;
    [newPath[i], newPath[j]] = [newPath[j], newPath[i]];

    const newDistance = calculatePathDistance(newPath, distanceMatrix);
    const delta = newDistance - currentDistance;

    // Accept better solutions always, worse solutions with probability
    if (delta < 0 || Math.random() < Math.exp(-delta / temperature)) {
      currentPath = newPath;
      currentDistance = newDistance;

      // Update best solution
      if (currentDistance < bestDistance) {
        bestPath = [...currentPath];
        bestDistance = currentDistance;
      }
    }

    // Cool down
    temperature *= coolingRate;
  }

  const executionTime = performance.now() - startTime;

  return {
    path: bestPath,
    totalDistance: bestDistance,
    algorithm: "Simulated Annealing",
    executionTime,
    iterations,
  };
}

/**
 * Genetic Algorithm for TSP
 * Population-based optimization
 */
export function geneticAlgorithm(
  locations: TSPLocation[],
  distanceMatrix: DistanceMatrix,
  populationSize: number = 50,
  generations: number = 100,
  mutationRate: number = 0.01,
  startLocationId?: number
): TSPResult {
  const startTime = performance.now();

  if (locations.length <= 2) {
    return nearestNeighbor(locations, distanceMatrix, startLocationId);
  }

  // Initialize population
  let population: number[][] = [];
  const locationIds = locations.map((l) => l.id);
  
  // Ensure start location is fixed if specified
  const fixedStart = startLocationId || locationIds[0];
  const remainingIds = locationIds.filter((id) => id !== fixedStart);

  for (let i = 0; i < populationSize; i++) {
    const shuffled = [...remainingIds].sort(() => Math.random() - 0.5);
    population.push([fixedStart, ...shuffled]);
  }

  let bestPath = population[0];
  let bestDistance = calculatePathDistance(bestPath, distanceMatrix);

  // Evolution
  for (let gen = 0; gen < generations; gen++) {
    // Evaluate fitness
    const fitness = population.map((path) => {
      const distance = calculatePathDistance(path, distanceMatrix);
      return 1 / (1 + distance); // Higher fitness for shorter distances
    });

    // Track best solution
    population.forEach((path) => {
      const distance = calculatePathDistance(path, distanceMatrix);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPath = [...path];
      }
    });

    // Selection (tournament)
    const selected: number[][] = [];
    for (let i = 0; i < populationSize; i++) {
      const a = Math.floor(Math.random() * populationSize);
      const b = Math.floor(Math.random() * populationSize);
      selected.push([...population[fitness[a] > fitness[b] ? a : b]]);
    }

    // Crossover
    const offspring: number[][] = [];
    for (let i = 0; i < populationSize; i += 2) {
      if (i + 1 < populationSize) {
        const [child1, child2] = orderCrossover(selected[i], selected[i + 1]);
        offspring.push(child1, child2);
      } else {
        offspring.push(selected[i]);
      }
    }

    // Mutation
    offspring.forEach((path) => {
      if (Math.random() < mutationRate) {
        const i = Math.floor(Math.random() * (path.length - 1)) + 1;
        const j = Math.floor(Math.random() * (path.length - 1)) + 1;
        [path[i], path[j]] = [path[j], path[i]];
      }
    });

    population = offspring;
  }

  const executionTime = performance.now() - startTime;

  return {
    path: bestPath,
    totalDistance: bestDistance,
    algorithm: "Genetic Algorithm",
    executionTime,
    iterations: generations,
  };
}

/**
 * Order Crossover (OX) for genetic algorithm
 */
function orderCrossover(parent1: number[], parent2: number[]): [number[], number[]] {
  const size = parent1.length;
  const start = Math.floor(Math.random() * (size - 1)) + 1; // Avoid swapping fixed start
  const end = Math.floor(Math.random() * (size - start)) + start;

  const child1 = new Array(size).fill(null);
  const child2 = new Array(size).fill(null);

  // Copy fixed start
  child1[0] = parent1[0];
  child2[0] = parent2[0];

  // Copy segments
  for (let i = start; i <= end; i++) {
    child1[i] = parent1[i];
    child2[i] = parent2[i];
  }

  // Fill remaining positions
  fillRemaining(child1, parent2);
  fillRemaining(child2, parent1);

  return [child1, child2];
}

function fillRemaining(child: (number | null)[], parent: number[]): void {
  const used = new Set(child.filter((x): x is number => x !== null));
  let childIdx = 1; // Start after fixed first position

  for (let i = 1; i < parent.length; i++) {
    if (!used.has(parent[i])) {
      while (childIdx < child.length && child[childIdx] !== null) {
        childIdx++;
      }
      if (childIdx < child.length) {
        child[childIdx] = parent[i];
      }
    }
  }
}

/**
 * Solve TSP with best available algorithm
 * Automatically chooses based on problem size
 */
export function solveTSP(
  locations: TSPLocation[],
  distanceMatrix: DistanceMatrix,
  algorithm: "auto" | "nearest-neighbor" | "2-opt" | "simulated-annealing" | "genetic" = "auto",
  startLocationId?: number
): TSPResult {
  const n = locations.length;

  if (n <= 1) {
    return nearestNeighbor(locations, distanceMatrix, startLocationId);
  }

  // Auto-select algorithm based on problem size
  if (algorithm === "auto") {
    if (n <= 10) {
      algorithm = "2-opt";
    } else if (n <= 20) {
      algorithm = "simulated-annealing";
    } else {
      algorithm = "genetic";
    }
  }

  switch (algorithm) {
    case "nearest-neighbor":
      return nearestNeighbor(locations, distanceMatrix, startLocationId);

    case "2-opt": {
      const initial = nearestNeighbor(locations, distanceMatrix, startLocationId);
      return twoOpt(initial.path, distanceMatrix);
    }

    case "simulated-annealing":
      return simulatedAnnealing(locations, distanceMatrix, 10000, 0.995, startLocationId);

    case "genetic":
      return geneticAlgorithm(locations, distanceMatrix, 50, 100, 0.01, startLocationId);

    default:
      return nearestNeighbor(locations, distanceMatrix, startLocationId);
  }
}
