import { CircuitElement, Wire, getPinAbsolutePos } from '../components-model/element-base';
import { MNAMatrix } from './mna-solver';
import { registry } from '../components-model/element-registry';
import { SubcircuitComponentDef } from '../components-model/custom-element-schema';

export interface SimulationStats {
  simTime: number; // Simulated time in seconds
  realFps: number;
  timeStep: number; // dt in seconds
  stepsPerFrame: number;
  nodeCount: number;
  converged: boolean;
}

export interface HistoryPoint {
  time: number;
  nodes: number[]; // Voltages of nodes [node0(0), node1, node2, ...]
  elementCurrents: Record<string, number>;
  elementVoltages: Record<string, number>;
}

export class CircuitEngine {
  elements: CircuitElement[] = [];
  wires: Wire[] = [];

  // Simulation params
  timeStep: number = 20e-6; // 20 microseconds (50kHz sampling)
  stepsPerFrame: number = 25; // Steps computed per animation frame (approx 500µs simulated per frame)
  simTime: number = 0;
  isRunning: boolean = true;

  // Internal graph & MNA mappings
  private pinToNodeMap: Map<string, number> = new Map(); // "compId:pinId" -> nodeId
  private nodeCount: number = 0; // Number of non-ground nodes (nodes 1..nodeCount)
  private voltageSources: { id: string; n1: number; n2: number; getVoltage: (t: number) => number; compId?: string }[] = [];

  // Measurement waveform history buffer (circular buffer for oscilloscope)
  private historyBuffer: HistoryPoint[] = [];
  private maxHistoryLength: number = 8000;

