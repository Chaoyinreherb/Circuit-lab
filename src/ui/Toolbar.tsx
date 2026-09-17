import React, { useState } from 'react';
import { registry } from '../components-model/element-registry';
import { ElementTemplate } from '../components-model/primitive-elements';
import { CircuitEngine } from '../simulator/circuit-engine';
import { getPresetCircuits, PresetCircuit } from './presets';
import {
  Play,
  Pause,
  RotateCcw,
  PlusCircle,
  FolderOpen,
  Trash2,
  Cpu,
  Sparkles
} from 'lucide-react';

interface ToolbarProps {
  engine: CircuitEngine;
  onAddElement: (typeId: string) => void;
  onOpenCustomModal: () => void;
  onLoadPreset: (preset: PresetCircuit) => void;
  onClearAll: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  engine,
  onAddElement,
  onOpenCustomModal,
  onLoadPreset,
  onClearAll
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(engine.isRunning);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(25); // stepsPerFrame
  const presets = getPresetCircuits();
  const templates = registry.getTemplates();

  // Filter templates
  const passiveTemplates = templates.filter(t => t.category === 'Passives');
  const sourceTemplates = templates.filter(t => t.category === 'Sources');
  const semiTemplates = templates.filter(t => t.category === 'Semiconductors');
  const otherTemplates = templates.filter(
    t => t.category === 'Control' || t.category === 'Instruments' || t.category === 'IC / Amplifiers'
  );

  const toggleRun = () => {
    engine.isRunning = !engine.isRunning;
    setIsRunning(engine.isRunning);
  };

  const handleReset = () => {
    engine.reset();
  };

  const handleSpeedChange = (val: number) => {
    setSpeedMultiplier(val);
    engine.stepsPerFrame = val;
  };

