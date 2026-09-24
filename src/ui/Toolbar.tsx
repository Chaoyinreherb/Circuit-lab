import React, { useState, useRef, useEffect } from 'react';
import { registry } from '../components-model/element-registry';
import { CircuitEngine } from '../simulator/circuit-engine';
import {
  Play,
  Pause,
  RotateCcw,
  FolderOpen,
  Trash2,
  Cpu,
  Sparkles,
  FilePlus,
  Save,
  FileText
} from 'lucide-react';

interface ToolbarProps {
  engine: CircuitEngine;
  onAddElement: (typeId: string) => void;
  onOpenCustomModal: () => void;
  onNewCircuit: () => void;
  onOpenLoadModal: () => void;
  onOpenSaveModal: () => void;
  onClearAll: () => void;
  circuitName: string;
  isDirty: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  engine,
  onAddElement,
  onOpenCustomModal,
  onNewCircuit,
  onOpenLoadModal,
  onOpenSaveModal,
  onClearAll,
  circuitName,
  isDirty
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(engine.isRunning);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(25); // stepsPerFrame
  const templates = registry.getTemplates();

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

  const toolbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // If mostly vertical scrolling, convert to horizontal scroll
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div
      ref={toolbarRef}
      className="w-full bg-[#121620] border-b border-[#232c3d] px-3 py-1.5 overflow-x-auto overflow-y-hidden select-none text-xs"
    >
      <div className="flex items-center justify-between gap-4 min-w-max">
        {/* Left: Brand / Logo & Circuit Name */}
        <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-600/20 border border-cyan-500/30 text-cyan-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-xs tracking-wide text-gray-100 flex items-center gap-1.5">
              <span>CIRCUIT LAB</span>
              <span className="text-[9px] px-1 py-0.1 bg-cyan-950 text-cyan-400 rounded border border-cyan-800">
                v2.0
              </span>
            </div>
          </div>
        </div>

        {/* File Operation Buttons (New, Open, Save) */}
        <div className="flex items-center gap-1 bg-[#171d2b] p-1 rounded-lg border border-[#252f42]">
          <button
            onClick={onNewCircuit}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#20283a] hover:bg-[#2b364e] text-gray-200 transition font-medium text-[11px] cursor-pointer"
            title="新規作成 (空の回路にする)"
          >
            <FilePlus className="w-3.5 h-3.5 text-cyan-400" />
            <span>新規</span>
          </button>

          <button
            onClick={onOpenLoadModal}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#20283a] hover:bg-[#2b364e] text-gray-200 transition font-medium text-[11px] cursor-pointer"
            title="回路を開く (サンプル回路 / 保存済み / JSON)"
          >
            <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>開く / サンプル</span>
          </button>

