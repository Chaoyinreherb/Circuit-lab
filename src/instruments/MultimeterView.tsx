import React, { useState, useEffect } from 'react';
import { CircuitEngine } from '../simulator/circuit-engine';
import { ProbeManager } from './probe-system';
import { Gauge, Zap, Disc3, ShieldAlert } from 'lucide-react';
import { formatValueWithUnit } from '../components-model/element-base';

interface MultimeterProps {
  engine: CircuitEngine;
  probeManager: ProbeManager;
}

export type DMMMode = 'DC_V' | 'AC_V' | 'DC_A' | 'AC_A' | 'RES';

export const MultimeterView: React.FC<MultimeterProps> = ({ engine, probeManager }) => {
  const [mode, setMode] = useState<DMMMode>('DC_V');
  const [displayValue, setDisplayValue] = useState<string>('0.000');
  const [unit, setUnit] = useState<string>('V');
  const [isHold, setIsHold] = useState<boolean>(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isHold) return;

      if (mode === 'DC_V') {
        const v = probeManager.getProbeVoltage('dmm_pos', engine);
        setDisplayValue(v.toFixed(3));
        setUnit('V');
      } else if (mode === 'AC_V') {
        // RMS over recent buffer
        const history = engine.getHistory();
        const pos = probeManager.probes.dmm_pos;
        const neg = probeManager.probes.dmm_neg;
        if (!pos.attachedTo) {
          setDisplayValue('0.000');
          setUnit('V rms');
          return;
        }
        const n1 = pos.attachedTo.pinId ? engine.getPinNode(pos.attachedTo.compId, pos.attachedTo.pinId) : 0;
        const n2 = (neg.attachedTo && neg.attachedTo.pinId) ? engine.getPinNode(neg.attachedTo.compId, neg.attachedTo.pinId) : 0;

        let sumSq = 0;
        const windowSize = Math.min(200, history.length);
        if (windowSize > 0) {
          for (let i = history.length - windowSize; i < history.length; i++) {
            const diff = (history[i].nodes[n1] ?? 0) - (history[i].nodes[n2] ?? 0);
            sumSq += diff * diff;
          }
          const rms = Math.sqrt(sumSq / windowSize);
          setDisplayValue(rms.toFixed(3));
        } else {
          setDisplayValue('0.000');
        }
        setUnit('V rms');
      } else if (mode === 'DC_A' || mode === 'AC_A') {
        const current = probeManager.getMeasuredCurrent(engine);
        if (Math.abs(current) < 1e-3) {
          setDisplayValue((current * 1e6).toFixed(1));
          setUnit('µA');
        } else if (Math.abs(current) < 1) {
          setDisplayValue((current * 1e3).toFixed(2));
          setUnit('mA');
        } else {
          setDisplayValue(current.toFixed(3));
          setUnit('A');
        }
      } else if (mode === 'RES') {
        // Resistance measurement: check if pos and neg are on opposite ends of a resistor
        const pos = probeManager.probes.dmm_pos;
        const neg = probeManager.probes.dmm_neg;
        if (pos.attachedTo && neg.attachedTo && pos.attachedTo.compId === neg.attachedTo.compId) {
          const elem = engine.elements.find(e => e.id === pos.attachedTo?.compId);
          if (elem && elem.type === 'resistor') {
            const r = Number(elem.params.resistance ?? 1000);
            setDisplayValue(formatValueWithUnit(r, 'Ω'));
            setUnit('');
            return;
          }
        }
        setDisplayValue('O.L');
        setUnit('MΩ');
      }
    }, 100);

    return () => clearInterval(interval);
  }, [mode, isHold, engine, probeManager]);

  const posProbe = probeManager.probes.dmm_pos;
  const negProbe = probeManager.probes.dmm_neg;
  const clampProbe = probeManager.probes.dmm_clamp;

  return (
    <div className="bg-[#151921] border border-[#27303f] rounded-lg shadow-xl p-3 flex flex-col gap-2 select-none text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#27303f] pb-2">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-amber-400" />
          <span className="font-bold tracking-wider text-gray-200">DIGITAL MULTIMETER / AMMETER</span>
        </div>
        <button
          onClick={() => setIsHold(!isHold)}
          className={`px-2 py-0.5 rounded font-semibold text-[10px] border transition-colors ${
            isHold ? 'bg-amber-600 text-white border-amber-500' : 'bg-gray-800 text-gray-400 border-gray-700'
          }`}
        >
          {isHold ? 'HOLDING' : 'HOLD'}
        </button>
      </div>

      {/* 7-Segment Style LCD Display */}
      <div className="bg-[#0c140e] border-2 border-[#1c3322] rounded-lg p-3 text-right font-mono flex flex-col justify-center items-end shadow-inner relative overflow-hidden">
        <div className="text-[10px] text-emerald-600 tracking-widest absolute top-1.5 left-2 flex items-center gap-2">
          <span>AUTO-RANGE</span>
          <span>{mode.replace('_', ' ')}</span>
        </div>

        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-3xl font-bold text-emerald-400 crt-glow tracking-widest">
            {displayValue}
          </span>
          <span className="text-sm font-semibold text-emerald-500">
            {unit}
          </span>
        </div>
      </div>

      {/* Mode Dial Buttons */}
      <div className="grid grid-cols-5 gap-1 bg-[#12161e] p-1.5 rounded border border-[#1e2736]">
        {(['DC_V', 'AC_V', 'DC_A', 'AC_A', 'RES'] as DMMMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`py-1.5 rounded text-[11px] font-semibold transition-all ${
              mode === m
                ? 'bg-amber-500 text-black shadow-md font-bold'
                : 'bg-[#1e2430] text-gray-300 hover:bg-[#283244]'
            }`}
          >
            {m === 'DC_V' && 'DC V'}
            {m === 'AC_V' && 'AC V'}
            {m === 'DC_A' && 'DC A'}
            {m === 'AC_A' && 'AC A'}
            {m === 'RES' && 'Ω 抵抗'}
          </button>
        ))}
      </div>

      {/* Probe Connection status */}
      <div className="flex flex-col gap-1 bg-[#0d1017] p-2 rounded border border-[#1e2736] text-[10px]">
        <div className="text-gray-400 font-medium">端子接続状況:</div>
        <div className="grid grid-cols-3 gap-1">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
            <span className="text-gray-300 font-mono">
              +: {posProbe.attachedTo ? `${posProbe.attachedTo.compId}.${posProbe.attachedTo.pinId ?? ''}` : '未接続'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-600"></span>
            <span className="text-gray-300 font-mono">
              -: {negProbe.attachedTo ? `${negProbe.attachedTo.compId}.${negProbe.attachedTo.pinId ?? ''}` : '未接続'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
            <span className="text-gray-300 font-mono">
              クランプ: {clampProbe.attachedTo ? `${clampProbe.attachedTo.compId}` : '未接続'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
