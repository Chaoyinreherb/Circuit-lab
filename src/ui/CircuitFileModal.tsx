import React, { useState, useEffect } from 'react';
import { CircuitElement, Wire } from '../components-model/element-base';
import { getPresetCircuits, PresetCircuit } from './presets';
import {
  FolderOpen,
  Save,
  Download,
  Upload,
  Trash2,
  Clock,
  Sparkles,
  X,
  Check,
  Cpu,
  Layers,
  FileText,
  AlertTriangle
} from 'lucide-react';

export interface SavedCircuit {
  id: string;
  name: string;
  updatedAt: number;
  elements: CircuitElement[];
  wires: Wire[];
}

const STORAGE_KEY = 'circuit_lab_saved_circuits';

interface CircuitFileModalProps {
  isOpen: boolean;
  mode: 'open' | 'save';
  onClose: () => void;
  currentCircuitName: string;
  onSetCircuitName: (name: string) => void;
  elements: CircuitElement[];
  wires: Wire[];
  onLoadCircuit: (name: string, elements: CircuitElement[], wires: Wire[], setupProbes?: () => void) => void;
  onSaved: () => void;
}

export const CircuitFileModal: React.FC<CircuitFileModalProps> = ({
  isOpen,
  mode: initialMode,
  onClose,
  currentCircuitName,
  onSetCircuitName,
  elements,
  wires,
  onLoadCircuit,
  onSaved
}) => {
  const [activeMode, setActiveMode] = useState<'open' | 'save'>(initialMode);
  const [openSubTab, setOpenSubTab] = useState<'samples' | 'browser' | 'json'>('samples');

  // Save inputs
  const [saveName, setSaveName] = useState<string>(currentCircuitName || '無題の回路');
  const [savedCircuits, setSavedCircuits] = useState<SavedCircuit[]>([]);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Sync mode when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveMode(initialMode);
      setSaveName(currentCircuitName || '無題の回路');
      loadSavedList();
      setJsonError(null);
    }
  }, [isOpen, initialMode, currentCircuitName]);

  const loadSavedList = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setSavedCircuits(JSON.parse(raw));
      } else {
        setSavedCircuits([]);
      }
    } catch {
      setSavedCircuits([]);
    }
  };

  if (!isOpen) return null;

  const presets = getPresetCircuits();

  // Save to LocalStorage
  const handleSaveToBrowser = () => {
    const name = saveName.trim() || '無題の回路';
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list: SavedCircuit[] = raw ? JSON.parse(raw) : [];

      const newEntry: SavedCircuit = {
        id: `circuit_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
        name,
        updatedAt: Date.now(),
        elements: elements.map(el => ({
          ...el,
          pins: el.pins.map(p => ({ ...p })),
          params: { ...el.params },
          state: { ...el.state }
        })),
        wires: wires.map(w => ({ ...w }))
      };

      list.unshift(newEntry);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      onSetCircuitName(name);
      onSaved();
      onClose();
    } catch (e) {
      alert('ブラウザ保存に失敗しました。容量オーバーの可能性があります。');
    }
  };

  // Export JSON file
  const handleExportJson = () => {
    const name = saveName.trim() || '無題の回路';
    const payload = {
      app: 'CircuitLab',
      version: '1.0.0',
      circuitName: name,
      exportedAt: new Date().toISOString(),
      elements,
      wires
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[/\\?%*:|"<>]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);

    onSetCircuitName(name);
    onSaved();
    onClose();
  };

  // Import JSON file
  const handleImportJsonFile = (file: File) => {
    setJsonError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);
        if (!Array.isArray(data.elements) || !Array.isArray(data.wires)) {
          throw new Error('回路データ（elements / wires）が正しく含まれていません。');
        }
        const name = data.circuitName || file.name.replace(/\.json$/i, '');
        onLoadCircuit(name, data.elements, data.wires);
        onClose();
      } catch (err: any) {
        setJsonError(`読み込み失敗: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Delete from LocalStorage
  const handleDeleteSaved = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('この保存回路を削除してもよろしいですか？')) return;
    const updated = savedCircuits.filter(item => item.id !== id);
    setSavedCircuits(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#121622] border border-[#273248] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl text-gray-200 overflow-hidden">
        {/* Header with Mode Switch */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#20293d] bg-[#161c2b]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              {activeMode === 'save' ? <Save className="w-5 h-5" /> : <FolderOpen className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveMode('open')}
                  className={`text-base font-bold transition ${
                    activeMode === 'open' ? 'text-white border-b-2 border-cyan-400 pb-0.5' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  回路を開く / サンプル
                </button>
                <span className="text-gray-600">|</span>
                <button
                  onClick={() => setActiveMode('save')}
                  className={`text-base font-bold transition ${
                    activeMode === 'save' ? 'text-white border-b-2 border-cyan-400 pb-0.5' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  回路を保存
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {activeMode === 'save'
                  ? '作成した回路をブラウザ内またはJSONファイルとして保存します'
                  : 'サンプル回路、ブラウザ保存回路、またはJSONファイルを読み込みます'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#20293d] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ──────── SAVE MODE ──────── */}
          {activeMode === 'save' && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300">回路名:</label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="例: マイ発振回路_v1"
                  className="bg-[#0e131d] border border-[#2d3a52] rounded-xl px-3.5 py-2 text-sm text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                />
                <span className="text-[11px] text-gray-500">
                  現在の素子数: {elements.length} 個 / 配線数: {wires.length} 本
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-2">
                {/* Save to Browser */}
                <div className="bg-[#171e2c] border border-[#273449] hover:border-cyan-500/50 rounded-xl p-4 flex flex-col justify-between gap-4 transition">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
                      <Save className="w-4 h-4" />
                      <span>ブラウザに保存 (推奨)</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      このブラウザの内部ストレージに即時保存します。次回以降いつでも「開く」一覧から呼び出せます。
                    </p>
                  </div>
                  <button
                    onClick={handleSaveToBrowser}
                    className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition shadow-lg shadow-cyan-950/50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>ブラウザに保存する</span>
                  </button>
                </div>

                {/* Export JSON */}
                <div className="bg-[#171e2c] border border-[#273449] hover:border-emerald-500/50 rounded-xl p-4 flex flex-col justify-between gap-4 transition">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                      <Download className="w-4 h-4" />
                      <span>JSONエクスポート</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      回路データを .json ファイルとしてPCにダウンロードします。バックアップや他環境への共有に最適です。
                    </p>
                  </div>
                  <button
                    onClick={handleExportJson}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-950/50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>JSONファイルを保存</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ──────── OPEN MODE ──────── */}
          {activeMode === 'open' && (
            <div className="flex flex-col gap-4">
              {/* Sub tabs */}
              <div className="flex items-center gap-2 border-b border-[#232c3d] pb-2 text-xs font-semibold">
                <button
                  onClick={() => setOpenSubTab('samples')}
                  className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                    openSubTab === 'samples'
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a2130]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>サンプル回路 ({presets.length})</span>
                </button>

                <button
                  onClick={() => setOpenSubTab('browser')}
                  className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                    openSubTab === 'browser'
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a2130]'
                  }`}
                >
                  <Save className="w-3.5 h-3.5 text-cyan-400" />
                  <span>保存済み回路 ({savedCircuits.length})</span>
                </button>

                <button
                  onClick={() => setOpenSubTab('json')}
                  className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                    openSubTab === 'json'
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a2130]'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  <span>JSONファイル読込</span>
                </button>
              </div>

              {/* Subtab 1: Preset Samples */}
              {openSubTab === 'samples' && (
                <div className="flex flex-col gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      onClick={() => {
                        onLoadCircuit(preset.name, preset.elements, preset.wires, preset.setupProbes);
                        onClose();
                      }}
                      className="p-3.5 rounded-xl bg-[#171d2b] hover:bg-[#20293d] border border-[#252f44] hover:border-cyan-500/50 transition cursor-pointer flex items-center justify-between gap-4 group"
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-100 group-hover:text-cyan-300 transition">
                            {preset.name}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed truncate">
                          {preset.description}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-gray-500 font-mono mt-0.5">
                          <span>素子: {preset.elements.length}個</span>
                          <span>配線: {preset.wires.length}本</span>
                        </div>
                      </div>

                      <button className="px-3.5 py-1.5 rounded-lg bg-[#243046] group-hover:bg-cyan-600 text-gray-300 group-hover:text-white font-medium text-xs transition shrink-0">
                        読み込む
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Subtab 2: Saved Circuits in LocalStorage */}
              {openSubTab === 'browser' && (
                <div className="flex flex-col gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
                  {savedCircuits.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center text-gray-500">
                      <Save className="w-8 h-8 mb-2 opacity-40" />
                      <p className="text-sm font-medium">ブラウザ保存された回路はまだありません</p>
                      <p className="text-xs text-gray-600 mt-1">「回路を保存」タブから現在の回路を保存できます</p>
                    </div>
                  ) : (
                    savedCircuits.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          onLoadCircuit(item.name, item.elements, item.wires);
                          onClose();
                        }}
                        className="p-3.5 rounded-xl bg-[#171d2b] hover:bg-[#20293d] border border-[#252f44] hover:border-cyan-500/50 transition cursor-pointer flex items-center justify-between gap-4 group"
                      >
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="font-bold text-sm text-gray-100 group-hover:text-cyan-300 transition truncate">
                            {item.name}
                          </span>
                          <div className="flex items-center gap-3 text-[11px] text-gray-500 font-mono">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(item.updatedAt).toLocaleString()}
                            </span>
                            <span>素子: {item.elements.length}個</span>
                            <span>配線: {item.wires.length}本</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={(e) => handleDeleteSaved(item.id, e)}
                            title="削除"
                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <span className="px-3.5 py-1.5 rounded-lg bg-[#243046] group-hover:bg-cyan-600 text-gray-300 group-hover:text-white font-medium text-xs transition">
                            開く
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Subtab 3: JSON file import */}
              {openSubTab === 'json' && (
                <div className="flex flex-col gap-4 py-4">
                  <div className="border-2 border-dashed border-[#2d3a52] hover:border-cyan-500 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3 bg-[#141a27] transition group cursor-pointer relative">
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImportJsonFile(file);
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Upload className="w-10 h-10 text-cyan-400 group-hover:scale-110 transition" />
                    <div>
                      <p className="font-semibold text-sm text-gray-200">
                        クリックして JSON 回路ファイルを選択
                      </p>
                      <p className="text-xs text-gray-500 mt-1">またはファイルをここにドラッグ＆ドロップ</p>
                    </div>
                  </div>

                  {jsonError && (
                    <div className="p-3 rounded-xl bg-red-950/60 border border-red-700 text-red-300 text-xs">
                      {jsonError}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface ConfirmUnsavedModalProps {
  isOpen: boolean;
  onConfirmDiscard: () => void;
  onSaveFirst: () => void;
  onCancel: () => void;
  actionTitle?: string;
}

export const ConfirmUnsavedModal: React.FC<ConfirmUnsavedModalProps> = ({
  isOpen,
  onConfirmDiscard,
  onSaveFirst,
  onCancel,
  actionTitle = '別の回路を開く'
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#121622] border border-amber-600/60 rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl text-gray-200">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-700/60 text-amber-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="font-bold text-base text-white">未保存の変更があります</h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              現在の回路に変更が加えられています。{actionTitle}前に保存しますか？
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-[#232c3e]">
          <button
            onClick={onCancel}
            className="px-3.5 py-2 rounded-xl bg-[#1c2333] hover:bg-[#253046] text-gray-300 text-xs font-medium transition cursor-pointer"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirmDiscard}
            className="px-3.5 py-2 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-200 text-xs font-semibold transition cursor-pointer"
          >
            破棄して続ける
          </button>
          <button
            onClick={onSaveFirst}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition shadow-lg shadow-cyan-950 cursor-pointer flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>保存する</span>
          </button>
        </div>
      </div>
    </div>
  );
};

