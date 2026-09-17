import React, { useState, useEffect } from 'react';
import { CircuitElement, Wire, formatValueWithUnit } from '../components-model/element-base';
import { CircuitEngine } from '../simulator/circuit-engine';
import { Sliders, Trash2, RotateCw, AlertTriangle } from 'lucide-react';

interface PropertyPanelProps {
  element: CircuitElement | null;
  wires: Wire[];
  onUpdateElement: (updated: CircuitElement) => void;
  onDeleteElement: () => void;
  onRotateElement: () => void;
  engine: CircuitEngine;
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateParams(element: CircuitElement): string | null {
  const p = element.params;
  switch (element.type) {
    case 'resistor': {
      const v = Number(p.resistance);
      if (p.resistance === '' || isNaN(v) || v <= 0) return '抵抗値は 0 より大きい正の値にしてください。';
      break;
    }
    case 'capacitor': {
      const v = Number(p.capacitance);
      if (p.capacitance === '' || isNaN(v) || v <= 0) return '静電容量は 0 より大きい正の値にしてください。';
      break;
    }
    case 'inductor': {
      const v = Number(p.inductance);
      if (p.inductance === '' || isNaN(v) || v <= 0) return 'インダクタンスは 0 より大きい正の値にしてください。';
      break;
    }
    case 'dc_voltage': {
      const v = Number(p.voltage);
      if (p.voltage === '' || isNaN(v)) return '電圧は数値で入力してください。';
      break;
    }
    case 'ac_voltage': {
      const amp = Number(p.amplitude);
      const freq = Number(p.frequency);
      if (p.amplitude === '' || isNaN(amp) || amp <= 0) return '振幅は 0 より大きい正の値にしてください。';
      if (p.frequency === '' || isNaN(freq) || freq <= 0) return '周波数は 0 より大きい正の値にしてください。';
      break;
    }
    case 'npn':
    case 'pnp': {
      const v = Number(p.beta);
      if (p.beta === '' || isNaN(v) || v < 1) return '電流増幅率 β は 1 以上の値にしてください。';
      break;
    }
    case 'zener': {
      const v = Number(p.Vz);
      if (p.Vz === '' || isNaN(v) || v <= 0) return 'ツェナー電圧 Vz は 0 より大きい正の値にしてください。';
      break;
    }
  }
  return null;
}

// ── Numeric input that allows free editing ────────────────────────────────────

interface NumericInputProps {
  paramValue: any;
  step?: number;
  hasError?: boolean;
  onRawChange: (raw: string) => void;
  onCommit: (parsed: number) => void;
}

const NumericInput: React.FC<NumericInputProps> = ({ paramValue, step = 1, hasError, onRawChange, onCommit }) => {
  const [raw, setRaw] = useState<string>(String(paramValue ?? ''));

  // Sync raw string when element selection changes
  useEffect(() => {
    setRaw(String(paramValue ?? ''));
  }, [paramValue]);

  const commit = () => {
    const n = parseFloat(raw);
    onCommit(n); // NaN is fine — caller handles it
  };

  return (
    <input
      type="number"
      step={step}
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value);
        onRawChange(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={`bg-[#1e2430] border rounded px-2 py-1 text-white font-mono text-xs outline-none w-full ${
        hasError ? 'border-red-500' : 'border-[#2d3748]'
      }`}
    />
  );
};

// ── Main Panel ────────────────────────────────────────────────────────────────

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  element,
  wires,
  onUpdateElement,
  onDeleteElement,
  onRotateElement,
}) => {
  if (!element) {
    return (
      <div className="bg-[#151921] border border-[#27303f] rounded-lg p-3 text-xs text-gray-500 flex flex-col items-center justify-center h-48">
        <Sliders className="w-6 h-6 mb-2 opacity-40" />
        <span>回路上の素子をクリックすると</span>
        <span>パラメータを編集できます</span>
      </div>
    );
  }

  const validationError = validateParams(element);
  const isConnected = wires.some(
    (w) => w.fromCompId === element.id || w.toCompId === element.id
  );

  /** Store raw string (may be empty / partial) directly in params */
  const setRawParam = (key: string, raw: string) => {
    onUpdateElement({ ...element, params: { ...element.params, [key]: raw } });
  };

  /** On blur/Enter commit a parsed number; if NaN, keep empty string */
  const commitParam = (key: string, parsed: number) => {
    onUpdateElement({
      ...element,
      params: { ...element.params, [key]: isNaN(parsed) ? '' : parsed },
    });
  };

  const isParamErr = (val: any, requirePositive: boolean = true): boolean => {
    if (val === '' || val === undefined || val === null) return true;
    const n = Number(val);
    if (isNaN(n)) return true;
    if (requirePositive && n <= 0) return true;
    return false;
  };

  return (
    <div className="bg-[#151921] border border-[#27303f] rounded-lg p-3 text-xs flex flex-col gap-3 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#27303f] pb-2">
        <div>
          <span className="font-bold text-gray-200">{element.name}</span>
          <span className="ml-2 text-[10px] text-gray-500 font-mono">[{element.id}]</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onRotateElement}
            title="回転 (R)"
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDeleteElement}
            title="削除 (Del)"
            className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-950/50 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Validation warning banner */}
      {validationError && (
        <div
          className={`flex items-start gap-2 rounded px-2 py-1.5 text-[11px] ${
            isConnected
              ? 'bg-red-950/60 border border-red-700 text-red-300'
              : 'bg-amber-950/60 border border-amber-700 text-amber-300'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold leading-tight">
              {isConnected
                ? '⚠ 素子値が無効 — シミュレーション停止中'
                : '素子値が未入力または無効です'}
            </p>
            <p className="mt-0.5 opacity-80">{validationError}</p>
          </div>
        </div>
      )}

      {/* Real-time State Monitors */}
      <div className="grid grid-cols-2 gap-2 bg-[#0e121a] p-2 rounded border border-[#1f2737] text-[11px] font-mono">
        <div>
          <span className="text-gray-400">電圧: </span>
          <span className="text-emerald-400 font-bold">{element.state.voltage.toFixed(3)} V</span>
        </div>
        <div>
          <span className="text-gray-400">電流: </span>
          <span className="text-amber-400 font-bold">{formatValueWithUnit(element.state.current, 'A')}</span>
        </div>
      </div>

      {/* Parameters */}
      <div className="flex flex-col gap-2">

        {element.type === 'resistor' && (() => {
          const val = element.params.resistance;
          const err = isParamErr(val, true);
          return (
            <div className="flex flex-col gap-1">
              <label className="text-gray-300 flex justify-between">
                <span>抵抗値 (Ω):</span>
                {!err && <span className="font-mono text-cyan-400">{formatValueWithUnit(Number(val), 'Ω')}</span>}
              </label>
              <NumericInput
                paramValue={val ?? 1000}
                step={10}
                hasError={err}
                 onRawChange={() => {}}
                 onCommit={(n) => commitParam('resistance', n)}
              />
            </div>
          );
        })()}

        {element.type === 'capacitor' && (() => {
          const val = element.params.capacitance;
          const err = isParamErr(val, true);
          return (
            <div className="flex flex-col gap-1">
              <label className="text-gray-300 flex justify-between">
                <span>静電容量 (F):</span>
                {!err && <span className="font-mono text-cyan-400">{formatValueWithUnit(Number(val), 'F')}</span>}
              </label>
                <NumericInput
                  paramValue={val ?? 1e-6}
                  step={1e-6}
                  hasError={err}
                  onRawChange={() => {}}
                  onCommit={(n) => commitParam('capacitance', n)}
                />
            </div>
          );
        })()}

        {element.type === 'inductor' && (() => {
          const val = element.params.inductance;
          const err = isParamErr(val, true);
          return (
            <div className="flex flex-col gap-1">
              <label className="text-gray-300 flex justify-between">
                <span>インダクタンス (H):</span>
                {!err && <span className="font-mono text-cyan-400">{formatValueWithUnit(Number(val), 'H')}</span>}
              </label>
                <NumericInput
                  paramValue={val ?? 0.1}
                  step={0.001}
                  hasError={err}
                  onRawChange={() => {}}
                  onCommit={(n) => commitParam('inductance', n)}
                />
            </div>
          );
        })()}

        {element.type === 'dc_voltage' && (() => {
          const val = element.params.voltage;
          const err = isParamErr(val, false);
          return (
            <div className="flex flex-col gap-1">
              <label className="text-gray-300 flex justify-between">
                <span>出力電圧 (V):</span>
                {!err && <span className="font-mono text-cyan-400">{Number(val)} V</span>}
              </label>
                <NumericInput
                  paramValue={val ?? 5}
                  step={0.5}
                  hasError={err}
                  onRawChange={() => {}}
                  onCommit={(n) => commitParam('voltage', n)}
                />
            </div>
          );
        })()}

        {element.type === 'ac_voltage' && (() => {
          const amp = element.params.amplitude;
          const freq = element.params.frequency;
          const ampErr = isParamErr(amp, true);
          const freqErr = isParamErr(freq, true);
          return (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-gray-300 flex justify-between">
                  <span>振幅 (V peak):</span>
                  {!ampErr && <span className="font-mono text-cyan-400">{Number(amp)} V</span>}
                </label>
                  <NumericInput
                    paramValue={amp ?? 5}
                    step={0.5}
                    hasError={ampErr}
                    onRawChange={() => {}}
                    onCommit={(n) => commitParam('amplitude', n)}
                  />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-gray-300 flex justify-between">
                  <span>周波数 (Hz):</span>
                  {!freqErr && <span className="font-mono text-cyan-400">{Number(freq)} Hz</span>}
                </label>
                  <NumericInput
                    paramValue={freq ?? 50}
                    step={5}
                    hasError={freqErr}
                    onRawChange={() => {}}
                    onCommit={(n) => commitParam('frequency', n)}
                  />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-gray-300">波形形状:</label>
                <select
                  value={element.params.waveform ?? 'sine'}
                  onChange={(e) => onUpdateElement({ ...element, params: { ...element.params, waveform: e.target.value } })}
                  className="bg-[#1e2430] border border-[#2d3748] rounded px-2 py-1 text-white text-xs outline-none"
                >
                  <option value="sine">正弦波 (Sine)</option>
                  <option value="square">方形波 (Square)</option>
                  <option value="triangle">三角波 (Triangle)</option>
                </select>
              </div>
            </>
          );
        })()}

        {(element.type === 'npn' || element.type === 'pnp') && (() => {
          const val = element.params.beta;
          const err = isParamErr(val, true) || Number(val) < 1;
          return (
            <div className="flex flex-col gap-1">
              <label className="text-gray-300 flex justify-between">
                <span>電流増幅率 β (hFE):</span>
                {!err && <span className="font-mono text-cyan-400">{Number(val)}</span>}
              </label>
                <NumericInput
                  paramValue={val ?? 1000}
                  step={10}
                  hasError={err}
                  onRawChange={() => {}}
                  onCommit={(n) => commitParam('resistance', n)}
                />
            </div>
          );
        })()}

        {element.type === 'zener' && (() => {
          const val = element.params.Vz;
          const err = isParamErr(val, true);
          return (
            <div className="flex flex-col gap-1">
              <label className="text-gray-300 flex justify-between">
                <span>ツェナー電圧 Vz (V):</span>
                {!err && <span className="font-mono text-cyan-400">{Number(val)} V</span>}
              </label>
                  <NumericInput
                    paramValue={val ?? 200}
                    step={10}
                    hasError={err}
                    onRawChange={() => {}}
                    onCommit={(n) => commitParam('beta', n)}
                  />
            </div>
          );
        })()}

        {element.type === 'switch' && (
          <button
            onClick={() => {
              const updated = {
                ...element,
                state: { ...element.state, isOpen: !element.state.isOpen }
              };
              onUpdateElement(updated);
            }}
            className={`w-full py-1.5 rounded font-semibold text-xs transition-colors ${
              element.state.isOpen ? 'bg-amber-700 text-white' : 'bg-emerald-700 text-white'
            }`}
          >
            {element.state.isOpen ? 'スイッチを開く (現在: 開 OFF)' : 'スイッチを閉じる (現在: 閉 ON)'}
          </button>
        )}
      </div>
    </div>
  );
};
