import React, { useState, useEffect, useMemo } from 'react';
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
import { getPresetCircuits, PresetCircuit } from './ui/presets';

export const App: React.FC = () => {
  const engine = useMemo(() => new CircuitEngine(), []);

  const [elements, setElements] = useState<CircuitElement[]>([]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [selectedElement, setSelectedElement] = useState<CircuitElement | null>(null);
  const [selectedProbe, setSelectedProbe] = useState<ProbeType | null>(null);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState<boolean>(false);
  const [, setForceUpdate] = useState<number>(0);

  // Load initial preset circuit on mount
  useEffect(() => {
    const presets = getPresetCircuits();
    if (presets.length > 0) {
      loadPreset(presets[0]);
    }
  }, []);

  const loadPreset = (preset: PresetCircuit) => {
    // Deep clone elements and wires to prevent mutating original preset templates
    const newElements: CircuitElement[] = preset.elements.map(el => ({
      ...el,
      pins: el.pins.map(p => ({ ...p })),
      params: { ...el.params },
      state: { ...el.state }
    }));
    const newWires: Wire[] = preset.wires.map(w => ({ ...w }));

    setElements(newElements);
    setWires(newWires);
    setSelectedElement(null);
    setSelectedProbe(null);

    engine.setElementsAndWires(newElements, newWires);

    if (preset.setupProbes) {
      preset.setupProbes();
    }
  };

  const handleAddElement = (typeOrId: string) => {
    // Place new component near center
    const x = 300 + Math.round((Math.random() * 80 - 40) / 10) * 10;
    const y = 200 + Math.round((Math.random() * 80 - 40) / 10) * 10;
    const elem = registry.createElement(typeOrId, x, y);
    if (!elem) return;

    const updated = [...elements, elem];
    setElements(updated);
    setSelectedElement(elem);
    setSelectedProbe(null);
    engine.setElementsAndWires(updated, wires);
  };

  const handleClearAll = () => {
    setElements([]);
    setWires([]);
    setSelectedElement(null);
    setSelectedProbe(null);
    engine.setElementsAndWires([], []);
    // Reset probes to default floating
    Object.values(probeManager.probes).forEach(p => {
      p.attachedTo = undefined;
    });
  };

  const handleUpdateElement = (updated: CircuitElement) => {
    const updatedList = elements.map(e => (e.id === updated.id ? updated : e));
    setElements(updatedList);
    setSelectedElement(updated);
    engine.setElementsAndWires(updatedList, wires);
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
      // Move slightly to open area
      probe.x = probe.originX + 100;
      probe.y = 80;
      setForceUpdate(n => n + 1);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1017] text-gray-100 overflow-hidden font-sans">
      {/* Top Application Bar */}
      <Toolbar
        engine={engine}
        onAddElement={handleAddElement}
        onOpenCustomModal={() => setIsCustomModalOpen(true)}
        onLoadPreset={loadPreset}
        onClearAll={handleClearAll}
      />

      {/* Main Workspace Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar: Components and Probes Tabbed List */}
        <ComponentSidebar
          elements={elements}
          selectedElement={selectedElement}
          onSelectElement={setSelectedElement}
          onRotateElement={handleRotateElement}
          onDeleteElement={handleDeleteElement}
          probeManager={probeManager}
          selectedProbe={selectedProbe}
          onSelectProbe={setSelectedProbe}
          onDetachProbe={handleDetachProbe}
        />

        {/* Center: Circuit Canvas (Interactive workbench) */}
        <div className="flex-1 h-full relative flex flex-col">
          <CircuitCanvas
            engine={engine}
            probeManager={probeManager}
            elements={elements}
            wires={wires}
            selectedElement={selectedElement}
            onSelectElement={setSelectedElement}
            onUpdateElements={(newEls) => {
              setElements(newEls);
              engine.setElementsAndWires(newEls, wires);
            }}
            onUpdateWires={(newWires) => {
              setWires(newWires);
              engine.setElementsAndWires(elements, newWires);
            }}
            selectedProbe={selectedProbe}
            onSelectProbe={setSelectedProbe}
          />
        </div>

        {/* Right: Instrument Bench & Properties Dock */}
        <div className="w-[490px] h-full border-l border-[#202737] bg-[#11141d] p-3 flex flex-col gap-3 overflow-y-auto shadow-2xl z-10">
          {/* Oscilloscope */}
          <OscilloscopeView engine={engine} probeManager={probeManager} />

          {/* Digital Multimeter / Ammeter */}
          <MultimeterView engine={engine} probeManager={probeManager} />

          {/* Component Parameter Inspector */}
          <PropertyPanel
            element={selectedElement}
            wires={wires}
            onUpdateElement={handleUpdateElement}
            onDeleteElement={handleDeleteSelected}
            onRotateElement={handleRotateSelected}
            engine={engine}
          />
        </div>
      </div>

      {/* JSON Custom Component Modal */}
      <CustomElementModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onComponentAdded={() => setForceUpdate(n => n + 1)}
      />
    </div>
  );
};
