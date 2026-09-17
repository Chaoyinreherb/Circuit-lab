import React, { useState } from 'react';
import { registry } from '../components-model/element-registry';
import { CustomComponentDefinition, PRESET_CUSTOM_DEFINITIONS } from '../components-model/custom-element-schema';
import { X, Plus, FileCode, Check, AlertCircle, Download, Upload } from 'lucide-react';

interface CustomElementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComponentAdded: () => void;
}

export const CustomElementModal: React.FC<CustomElementModalProps> = ({ isOpen, onClose, onComponentAdded }) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESET_CUSTOM_DEFINITIONS[0].typeId);
  const [jsonText, setJsonText] = useState<string>(
    JSON.stringify(PRESET_CUSTOM_DEFINITIONS[0], null, 2)
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (def: CustomComponentDefinition) => {
    setSelectedPresetId(def.typeId);
    setJsonText(JSON.stringify(def, null, 2));
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleApply = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.typeId || !parsed.name || !parsed.kind) {
        setErrorMsg('JSONに "typeId", "name", "kind" フィールドが必要です。');
        return;
      }
      const ok = registry.registerCustomDefinition(parsed);
      if (ok) {
        setSuccessMsg(`素子「${parsed.name}」(${parsed.typeId}) をパレットに追加しました！`);
        onComponentAdded();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMsg('素子の登録に失敗しました。定義内容を確認してください。');
      }
    } catch (e: any) {
      setErrorMsg(`JSON構文エラー: ${e.message}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setJsonText(content);
      setErrorMsg(null);
    };
    reader.readAsText(file);
  };

  const handleExportJson = () => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `custom_component_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#161a23] border border-[#2d3748] w-full max-w-3xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-sm">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2d3748] bg-[#12161f]">
          <div className="flex items-center gap-2 text-cyan-400 font-bold">
            <FileCode className="w-5 h-5" />
            <span>カスタム素子の定義 & 追加 (JSON拡張)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex flex-col gap-4 flex-1">
          <p className="text-gray-300 text-xs leading-relaxed">
            素子のモデル定義（端子ピン、等価パラメータ、サブサーキット内部ネットリストなど）をJSONで定義し、回路パレットに直接追加できます。
            下のプリセットテンプレートを選んで編集するか、JSONファイルをインポートしてください。
          </p>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400 font-semibold">テンプレート例:</span>
            {PRESET_CUSTOM_DEFINITIONS.map(def => (
              <button
                key={def.typeId}
                onClick={() => handleSelectPreset(def)}
                className={`px-3 py-1 text-xs rounded-full border transition-all ${
                  selectedPresetId === def.typeId
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-200 font-semibold'
                    : 'bg-[#1f2635] border-gray-700 text-gray-300 hover:bg-[#2a3449]'
                }`}
              >
                {def.name}
              </button>
            ))}
          </div>

          {/* JSON Textarea Editor */}
          <div className="flex flex-col gap-1.5 flex-1">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="font-mono">JSON スキーマ定義</span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 cursor-pointer text-cyan-400 hover:text-cyan-300">
                  <Upload className="w-3.5 h-3.5" />
                  <span>JSON読み込み</span>
                  <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                </label>
                <button
                  onClick={handleExportJson}
                  className="flex items-center gap-1 text-gray-400 hover:text-gray-200"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>エクスポート</span>
                </button>
              </div>
            </div>

            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="w-full h-72 font-mono text-xs p-3 bg-[#0d1017] border border-[#283244] rounded-lg text-emerald-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              spellCheck={false}
            />
          </div>

          {/* Alert Messages */}
          {errorMsg && (
            <div className="flex items-center gap-2 bg-red-950/80 border border-red-800 text-red-300 px-3 py-2 rounded text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 bg-emerald-950/80 border border-emerald-800 text-emerald-300 px-3 py-2 rounded text-xs">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[#2d3748] bg-[#12161f]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            キャンセル
          </button>
          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 px-5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg shadow text-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>素子をパレットに登録</span>
          </button>
        </div>
      </div>
    </div>
  );
};
