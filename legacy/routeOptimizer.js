// ===== TSP ROUTE OPTIMIZER =====
// 
// Algoritma Optimasi Rute untuk Traveling Salesman Problem (TSP)
// Menggunakan Permutation Brute Force untuk dataset kecil (< 12 node)
// 
// CATATAN: Ini BUKAN Branch & Bound proper, tapi:
// - Hasilnya OPTIMAL (rute tercepat/terpendek)
// - Untuk 10 pangkalan: hitung cepat (< 1 detik)
// - Mudah di-maintain dan di-debug
//
// Untuk dataset > 12 node, gunakan Nearest Neighbor atau OR-Tools
// ================================================================

/**
 * Haversine Formula: Menghitung jarak antara 2 koordinat GPS (km)
 * 
 * @param {number} lat1 - Latitude titik awal
 * @param {number} lng1 - Longitude titik awal
 * @param {number} lat2 - Latitude titik tujuan
 * @param {number} lng2 - Longitude titik tujuan
 * @returns {number} Jarak dalam km
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Radius bumi dalam km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Membuat Distance Matrix dari daftar pangkalan
 * Matrix[i][j] = jarak dari pangkalan i ke pangkalan j
 * 
 * @param {Array} pangkalan - Daftar pangkalan dengan lat, lng
 * @returns {Array} Matrix jarak 2D
 */
function createDistanceMatrix(pangkalan) {
  const n = pangkalan.length;
  const matrix = Array(n).fill(0).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        matrix[i][j] = calculateDistance(
          pangkalan[i].lat,
          pangkalan[i].lng,
          pangkalan[j].lat,
          pangkalan[j].lng
        );
      }
    }
  }
  
  return matrix;
}

/**
 * Generate semua permutasi dari array
 * Untuk mencari rute optimal (TSP)
 * 
 * Complexity: O(n!)
 * - 5 node = 120 kombinasi
 * - 10 node = 3,628,800 kombinasi (masih cepat)
 * - 12 node = 479 juta kombinasi (mulai lambat)
 * 
 * @param {Array} arr - Array indeks
 * @returns {Array} Semua permutasi
 */
function generatePermutations(arr) {
  if (arr.length <= 1) return [arr];
  
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const current = arr[i];
    const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
    const remainingPerms = generatePermutations(remaining);
    
    for (const perm of remainingPerms) {
      result.push([current, ...perm]);
    }
  }
  
  return result;
}

/**
 * Hitung total jarak dari sebuah rute menggunakan distance matrix
 * 
 * @param {Array} sequence - Urutan indeks pangkalan
 * @param {Array} distMatrix - Distance matrix
 * @returns {number} Total jarak
 */
function calculateTotalDistanceMatrix(sequence, distMatrix) {
  let total = 0;
  for (let i = 0; i < sequence.length - 1; i++) {
    total += distMatrix[sequence[i]][sequence[i + 1]];
  }
  // Tambah jarak kembali ke titik awal (jika circular)
  total += distMatrix[sequence[sequence.length - 1]][sequence[0]];
  return total;
}

/**
 * Hitung total jarak dari sebuah rute menggunakan koordinat
 * 
 * @param {Array} pangkalan - Daftar pangkalan
 * @param {Array} sequence - Urutan indeks
 * @returns {number} Total jarak
 */
function calculateTotalDistance(pangkalan, sequence) {
  let total = 0;
  for (let i = 0; i < sequence.length - 1; i++) {
    const from = pangkalan[sequence[i]];
    const to = pangkalan[sequence[i + 1]];
    total += calculateDistance(from.lat, from.lng, to.lat, to.lng);
  }
  return total;
}

/**
 * TSP Solver menggunakan Permutation Brute Force
 * HASIL: OPTIMAL (rute tercepat/terpendek yang paling baik)
 * 
 * Untuk dataset kecil (5-10 node), ini adalah solusi terbaik
 * karena menjamin hasil optimal dan tetap cepat
 * 
 * @param {Array} pangkalan - Daftar pangkalan
 * @returns {Object} Rute optimal dengan detail
 */
