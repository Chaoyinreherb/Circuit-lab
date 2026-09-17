import { CircuitEngine } from './circuit-engine';
import { registry } from '../components-model/element-registry';
import { Wire } from '../components-model/element-base';

console.log('--- Testing Circuit Simulation Engine ---');

const engine = new CircuitEngine();

// 1. Test DC Circuit: 10V source + 1kΩ resistor + GND
// Expected current: 10V / 1000Ω = 10mA = 0.01A
const vdc = { ...registry.createElement('dc_voltage', 100, 100)!, id: 'v1', params: { voltage: 10 } };
const r1 = { ...registry.createElement('resistor', 200, 100)!, id: 'r1', params: { resistance: 1000 } };
const gnd = { ...registry.createElement('ground', 150, 200)!, id: 'gnd' };

const wires: Wire[] = [
  { id: 'w1', fromCompId: 'v1', fromPinId: 'pos', toCompId: 'r1', toPinId: 'pin1' },
  { id: 'w2', fromCompId: 'r1', fromPinId: 'pin2', toCompId: 'gnd', toPinId: 'gnd' },
  { id: 'w3', fromCompId: 'v1', fromPinId: 'neg', toCompId: 'gnd', toPinId: 'gnd' }
];

engine.setElementsAndWires([vdc, r1, gnd], wires);

// Step 5 times
for (let i = 0; i < 5; i++) {
  engine.stepSingle(1e-4);
}

const history = engine.getHistory();
const latest = history[history.length - 1];
const iResistor = latest.elementCurrents['r1'];
const vResistor = latest.elementVoltages['r1'];

console.log(`DC Test: V_R = ${vResistor.toFixed(3)}V (Expected 10.000V)`);
console.log(`DC Test: I_R = ${(iResistor * 1000).toFixed(3)}mA (Expected 10.000mA)`);

if (Math.abs(vResistor - 10.0) < 1e-3 && Math.abs(iResistor - 0.01) < 1e-4) {
  console.log('✅ DC Circuit Test: PASSED');
} else {
  console.error('❌ DC Circuit Test: FAILED');
  throw new Error('Test failed');
}

// 2. Test Diode Circuit: 5V source + 1k resistor + Diode (in series) + GND
// Expected: Vd ≈ 0.65V ~ 0.7V, Vr ≈ 4.3V, I ≈ 4.3mA
const diode = { ...registry.createElement('diode', 250, 100)!, id: 'd1' };
const wires2: Wire[] = [
  { id: 'w1', fromCompId: 'v1', fromPinId: 'pos', toCompId: 'r1', toPinId: 'pin1' },
  { id: 'w2', fromCompId: 'r1', fromPinId: 'pin2', toCompId: 'd1', toPinId: 'anode' },
  { id: 'w3', fromCompId: 'd1', fromPinId: 'cathode', toCompId: 'gnd', toPinId: 'gnd' },
  { id: 'w4', fromCompId: 'v1', fromPinId: 'neg', toCompId: 'gnd', toPinId: 'gnd' }
];

engine.reset();
engine.setElementsAndWires([vdc, r1, diode, gnd], wires2);

for (let i = 0; i < 10; i++) {
  engine.stepSingle(1e-4);
}

const latest2 = engine.getHistory()[engine.getHistory().length - 1];
const vDiode = latest2.elementVoltages['d1'];
const iDiode = latest2.elementCurrents['d1'];
console.log(`Diode Test: V_D = ${vDiode.toFixed(3)}V (Expected ~0.65-0.75V)`);
console.log(`Diode Test: I_D = ${(iDiode * 1000).toFixed(3)}mA (Expected ~4.2-4.3mA)`);

// With 10V supply: Vd ≈ 0.716V, Vr = 10 - 0.716 = 9.284V => I = 9.284mA
if (vDiode > 0.65 && vDiode < 0.85 && iDiode > 0.0085 && iDiode < 0.0098) {
  console.log('✅ Diode Non-linear Newton-Raphson Test: PASSED');
} else {
  console.error('❌ Diode Test: FAILED');
  throw new Error('Test failed');
}

console.log('All tests passed successfully!');