  return (
    <div className="bg-[#121620] border-b border-[#232c3d] px-4 py-2 flex items-center justify-between gap-4 select-none text-xs">
      {/* Brand / Logo */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-cyan-600/20 border border-cyan-500/30 text-cyan-400">
          <Cpu className="w-5 h-5" />
        </div>
        <div>
          <div className="font-bold text-sm tracking-wide text-gray-100 flex items-center gap-1.5">
            <span>CIRCUIT LAB</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-cyan-950 text-cyan-400 rounded border border-cyan-800">
              Interactive
            </span>
          </div>
          <div className="text-[10px] text-gray-400">リアルタイム回路シミュレータ</div>
        </div>
      </div>

      {/* Component Palette */}
      <div className="flex items-center gap-1 bg-[#181e2b] p-1 rounded-lg border border-[#252f42] overflow-x-auto">
        <span className="text-[10px] text-gray-500 px-2 font-medium">素子追加:</span>

        {/* Passives: R, L, C */}
        <button
          onClick={() => onAddElement('resistor')}
          className="px-2 py-1 rounded bg-[#212a3b] hover:bg-[#2c374d] text-gray-200 transition font-medium"
          title="抵抗 (R)"
        >
          [R] 抵抗
        </button>
        <button
          onClick={() => onAddElement('capacitor')}
          className="px-2 py-1 rounded bg-[#212a3b] hover:bg-[#2c374d] text-gray-200 transition font-medium"
          title="コンデンサ (C)"
        >
          [C] コンデンサ
        </button>
        <button
          onClick={() => onAddElement('inductor')}
          className="px-2 py-1 rounded bg-[#212a3b] hover:bg-[#2c374d] text-gray-200 transition font-medium"
          title="コイル (L)"
        >
          [L] コイル
        </button>

        {/* Semiconductors: Diode, Transistor */}
        <button
          onClick={() => onAddElement('diode')}
          className="px-2 py-1 rounded bg-[#212a3b] hover:bg-[#2c374d] text-gray-200 transition font-medium"
          title="ダイオード"
        >
          ダイオード
        </button>
        <button
          onClick={() => onAddElement('npn')}
          className="px-2 py-1 rounded bg-[#212a3b] hover:bg-[#2c374d] text-gray-200 transition font-medium"
          title="NPNトランジスタ (2SC1815)"
        >
          NPN (BJT)
        </button>
        <button
          onClick={() => onAddElement('pnp')}
          className="px-2 py-1 rounded bg-[#212a3b] hover:bg-[#2c374d] text-gray-200 transition font-medium"
          title="PNPトランジスタ (2SA1015)"
        >
          PNP (BJT)
        </button>

        {/* Sources & Controls */}
        <button
          onClick={() => onAddElement('dc_voltage')}
          className="px-2 py-1 rounded bg-[#212a3b] hover:bg-[#2c374d] text-emerald-300 transition font-medium"
          title="直流電源"
        >
          DC電源
        </button>
        <button
          onClick={() => onAddElement('ac_voltage')}
          className="px-2 py-1 rounded bg-[#212a3b] hover:bg-[#2c374d] text-emerald-300 transition font-medium"
          title="交流信号源"
        >
          AC電源
        </button>
        <button
          onClick={() => onAddElement('ground')}
          className="px-2 py-1 rounded bg-[#212a3b] hover:bg-[#2c374d] text-gray-300 transition font-medium"
          title="GND"
        >
          GND
        </button>
        <button
          onClick={() => onAddElement('switch')}
          className="px-2 py-1 rounded bg-[#212a3b] hover:bg-[#2c374d] text-gray-300 transition font-medium"
          title="スイッチ"
        >
          SW
        </button>
        <button
          onClick={() => onAddElement('ammeter')}
          className="px-2 py-1 rounded bg-[#212a3b] hover:bg-[#2c374d] text-amber-300 transition font-medium"
          title="直列電流計"
        >
          電流計
        </button>

        {/* Custom Dropdown */}
        <select
          onChange={(e) => {
            if (e.target.value) {
              onAddElement(e.target.value);
              e.target.value = '';
            }
          }}
          className="px-2 py-1 rounded bg-[#1f283a] text-cyan-300 border border-cyan-800/60 font-medium outline-none cursor-pointer"
          defaultValue=""
        >
          <option value="" disabled>拡張素子...</option>
          {templates
            .filter(t => t.customTypeId)
            .map(t => (
              <option key={t.customTypeId} value={t.customTypeId}>
                {t.name}
              </option>
            ))}
        </select>

        {/* Add Custom via JSON */}
        <button
          onClick={onOpenCustomModal}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 border border-cyan-700 transition font-semibold"
          title="JSONで新しい素子を追加"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>+ JSON素子追加</span>
        </button>
      </div>

      {/* Preset circuits & Simulation controls */}
      <div className="flex items-center gap-3">
        {/* Preset Selector */}
        <div className="flex items-center gap-1">
          <FolderOpen className="w-3.5 h-3.5 text-gray-400" />
          <select
            onChange={(e) => {
              const p = presets.find(pr => pr.id === e.target.value);
              if (p) onLoadPreset(p);
            }}
            className="bg-[#181e2b] border border-[#252f42] text-gray-200 rounded px-2 py-1 outline-none cursor-pointer text-xs"
            defaultValue="rc_filter"
          >
            {presets.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sim Speed */}
        <div className="flex items-center gap-1.5 bg-[#181e2b] px-2 py-1 rounded border border-[#252f42]">
          <span className="text-gray-400 text-[10px]">速度:</span>
          <select
            value={speedMultiplier}
            onChange={(e) => handleSpeedChange(Number(e.target.value))}
            className="bg-transparent text-gray-200 outline-none text-xs cursor-pointer"
          >
            <option value={5} className="bg-[#181e2b]">低速 (0.2x)</option>
            <option value={25} className="bg-[#181e2b]">標準 (1.0x)</option>
            <option value={60} className="bg-[#181e2b]">高速 (2.5x)</option>
            <option value={150} className="bg-[#181e2b]">超高速 (6.0x)</option>
          </select>
        </div>

        {/* Run/Pause & Reset */}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleRun}
            className={`flex items-center gap-1 px-3 py-1 rounded font-bold transition shadow ${
              isRunning ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isRunning ? '一時停止' : '再開'}</span>
          </button>

          <button
            onClick={handleReset}
            className="p-1.5 bg-[#181e2b] hover:bg-[#252f42] text-gray-300 rounded border border-[#252f42] transition"
            title="シミュレーション時刻リセット"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClearAll}
            className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 rounded border border-red-800/60 transition ml-1"
            title="回路全クリア"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