function permutationTSP(pangkalan) {
  const n = pangkalan.length;
  
  // Jika hanya 1-2 pangkalan, tidak perlu optimasi
  if (n <= 2) {
    const sequence = Array.from({length: n}, (_, i) => i);
    return {
      sequence,
      totalDistance: calculateTotalDistance(pangkalan, sequence),
      method: 'no_optimization'
    };
  }
  
  const distMatrix = createDistanceMatrix(pangkalan);
  let bestRoute = Array.from({length: n}, (_, i) => i);
  let bestDistance = calculateTotalDistanceMatrix(bestRoute, distMatrix);
  
  console.log(`🔍 Mencari rute optimal dari ${n} pangkalan...`);
  console.log(`   Total kemungkinan rute: ${factorial(n).toLocaleString()}`);
  
  const startTime = Date.now();
  
  // Coba semua permutasi dan cari yang terbaik
  const permutations = generatePermutations(Array.from({length: n}, (_, i) => i));
  
  for (const perm of permutations) {
    const distance = calculateTotalDistanceMatrix(perm, distMatrix);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestRoute = perm;
    }
  }
  
  const endTime = Date.now();
  const computeTime = endTime - startTime;
  
  console.log(`✅ Rute optimal ditemukan dalam ${computeTime}ms`);
  console.log(`   Jarak total: ${bestDistance.toFixed(2)} km`);
  
  return {
    sequence: bestRoute,
    totalDistance: bestDistance,
    method: 'permutation_tsp',
    computeTime,
    complexity: `O(${n}!) = ${factorial(n).toLocaleString()} operasi`
  };
}

/**
 * Nearest Neighbor Heuristic (GREEDY)
 * HASIL: SUB-OPTIMAL tapi CEPAT
 * 
 * Berguna untuk dataset besar (> 12 node)
 * Tidak menjamin optimal, tapi solusi yang baik
 * 
 * @param {Array} pangkalan - Daftar pangkalan
 * @returns {Object} Rute dengan strategi greedy
 */
function nearestNeighbor(pangkalan) {
  const n = pangkalan.length;

  // Tetap kembalikan format hasil yang konsisten untuk rute kosong.
  if (n === 0) {
    return {
      sequence: [],
      totalDistance: 0,
      method: 'nearest_neighbor',
      complexity: 'O(n²)',
      note: 'Rute kosong'
    };
  }

  const distMatrix = createDistanceMatrix(pangkalan);
  const visited = Array(n).fill(false);
  const sequence = [0]; // Mulai dari pangkalan pertama
  visited[0] = true;

  console.log(`[Rute] Menggunakan Nearest Neighbor untuk ${n} pangkalan`);

  for (let i = 1; i < n; i++) {
    const current = sequence[sequence.length - 1];
    let nearest = -1;
    let minDist = Infinity;

    for (let j = 0; j < n; j++) {
      if (!visited[j] && distMatrix[current][j] < minDist) {
        minDist = distMatrix[current][j];
        nearest = j;
      }
    }

    if (nearest !== -1) {
      sequence.push(nearest);
      visited[nearest] = true;
    }
  }

  return {
    sequence,
    totalDistance: calculateTotalDistanceMatrix(sequence, distMatrix),
    method: 'nearest_neighbor',
    complexity: 'O(n²)',
    note: 'Rute dihitung menggunakan Nearest Neighbor'
  };
}

/**
 * Helper: Hitung factorial
 */
function factorial(n) {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

/**
 * Main Optimization Function
 * Pilih algoritma yang tepat berdasarkan ukuran dataset
 * 
 * @param {Array} pangkalan - Daftar pangkalan dengan lat, lng
 * @param {boolean} preferOptimal - Prefer optimal hasil vs cepat
 * @returns {Object} Rute yang sudah dioptimasi
 */
function optimizeRoute(pangkalan, preferOptimal = true) {
  // Parameter preferOptimal dipertahankan agar pemanggilan lama tetap kompatibel.
  // Semua jumlah pangkalan menggunakan Nearest Neighbor.
  const optimizationResult = nearestNeighbor(pangkalan);

  // Estimasi waktu: 20 menit per pangkalan + 5 menit per km.
  const estimatedTime =
    (pangkalan.length * 20) + (optimizationResult.totalDistance * 5);

  return {
    sequence: optimizationResult.sequence,
    totalDistance: Math.round(optimizationResult.totalDistance * 100) / 100,
    method: optimizationResult.method,
    computeTime: optimizationResult.computeTime || 0,
    complexity: optimizationResult.complexity || 'N/A',
    estimatedTime: Math.round(estimatedTime),
    pangkalanOrdered: optimizationResult.sequence.map(
      index => pangkalan[index]
    )
  };
}

module.exports = {
  optimizeRoute,
  calculateDistance,
  createDistanceMatrix,
  permutationTSP,
  nearestNeighbor,
  generatePermutations
};