          <button
            onClick={onOpenSaveModal}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition font-medium text-[11px] cursor-pointer ${
              isDirty
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow shadow-cyan-900'
                : 'bg-[#20283a] hover:bg-[#2b364e] text-gray-200'
            }`}
            title="回路を保存 (ブラウザ保存 / JSONエクスポート)"
          >
            <Save className={`w-3.5 h-3.5 ${isDirty ? 'text-white' : 'text-cyan-400'}`} />
            <span>保存</span>
            {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-0.5 animate-pulse"></span>}
          </button>
        </div>

        {/* Current Circuit Title Tag */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e121a] border border-[#222a3a] text-gray-300 font-mono text-[11px] max-w-[170px] truncate">
          <FileText className="w-3 h-3 text-gray-500 shrink-0" />
          <span className="truncate">{circuitName}</span>
          {isDirty && <span className="text-amber-400 text-xs font-bold shrink-0" title="未保存の変更あり">*</span>}
        </div>
      </div>

      {/* Center: Component Palette (Equal Width & Height) */}
      <div className="flex items-center gap-1 bg-[#181e2b] p-1 rounded-lg border border-[#252f42] overflow-x-auto shrink-0">
        <span className="text-[10px] text-gray-500 px-1.5 font-medium">素子追加:</span>

        {/* Passives: R, L, C */}
        <button
          onClick={() => onAddElement('resistor')}
          className="w-[82px] h-[28px] rounded bg-[#212a3b] hover:bg-[#2c374d] text-gray-200 transition font-medium flex items-center justify-center text-center text-[11px] shrink-0"
          title="抵抗 (R)"
        >
          [R] 抵抗
        </button>
        <button
          onClick={() => onAddElement('capacitor')}
          className="w-[82px] h-[28px] rounded bg-[#212a3b] hover:bg-[#2c374d] text-gray-200 transition font-medium flex items-center justify-center text-center text-[11px] shrink-0"
          title="コンデンサ (C)"
        >
          [C] 静電容量
        </button>
        <button
          onClick={() => onAddElement('inductor')}
          className="w-[82px] h-[28px] rounded bg-[#212a3b] hover:bg-[#2c374d] text-gray-200 transition font-medium flex items-center justify-center text-center text-[11px] shrink-0"
          title="コイル (L)"
        >
          [L] コイル
        </button>

        {/* Semiconductors: Diode, Transistor */}
        <button
          onClick={() => onAddElement('diode')}
          className="w-[82px] h-[28px] rounded bg-[#212a3b] hover:bg-[#2c374d] text-gray-200 transition font-medium flex items-center justify-center text-center text-[11px] shrink-0"
          title="ダイオード"
        >
          ダイオード
        </button>
        <button
          onClick={() => onAddElement('npn')}
          className="w-[82px] h-[28px] rounded bg-[#212a3b] hover:bg-[#2c374d] text-gray-200 transition font-medium flex items-center justify-center text-center text-[11px] shrink-0"
          title="NPNトランジスタ (2SC1815)"
        >
          NPN (BJT)
        </button>
        <button
          onClick={() => onAddElement('pnp')}
          className="w-[82px] h-[28px] rounded bg-[#212a3b] hover:bg-[#2c374d] text-gray-200 transition font-medium flex items-center justify-center text-center text-[11px] shrink-0"
          title="PNPトランジスタ (2SA1015)"
        >
          PNP (BJT)
        </button>

        {/* Sources & Controls */}
        <button
          onClick={() => onAddElement('dc_voltage')}
          className="w-[82px] h-[28px] rounded bg-[#212a3b] hover:bg-[#2c374d] text-emerald-300 transition font-medium flex items-center justify-center text-center text-[11px] shrink-0"
          title="直流電源"
        >
          DC電源
        </button>
        <button
          onClick={() => onAddElement('ac_voltage')}
          className="w-[82px] h-[28px] rounded bg-[#212a3b] hover:bg-[#2c374d] text-emerald-300 transition font-medium flex items-center justify-center text-center text-[11px] shrink-0"
          title="交流信号源"
        >
          AC電源
        </button>
        <button
          onClick={() => onAddElement('ground')}
          className="w-[82px] h-[28px] rounded bg-[#212a3b] hover:bg-[#2c374d] text-gray-300 transition font-medium flex items-center justify-center text-center text-[11px] shrink-0"
          title="GND (接地)"
        >
          GND
        </button>
        <button
          onClick={() => onAddElement('switch')}
          className="w-[82px] h-[28px] rounded bg-[#212a3b] hover:bg-[#2c374d] text-gray-300 transition font-medium flex items-center justify-center text-center text-[11px] shrink-0"
          title="スイッチ"
        >
          スイッチ
        </button>
        <button
          onClick={() => onAddElement('ammeter')}
          className="w-[82px] h-[28px] rounded bg-[#212a3b] hover:bg-[#2c374d] text-amber-300 transition font-medium flex items-center justify-center text-center text-[11px] shrink-0"
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
          className="h-[28px] px-2 rounded bg-[#1f283a] text-cyan-300 border border-cyan-800/60 font-medium outline-none cursor-pointer text-[11px] shrink-0"
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
          className="h-[28px] flex items-center gap-1 px-2.5 rounded bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 border border-cyan-700 transition font-semibold text-[11px] shrink-0"
          title="JSONで新しい素子を追加"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>+ JSON素子</span>
        </button>
      </div>

      {/* Right: Simulation Speed & Controls */}
      <div className="flex items-center gap-2 shrink-0">
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
            className="p-1.5 bg-[#181e2b] hover:bg-[#252f42] text-gray-300 rounded border border-[#252f42] transition cursor-pointer"
            title="シミュレーション時刻リセット"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClearAll}
            className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 rounded border border-red-800/60 transition ml-1 cursor-pointer"
            title="画面クリア"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
);
};
