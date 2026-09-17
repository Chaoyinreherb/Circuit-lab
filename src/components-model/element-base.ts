/**
 * Base interfaces and types for circuit elements
 */

export type ElementType =
  | 'resistor'
  | 'capacitor'
  | 'inductor'
  | 'diode'
  | 'zener'
  | 'led'
  | 'npn'
  | 'pnp'
  | 'dc_voltage'
  | 'ac_voltage'
  | 'ground'
  | 'switch'
  | 'ammeter'
  | 'subcircuit'
  | 'custom';

export interface Pin {
  id: string;
  name: string;
  x: number; // relative to component center
  y: number;
  direction?: 'left' | 'right' | 'top' | 'bottom';
  nodeId?: number; // MNA node ID assigned during simulation (0 is ground)
}

export interface ComponentState {
  current: number; // Current flowing through device (Amps)
  voltage: number; // Primary voltage across device (Volts)
  power: number; // Dissipated power (Watts)
  historyV?: number; // Previous timestep voltage for dynamic components (C, L)
  historyI?: number; // Previous timestep current
  iterationsV?: number; // Newton-Raphson iteration voltage for non-linear components
  isOpen?: boolean; // For switches
  isConducting?: boolean; // For diodes/LEDs
  lightIntensity?: number; // For LEDs (0 to 1)
}

export interface CircuitElement {
  id: string;
  type: ElementType;
  customTypeId?: string;
  name: string;
  x: number;
  y: number;
  rotation: number; // 0, 90, 180, 270 degrees
  pins: Pin[];
  params: Record<string, any>;
  state: ComponentState;
  
  // Custom visual properties
  color?: string;
  label?: string;
}

export interface Wire {
  id: string;
  fromCompId: string;
  fromPinId: string;
  toCompId: string;
  toPinId: string;
  // Intermediate waypoints if needed, or straight lines
  points?: { x: number; y: number }[];
  current?: number;
  voltage?: number;
}

/**
 * Helper to get the absolute coordinates of a pin
 */
export function getPinAbsolutePos(comp: CircuitElement, pin: Pin): { x: number; y: number } {
  const rad = (comp.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rotatedX = pin.x * cos - pin.y * sin;
  const rotatedY = pin.x * sin + pin.y * cos;
  return {
    x: Math.round(comp.x + rotatedX),
    y: Math.round(comp.y + rotatedY)
  };
}

/**
 * Format electrical values nicely (e.g. 1000 -> 1 kΩ, 0.000001 -> 1 µF)
 */
export function formatValueWithUnit(val: number, unit: string): string {
  if (val === undefined || isNaN(val)) return `0 ${unit}`;
  const abs = Math.abs(val);
  if (abs === 0) return `0 ${unit}`;
  if (abs >= 1e9) return `${(val / 1e9).toPrecision(3)} G${unit}`;
  if (abs >= 1e6) return `${(val / 1e6).toPrecision(3)} M${unit}`;
  if (abs >= 1e3) return `${(val / 1e3).toPrecision(3)} k${unit}`;
  if (abs >= 1) return `${val.toPrecision(3)} ${unit}`;
  if (abs >= 1e-3) return `${(val * 1e3).toPrecision(3)} m${unit}`;
  if (abs >= 1e-6) return `${(val * 1e6).toPrecision(3)} µ${unit}`;
  if (abs >= 1e-9) return `${(val * 1e9).toPrecision(3)} n${unit}`;
  if (abs >= 1e-12) return `${(val * 1e12).toPrecision(3)} p${unit}`;
  return `${val.toExponential(2)} ${unit}`;
}
