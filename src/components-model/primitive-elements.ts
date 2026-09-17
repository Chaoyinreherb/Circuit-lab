import { CircuitElement, Pin, ElementType } from './element-base';

let nextCompId = 1;
export function generateElementId(prefix: string = 'comp'): string {
  return `${prefix}_${Date.now().toString(36)}_${(nextCompId++).toString(36)}`;
}

export interface ElementTemplate {
  type: ElementType;
  customTypeId?: string;
  name: string;
  category: 'Sources' | 'Passives' | 'Semiconductors' | 'Control' | 'Instruments' | 'IC / Amplifiers' | 'Modules' | 'Logic' | 'Sensors' | 'Custom';
  defaultParams: Record<string, any>;
  pins: Pin[];
  description: string;
  symbolColor?: string;
}

export const PRIMITIVE_TEMPLATES: ElementTemplate[] = [
  // Sources
  {
    type: 'ground',
    name: 'Ground (GND)',
    category: 'Sources',
    description: '0V reference node',
    defaultParams: {},
    pins: [
      { id: 'gnd', name: 'GND', x: 0, y: -20, direction: 'top' }
    ]
  },
  {
    type: 'dc_voltage',
    name: 'DC Voltage (直流電源)',
    category: 'Sources',
    description: 'Constant DC voltage source',
    defaultParams: { voltage: 5.0 },
    pins: [
      { id: 'pos', name: '+', x: 0, y: -20, direction: 'top' },
      { id: 'neg', name: '-', x: 0, y: 20, direction: 'bottom' }
    ]
  },
  {
    type: 'ac_voltage',
    name: 'AC Voltage (交流信号源)',
    category: 'Sources',
    description: 'AC wave generator (Sine, Square, Triangle)',
    defaultParams: {
      amplitude: 5.0, // Peak amplitude in Volts
      frequency: 50.0, // Hz
      waveform: 'sine', // 'sine' | 'square' | 'triangle'
      offset: 0.0,
      phase: 0.0
    },
    pins: [
      { id: 'pos', name: '+', x: 0, y: -20, direction: 'top' },
      { id: 'neg', name: '-', x: 0, y: 20, direction: 'bottom' }
    ]
  },

  // Passives (R, L, C)
  {
    type: 'resistor',
    name: 'Resistor (抵抗)',
    category: 'Passives',
    description: 'Standard linear resistor (Ohm)',
    defaultParams: { resistance: 1000 }, // 1 kΩ
    pins: [
      { id: 'pin1', name: '1', x: -30, y: 0, direction: 'left' },
      { id: 'pin2', name: '2', x: 30, y: 0, direction: 'right' }
    ]
  },
  {
    type: 'capacitor',
    name: 'Capacitor (コンデンサ)',
    category: 'Passives',
    description: 'Energy storing capacitor (Farad)',
    defaultParams: { capacitance: 10e-6 }, // 10 µF
    pins: [
      { id: 'pin1', name: '+', x: -20, y: 0, direction: 'left' },
      { id: 'pin2', name: '-', x: 20, y: 0, direction: 'right' }
    ]
  },
  {
    type: 'inductor',
    name: 'Inductor (コイル)',
    category: 'Passives',
    description: 'Magnetic energy storing inductor (Henry)',
    defaultParams: { inductance: 0.1 }, // 100 mH
    pins: [
      { id: 'pin1', name: '1', x: -25, y: 0, direction: 'left' },
      { id: 'pin2', name: '2', x: 25, y: 0, direction: 'right' }
    ]
  },

  // Semiconductors (Diode, BJT Transistor)
  {
    type: 'diode',
    name: 'Diode (ダイオード)',
    category: 'Semiconductors',
    description: 'PN junction diode (1N4148 equivalent)',
    defaultParams: {
      Is: 1e-14, // Saturation current
      Vt: 0.026, // Thermal voltage (26mV at room temp)
      Vf: 0.65   // Typical nominal drop
    },
    pins: [
      { id: 'anode', name: 'A (+)', x: -20, y: 0, direction: 'left' },
      { id: 'cathode', name: 'K (-)', x: 20, y: 0, direction: 'right' }
    ]
  },
  {
    type: 'npn',
    name: 'NPN Transistor (NPN BJT)',
    category: 'Semiconductors',
    description: 'Bipolar Junction Transistor NPN (2SC1815)',
    defaultParams: {
      beta: 200, // Common emitter current gain (hFE)
      Is: 1e-14,
      Vt: 0.026
    },
    pins: [
      { id: 'base', name: 'B', x: -20, y: 0, direction: 'left' },
      { id: 'collector', name: 'C', x: 15, y: -20, direction: 'top' },
      { id: 'emitter', name: 'E', x: 15, y: 20, direction: 'bottom' }
    ]
  },
  {
    type: 'pnp',
    name: 'PNP Transistor (PNP BJT)',
    category: 'Semiconductors',
    description: 'Bipolar Junction Transistor PNP (2SA1015)',
    defaultParams: {
      beta: 200,
      Is: 1e-14,
      Vt: 0.026
    },
    pins: [
      { id: 'base', name: 'B', x: -20, y: 0, direction: 'left' },
      { id: 'collector', name: 'C', x: 15, y: 20, direction: 'bottom' },
      { id: 'emitter', name: 'E', x: 15, y: -20, direction: 'top' }
    ]
  },

  // Control & Instruments
  {
    type: 'switch',
    name: 'SPST Switch (スイッチ)',
    category: 'Control',
    description: 'Single-pole single-throw toggle switch',
    defaultParams: { closed: false },
    pins: [
      { id: 'pin1', name: '1', x: -20, y: 0, direction: 'left' },
      { id: 'pin2', name: '2', x: 20, y: 0, direction: 'right' }
    ]
  },
  {
    type: 'ammeter',
    name: 'In-line Ammeter (直列電流計)',
    category: 'Instruments',
    description: 'Zero-resistance current meter inserted in series',
    defaultParams: {},
    pins: [
      { id: 'in', name: '+', x: -20, y: 0, direction: 'left' },
      { id: 'out', name: '-', x: 20, y: 0, direction: 'right' }
    ]
  }
];

export function createElementFromTemplate(template: ElementTemplate, x: number, y: number): CircuitElement {
  return {
    id: generateElementId(template.type),
    type: template.type,
    customTypeId: template.customTypeId,
    name: template.name,
    x,
    y,
    rotation: 0,
    pins: template.pins.map(p => ({ ...p })),
    params: { ...template.defaultParams },
    state: {
      current: 0,
      voltage: 0,
      power: 0,
      historyV: 0,
      historyI: 0,
      isOpen: template.type === 'switch' ? !template.defaultParams.closed : false
    }
  };
}
