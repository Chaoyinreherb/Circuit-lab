import { CircuitElement, Wire } from '../components-model/element-base';
import { registry } from '../components-model/element-registry';
import { probeManager } from '../instruments/probe-system';

export interface PresetCircuit {
  id: string;
  name: string;
  description: string;
  elements: CircuitElement[];
  wires: Wire[];
  setupProbes?: () => void;
}

export function getPresetCircuits(): PresetCircuit[] {
  return [
    // 1. RC Low-pass filter
    {
      id: 'rc_filter',
      name: '1. RCローパスフィルタ (50Hz AC応答)',
      description: 'AC信号源、抵抗 (1kΩ)、コンデンサ (10µF) による一次低域通過フィルタ回路',
      elements: [
        {
          ...registry.createElement('ac_voltage', 120, 200)!,
          id: 'v_ac_1',
          params: { amplitude: 5, frequency: 50, waveform: 'sine' }
        },
        {
          ...registry.createElement('resistor', 260, 140)!,
          id: 'r1',
          params: { resistance: 1000 }
        },
        {
          ...registry.createElement('capacitor', 380, 220)!,
          id: 'c1',
          rotation: 90,
          params: { capacitance: 10e-6 }
        },
        {
          ...registry.createElement('ground', 260, 320)!,
          id: 'gnd_1'
        }
      ],
      wires: [
        { id: 'w1', fromCompId: 'v_ac_1', fromPinId: 'pos', toCompId: 'r1', toPinId: 'pin1' },
        { id: 'w2', fromCompId: 'r1', fromPinId: 'pin2', toCompId: 'c1', toPinId: 'pin1' },
        { id: 'w3', fromCompId: 'c1', fromPinId: 'pin2', toCompId: 'gnd_1', toPinId: 'gnd' },
        { id: 'w4', fromCompId: 'v_ac_1', fromPinId: 'neg', toCompId: 'gnd_1', toPinId: 'gnd' }
      ],
      setupProbes: () => {
        // CH1 to input, CH2 to output (across C1), GND to ground
        probeManager.probes.osc_ch1.x = 120;
        probeManager.probes.osc_ch1.y = 180;
        probeManager.probes.osc_ch1.attachedTo = { type: 'pin', compId: 'v_ac_1', pinId: 'pos' };

        probeManager.probes.osc_ch2.x = 380;
        probeManager.probes.osc_ch2.y = 200;
        probeManager.probes.osc_ch2.attachedTo = { type: 'pin', compId: 'c1', pinId: 'pin1' };

        probeManager.probes.osc_gnd.x = 260;
        probeManager.probes.osc_gnd.y = 300;
        probeManager.probes.osc_gnd.attachedTo = { type: 'pin', compId: 'gnd_1', pinId: 'gnd' };

        probeManager.probes.dmm_pos.x = 380;
        probeManager.probes.dmm_pos.y = 200;
        probeManager.probes.dmm_pos.attachedTo = { type: 'pin', compId: 'c1', pinId: 'pin1' };

        probeManager.probes.dmm_neg.x = 260;
        probeManager.probes.dmm_neg.y = 300;
        probeManager.probes.dmm_neg.attachedTo = { type: 'pin', compId: 'gnd_1', pinId: 'gnd' };
      }
    },

    // 2. Diode Half-Wave Rectifier with Smoothing Capacitor
    {
      id: 'rectifier_filter',
      name: '2. 半波整流 ＆ 平滑回路',
      description: 'ダイオードで交流を整流し、コンデンサで直流脈流を平滑化する電源回路',
      elements: [
        {
          ...registry.createElement('ac_voltage', 120, 200)!,
          id: 'v_ac_rect',
          params: { amplitude: 6, frequency: 50, waveform: 'sine' }
        },
        {
          ...registry.createElement('diode', 240, 140)!,
          id: 'd1'
        },
        {
          ...registry.createElement('capacitor', 340, 220)!,
          id: 'c_smooth',
          rotation: 90,
          params: { capacitance: 100e-6 }
        },
        {
          ...registry.createElement('resistor', 440, 220)!,
          id: 'r_load',
          rotation: 90,
          params: { resistance: 220 }
        },
        {
          ...registry.createElement('ground', 260, 320)!,
          id: 'gnd_rect'
        }
      ],
      wires: [
        { id: 'rw1', fromCompId: 'v_ac_rect', fromPinId: 'pos', toCompId: 'd1', toPinId: 'anode' },
        { id: 'rw2', fromCompId: 'd1', fromPinId: 'cathode', toCompId: 'c_smooth', toPinId: 'pin1' },
        { id: 'rw3', fromCompId: 'c_smooth', fromPinId: 'pin1', toCompId: 'r_load', toPinId: 'pin1' },
        { id: 'rw4', fromCompId: 'c_smooth', fromPinId: 'pin2', toCompId: 'gnd_rect', toPinId: 'gnd' },
        { id: 'rw5', fromCompId: 'r_load', fromPinId: 'pin2', toCompId: 'gnd_rect', toPinId: 'gnd' },
        { id: 'rw6', fromCompId: 'v_ac_rect', fromPinId: 'neg', toCompId: 'gnd_rect', toPinId: 'gnd' }
      ],
      setupProbes: () => {
        probeManager.probes.osc_ch1.x = 120;
        probeManager.probes.osc_ch1.y = 180;
        probeManager.probes.osc_ch1.attachedTo = { type: 'pin', compId: 'v_ac_rect', pinId: 'pos' };

        probeManager.probes.osc_ch2.x = 440;
        probeManager.probes.osc_ch2.y = 190;
        probeManager.probes.osc_ch2.attachedTo = { type: 'pin', compId: 'r_load', pinId: 'pin1' };

        probeManager.probes.osc_gnd.x = 260;
        probeManager.probes.osc_gnd.y = 300;
        probeManager.probes.osc_gnd.attachedTo = { type: 'pin', compId: 'gnd_rect', pinId: 'gnd' };

        probeManager.probes.dmm_pos.x = 440;
        probeManager.probes.dmm_pos.y = 190;
        probeManager.probes.dmm_pos.attachedTo = { type: 'pin', compId: 'r_load', pinId: 'pin1' };

        probeManager.probes.dmm_neg.x = 260;
        probeManager.probes.dmm_neg.y = 300;
        probeManager.probes.dmm_neg.attachedTo = { type: 'pin', compId: 'gnd_rect', pinId: 'gnd' };
      }
    },

    // 3. RLC Series Resonance
    {
      id: 'rlc_resonance',
      name: '3. RLC 直列共振回路',
      description: 'L(10mH)とC(10µF)による共振現象と減衰振動の観測',
      elements: [
        {
          ...registry.createElement('ac_voltage', 120, 200)!,
          id: 'v_ac_rlc',
          params: { amplitude: 5, frequency: 150, waveform: 'sine' }
        },
        {
          ...registry.createElement('resistor', 240, 140)!,
          id: 'r_rlc',
          params: { resistance: 20 }
        },
        {
          ...registry.createElement('inductor', 340, 140)!,
          id: 'l_rlc',
          params: { inductance: 0.05 }
        },
        {
          ...registry.createElement('capacitor', 440, 220)!,
          id: 'c_rlc',
          rotation: 90,
          params: { capacitance: 20e-6 }
        },
        {
          ...registry.createElement('ground', 280, 320)!,
          id: 'gnd_rlc'
        }
      ],
      wires: [
        { id: 'lw1', fromCompId: 'v_ac_rlc', fromPinId: 'pos', toCompId: 'r_rlc', toPinId: 'pin1' },
        { id: 'lw2', fromCompId: 'r_rlc', fromPinId: 'pin2', toCompId: 'l_rlc', toPinId: 'pin1' },
        { id: 'lw3', fromCompId: 'l_rlc', fromPinId: 'pin2', toCompId: 'c_rlc', toPinId: 'pin1' },
        { id: 'lw4', fromCompId: 'c_rlc', fromPinId: 'pin2', toCompId: 'gnd_rlc', toPinId: 'gnd' },
        { id: 'lw5', fromCompId: 'v_ac_rlc', fromPinId: 'neg', toCompId: 'gnd_rlc', toPinId: 'gnd' }
      ],
      setupProbes: () => {
        probeManager.probes.osc_ch1.x = 120;
        probeManager.probes.osc_ch1.y = 180;
        probeManager.probes.osc_ch1.attachedTo = { type: 'pin', compId: 'v_ac_rlc', pinId: 'pos' };

        probeManager.probes.osc_ch2.x = 440;
        probeManager.probes.osc_ch2.y = 190;
        probeManager.probes.osc_ch2.attachedTo = { type: 'pin', compId: 'c_rlc', pinId: 'pin1' };

        probeManager.probes.osc_gnd.x = 280;
        probeManager.probes.osc_gnd.y = 300;
        probeManager.probes.osc_gnd.attachedTo = { type: 'pin', compId: 'gnd_rlc', pinId: 'gnd' };
      }
    },

    // 4. BJT NPN Amplifier (Self-Biased Common Emitter)
    {
      id: 'bjt_amp',
      name: '4. トランジスタ増幅回路 (自己バイアス・エミッタ接地)',
      description: '分圧バイアスとエミッタ抵抗による安定動作点と小信号反転増幅',
      elements: [
        {
          ...registry.createElement('dc_voltage', 80, 160)!,
          id: 'v_vcc',
          params: { voltage: 12 }
        },
        {
          ...registry.createElement('ac_voltage', 80, 320)!,
          id: 'v_vin',
          params: { amplitude: 0.05, frequency: 100, waveform: 'sine' } // 50mV peak = 100mVpp
        },
        {
          ...registry.createElement('resistor', 220, 140)!,
          id: 'r_bias1',
          rotation: 90,
          params: { resistance: 47000 } // 47k upper bias
        },
        {
          ...registry.createElement('resistor', 220, 260)!,
          id: 'r_bias2',
          rotation: 90,
          params: { resistance: 10000 } // 10k lower bias
        },
        {
          ...registry.createElement('resistor', 340, 140)!,
          id: 'r_collector',
          rotation: 90,
          params: { resistance: 3300 } // 3.3k load
        },
        {
          ...registry.createElement('resistor', 340, 320)!,
          id: 'r_emitter',
          rotation: 90,
          params: { resistance: 560 } // 560 ohm negative feedback
        },
        {
          ...registry.createElement('capacitor', 420, 320)!,
          id: 'c_bypass',
          rotation: 90,
          params: { capacitance: 22e-6 } // Emitter AC bypass
        },
        {
          ...registry.createElement('npn', 300, 230)!,
          id: 'q1',
          params: { beta: 200 }
        },
        {
          ...registry.createElement('capacitor', 150, 230)!,
          id: 'c_in',
          params: { capacitance: 1e-6 }
        },
        {
          ...registry.createElement('ground', 220, 390)!,
          id: 'gnd_bjt'
        }
      ],
      wires: [
        // Input AC through Cin to Base
        { id: 'bw1', fromCompId: 'v_vin', fromPinId: 'pos', toCompId: 'c_in', toPinId: 'pin1' },
        { id: 'bw2', fromCompId: 'c_in', fromPinId: 'pin2', toCompId: 'q1', toPinId: 'base' },
        { id: 'bw3', fromCompId: 'c_in', fromPinId: 'pin2', toCompId: 'r_bias1', toPinId: 'pin2' },
        { id: 'bw4', fromCompId: 'c_in', fromPinId: 'pin2', toCompId: 'r_bias2', toPinId: 'pin1' },
        // VCC 12V rail
        { id: 'bw5', fromCompId: 'v_vcc', fromPinId: 'pos', toCompId: 'r_bias1', toPinId: 'pin1' },
        { id: 'bw6', fromCompId: 'v_vcc', fromPinId: 'pos', toCompId: 'r_collector', toPinId: 'pin1' },
        // Collector node
        { id: 'bw7', fromCompId: 'r_collector', fromPinId: 'pin2', toCompId: 'q1', toPinId: 'collector' },
        // Emitter node with Re and Ce in parallel
        { id: 'bw8', fromCompId: 'q1', fromPinId: 'emitter', toCompId: 'r_emitter', toPinId: 'pin1' },
        { id: 'bw8b', fromCompId: 'q1', fromPinId: 'emitter', toCompId: 'c_bypass', toPinId: 'pin1' },
        // Grounds
        { id: 'bw9', fromCompId: 'r_bias2', fromPinId: 'pin2', toCompId: 'gnd_bjt', toPinId: 'gnd' },
        { id: 'bw10', fromCompId: 'r_emitter', fromPinId: 'pin2', toCompId: 'gnd_bjt', toPinId: 'gnd' },
        { id: 'bw10b', fromCompId: 'c_bypass', fromPinId: 'pin2', toCompId: 'gnd_bjt', toPinId: 'gnd' },
        { id: 'bw11', fromCompId: 'v_vcc', fromPinId: 'neg', toCompId: 'gnd_bjt', toPinId: 'gnd' },
        { id: 'bw12', fromCompId: 'v_vin', fromPinId: 'neg', toCompId: 'gnd_bjt', toPinId: 'gnd' }
      ],
      setupProbes: () => {
        probeManager.probes.osc_ch1.x = 80;
        probeManager.probes.osc_ch1.y = 300;
        probeManager.probes.osc_ch1.attachedTo = { type: 'pin', compId: 'v_vin', pinId: 'pos' };

        probeManager.probes.osc_ch2.x = 315;
        probeManager.probes.osc_ch2.y = 210;
        probeManager.probes.osc_ch2.attachedTo = { type: 'pin', compId: 'q1', pinId: 'collector' };

        probeManager.probes.osc_gnd.x = 220;
        probeManager.probes.osc_gnd.y = 370;
        probeManager.probes.osc_gnd.attachedTo = { type: 'pin', compId: 'gnd_bjt', pinId: 'gnd' };

        probeManager.probes.dmm_clamp.x = 340;
        probeManager.probes.dmm_clamp.y = 140;
        probeManager.probes.dmm_clamp.attachedTo = { type: 'element', compId: 'r_collector' };
      }
    },

    // 5. LC Colpitts Oscillator
    {
      id: 'colpitts_osc',
      name: '5. LC コルピッツ発振回路 (正弦波発振)',
      description: 'L(20mH)と容量分圧(C1, C2)による自励正弦波発振回路 (電源9V, 約2.3kHz)',
      elements: [
        {
          ...registry.createElement('dc_voltage', 80, 160)!,
          id: 'v_vcc_osc',
          params: { voltage: 9 }
        },
        {
          ...registry.createElement('resistor', 180, 120)!,
          id: 'r_b1',
          rotation: 90,
          params: { resistance: 22000 }
        },
        {
          ...registry.createElement('resistor', 180, 240)!,
          id: 'r_b2',
          rotation: 90,
          params: { resistance: 4700 }
        },
        {
          ...registry.createElement('capacitor', 180, 340)!,
          id: 'c_b_bypass',
          rotation: 90,
          params: { capacitance: 10e-6 }
        },
        {
          ...registry.createElement('resistor', 290, 120)!,
          id: 'r_c_osc',
          rotation: 90,
          params: { resistance: 2200 }
        },
        {
          ...registry.createElement('npn', 270, 210)!,
          id: 'q_osc',
          params: { beta: 200 }
        },
        {
          ...registry.createElement('resistor', 270, 320)!,
          id: 'r_e_osc',
          rotation: 90,
          params: { resistance: 470 }
        },
        {
          ...registry.createElement('inductor', 390, 120)!,
          id: 'l_tank',
          rotation: 90,
          params: { inductance: 20e-3 }
        },
        {
          ...registry.createElement('capacitor', 410, 220)!,
          id: 'c_tank1',
          rotation: 90,
          params: { capacitance: 470e-9 }
        },
        {
          ...registry.createElement('capacitor', 340, 320)!,
          id: 'c_tank2',
          rotation: 90,
          params: { capacitance: 4.7e-6 }
        },
        {
          ...registry.createElement('ground', 270, 400)!,
          id: 'gnd_osc'
        }
      ],
      wires: [
        // VCC 9V Rail
        { id: 'ow1', fromCompId: 'v_vcc_osc', fromPinId: 'pos', toCompId: 'r_b1', toPinId: 'pin1' },
        { id: 'ow2', fromCompId: 'v_vcc_osc', fromPinId: 'pos', toCompId: 'r_c_osc', toPinId: 'pin1' },
        { id: 'ow3', fromCompId: 'v_vcc_osc', fromPinId: 'pos', toCompId: 'l_tank', toPinId: 'pin1' },
        // Base bias & AC ground bypass
        { id: 'ow4', fromCompId: 'r_b1', fromPinId: 'pin2', toCompId: 'r_b2', toPinId: 'pin1' },
        { id: 'ow5', fromCompId: 'r_b1', fromPinId: 'pin2', toCompId: 'q_osc', toPinId: 'base' },
        { id: 'ow6', fromCompId: 'r_b2', fromPinId: 'pin2', toCompId: 'c_b_bypass', toPinId: 'pin1' },
        { id: 'ow7', fromCompId: 'c_b_bypass', fromPinId: 'pin2', toCompId: 'gnd_osc', toPinId: 'gnd' },
        { id: 'ow7b', fromCompId: 'r_b2', fromPinId: 'pin2', toCompId: 'gnd_osc', toPinId: 'gnd' },
        // Collector: connected to RC, L_tank, and C_tank1 top
        { id: 'ow8', fromCompId: 'r_c_osc', fromPinId: 'pin2', toCompId: 'q_osc', toPinId: 'collector' },
        { id: 'ow9', fromCompId: 'l_tank', fromPinId: 'pin2', toCompId: 'q_osc', toPinId: 'collector' },
        { id: 'ow10', fromCompId: 'q_osc', fromPinId: 'collector', toCompId: 'c_tank1', toPinId: 'pin1' },
        // Emitter: feedback from C_tank1 bottom, connected to RE and C_tank2
        { id: 'ow11', fromCompId: 'c_tank1', fromPinId: 'pin2', toCompId: 'q_osc', toPinId: 'emitter' },
        { id: 'ow12', fromCompId: 'q_osc', fromPinId: 'emitter', toCompId: 'r_e_osc', toPinId: 'pin1' },
        { id: 'ow13', fromCompId: 'q_osc', fromPinId: 'emitter', toCompId: 'c_tank2', toPinId: 'pin1' },
        // Grounds
        { id: 'ow14', fromCompId: 'r_e_osc', fromPinId: 'pin2', toCompId: 'gnd_osc', toPinId: 'gnd' },
        { id: 'ow15', fromCompId: 'c_tank2', fromPinId: 'pin2', toCompId: 'gnd_osc', toPinId: 'gnd' },
        { id: 'ow16', fromCompId: 'v_vcc_osc', fromPinId: 'neg', toCompId: 'gnd_osc', toPinId: 'gnd' }
      ],
      setupProbes: () => {
        probeManager.probes.osc_ch1.x = 285;
        probeManager.probes.osc_ch1.y = 190;
        probeManager.probes.osc_ch1.attachedTo = { type: 'pin', compId: 'q_osc', pinId: 'collector' };

        probeManager.probes.osc_ch2.x = 285;
        probeManager.probes.osc_ch2.y = 230;
        probeManager.probes.osc_ch2.attachedTo = { type: 'pin', compId: 'q_osc', pinId: 'emitter' };

        probeManager.probes.osc_gnd.x = 270;
        probeManager.probes.osc_gnd.y = 380;
        probeManager.probes.osc_gnd.attachedTo = { type: 'pin', compId: 'gnd_osc', pinId: 'gnd' };
      }
    }
  ];
}
