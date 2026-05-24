/**
 * Graph Algorithms Library
 * Implements Dijkstra's Algorithm and BFS for route optimization
 */

export interface GraphNode {
  id: number;
  name: string;
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
}

/**
 * Build adjacency list from edges
 * @param edges Array of graph edges
 * @param isBidirectional Whether edges are bidirectional
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
 * Dijkstra's Algorithm for finding shortest path
 * Time Complexity: O(V² + E) with simple array implementation
 * @param adjacencyList Graph represented as adjacency list
 * @param source Source node ID
 * @param target Target node ID
 * @param nodeIds All node IDs in the graph
 */
export function dijkstra(
  adjacencyList: AdjacencyList,
  source: number,
  target: number,
  nodeIds: number[]
): ShortestPathResult {
  // Initialize distances with infinity
  const distances: { [nodeId: number]: number } = {};
  const previous: { [nodeId: number]: number | null } = {};
  const visited: Set<number> = new Set();

  // Initialize all distances to infinity except source
  nodeIds.forEach((nodeId) => {
    distances[nodeId] = Infinity;
    previous[nodeId] = null;
  });
  distances[source] = 0;

  // Main loop - visit all nodes
  for (let i = 0; i < nodeIds.length; i++) {
    // Find unvisited node with minimum distance (O(V))
    let minDistance = Infinity;
    let currentNode: number | null = null;

    nodeIds.forEach((nodeId) => {
      if (!visited.has(nodeId) && distances[nodeId] < minDistance) {
        minDistance = distances[nodeId];
        currentNode = nodeId;
      }
    });

    // No reachable unvisited nodes left
    if (currentNode === null || minDistance === Infinity) {
      break;
    }

    // Mark current node as visited
    visited.add(currentNode);

    // Early termination if we reached target
    if (currentNode === target) {
      break;
    }

    // Update distances to neighbors
    const neighbors = adjacencyList[currentNode] || [];
    neighbors.forEach(({ neighbor, weight }) => {
      if (!visited.has(neighbor)) {
        const newDistance = distances[currentNode!] + weight;
        if (newDistance < distances[neighbor]) {
          distances[neighbor] = newDistance;
          previous[neighbor] = currentNode;
        }
      }
    });
  }

  // Reconstruct path
  const path: number[] = [];
  let current: number | null = target;

  if (distances[target] === Infinity) {
    // No path found
    return { path: [], distance: 0, found: false };
  }

  while (current !== null) {
    path.unshift(current);
    current = previous[current];
  }

  return {
    path,
    distance: distances[target],
    found: true,
  };
}

/**
 * BFS (Breadth-First Search) for finding path with minimum number of hops
 * Time Complexity: O(V + E)
 * @param adjacencyList Graph represented as adjacency list (unweighted)
 * @param source Source node ID
 * @param target Target node ID
 */
export function bfs(
  adjacencyList: AdjacencyList,
  source: number,
  target: number
): ShortestPathResult {
  const queue: number[] = [source];
  const visited: Set<number> = new Set([source]);
  const previous: { [nodeId: number]: number | null } = { [source]: null };

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Found target
    if (current === target) {
      // Reconstruct path
      const path: number[] = [];
      let node: number | null = target;

      while (node !== null) {
        path.unshift(node);
        node = previous[node];
      }

      return {
        path,
        distance: path.length - 1, // Number of edges (hops)
        found: true,
      };
    }

    // Explore neighbors
    const neighbors = adjacencyList[current] || [];
    neighbors.forEach(({ neighbor }) => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        previous[neighbor] = current;
        queue.push(neighbor);
      }
    });
  }

  // No path found
  return { path: [], distance: 0, found: false };
}

/**
 * Calculate total distance for a given path
 * @param path Array of node IDs
 * @param adjacencyList Graph represented as adjacency list
 */
export function calculatePathDistance(
  path: number[],
  adjacencyList: AdjacencyList
): number {
  let totalDistance = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const current = path[i];
    const next = path[i + 1];
    const neighbors = adjacencyList[current] || [];
    const edge = neighbors.find((n) => n.neighbor === next);

    if (edge) {
      totalDistance += edge.weight;
    }
  }

  return totalDistance;
}

/**
 * Calculate shortest path using Dijkstra's algorithm
 * Wrapper function for convenience
 * @param graph Graph represented as adjacency list with node and weight
 * @param source Source node ID
 * @param target Target node ID
 */
export function calculateShortestPath(
  graph: Record<number, { node: number; weight: number }[]>,
  source: number,
  target: number
): { path: number[]; distance: number; found: boolean } {
  // Convert graph format to AdjacencyList format
  const adjacencyList: AdjacencyList = {};
  
  for (const nodeId in graph) {
    const id = parseInt(nodeId);
    adjacencyList[id] = graph[id].map(edge => ({
      neighbor: edge.node,
      weight: edge.weight
    }));
  }
  
  // Get all node IDs
  const nodeIds = Object.keys(adjacencyList).map(id => parseInt(id));
  
  // Run Dijkstra's algorithm
  return dijkstra(adjacencyList, source, target, nodeIds);
}