  // Performance stats
  private lastStatsTime: number = performance.now();
  private frameCounter: number = 0;
  private currentFps: number = 60;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.simTime = 0;
    this.historyBuffer = [];
    // Reset element states
    this.elements.forEach(elem => {
      elem.state.current = 0;
      elem.state.voltage = 0;
      elem.state.historyV = 0;
      elem.state.historyI = 0;
      elem.state.iterationsV = 0;
      elem.state.lightIntensity = 0;
    });
  }

  setElementsAndWires(elements: CircuitElement[], wires: Wire[]): void {
    this.elements = elements;
    this.wires = wires;
    this.rebuildTopology();
  }

  /**
   * Rebuild the circuit graph topology and assign MNA node IDs.
   * Node 0 is always Ground.
   */
  rebuildTopology(): void {
    this.pinToNodeMap.clear();
    this.voltageSources = [];

    // Collect all pins
    const pinKeys: string[] = [];
    this.elements.forEach(elem => {
      elem.pins.forEach(pin => {
        pinKeys.push(`${elem.id}:${pin.id}`);
      });
    });

    // Build connected components using Disjoint Set (Union-Find)
    const parent: Map<string, string> = new Map();
    const find = (i: string): string => {
      if (!parent.has(i)) parent.set(i, i);
      if (parent.get(i) === i) return i;
      const root = find(parent.get(i)!);
      parent.set(i, root);
      return root;
    };
    const union = (i: string, j: string) => {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) {
        parent.set(rootI, rootJ);
      }
    };

    // Connect pins joined by wires
    this.wires.forEach(wire => {
      const pinA = `${wire.fromCompId}:${wire.fromPinId}`;
      const pinB = `${wire.toCompId}:${wire.toPinId}`;
      union(pinA, pinB);
    });

    // Also connect pins that are coincident in position (on top of each other)
    const posMap: Map<string, string> = new Map();
    this.elements.forEach(elem => {
      elem.pins.forEach(pin => {
        const p = getPinAbsolutePos(elem, pin);
        // snap to 10px grid
        const key = `${Math.round(p.x / 10) * 10},${Math.round(p.y / 10) * 10}`;
        const pinKey = `${elem.id}:${pin.id}`;
        if (posMap.has(key)) {
          union(pinKey, posMap.get(key)!);
        } else {
          posMap.set(key, pinKey);
        }
      });
    });

    // Identify which group contains GND
    const groundRoots = new Set<string>();
    this.elements.forEach(elem => {
      if (elem.type === 'ground') {
        const pinKey = `${elem.id}:gnd`;
        groundRoots.add(find(pinKey));
      }
    });

    // Group pins by root
    const groups = new Map<string, string[]>();
    pinKeys.forEach(pk => {
      const root = find(pk);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root)!.push(pk);
    });

    // Assign node IDs:
    // If ground exists, that group gets node 0.
    // If no ground element exists in the circuit, pick the first group or negative rail as node 0.
    let nextNodeId = 1;
    const groupToNodeMap = new Map<string, number>();

    let gndAssigned = false;
    groups.forEach((_, root) => {
      if (groundRoots.has(root)) {
        groupToNodeMap.set(root, 0);
        gndAssigned = true;
      }
    });

    if (!gndAssigned && groups.size > 0) {
      // Choose the first group as reference node 0
      const firstRoot = groups.keys().next().value;
      if (firstRoot) {
        groupToNodeMap.set(firstRoot, 0);
      }
    }

    groups.forEach((_, root) => {
      if (!groupToNodeMap.has(root)) {
        groupToNodeMap.set(root, nextNodeId++);
      }
    });

    this.nodeCount = nextNodeId - 1;

    // Map each pin to its assigned node
    pinKeys.forEach(pk => {
      const root = find(pk);
      const nodeId = groupToNodeMap.get(root) ?? 0;
      this.pinToNodeMap.set(pk, nodeId);

      const [compId, pinId] = pk.split(':');
      const elem = this.elements.find(e => e.id === compId);
      if (elem) {
        const pin = elem.pins.find(p => p.id === pinId);
        if (pin) pin.nodeId = nodeId;
      }
    });

    // Register voltage sources for MNA
    this.elements.forEach(elem => {
      if (elem.type === 'dc_voltage') {
        const nPos = this.getPinNode(elem.id, 'pos');
        const nNeg = this.getPinNode(elem.id, 'neg');
        const vRaw = Number(elem.params.voltage);
        const v = isNaN(vRaw) ? 0 : vRaw; // treat invalid as 0V
        this.voltageSources.push({
          id: elem.id,
          n1: nPos,
          n2: nNeg,
          getVoltage: () => v,
          compId: elem.id
        });
      } else if (elem.type === 'ac_voltage') {
        const nPos = this.getPinNode(elem.id, 'pos');
        const nNeg = this.getPinNode(elem.id, 'neg');
        const ampRaw = Number(elem.params.amplitude);
        const freqRaw = Number(elem.params.frequency);
        // If amplitude or frequency invalid, treat as 0V source
        const amp = (isNaN(ampRaw) || ampRaw <= 0) ? 0 : ampRaw;
        const freq = (isNaN(freqRaw) || freqRaw <= 0) ? 50 : freqRaw;
        const offset = Number(elem.params.offset ?? 0);
        const wave = elem.params.waveform ?? 'sine';
        this.voltageSources.push({
          id: elem.id,
          n1: nPos,
          n2: nNeg,
          getVoltage: (t: number) => {
            if (amp === 0) return 0;
            const phase = 2 * Math.PI * freq * t;
            if (wave === 'square') {
              return offset + (Math.sin(phase) >= 0 ? amp : -amp);
            } else if (wave === 'triangle') {
              const fract = (t * freq) % 1.0;
              const tri = fract < 0.5 ? 4 * fract - 1 : 3 - 4 * fract;
              return offset + amp * tri;
            } else {
              return offset + amp * Math.sin(phase);
            }
          },
          compId: elem.id
        });
      } else if (elem.type === 'ammeter') {
        // Ideal ammeter is stamped as 0V voltage source to measure current
        const nIn = this.getPinNode(elem.id, 'in');
        const nOut = this.getPinNode(elem.id, 'out');
        this.voltageSources.push({
          id: elem.id,
          n1: nIn,
          n2: nOut,
          getVoltage: () => 0,
          compId: elem.id
        });
      }
    });
  }

  getPinNode(compId: string, pinId: string): number {
    return this.pinToNodeMap.get(`${compId}:${pinId}`) ?? 0;
  }

  /**
   * Run simulation for one animation frame (multiple time steps)
   */
  stepFrame(): void {
    if (!this.isRunning || this.elements.length === 0) return;

    // Track FPS
    this.frameCounter++;
    const now = performance.now();
    if (now - this.lastStatsTime >= 500) {
      this.currentFps = Math.round((this.frameCounter * 1000) / (now - this.lastStatsTime));
      this.frameCounter = 0;
      this.lastStatsTime = now;
    }

    for (let s = 0; s < this.stepsPerFrame; s++) {
      this.stepSingle(this.timeStep);
      this.simTime += this.timeStep;
    }
  }

  /**
   * Run a single discrete time step with Newton-Raphson iteration for non-linear components
   */
  stepSingle(dt: number): void {
    const totalVars = this.nodeCount + this.voltageSources.length;
    if (totalVars === 0) return;

    const matrix = new MNAMatrix(totalVars);
    let converged = false;
    const maxIterations = 15;
    let iteration = 0;

    let nodeVoltages = new Array<number>(this.nodeCount + 1).fill(0);
    const sourceCurrents = new Array<number>(this.voltageSources.length).fill(0);

    while (!converged && iteration < maxIterations) {
      iteration++;
      matrix.clear();

      // 1. Stamp linear voltage sources
      this.voltageSources.forEach((vs, idx) => {
        const v = vs.getVoltage(this.simTime);
        matrix.stampVoltageSource(vs.n1, vs.n2, idx, v, this.nodeCount);
      });

      // 2. Stamp elements
      this.elements.forEach(elem => {
        this.stampElement(elem, matrix, dt);
      });

      // 3. Solve linear system
      const solution = matrix.solve();
      if (!solution) {
        break; // Singular or unresolvable
      }

      // Extract node voltages (node 0 is GND = 0)
      const newNodeVoltages = [0];
      for (let i = 0; i < this.nodeCount; i++) {
        newNodeVoltages.push(solution[i]);
      }

      // Check Newton-Raphson convergence on non-linear elements
      let maxDelta = 0;
      for (let i = 1; i <= this.nodeCount; i++) {
        const delta = Math.abs(newNodeVoltages[i] - nodeVoltages[i]);
        if (delta > maxDelta) maxDelta = delta;
      }

      nodeVoltages = newNodeVoltages;

      // Update non-linear components operating points for next iteration
      this.elements.forEach(elem => {
        if (elem.type === 'diode' || elem.type === 'led' || elem.type === 'zener') {
          const vA = nodeVoltages[this.getPinNode(elem.id, 'anode')] ?? 0;
          const vK = nodeVoltages[this.getPinNode(elem.id, 'cathode')] ?? 0;
          const vdTarget = vA - vK;
          const vdOld = elem.state.iterationsV ?? 0;
          elem.state.iterationsV = vdOld + 0.6 * (vdTarget - vdOld);
        } else if (elem.type === 'npn') {
          const vB = nodeVoltages[this.getPinNode(elem.id, 'base')] ?? 0;
          const vC = nodeVoltages[this.getPinNode(elem.id, 'collector')] ?? 0;
          const vE = nodeVoltages[this.getPinNode(elem.id, 'emitter')] ?? 0;
          const vbeTarget = vB - vE;
          const vbcTarget = vB - vC;
          const vbeOld = elem.state.iterationsV ?? 0.6;
          const vbcOld = elem.state.historyV ?? -1.0;
          elem.state.iterationsV = vbeOld + 0.6 * (vbeTarget - vbeOld);
          elem.state.historyV = vbcOld + 0.6 * (vbcTarget - vbcOld);
        } else if (elem.type === 'pnp') {
          const vB = nodeVoltages[this.getPinNode(elem.id, 'base')] ?? 0;
          const vC = nodeVoltages[this.getPinNode(elem.id, 'collector')] ?? 0;
          const vE = nodeVoltages[this.getPinNode(elem.id, 'emitter')] ?? 0;
          const vebTarget = vE - vB;
          const vcbTarget = vC - vB;
          const vebOld = elem.state.iterationsV ?? 0.6;
          const vcbOld = elem.state.historyV ?? -1.0;
          elem.state.iterationsV = vebOld + 0.6 * (vebTarget - vebOld);
          elem.state.historyV = vcbOld + 0.6 * (vcbTarget - vcbOld);
        }
      });

      // Extract source currents
      for (let i = 0; i < this.voltageSources.length; i++) {
        sourceCurrents[i] = solution[this.nodeCount + i];
      }

      if (maxDelta < 1e-4 || iteration >= maxIterations) {
        converged = true;
      }
    }

    // Update element states based on solved voltages
    const elemVoltages: Record<string, number> = {};
    const elemCurrents: Record<string, number> = {};

    this.elements.forEach(elem => {
      this.updateElementState(elem, nodeVoltages, sourceCurrents, dt);
      elemVoltages[elem.id] = elem.state.voltage;
      elemCurrents[elem.id] = elem.state.current;
    });

    // Update wire voltages & currents for visual display
    this.wires.forEach(wire => {
      const n1 = this.getPinNode(wire.fromCompId, wire.fromPinId);
      const n2 = this.getPinNode(wire.toCompId, wire.toPinId);
      wire.voltage = nodeVoltages[n1] ?? 0;
      // Approximate wire current from connected element
      const comp = this.elements.find(e => e.id === wire.fromCompId || e.id === wire.toCompId);
      wire.current = comp ? comp.state.current : 0;
    });

    // Record waveform in history ring buffer
    this.historyBuffer.push({
      time: this.simTime,
      nodes: [...nodeVoltages],
      elementCurrents: { ...elemCurrents },
      elementVoltages: { ...elemVoltages }
    });

    if (this.historyBuffer.length > this.maxHistoryLength) {
      this.historyBuffer.shift();
    }
  }

  /**
   * Stamp element into MNA matrix
   */
  private stampElement(elem: CircuitElement, mna: MNAMatrix, dt: number): void {
    switch (elem.type) {
      case 'resistor': {
        const n1 = this.getPinNode(elem.id, 'pin1');
        const n2 = this.getPinNode(elem.id, 'pin2');
        const rRaw = Number(elem.params.resistance);
        if (isNaN(rRaw) || rRaw <= 0) break; // invalid param — treat as open circuit
        const r = rRaw;
        mna.stampConductance(n1, n2, 1.0 / r);
        break;
      }

      case 'capacitor': {
        // Trapezoidal integration: Geq = 2*C / dt, Ieq = -Geq * v_prev - i_prev
        const n1 = this.getPinNode(elem.id, 'pin1');
        const n2 = this.getPinNode(elem.id, 'pin2');
        const cRaw = Number(elem.params.capacitance);
        if (isNaN(cRaw) || cRaw <= 0) break; // invalid — treat as open circuit
        const c = cRaw;
        const geq = (2 * c) / dt;
        const ieq = -geq * (elem.state.historyV ?? 0) - (elem.state.historyI ?? 0);
        mna.stampConductance(n1, n2, geq);
        mna.stampCurrentSource(n1, n2, -ieq); // flowing from n1 to n2
        break;
      }

      case 'inductor': {
        // Trapezoidal integration: Geq = dt / (2*L), Ieq = i_prev + Geq * v_prev
        const n1 = this.getPinNode(elem.id, 'pin1');
        const n2 = this.getPinNode(elem.id, 'pin2');
        const lRaw = Number(elem.params.inductance);
        if (isNaN(lRaw) || lRaw <= 0) break; // invalid — treat as open circuit
        const l = lRaw;
        const geq = dt / (2 * l);
        const ieq = (elem.state.historyI ?? 0) + geq * (elem.state.historyV ?? 0);
        mna.stampConductance(n1, n2, geq);
        mna.stampCurrentSource(n1, n2, -ieq);
        break;
      }

      case 'switch': {
        const n1 = this.getPinNode(elem.id, 'pin1');
        const n2 = this.getPinNode(elem.id, 'pin2');
        const isClosed = !elem.state.isOpen;
        const r = isClosed ? 1e-3 : 1e8; // 1 mΩ closed, 100 MΩ open
        mna.stampConductance(n1, n2, 1.0 / r);
        break;
      }

      case 'diode':
      case 'led': {
        const nA = this.getPinNode(elem.id, 'anode');
        const nK = this.getPinNode(elem.id, 'cathode');
        const Is = Number(elem.params.Is ?? 1e-14);
        const Vt = Number(elem.params.Vt ?? 0.026);
        const Vf = Number(elem.params.Vf ?? (elem.type === 'led' ? 1.8 : 0.65));

        // Operating point voltage from previous iteration
        let vd = elem.state.iterationsV ?? 0;
        // Damp / clamp voltage to prevent exp overflow
        if (vd > 1.2 * Vf) vd = 1.2 * Vf;
        if (vd < -50) vd = -50;

        // Shockley diode linearized: Id = Is * (exp(vd/Vt) - 1)
        const expTerm = Math.exp(Math.min(vd / Vt, 40));
        const gd = Math.max((Is / Vt) * expTerm, 1e-12);
        const id0 = Is * (expTerm - 1);
        const ieq = id0 - gd * vd;

        mna.stampConductance(nA, nK, gd);
        mna.stampCurrentSource(nA, nK, -ieq);
        break;
      }

      case 'zener': {
        const nA = this.getPinNode(elem.id, 'anode');
        const nK = this.getPinNode(elem.id, 'cathode');
        const Vz = Number(elem.params.Vz ?? 5.1);
        const Rz = Number(elem.params.Rz ?? 10);
        const Vf = Number(elem.params.Vf ?? 0.7);

        const vd = elem.state.iterationsV ?? 0; // V(anode) - V(cathode)
        if (vd > Vf) {
          // Forward conduction
          const gd = 1.0 / 5.0; // 5 ohm forward
          const ieq = -gd * Vf;
          mna.stampConductance(nA, nK, gd);
          mna.stampCurrentSource(nA, nK, ieq);
        } else if (vd < -Vz) {
          // Zener breakdown reverse conduction: V(cathode) - V(anode) > Vz
          const gz = 1.0 / Rz;
          const ieq = gz * Vz;
          mna.stampConductance(nA, nK, gz);
          mna.stampCurrentSource(nA, nK, ieq);
        } else {
          // Reverse leakage
          mna.stampConductance(nA, nK, 1e-9);
        }
        break;
      }

      case 'npn': {
        const nB = this.getPinNode(elem.id, 'base');
        const nC = this.getPinNode(elem.id, 'collector');
        const nE = this.getPinNode(elem.id, 'emitter');
        const beta = Number(elem.params.beta ?? 200);
        const Is = Number(elem.params.Is ?? 1e-14);
        const Vt = Number(elem.params.Vt ?? 0.026);

        // Operating points with safety limits
        let vbe = elem.state.iterationsV ?? 0.6;
        let vbc = elem.state.historyV ?? -1.0;
        if (vbe > 0.85) vbe = 0.85;
        if (vbe < -5) vbe = -5;
        if (vbc > 0.85) vbc = 0.85;
        if (vbc < -50) vbc = -50;

        // Base-Emitter Diode
        const expBE = Math.exp(Math.min(vbe / Vt, 35));
        const gbe = Math.max((Is / (beta * Vt)) * expBE, 1e-12);
        const ibe0 = (Is / beta) * (expBE - 1);
        const ieq_be = ibe0 - gbe * vbe;

        // Base-Collector Diode (Saturation clamp when Vc < Vb)
        const expBC = Math.exp(Math.min(vbc / Vt, 35));
        const gbc = Math.max((Is / (beta * Vt)) * expBC, 1e-12);
        const ibc0 = (Is / beta) * (expBC - 1);
        const ieq_bc = ibc0 - gbc * vbc;

        // Stamp BE diode
        mna.stampConductance(nB, nE, gbe);
        mna.stampCurrentSource(nB, nE, -ieq_be);

        // Stamp BC diode (clamps collector voltage to >= 0.1V above emitter)
        mna.stampConductance(nB, nC, gbc);
        mna.stampCurrentSource(nB, nC, -ieq_bc);

        // Active forward collector current: Ic_fwd = beta * Ibe (flows C -> E)
        const gm_be = beta * gbe;
        mna.stampVCCS(nC, nE, nB, nE, gm_be);
        mna.stampCurrentSource(nC, nE, -beta * ieq_be);

        // Reverse saturation collector current: Ic_rev = (beta + 1) * Ibc (flows E -> C)
        const gm_bc = (beta + 1) * gbc;
        mna.stampVCCS(nE, nC, nB, nC, gm_bc);
        mna.stampCurrentSource(nE, nC, -(beta + 1) * ieq_bc);
        break;
      }

      case 'pnp': {
        const nB = this.getPinNode(elem.id, 'base');
        const nC = this.getPinNode(elem.id, 'collector');
        const nE = this.getPinNode(elem.id, 'emitter');
        const beta = Number(elem.params.beta ?? 200);
        const Is = Number(elem.params.Is ?? 1e-14);
        const Vt = Number(elem.params.Vt ?? 0.026);

        let veb = elem.state.iterationsV ?? 0.6;
        let vcb = elem.state.historyV ?? -1.0;
        if (veb > 0.85) veb = 0.85;
        if (veb < -5) veb = -5;
        if (vcb > 0.85) vcb = 0.85;
        if (vcb < -50) vcb = -50;

        // Emitter-Base Diode
        const expEB = Math.exp(Math.min(veb / Vt, 35));
        const geb = Math.max((Is / (beta * Vt)) * expEB, 1e-12);
        const ieb0 = (Is / beta) * (expEB - 1);
        const ieq_eb = ieb0 - geb * veb;

        // Collector-Base Diode
        const expCB = Math.exp(Math.min(vcb / Vt, 35));
        const gcb = Math.max((Is / (beta * Vt)) * expCB, 1e-12);
        const icb0 = (Is / beta) * (expCB - 1);
        const ieq_cb = icb0 - gcb * vcb;

        // Stamp EB diode
        mna.stampConductance(nE, nB, geb);
        mna.stampCurrentSource(nE, nB, -ieq_eb);

        // Stamp CB diode
        mna.stampConductance(nC, nB, gcb);
        mna.stampCurrentSource(nC, nB, -ieq_cb);

        // Active forward current (flows E -> C)
        const gm_eb = beta * geb;
        mna.stampVCCS(nE, nC, nE, nB, gm_eb);
        mna.stampCurrentSource(nE, nC, -beta * ieq_eb);

        // Reverse saturation current (flows C -> E)
        const gm_cb = (beta + 1) * gcb;
        mna.stampVCCS(nC, nE, nC, nB, gm_cb);
        mna.stampCurrentSource(nC, nE, -(beta + 1) * ieq_cb);
        break;
      }

      case 'subcircuit': {
        // Handle subcircuit modules like Op-Amps
        const def = registry.getCustomDefinitions().find(d => d.typeId === elem.customTypeId) as SubcircuitComponentDef;
        if (def && def.kind === 'subcircuit') {
          this.stampSubcircuit(elem, def, mna);
        }
        break;
      }
    }
  }

  /**
   * Stamp subcircuit (e.g. Op-Amp LM358 equivalent model)
   */
  private stampSubcircuit(elem: CircuitElement, def: SubcircuitComponentDef, mna: MNAMatrix): void {
    if (def.typeId === 'opamp_ideal') {
      const nPos = this.getPinNode(elem.id, 'in_pos');
      const nNeg = this.getPinNode(elem.id, 'in_neg');
      const nOut = this.getPinNode(elem.id, 'out');

      // Differential input resistance (10 MΩ)
      mna.stampConductance(nPos, nNeg, 1e-7);

      // Output resistance (50 Ω) and VCVS with gain 100,000
      // V_out = Rout * (gm * (V_pos - V_neg)) => gm = Gain / Rout = 1e5 / 50 = 2000
      const rout = 50;
      const gain = 1e5;
      const gm = gain / rout;
      mna.stampConductance(nOut, 0, 1.0 / rout);
      mna.stampVCCS(nOut, 0, nPos, nNeg, gm);
    }
  }

  /**
   * Update calculated current, voltage, power and history variables for each element
   */
  private updateElementState(elem: CircuitElement, nodeV: number[], sourceCurrents: number[], dt: number): void {
    switch (elem.type) {
      case 'resistor': {
        const v1 = nodeV[this.getPinNode(elem.id, 'pin1')] ?? 0;
        const v2 = nodeV[this.getPinNode(elem.id, 'pin2')] ?? 0;
        const v = v1 - v2;
        const rRaw = Number(elem.params.resistance);
        if (isNaN(rRaw) || rRaw <= 0) {
          elem.state.voltage = 0; elem.state.current = 0; elem.state.power = 0;
          break;
        }
        elem.state.voltage = v;
        elem.state.current = v / rRaw;
        elem.state.power = Math.abs(v * elem.state.current);
        break;
      }

      case 'capacitor': {
        const v1 = nodeV[this.getPinNode(elem.id, 'pin1')] ?? 0;
        const v2 = nodeV[this.getPinNode(elem.id, 'pin2')] ?? 0;
        const v = v1 - v2;
        const cRaw = Number(elem.params.capacitance);
        if (isNaN(cRaw) || cRaw <= 0) {
          elem.state.voltage = 0; elem.state.current = 0;
          break;
        }
        const geq = (2 * cRaw) / dt;
        const i = geq * (v - (elem.state.historyV ?? 0)) - (elem.state.historyI ?? 0);

        elem.state.voltage = v;
        elem.state.current = i;
        elem.state.historyV = v;
        elem.state.historyI = i;
        break;
      }

      case 'inductor': {
        const v1 = nodeV[this.getPinNode(elem.id, 'pin1')] ?? 0;
        const v2 = nodeV[this.getPinNode(elem.id, 'pin2')] ?? 0;
        const v = v1 - v2;
        const lRaw = Number(elem.params.inductance);
        if (isNaN(lRaw) || lRaw <= 0) {
          elem.state.voltage = 0; elem.state.current = 0;
          break;
        }
        const geq = dt / (2 * lRaw);
        const i = (elem.state.historyI ?? 0) + geq * ((elem.state.historyV ?? 0) + v);

        elem.state.voltage = v;
        elem.state.current = i;
        elem.state.historyV = v;
        elem.state.historyI = i;
        break;
      }

      case 'diode':
      case 'led': {
        const vA = nodeV[this.getPinNode(elem.id, 'anode')] ?? 0;
        const vK = nodeV[this.getPinNode(elem.id, 'cathode')] ?? 0;
        const vd = vA - vK;
        const Is = Number(elem.params.Is ?? 1e-14);
        const Vt = Number(elem.params.Vt ?? 0.026);
        const id = Is * (Math.exp(Math.min(vd / Vt, 35)) - 1);

        elem.state.voltage = vd;
        elem.state.current = id;
        elem.state.iterationsV = vd;
        elem.state.isConducting = id > 1e-4;

        if (elem.type === 'led') {
          // Visual light intensity based on current up to 20mA
          elem.state.lightIntensity = Math.min(1.0, Math.max(0, id / 0.015));
        }
        break;
      }

      case 'zener': {
        const vA = nodeV[this.getPinNode(elem.id, 'anode')] ?? 0;
        const vK = nodeV[this.getPinNode(elem.id, 'cathode')] ?? 0;
        const vd = vA - vK;
        elem.state.voltage = vd;
        elem.state.iterationsV = vd;
        const Vz = Number(elem.params.Vz ?? 5.1);
        const Rz = Number(elem.params.Rz ?? 10);
        if (vd < -Vz) {
          elem.state.current = -(Math.abs(vd) - Vz) / Rz;
        } else if (vd > 0.7) {
          elem.state.current = (vd - 0.7) / 5;
        } else {
          elem.state.current = 0;
        }
        break;
      }

      case 'npn': {
        const vB = nodeV[this.getPinNode(elem.id, 'base')] ?? 0;
        const vC = nodeV[this.getPinNode(elem.id, 'collector')] ?? 0;
        const vE = nodeV[this.getPinNode(elem.id, 'emitter')] ?? 0;
        const vbe = vB - vE;
        const vbc = vB - vC;
        elem.state.iterationsV = vbe;
        elem.state.historyV = vbc;
        elem.state.voltage = vC - vE; // Vce

        const beta = Number(elem.params.beta ?? 200);
        const Is = Number(elem.params.Is ?? 1e-14);
        const Vt = Number(elem.params.Vt ?? 0.026);

        const ibe = (Is / beta) * (Math.exp(Math.min(vbe / Vt, 35)) - 1);
        const ibc = (Is / beta) * (Math.exp(Math.min(vbc / Vt, 35)) - 1);
        const ic = beta * ibe - (beta + 1) * ibc;
        elem.state.current = Math.max(0, ic);
        break;
      }

      case 'pnp': {
        const vB = nodeV[this.getPinNode(elem.id, 'base')] ?? 0;
        const vC = nodeV[this.getPinNode(elem.id, 'collector')] ?? 0;
        const vE = nodeV[this.getPinNode(elem.id, 'emitter')] ?? 0;
        const veb = vE - vB;
        const vcb = vC - vB;
        elem.state.iterationsV = veb;
        elem.state.historyV = vcb;
        elem.state.voltage = vE - vC; // Vec

        const beta = Number(elem.params.beta ?? 200);
        const Is = Number(elem.params.Is ?? 1e-14);
        const Vt = Number(elem.params.Vt ?? 0.026);

        const ieb = (Is / beta) * (Math.exp(Math.min(veb / Vt, 35)) - 1);
        const icb = (Is / beta) * (Math.exp(Math.min(vcb / Vt, 35)) - 1);
        const ic = beta * ieb - (beta + 1) * icb;
        elem.state.current = Math.max(0, ic);
        break;
      }

      case 'dc_voltage':
      case 'ac_voltage':
      case 'ammeter': {
        const vsIndex = this.voltageSources.findIndex(vs => vs.id === elem.id);
        if (vsIndex !== -1) {
          elem.state.current = -sourceCurrents[vsIndex]; // MNA source current sign convention
        }
        const v1 = nodeV[this.getPinNode(elem.id, elem.type === 'ammeter' ? 'in' : 'pos')] ?? 0;
        const v2 = nodeV[this.getPinNode(elem.id, elem.type === 'ammeter' ? 'out' : 'neg')] ?? 0;
        elem.state.voltage = v1 - v2;
        break;
      }

      case 'switch': {
        const v1 = nodeV[this.getPinNode(elem.id, 'pin1')] ?? 0;
        const v2 = nodeV[this.getPinNode(elem.id, 'pin2')] ?? 0;
        const v = v1 - v2;
        const isClosed = !elem.state.isOpen;
        elem.state.voltage = v;
        elem.state.current = isClosed ? v / 1e-3 : v / 1e8;
        break;
      }
    }
  }

  getHistory(): HistoryPoint[] {
    return this.historyBuffer;
  }

  getStats(): SimulationStats {
    return {
      simTime: this.simTime,
      realFps: this.currentFps,
      timeStep: this.timeStep,
      stepsPerFrame: this.stepsPerFrame,
      nodeCount: this.nodeCount,
      converged: true
    };
  }
}
