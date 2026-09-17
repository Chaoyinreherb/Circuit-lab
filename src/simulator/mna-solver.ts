/**
 * Linear equation solver using Gaussian Elimination with partial pivoting
 * Solves A * x = b for x
 */
export function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  // Deep copy A and b to avoid mutating input
  const M: number[][] = A.map(row => [...row]);
  const x: number[] = [...b];

  // Forward elimination
  for (let i = 0; i < n; i++) {
    // Search for maximum in column i
    let maxEl = Math.abs(M[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > maxEl) {
        maxEl = Math.abs(M[k][i]);
        maxRow = k;
      }
    }

    // Swap maximum row with current row
    if (maxRow !== i) {
      const tempRow = M[i];
      M[i] = M[maxRow];
      M[maxRow] = tempRow;

      const tempVal = x[i];
      x[i] = x[maxRow];
      x[maxRow] = tempVal;
    }

    // Singular matrix check
    if (Math.abs(M[i][i]) < 1e-12) {
      // Add tiny epsilon to diagonal to prevent singular matrix division if floating node
      M[i][i] = 1e-12;
    }

    // Eliminate below
    for (let k = i + 1; k < n; k++) {
      const c = M[k][i] / M[i][i];
      for (let j = i; j < n; j++) {
        if (i === j) {
          M[k][j] = 0;
        } else {
          M[k][j] -= c * M[i][j];
        }
      }
      x[k] -= c * x[i];
    }
  }

  // Back substitution
  const result = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = x[i];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * result[j];
    }
    result[i] = sum / M[i][i];
    if (isNaN(result[i]) || !isFinite(result[i])) {
      result[i] = 0;
    }
  }

  return result;
}

/**
 * MNA Matrix builder helper
 */
export class MNAMatrix {
  size: number;
  A: number[][];
  b: number[];

  constructor(size: number) {
    this.size = size;
    this.A = Array.from({ length: size }, () => new Array(size).fill(0));
    this.b = new Array(size).fill(0);
  }

  clear(): void {
    for (let i = 0; i < this.size; i++) {
      this.A[i].fill(0);
      this.b[i] = 0;
    }
  }

  // Stamp conductance between node1 and node2
  stampConductance(n1: number, n2: number, g: number): void {
    if (isNaN(g) || !isFinite(g)) return;
    if (n1 > 0) this.A[n1 - 1][n1 - 1] += g;
    if (n2 > 0) this.A[n2 - 1][n2 - 1] += g;
    if (n1 > 0 && n2 > 0) {
      this.A[n1 - 1][n2 - 1] -= g;
      this.A[n2 - 1][n1 - 1] -= g;
    }
  }

  // Stamp independent current source into n1 and out of n2
  stampCurrentSource(n1: number, n2: number, current: number): void {
    if (isNaN(current) || !isFinite(current)) return;
    if (n1 > 0) this.b[n1 - 1] += current;
    if (n2 > 0) this.b[n2 - 1] -= current;
  }

  // Stamp voltage source between n1(+) and n2(-) with sourceIndex (0-indexed among voltage sources)
  // nodeCount is the number of non-ground nodes
  stampVoltageSource(n1: number, n2: number, vIndex: number, voltage: number, nodeCount: number): void {
    const row = nodeCount + vIndex;
    if (n1 > 0) {
      this.A[n1 - 1][row] += 1;
      this.A[row][n1 - 1] += 1;
    }
    if (n2 > 0) {
      this.A[n2 - 1][row] -= 1;
      this.A[row][n2 - 1] -= 1;
    }
    this.b[row] += voltage;
  }

  // Stamp Voltage-Controlled Current Source (VCCS): I = gm * (n_ctrl_pos - n_ctrl_neg) flowing from n_out_neg to n_out_pos
  stampVCCS(outPos: number, outNeg: number, ctrlPos: number, ctrlNeg: number, gm: number): void {
    if (isNaN(gm) || !isFinite(gm)) return;
    if (outPos > 0) {
      if (ctrlPos > 0) this.A[outPos - 1][ctrlPos - 1] += gm;
      if (ctrlNeg > 0) this.A[outPos - 1][ctrlNeg - 1] -= gm;
    }
    if (outNeg > 0) {
      if (ctrlPos > 0) this.A[outNeg - 1][ctrlPos - 1] -= gm;
      if (ctrlNeg > 0) this.A[outNeg - 1][ctrlNeg - 1] += gm;
    }
  }

  // Stamp a shunt conductance to ground to guarantee matrix invertibility for floating nodes
  addGroundConductance(g: number = 1e-12): void {
    for (let i = 0; i < this.size; i++) {
      this.A[i][i] += g;
    }
  }

  solve(): number[] | null {
    this.addGroundConductance();
    return solveLinearSystem(this.A, this.b);
  }
}
