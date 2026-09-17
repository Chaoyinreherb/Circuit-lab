import React, { useState } from 'react';
import { CircuitElement, formatValueWithUnit } from '../components-model/element-base';
import { ProbeManager, ProbeType, Probe } from '../instruments/probe-system';
import {
  Layers,
  Crosshair,
  Trash2,
  RotateCw,
  Unlink,
  ChevronLeft,
  ChevronRight,
  Zap,
  Activity,
  Cpu,
  ToggleRight,
  Disc
} from 'lucide-react';

interface ComponentSidebarProps {
  elements: CircuitElement[];
  selectedElement: CircuitElement | null;
  onSelectElement: (elem: CircuitElement | null) => void;
  onRotateElement: (elem: CircuitElement) => void;
  onDeleteElement: (elem: CircuitElement) => void;
  probeManager: ProbeManager;
  selectedProbe: ProbeType | null;
  onSelectProbe: (probeType: ProbeType | null) => void;
  onDetachProbe: (probeType: ProbeType) => void;
}

export const ComponentSidebar: React.FC<ComponentSidebarProps> = ({
  elements,
  selectedElement,
  onSelectElement,
  onRotateElement,
  onDeleteElement,
  probeManager,
  selectedProbe,
  onSelectProbe,
  onDetachProbe
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'components' | 'probes'>('components');

  const probeList = Object.values(probeManager.probes) as Probe[];

  const getElementBadge = (type: string) => {
    switch (type) {
      case 'resistor':
        return <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 font-mono text-[10px]">R</span>;
      case 'capacitor':
        return <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono text-[10px]">C</span>;
      case 'inductor':
        return <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 font-mono text-[10px]">L</span>;
      case 'diode':
      case 'led':
      case 'zener':
        return <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono text-[10px]">D</span>;
      case 'npn':
      case 'pnp':
        return <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 font-mono text-[10px]">Q</span>;
      case 'dc_voltage':
      case 'ac_voltage':
        return <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 font-mono text-[10px]">V</span>;
      case 'switch':
        return <span className="px-1.5 py-0.5 rounded bg-orange-950 text-orange-300 font-mono text-[10px]">SW</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono text-[10px]">IC</span>;
    }
  };

  const getElementParamSummary = (elem: CircuitElement): string => {
    if (elem.type === 'resistor') return formatValueWithUnit(elem.params.resistance ?? 1000, 'Ω');
    if (elem.type === 'capacitor') return formatValueWithUnit(elem.params.capacitance ?? 10e-6, 'F');
    if (elem.type === 'inductor') return formatValueWithUnit(elem.params.inductance ?? 0.1, 'H');
    if (elem.type === 'dc_voltage') return `${elem.params.voltage ?? 5}V`;
    if (elem.type === 'ac_voltage') return `${elem.params.amplitude ?? 5}Vpk ${elem.params.frequency ?? 50}Hz`;
    if (elem.type === 'npn' || elem.type === 'pnp') return `β=${elem.params.beta ?? 200}`;
    if (elem.type === 'zener') return `Vz=${elem.params.Vz ?? 5.1}V`;
    if (elem.type === 'switch') return elem.state.isOpen ? '開 (OFF)' : '閉 (ON)';
    return '';
  };

  if (!isOpen) {
    return (
      <div className="h-full border-r border-[#202737] bg-[#11141d] flex flex-col items-center py-3 px-1 gap-4 z-20 select-none">
        <button
          onClick={() => setIsOpen(true)}
          title="サイドバーを展開"
          className="p-1.5 rounded-lg bg-[#1a202c] hover:bg-[#252f42] text-cyan-400 border border-[#2d3748] transition cursor-pointer shadow"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="flex flex-col gap-2 items-center text-gray-400">
          <button
            onClick={() => { setIsOpen(true); setActiveTab('components'); }}
            title={`部品一覧 (${elements.length})`}
            className="p-1.5 rounded hover:bg-[#1a202c] hover:text-white transition cursor-pointer relative"
          >
            <Layers className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-cyan-600 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
              {elements.length}
            </span>
          </button>

          <button
            onClick={() => { setIsOpen(true); setActiveTab('probes'); }}
            title="プローブ一覧"
            className="p-1.5 rounded hover:bg-[#1a202c] hover:text-white transition cursor-pointer"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[270px] h-full border-r border-[#202737] bg-[#11141d] flex flex-col z-20 select-none shadow-xl text-xs">
      {/* Sidebar Header & Tab Buttons */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#202737] bg-[#141822]">
        <div className="flex items-center gap-1 bg-[#1c2230] p-0.5 rounded-lg border border-[#283244]">
          <button
            onClick={() => setActiveTab('components')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
              activeTab === 'components'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>部品 ({elements.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('probes')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
              activeTab === 'probes'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>プローブ</span>
          </button>
        </div>

        <button
          onClick={() => setIsOpen(false)}
          title="サイドバーを折りたたむ"
          className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1e2535] transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Content: Components List */}
      {activeTab === 'components' && (
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
          {elements.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500 text-center px-4">
              <Layers className="w-8 h-8 mb-2 opacity-30" />
              <span>回路に部品がありません</span>
              <span className="text-[10px] text-gray-600 mt-1">上部ツールバーから素子を追加してください</span>
            </div>
          ) : (
            elements.map((elem) => {
              const isSelected = selectedElement?.id === elem.id;
              const paramText = getElementParamSummary(elem);

              return (
                <div
                  key={elem.id}
                  onClick={() => {
                    onSelectElement(elem);
                    onSelectProbe(null);
                  }}
                  className={`p-2 rounded-lg border transition-all cursor-pointer flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-cyan-950/60 border-cyan-500 shadow-md ring-1 ring-cyan-500/40'
                      : 'bg-[#151a24] border-[#222b3a] hover:bg-[#1a2130] hover:border-[#2d384c]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 truncate">
                      {getElementBadge(elem.type)}
                      <span className="font-semibold text-gray-200 truncate">
                        {elem.name}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono truncate">
                        [{elem.id}]
                      </span>
                    </div>

                    {/* Quick actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRotateElement(elem);
                        }}
                        title="回転 (R)"
                        className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#252f42] transition"
                      >
                        <RotateCw className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteElement(elem);
                        }}
                        title="削除 (Del)"
                        className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-950/60 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Parameter and Real-time measurements */}
                  <div className="flex items-center justify-between text-[10px] text-gray-400 pl-1 font-mono">
                    <span className="text-cyan-300 truncate">{paramText}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400">{elem.state.voltage.toFixed(2)}V</span>
                      <span className="text-amber-400">{formatValueWithUnit(elem.state.current, 'A')}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab Content: Probes List */}
      {activeTab === 'probes' && (
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
          <div className="text-[10px] text-gray-400 px-1 pb-1">
            プローブをクリックすると回路上の先端がハイライトされます。重なったプローブは「外す」で簡単に未接続に戻せます。
          </div>

          {probeList.map((probe) => {
            const isSelected = selectedProbe === probe.type;
            const isAttached = !!probe.attachedTo;

            return (
              <div
                key={probe.type}
                onClick={() => {
                  onSelectProbe(probe.type);
                  // If attached, also focus the attached element
                  if (probe.attachedTo) {
                    const el = elements.find(e => e.id === probe.attachedTo?.compId);
                    if (el) onSelectElement(el);
                  }
                }}
                className={`p-2 rounded-lg border transition-all cursor-pointer flex flex-col gap-1.5 ${
                  isSelected
                    ? 'bg-amber-950/50 border-amber-400 shadow-md ring-1 ring-amber-400/40'
                    : 'bg-[#151a24] border-[#222b3a] hover:bg-[#1a2130] hover:border-[#2d384c]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0 border border-black/40 shadow-sm"
                      style={{ backgroundColor: probe.color }}
                    ></span>
                    <span className="font-bold text-gray-200">
                      {probe.name}
                    </span>
                  </div>

                  {isAttached && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDetachProbe(probe.type);
                      }}
                      title="プローブを外す (未接続にする)"
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] transition"
                    >
                      <Unlink className="w-3 h-3 text-red-400" />
                      <span>外す</span>
                    </button>
                  )}
                </div>

                {/* Connection Details */}
                <div className="text-[10px] pl-5 flex items-center justify-between">
                  {isAttached ? (
                    <span className="font-mono text-emerald-400 font-semibold truncate">
                      📍 {probe.attachedTo?.compId}.{probe.attachedTo?.pinId ?? 'body'}
                    </span>
                  ) : (
                    <span className="text-gray-500 italic">
                      未接続 (フリー)
                    </span>
                  )}

                  <span className="text-[9px] text-gray-400">
                    {probe.type.startsWith('osc') ? 'OSC' : 'DMM'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Info */}
      <div className="p-2 border-t border-[#202737] bg-[#0f131a] text-[10px] text-gray-400 flex items-center justify-between">
        <span>💡 一覧クリックで即時選択</span>
      </div>
    </div>
  );
};
