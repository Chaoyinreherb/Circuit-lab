import React, { useState, useEffect } from 'react';
import { CircuitElement, Wire, formatValueWithUnit } from '../components-model/element-base';
import { CircuitEngine } from '../simulator/circuit-engine';
import { Sliders, Trash2, RotateCw, AlertTriangle, X, Zap } from 'lucide-react';

interface PropertyPanelProps {
  element: CircuitElement | null;
  wire?: Wire | null;
  wires: Wire[];
  onUpdateElement: (updated: CircuitElement) => void;
  onDeleteElement: () => void;
  onRotateElement: () => void;
  onDeleteWire?: (wireId: string) => void;
  onClose?: () => void;
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

  useEffect(() => {
    setRaw(String(paramValue ?? ''));
  }, [paramValue]);

  const commit = () => {
    const n = parseFloat(raw);
    onCommit(n);
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
      className={`w-full bg-[#0d121c] border rounded px-2.5 py-1 text-white text-xs font-mono outline-none transition ${
        hasError
          ? 'border-red-500 bg-red-950/20 text-red-200 focus:border-red-400'
          : 'border-[#2d3a50] focus:border-cyan-400 focus:bg-[#121927]'
      }`}
    />
  );
};

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  element,
  wire,
  wires,
  onUpdateElement,
  onDeleteElement,
  onRotateElement,
  onDeleteWire,
  onClose,
  engine
}) => {
  const [rawParams, setRawParams] = useState<Record<string, string>>({});

  useEffect(() => {
    setRawParams({});
  }, [element?.id, wire?.id]);

  // If wire selected
  if (wire && !element) {
    return (
      <div className="w-[300px] bg-[#121722]/95 border border-cyan-500/40 rounded-xl p-3.5 text-xs flex flex-col gap-2.5 shadow-2xl backdrop-blur-md select-none text-gray-200 animate-in fade-in slide-in-from-bottom-2 duration-150">
        <div className="flex items-center justify-between border-b border-[#232d40] pb-2">
          <div className="flex items-center gap-1.5 font-bold text-cyan-300">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>配線 (Wire) 選択中</span>
          </div>
          <div className="flex items-center gap-1">
            {onDeleteWire && (
              <button
                onClick={() => onDeleteWire(wire.id)}
                title="配線を削除 (Del)"
                className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-950/60 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                title="閉じる"
                className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-[#0c1017] p-2 rounded-lg border border-[#1e2636] text-[11px] font-mono">
          <div>
            <span className="text-gray-400">電圧: </span>
            <span className="text-emerald-400 font-bold">{(wire.voltage ?? 0).toFixed(3)} V</span>
          </div>
          <div>
            <span className="text-gray-400">電流: </span>
            <span className="text-amber-400 font-bold">{formatValueWithUnit(wire.current ?? 0, 'A')}</span>
          </div>
        </div>

        <div className="text-[11px] text-gray-400 flex flex-col gap-1">
          <div>💡 <b>端点をドラッグ</b>: 別のピンへ繋ぎ直し</div>
          <div>⌨️ <b>Del / Backspace</b>: 配線削除</div>
        </div>
      </div>
    );
  }

  if (!element) {
    return null;
  }

  const isConnected = wires.some(
    w => w.fromCompId === element.id || w.toCompId === element.id
  );

  const validationError = validateParams(element);

  const commitParam = (key: string, value: number) => {
    if (isNaN(value)) return;
    const updated = {
      ...element,
      params: { ...element.params, [key]: value }
    };
    onUpdateElement(updated);
    setRawParams(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const isParamErr = (val: any, mustBePositive = true) => {
    const num = Number(val);
    if (val === '' || isNaN(num)) return true;
    if (mustBePositive && num <= 0) return true;
    return false;
  };

  return (
    <div className="w-[320px] bg-[#121722]/95 border border-[#273449] rounded-xl p-3.5 text-xs flex flex-col gap-3 shadow-2xl backdrop-blur-md select-none text-gray-200 animate-in fade-in slide-in-from-bottom-2 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#232d40] pb-2">
        <div className="flex items-center gap-1.5 truncate">
          <Sliders className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="font-bold text-gray-100 truncate">{element.name}</span>
          <span className="text-[10px] text-gray-400 font-mono shrink-0">[{element.id}]</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onRotateElement}
            title="回転 (R)"
            className="p-1 text-gray-300 hover:text-white rounded hover:bg-[#1f293d] transition cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDeleteElement}
            title="削除 (Del)"
            className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-950/60 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title="閉じる"
              className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition cursor-pointer ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Validation warning banner */}
      {validationError && (
        <div
          className={`flex items-start gap-2 rounded px-2.5 py-1.5 text-[11px] ${
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
      <div className="grid grid-cols-2 gap-2 bg-[#0c1017] p-2 rounded-lg border border-[#1e2636] text-[11px] font-mono">
        <div>
          <span className="text-gray-400">端子間電圧: </span>
          <span className="text-emerald-400 font-bold">{element.state.voltage.toFixed(3)} V</span>
        </div>
        <div>
          <span className="text-gray-400">通過電流: </span>
          <span className="text-amber-400 font-bold">{formatValueWithUnit(element.state.current, 'A')}</span>
        </div>
      </div>

      {/* Parameter Controls */}
      <div className="flex flex-col gap-2.5">
        {element.type === 'resistor' && (() => {
          const val = element.params.resistance;
          const err = isParamErr(val, true);
          return (
            <div className="flex flex-col gap-1">
              <label className="text-gray-300 flex justify-between font-medium">
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
              <label className="text-gray-300 flex justify-between font-medium">
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
              <label className="text-gray-300 flex justify-between font-medium">
                <span>インダクタンス (H):</span>
                {!err && <span className="font-mono text-cyan-400">{formatValueWithUnit(Number(val), 'H')}</span>}
              </label>
              <NumericInput
                paramValue={val ?? 0.01}
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
              <label className="text-gray-300 flex justify-between font-medium">
                <span>DC設定電圧 (V):</span>
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
                <label className="text-gray-300 flex justify-between font-medium">
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
                <label className="text-gray-300 flex justify-between font-medium">
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
                <label className="text-gray-300 font-medium">波形形状:</label>
                <select
                  value={element.params.waveform ?? 'sine'}
                  onChange={(e) => onUpdateElement({ ...element, params: { ...element.params, waveform: e.target.value } })}
                  className="bg-[#0d121c] border border-[#2d3a50] rounded px-2.5 py-1 text-white text-xs outline-none cursor-pointer focus:border-cyan-400"
                >
                  <option value="sine">正弦波 (Sine)</option>
                  <option value="square">矩形波 (Square)</option>
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
              <label className="text-gray-300 flex justify-between font-medium">
                <span>電流増幅率 β (hFE):</span>
                {!err && <span className="font-mono text-cyan-400">{Number(val)}</span>}
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

        {element.type === 'zener' && (() => {
          const val = element.params.Vz;
          const err = isParamErr(val, true);
          return (
            <div className="flex flex-col gap-1">
              <label className="text-gray-300 flex justify-between font-medium">
                <span>ツェナー降伏電圧 Vz (V):</span>
                {!err && <span className="font-mono text-cyan-400">{Number(val)} V</span>}
              </label>
              <NumericInput
                paramValue={val ?? 5.1}
                step={0.1}
                hasError={err}
                onRawChange={() => {}}
                onCommit={(n) => commitParam('Vz', n)}
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
            className={`w-full py-2 rounded-lg font-semibold text-xs transition-colors cursor-pointer shadow ${
              element.state.isOpen ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {element.state.isOpen ? 'スイッチを開く (現在: 開 OFF)' : 'スイッチを閉じる (現在: 閉 ON)'}
          </button>
        )}
      </div>
    </div>
  );
};
