/**
 * Custom Element JSON Schema Definitions
 * Allows users to easily define and load new components via JSON.
 */

export interface PinDefinition {
  id: string;
  name: string;
  x: number; // Relative coordinate from center (-20 to 20 typically)
  y: number;
  direction?: 'left' | 'right' | 'top' | 'bottom';
}

// Parametric custom element (specialized diode, LED, Zener, transistor, etc.)
export interface ParametricComponentDef {
  kind: 'parametric';
  typeId: string;
  name: string;
  category: 'Semiconductors' | 'Passive' | 'Sources' | 'Sensors' | 'Custom';
  description?: string;
  baseType: 'resistor' | 'capacitor' | 'inductor' | 'diode' | 'zener' | 'led' | 'npn' | 'pnp' | 'switch';
  pins: PinDefinition[];
  params: Record<string, number | string | boolean>;
  color?: string;
  symbolIcon?: string;
}

// Internal element within a subcircuit
export interface SubcircuitElementDef {
  id: string;
  type: string; // resistor, diode, vcvs, capacitor, etc.
  pins: Record<string, string>; // e.g. { "pos": "in_pos", "neg": "internal_node_1" }
  params: Record<string, number | string | boolean>;
}

// Subcircuit-based custom element (Op-Amp, Logic Gate, Bridge Rectifier, 555 Timer, etc.)
export interface SubcircuitComponentDef {
  kind: 'subcircuit';
  typeId: string;
  name: string;
  category: 'IC / Amplifiers' | 'Modules' | 'Logic' | 'Custom';
  description?: string;
  width?: number;
  height?: number;
  pins: PinDefinition[];
  internalElements: SubcircuitElementDef[];
  symbolShape?: 'rect' | 'triangle' | 'ic_dip';
  color?: string;
}

export type CustomComponentDefinition = ParametricComponentDef | SubcircuitComponentDef;

/**
 * Built-in preset custom definitions (demonstrating JSON extensibility)
 */
export const PRESET_CUSTOM_DEFINITIONS: CustomComponentDefinition[] = [
  {
    kind: 'parametric',
    typeId: 'led_red',
    name: 'Red LED (赤色発光ダイオード)',
    category: 'Semiconductors',
    description: 'Forward voltage Vf ≈ 1.8V, emits red glow when conducting',
    baseType: 'led',
    color: '#ef4444',
    pins: [
      { id: 'anode', name: 'A (+)', x: -20, y: 0, direction: 'left' },
      { id: 'cathode', name: 'K (-)', x: 20, y: 0, direction: 'right' }
    ],
    params: {
      Vf: 1.8,
      Is: 1e-15,
      color: '#ef4444',
      name: 'Red LED'
    }
  },
  {
    kind: 'parametric',
    typeId: 'led_blue',
    name: 'Blue LED (青色発光ダイオード)',
    category: 'Semiconductors',
    description: 'Forward voltage Vf ≈ 3.2V, emits vibrant blue glow',
    baseType: 'led',
    color: '#3b82f6',
    pins: [
      { id: 'anode', name: 'A (+)', x: -20, y: 0, direction: 'left' },
      { id: 'cathode', name: 'K (-)', x: 20, y: 0, direction: 'right' }
    ],
    params: {
      Vf: 3.2,
      Is: 1e-18,
      color: '#3b82f6',
      name: 'Blue LED'
    }
  },
  {
    kind: 'parametric',
    typeId: 'zener_5v1',
    name: 'Zener Diode 5.1V (ツェナーダイオード)',
    category: 'Semiconductors',
    description: 'Breakdown voltage Vz = 5.1V for voltage stabilization',
    baseType: 'zener',
    color: '#10b981',
    pins: [
      { id: 'anode', name: 'A (+)', x: -20, y: 0, direction: 'left' },
      { id: 'cathode', name: 'K (-)', x: 20, y: 0, direction: 'right' }
    ],
    params: {
      Vz: 5.1,
      Vf: 0.7,
      Rz: 10,
      name: '5.1V Zener'
    }
  },
  {
    kind: 'parametric',
    typeId: 'bjt_2sc1815',
    name: '2SC1815 (NPN High Gain)',
    category: 'Semiconductors',
    description: 'Standard NPN BJT transistor, hFE ≈ 200',
    baseType: 'npn',
    pins: [
      { id: 'base', name: 'B', x: -20, y: 0, direction: 'left' },
      { id: 'collector', name: 'C', x: 15, y: -20, direction: 'top' },
      { id: 'emitter', name: 'E', x: 15, y: 20, direction: 'bottom' }
    ],
    params: {
      beta: 200,
      Is: 1e-14,
      name: '2SC1815'
    }
  },
  {
    kind: 'subcircuit',
    typeId: 'opamp_ideal',
    name: 'Operational Amplifier (オペアンプ LM358相当)',
    category: 'IC / Amplifiers',
    description: 'Differential input op-amp, gain A = 100,000',
    width: 60,
    height: 50,
    symbolShape: 'triangle',
    pins: [
      { id: 'in_pos', name: '+', x: -30, y: -15, direction: 'left' },
      { id: 'in_neg', name: '-', x: -30, y: 15, direction: 'left' },
      { id: 'out', name: 'OUT', x: 30, y: 0, direction: 'right' }
    ],
    internalElements: [
      {
        id: 'rin',
        type: 'resistor',
        pins: { 'pin1': 'in_pos', 'pin2': 'in_neg' },
        params: { value: 1e7 }
      },
      {
        id: 'vcvs',
        type: 'vcvs',
        pins: { 'out_pos': 'out', 'out_neg': 'ground', 'ctrl_pos': 'in_pos', 'ctrl_neg': 'in_neg' },
        params: { gain: 1e5, rout: 50, vlimit: 12 }
      }
    ]
  }
];
