import { CircuitElement, Wire, getPinAbsolutePos } from '../components-model/element-base';
import { CircuitEngine } from '../simulator/circuit-engine';

export type ProbeType = 'osc_ch1' | 'osc_ch2' | 'osc_gnd' | 'dmm_pos' | 'dmm_neg' | 'dmm_clamp';

export interface Probe {
  type: ProbeType;
  name: string;
  color: string;
  leadColor: string;
  x: number; // Current tip coordinate on canvas
  y: number;
  originX: number; // Jack position on instrument panel
  originY: number;
  isDragging: boolean;
  attachedTo?: {
    type: 'pin' | 'element';
    compId: string;
    pinId?: string;
  };
}

export interface ProbeMeasurement {
  voltage: number;
  current: number;
  frequency?: number;
  vpp?: number;
  vrms?: number;
}

export class ProbeManager {
  probes: Record<ProbeType, Probe>;

  constructor() {
    this.probes = {
      osc_ch1: {
        type: 'osc_ch1',
        name: 'OSC CH1',
        color: '#ef4444', // Red
        leadColor: 'rgba(239, 68, 68, 0.85)',
        x: 200,
        y: 100,
        originX: 80,
        originY: 20,
        isDragging: false
      },
      osc_ch2: {
        type: 'osc_ch2',
        name: 'OSC CH2',
        color: '#3b82f6', // Blue
        leadColor: 'rgba(59, 130, 246, 0.85)',
        x: 240,
        y: 100,
        originX: 130,
        originY: 20,
        isDragging: false
      },
      osc_gnd: {
        type: 'osc_gnd',
        name: 'OSC GND',
        color: '#1f2937', // Dark gray / black clip
        leadColor: 'rgba(75, 85, 99, 0.85)',
        x: 280,
        y: 100,
        originX: 180,
        originY: 20,
        isDragging: false
      },
      dmm_pos: {
        type: 'dmm_pos',
        name: 'DMM (+)',
        color: '#f97316', // Orange-red
        leadColor: 'rgba(249, 115, 22, 0.85)',
        x: 340,
        y: 100,
        originX: 300,
        originY: 20,
        isDragging: false
      },
      dmm_neg: {
        type: 'dmm_neg',
        name: 'DMM (-)',
        color: '#374151', // Black
        leadColor: 'rgba(55, 65, 81, 0.85)',
        x: 380,
        y: 100,
        originX: 350,
        originY: 20,
        isDragging: false
      },
      dmm_clamp: {
        type: 'dmm_clamp',
        name: 'Current Clamp (電流クランプ)',
        color: '#eab308', // Yellow
        leadColor: 'rgba(234, 179, 8, 0.85)',
        x: 440,
        y: 100,
        originX: 420,
        originY: 20,
        isDragging: false
      }
    };
  }

  /**
   * Set jack origin positions based on current viewport / instrument panel layout
   */
  updateOrigins(origins: Partial<Record<ProbeType, { x: number; y: number }>>): void {
    (Object.keys(origins) as ProbeType[]).forEach(type => {
      const orig = origins[type];
      if (orig && this.probes[type]) {
        this.probes[type].originX = orig.x;
        this.probes[type].originY = orig.y;
      }
    });
  }

  /**
   * Check if a probe can snap to any pin or element under (x, y)
   */
  findSnapTarget(
    x: number,
    y: number,
    elements: CircuitElement[],
    threshold: number = 20
  ): { type: 'pin' | 'element'; compId: string; pinId?: string; snapPos: { x: number; y: number } } | null {
    // 1. Check pins first
    for (const elem of elements) {
      for (const pin of elem.pins) {
        const pPos = getPinAbsolutePos(elem, pin);
        const dist = Math.hypot(pPos.x - x, pPos.y - y);
        if (dist <= threshold) {
          return {
            type: 'pin',
            compId: elem.id,
            pinId: pin.id,
            snapPos: pPos
          };
        }
      }
    }

    // 2. Check element body (for current clamp)
    for (const elem of elements) {
      const dist = Math.hypot(elem.x - x, elem.y - y);
      if (dist <= threshold * 1.5) {
        return {
          type: 'element',
          compId: elem.id,
          snapPos: { x: elem.x, y: elem.y }
        };
      }
    }

    return null;
  }

  /**
   * Update probe position following connected pin as elements move
   */
  syncWithElements(elements: CircuitElement[]): void {
    (Object.values(this.probes) as Probe[]).forEach(probe => {
      if (probe.isDragging || !probe.attachedTo) return;
      const elem = elements.find(e => e.id === probe.attachedTo?.compId);
      if (!elem) {
        // Element was removed
        probe.attachedTo = undefined;
        return;
      }

      if (probe.attachedTo.type === 'pin' && probe.attachedTo.pinId) {
        const pin = elem.pins.find(p => p.id === probe.attachedTo?.pinId);
        if (pin) {
          const abs = getPinAbsolutePos(elem, pin);
          probe.x = abs.x;
          probe.y = abs.y;
        }
      } else if (probe.attachedTo.type === 'element') {
        probe.x = elem.x;
        probe.y = elem.y;
      }
    });
  }

  /**
   * Measure voltage for a specific probe against reference (GND or differential probe)
   */
  getProbeVoltage(probeType: 'osc_ch1' | 'osc_ch2' | 'dmm_pos', engine: CircuitEngine): number {
    const probe = this.probes[probeType];
    if (!probe.attachedTo) return 0;

    let targetNode = 0;
    if (probe.attachedTo.type === 'pin' && probe.attachedTo.pinId) {
      targetNode = engine.getPinNode(probe.attachedTo.compId, probe.attachedTo.pinId);
    }

    // Reference node:
    let refNode = 0; // Default GND
    if (probeType === 'osc_ch1' || probeType === 'osc_ch2') {
      const gndProbe = this.probes.osc_gnd;
      if (gndProbe.attachedTo && gndProbe.attachedTo.pinId) {
        refNode = engine.getPinNode(gndProbe.attachedTo.compId, gndProbe.attachedTo.pinId);
      }
    } else if (probeType === 'dmm_pos') {
      const negProbe = this.probes.dmm_neg;
      if (negProbe.attachedTo && negProbe.attachedTo.pinId) {
        refNode = engine.getPinNode(negProbe.attachedTo.compId, negProbe.attachedTo.pinId);
      }
    }

    const history = engine.getHistory();
    if (history.length === 0) return 0;
    const latest = history[history.length - 1];

    const vTarget = latest.nodes[targetNode] ?? 0;
    const vRef = latest.nodes[refNode] ?? 0;
    return vTarget - vRef;
  }

  /**
   * Get current measured by clamp or inline ammeter
   */
  getMeasuredCurrent(engine: CircuitEngine): number {
    // 1. Check clamp first
    const clamp = this.probes.dmm_clamp;
    if (clamp.attachedTo) {
      const elem = engine.elements.find(e => e.id === clamp.attachedTo?.compId);
      if (elem) {
        return elem.state.current;
      }
    }

    // 2. Check DMM probes across a component
    const pos = this.probes.dmm_pos;
    const neg = this.probes.dmm_neg;
    if (pos.attachedTo && neg.attachedTo && pos.attachedTo.compId === neg.attachedTo.compId) {
      const elem = engine.elements.find(e => e.id === pos.attachedTo?.compId);
      if (elem) return elem.state.current;
    }

    return 0;
  }
}

export const probeManager = new ProbeManager();
