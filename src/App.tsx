import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CircuitEngine } from './simulator/circuit-engine';
import { probeManager, ProbeType } from './instruments/probe-system';
import { registry } from './components-model/element-registry';
import { CircuitElement, Wire } from './components-model/element-base';
import { Toolbar } from './ui/Toolbar';
import { CircuitCanvas } from './ui/CircuitCanvas';
import { ComponentSidebar } from './ui/ComponentSidebar';
import { OscilloscopeView } from './instruments/OscilloscopeView';
import { MultimeterView } from './instruments/MultimeterView';
import { PropertyPanel } from './ui/PropertyPanel';
import { CustomElementModal } from './ui/CustomElementModal';
import { CircuitFileModal, ConfirmUnsavedModal } from './ui/CircuitFileModal';
import { Sparkles, PlusCircle } from 'lucide-react';

export const App: React.FC = () => {
  const engine = useMemo(() => new CircuitEngine(), []);

  // Circuit Data: Starts as clean empty workbench (まっさらな状態)
  const [elements, setElements] = useState<CircuitElement[]>([]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [circuitName, setCircuitName] = useState<string>('無題の回路');
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const isDirtyRef = useRef<boolean>(false);

  // Selection states
  const [selectedElement, setSelectedElement] = useState<CircuitElement | null>(null);
  const [selectedWire, setSelectedWire] = useState<Wire | null>(null);
  const [selectedProbe, setSelectedProbe] = useState<ProbeType | null>(null);

  // Modals
  const [isCustomModalOpen, setIsCustomModalOpen] = useState<boolean>(false);
  const [fileModal, setFileModal] = useState<{ isOpen: boolean; mode: 'open' | 'save' }>({
    isOpen: false,
    mode: 'open'
  });
  const [confirmUnsaved, setConfirmUnsaved] = useState<{
    isOpen: boolean;
    action: () => void;
    actionTitle: string;
  } | null>(null);

  const [, setForceUpdate] = useState<number>(0);

  // Keep isDirtyRef in sync with isDirty
  const markDirty = () => {
    if (!isDirtyRef.current) {
      isDirtyRef.current = true;
      setIsDirty(true);
    }
  };

  const markClean = () => {
    isDirtyRef.current = false;
    setIsDirty(false);
  };

  // Browser reload / close warning when uncommitted changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Safe action executor that prompts user if uncommitted changes exist
  const executeWithUnsavedCheck = (action: () => void, actionTitle: string) => {
    if (isDirtyRef.current) {
      setConfirmUnsaved({
        isOpen: true,
        action,
        actionTitle
      });
    } else {
      action();
    }
  };

  // New Circuit (Reset to clean canvas)
  const performNewCircuit = () => {
    setElements([]);
    setWires([]);
    setCircuitName('無題の回路');
    setSelectedElement(null);
    setSelectedWire(null);
    setSelectedProbe(null);
    engine.setElementsAndWires([], []);
    Object.values(probeManager.probes).forEach(p => {
      p.attachedTo = undefined;
    });
    markClean();
  };

  const handleNewCircuit = () => {
    executeWithUnsavedCheck(performNewCircuit, '新しい回路を作成する');
  };

  // Load circuit (from Preset Sample, Browser Storage, or JSON Import)
  const handleLoadCircuit = (
    name: string,
    newElements: CircuitElement[],
    newWires: Wire[],
    setupProbes?: () => void
  ) => {
    const applyLoad = () => {
      const clonedElements = newElements.map(el => ({
        ...el,
        pins: el.pins.map(p => ({ ...p })),
        params: { ...el.params },
        state: { ...el.state }
      }));
      const clonedWires = newWires.map(w => ({ ...w }));

      setElements(clonedElements);
      setWires(clonedWires);
      setCircuitName(name);
      setSelectedElement(null);
      setSelectedWire(null);
      setSelectedProbe(null);

      engine.setElementsAndWires(clonedElements, clonedWires);

      if (setupProbes) {
        setupProbes();
      } else {
        Object.values(probeManager.probes).forEach(p => {
          p.attachedTo = undefined;
        });
      }

      markClean();
    };

    executeWithUnsavedCheck(applyLoad, `「${name}」を読み込む`);
  };

  // Add Element
  const handleAddElement = (typeOrId: string) => {
    const x = 300 + Math.round((Math.random() * 80 - 40) / 10) * 10;
    const y = 200 + Math.round((Math.random() * 80 - 40) / 10) * 10;
    const elem = registry.createElement(typeOrId, x, y);
    if (!elem) return;

    const updated = [...elements, elem];
    setElements(updated);
    setSelectedElement(elem);
    setSelectedWire(null);
    setSelectedProbe(null);
    engine.setElementsAndWires(updated, wires);
    markDirty();
  };

  const handleClearAll = () => {
    executeWithUnsavedCheck(performNewCircuit, '回路全体をクリアする');
  };

  const handleUpdateElement = (updated: CircuitElement) => {
    const updatedList = elements.map(e => (e.id === updated.id ? updated : e));
    setElements(updatedList);
    setSelectedElement(updated);
    engine.setElementsAndWires(updatedList, wires);
    markDirty();
  };

  const handleDeleteElement = (target: CircuitElement) => {
    const updatedList = elements.filter(e => e.id !== target.id);
    const updatedWires = wires.filter(
      w => w.fromCompId !== target.id && w.toCompId !== target.id
    );
    setElements(updatedList);
    setWires(updatedWires);
    if (selectedElement?.id === target.id) {
      setSelectedElement(null);
    }
    engine.setElementsAndWires(updatedList, updatedWires);
    markDirty();
  };

  const handleDeleteWire = (wireId: string) => {
    const updatedWires = wires.filter(w => w.id !== wireId);
    setWires(updatedWires);
    if (selectedWire?.id === wireId) {
      setSelectedWire(null);
    }
    engine.setElementsAndWires(elements, updatedWires);
    markDirty();
  };

  const handleRotateElement = (target: CircuitElement) => {
    const updated = {
      ...target,
      rotation: (target.rotation + 90) % 360
    };
    handleUpdateElement(updated);
  };

  const handleDeleteSelected = () => {
    if (selectedElement) {
      handleDeleteElement(selectedElement);
    } else if (selectedWire) {
      handleDeleteWire(selectedWire.id);
    }
  };

  const handleRotateSelected = () => {
    if (selectedElement) {
      handleRotateElement(selectedElement);
    }
  };

  const handleDetachProbe = (probeType: ProbeType) => {
    const probe = probeManager.probes[probeType];
    if (probe) {
      probe.attachedTo = undefined;
      probe.x = probe.originX + 100;
      probe.y = 80;
      setForceUpdate(n => n + 1);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1017] text-gray-100 overflow-hidden font-sans">
      {/* Top Application Bar with File Management & Palette */}
      <Toolbar
        engine={engine}
        onAddElement={handleAddElement}
        onOpenCustomModal={() => setIsCustomModalOpen(true)}
        onNewCircuit={handleNewCircuit}
        onOpenLoadModal={() => setFileModal({ isOpen: true, mode: 'open' })}
        onOpenSaveModal={() => setFileModal({ isOpen: true, mode: 'save' })}
        onClearAll={handleClearAll}
        circuitName={circuitName}
        isDirty={isDirty}
      />

      {/* Main Workspace Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar: Components and Probes Tabbed List */}
        <ComponentSidebar
          elements={elements}
          selectedElement={selectedElement}
          onSelectElement={(el) => {
            setSelectedElement(el);
            if (el) setSelectedWire(null);
          }}
          onRotateElement={handleRotateElement}
          onDeleteElement={handleDeleteElement}
          probeManager={probeManager}
          selectedProbe={selectedProbe}
          onSelectProbe={setSelectedProbe}
          onDetachProbe={handleDetachProbe}
        />

        {/* Center: Circuit Canvas (Interactive workbench) */}
        <div className="flex-1 h-full relative flex flex-col overflow-hidden">
          <CircuitCanvas
            engine={engine}
            probeManager={probeManager}
            elements={elements}
            wires={wires}
            selectedElement={selectedElement}
            onSelectElement={(el) => {
              setSelectedElement(el);
              if (el) setSelectedWire(null);
            }}
            selectedWire={selectedWire}
            onSelectWire={(w) => {
              setSelectedWire(w);
              if (w) setSelectedElement(null);
            }}
            onDeleteWire={handleDeleteWire}
            onDeleteElement={handleDeleteElement}
            onRotateElement={handleRotateElement}
            onUpdateElements={(newEls) => {
              setElements(newEls);
              engine.setElementsAndWires(newEls, wires);
              markDirty();
            }}
            onUpdateWires={(newWires) => {
              setWires(newWires);
              engine.setElementsAndWires(elements, newWires);
              markDirty();
            }}
            selectedProbe={selectedProbe}
            onSelectProbe={setSelectedProbe}
          />

          {/* Empty State Welcome Guidance (when canvas is clean) */}
          {elements.length === 0 && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-3 text-center p-6 select-none">
              <div className="p-3 rounded-2xl bg-[#141a26]/80 border border-[#232d3f] backdrop-blur-sm text-cyan-400">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="flex flex-col gap-1 max-w-sm">
                <h3 className="font-bold text-gray-200 text-sm">まっさらなキャンバスです</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  上部の素子ボタンからパーツを追加するか、<br />
                  <b>[開く / サンプル]</b> から5種類のサンプル回路を読み込めます。
                </p>
              </div>
            </div>
          )}

          {/* Bottom-Left Floating Property Panel (素子値・配線の変更) */}
          {(selectedElement || selectedWire) && (
            <div className="absolute bottom-4 left-4 z-20 pointer-events-auto">
              <PropertyPanel
                element={selectedElement}
                wire={selectedWire}
                wires={wires}
                onUpdateElement={handleUpdateElement}
                onDeleteElement={handleDeleteSelected}
                onRotateElement={handleRotateSelected}
                onDeleteWire={handleDeleteWire}
                onClose={() => {
                  setSelectedElement(null);
                  setSelectedWire(null);
                }}
                engine={engine}
              />
            </div>
          )}
        </div>

        {/* Right: Instrument Bench (オシロスコープ & マルチメータ) */}
        <div className="w-[490px] h-full border-l border-[#202737] bg-[#11141d] p-3 flex flex-col gap-3 overflow-y-auto shadow-2xl z-10">
          {/* Oscilloscope */}
          <OscilloscopeView engine={engine} probeManager={probeManager} />

          {/* Digital Multimeter / Ammeter */}
          <MultimeterView engine={engine} probeManager={probeManager} />
        </div>
      </div>

      {/* Circuit File Modal (Open / Save / Samples) */}
      <CircuitFileModal
        isOpen={fileModal.isOpen}
        mode={fileModal.mode}
        onClose={() => setFileModal(prev => ({ ...prev, isOpen: false }))}
        currentCircuitName={circuitName}
        onSetCircuitName={setCircuitName}
        elements={elements}
        wires={wires}
        onLoadCircuit={handleLoadCircuit}
        onSaved={markClean}
      />

      {/* Unsaved Changes Confirmation Modal */}
      {confirmUnsaved && (
        <ConfirmUnsavedModal
          isOpen={confirmUnsaved.isOpen}
          actionTitle={confirmUnsaved.actionTitle}
          onConfirmDiscard={() => {
            const action = confirmUnsaved.action;
            setConfirmUnsaved(null);
            action();
          }}
          onSaveFirst={() => {
            setConfirmUnsaved(null);
            setFileModal({ isOpen: true, mode: 'save' });
          }}
          onCancel={() => setConfirmUnsaved(null)}
        />
      )}

      {/* JSON Custom Component Definition Modal */}
      <CustomElementModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onComponentAdded={() => setForceUpdate(n => n + 1)}
      />
    </div>
  );
};
