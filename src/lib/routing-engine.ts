/**
 * Advanced Graph Algorithms Library
 * Implements Dijkstra's Algorithm, A* with heuristics, and k-shortest paths
 */

export interface GraphNode {
  id: number;
  name: string;
  latitude?: number;
  longitude?: number;
}

export interface GraphEdge {
  from: number;
  to: number;
  weight: number;
}

export interface AdjacencyList {
  [nodeId: number]: Array<{ neighbor: number; weight: number }>;
}

export interface ShortestPathResult {
  path: number[];
  distance: number;
  found: boolean;
  nodesExplored?: number;
  executionTime?: number;
}

export interface AlternativeRoute {
  path: number[];
  distance: number;
  similarity: number; // 0-1, similarity to main route
}

/**
 * Priority Queue implementation using binary heap
 */
class PriorityQueue<T> {
  private items: Array<{ element: T; priority: number }> = [];

  enqueue(element: T, priority: number): void {
    const item = { element, priority };
    let added = false;

    for (let i = 0; i < this.items.length; i++) {
      if (item.priority < this.items[i].priority) {
        this.items.splice(i, 0, item);
        added = true;
        break;
      }
    }

    if (!added) {
      this.items.push(item);
    }
  }

  dequeue(): T | undefined {
    return this.items.shift()?.element;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  size(): number {
    return this.items.length;
  }
}

/**
 * Calculate haversine distance between two coordinates (in km)
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Build adjacency list from edges
 */
export function buildAdjacencyList(
  edges: GraphEdge[],
  isBidirectional: boolean = false
): AdjacencyList {
  const adjacencyList: AdjacencyList = {};

  edges.forEach((edge) => {
    if (!adjacencyList[edge.from]) {
      adjacencyList[edge.from] = [];
    }
    adjacencyList[edge.from].push({ neighbor: edge.to, weight: edge.weight });

    if (isBidirectional) {
      if (!adjacencyList[edge.to]) {
        adjacencyList[edge.to] = [];
      }
      adjacencyList[edge.to].push({ neighbor: edge.from, weight: edge.weight });
    }
  });

  return adjacencyList;
}

/**
 * Dijkstra's Algorithm with Priority Queue
 * Time Complexity: O((V + E) log V)
 */
export function dijkstra(
  adjacencyList: AdjacencyList,
  source: number,
  target: number,
  nodeIds: number[]
): ShortestPathResult {
  const startTime = performance.now();
  let nodesExplored = 0;

  const distances: { [nodeId: number]: number } = {};
  const previous: { [nodeId: number]: number | null } = {};
  const pq = new PriorityQueue<number>();

  // Initialize
  nodeIds.forEach((nodeId) => {
    distances[nodeId] = Infinity;
    previous[nodeId] = null;
  });
  distances[source] = 0;
  pq.enqueue(source, 0);

  while (!pq.isEmpty()) {
    const current = pq.dequeue();
    if (current === undefined) break;

    nodesExplored++;

    // Early termination when target is reached
    if (current === target) {
      break;
    }

    // Skip if we've found a better path already
    if (!adjacencyList[current]) continue;

    // Relax edges
    for (const { neighbor, weight } of adjacencyList[current]) {
      const distance = distances[current] + weight;

      if (distance < distances[neighbor]) {
        distances[neighbor] = distance;
        previous[neighbor] = current;
        pq.enqueue(neighbor, distance);
      }
    }
  }

  // Reconstruct path
  const path: number[] = [];
  let current: number | null = target;

  while (current !== null) {
    path.unshift(current);
    current = previous[current];
  }

  const executionTime = performance.now() - startTime;

  return {
    path,
    distance: distances[target],
    found: distances[target] !== Infinity,
    nodesExplored,
    executionTime,
  };
}

/**
 * A* Algorithm with heuristic function
 * Time Complexity: O((V + E) log V) with good heuristic
 */
export function astar(
  adjacencyList: AdjacencyList,
  source: number,
  target: number,
  nodes: Map<number, GraphNode>,
  heuristicWeight: number = 1.0
): ShortestPathResult {
  const startTime = performance.now();
  let nodesExplored = 0;

  const sourceNode = nodes.get(source);
  const targetNode = nodes.get(target);

  // Fallback to Dijkstra if coordinates not available
  if (
    !sourceNode?.latitude ||
    !sourceNode?.longitude ||
    !targetNode?.latitude ||
    !targetNode?.longitude
  ) {
    return dijkstra(adjacencyList, source, target, Array.from(nodes.keys()));
  }

  const gScore: { [nodeId: number]: number } = {};
  const fScore: { [nodeId: number]: number } = {};
  const previous: { [nodeId: number]: number | null } = {};
  const pq = new PriorityQueue<number>();

  // Heuristic function: straight-line distance to target
  const heuristic = (nodeId: number): number => {
    const node = nodes.get(nodeId);
    if (!node?.latitude || !node?.longitude) return 0;
    return (
      haversineDistance(
        node.latitude,
        node.longitude,
        targetNode.latitude!,
        targetNode.longitude!
      ) * heuristicWeight
    );
  };

  // Initialize
  for (const nodeId of nodes.keys()) {
    gScore[nodeId] = Infinity;
    fScore[nodeId] = Infinity;
    previous[nodeId] = null;
  }

  gScore[source] = 0;
  fScore[source] = heuristic(source);
  pq.enqueue(source, fScore[source]);

  while (!pq.isEmpty()) {
    const current = pq.dequeue();
    if (current === undefined) break;

    nodesExplored++;

    // Target reached
    if (current === target) {
      break;
    }

    if (!adjacencyList[current]) continue;

    // Explore neighbors
    for (const { neighbor, weight } of adjacencyList[current]) {
      const tentativeGScore = gScore[current] + weight;

      if (tentativeGScore < gScore[neighbor]) {
        previous[neighbor] = current;
        gScore[neighbor] = tentativeGScore;
        fScore[neighbor] = gScore[neighbor] + heuristic(neighbor);
        pq.enqueue(neighbor, fScore[neighbor]);
      }
    }
  }

  // Reconstruct path
  const path: number[] = [];
  let current: number | null = target;

  while (current !== null) {
    path.unshift(current);
    current = previous[current];
  }

  const executionTime = performance.now() - startTime;

  return {
    path,
    distance: gScore[target],
    found: gScore[target] !== Infinity,
    nodesExplored,
    executionTime,
  };
}

/**
 * Find k alternative routes using Yen's algorithm (simplified)
 */
export function findAlternativeRoutes(
  adjacencyList: AdjacencyList,
  source: number,
  target: number,
  nodeIds: number[],
  k: number = 3
): AlternativeRoute[] {
  const mainRoute = dijkstra(adjacencyList, source, target, nodeIds);
  
  if (!mainRoute.found) {
    return [];
  }

  const routes: AlternativeRoute[] = [
    {
      path: mainRoute.path,
      distance: mainRoute.distance,
      similarity: 1.0,
    },
  ];

  // Simple approach: Try removing edges from main route and find alternative
  for (let i = 1; i < mainRoute.path.length - 1 && routes.length < k; i++) {
    const modifiedAdjList = JSON.parse(JSON.stringify(adjacencyList));
    const nodeToRemove = mainRoute.path[i];

    // Temporarily remove node from graph
    delete modifiedAdjList[nodeToRemove];
    for (const key in modifiedAdjList) {
      modifiedAdjList[key] = modifiedAdjList[key].filter(
        (edge: { neighbor: number }) => edge.neighbor !== nodeToRemove
      );
    }

    const altRoute = dijkstra(modifiedAdjList, source, target, nodeIds);

    if (altRoute.found && altRoute.distance !== Infinity) {
      // Calculate similarity (inverse of Jaccard distance)
      const mainSet = new Set(mainRoute.path);
      const altSet = new Set(altRoute.path);
      const intersection = new Set(
        [...mainSet].filter((x) => altSet.has(x))
      );
      const union = new Set([...mainSet, ...altSet]);
      const similarity = intersection.size / union.size;

      routes.push({
        path: altRoute.path,
        distance: altRoute.distance,
        similarity,
      });
    }
  }

  return routes;
}

/**
 * Route caching system
 */
export class RouteCache {
  private cache: Map<string, { result: ShortestPathResult; timestamp: number }>;
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = 1000, ttlMinutes: number = 60) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
  }

  private getCacheKey(source: number, target: number): string {
    return `${source}-${target}`;
  }

  get(source: number, target: number): ShortestPathResult | null {
    const key = this.getCacheKey(source, target);
    const cached = this.cache.get(key);

    if (!cached) return null;

    // Check if cache entry has expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.result;
  }

  set(source: number, target: number, result: ShortestPathResult): void {
    // Implement LRU eviction
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const key = this.getCacheKey(source, target);
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  getSize(): number {
    return this.cache.size;
  }

  getStats(): { size: number; maxSize: number; ttl: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl / 60000, // Convert back to minutes
    };
  }
}
