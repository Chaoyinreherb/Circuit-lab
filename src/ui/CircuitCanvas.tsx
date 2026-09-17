import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CircuitElement, Wire, getPinAbsolutePos, Pin } from '../components-model/element-base';
import { CircuitEngine } from '../simulator/circuit-engine';
import { ProbeManager, ProbeType, Probe } from '../instruments/probe-system';
import { drawElementSymbol, drawWire, drawProbeWithLead } from './circuit-renderer';

interface CircuitCanvasProps {
  engine: CircuitEngine;
  probeManager: ProbeManager;
  elements: CircuitElement[];
  wires: Wire[];
  selectedElement: CircuitElement | null;
  onSelectElement: (elem: CircuitElement | null) => void;
  onUpdateElements: (elements: CircuitElement[]) => void;
  onUpdateWires: (wires: Wire[]) => void;
  selectedProbe?: ProbeType | null;
  onSelectProbe?: (probe: ProbeType | null) => void;
}

export const CircuitCanvas: React.FC<CircuitCanvasProps> = ({
  engine,
  probeManager,
  elements,
  wires,
  selectedElement,
  onSelectElement,
  onUpdateElements,
  onUpdateWires,
  selectedProbe = null,
  onSelectProbe = () => {}
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Interaction states
  const [draggingCompId, setDraggingCompId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [wiringStart, setWiringStart] = useState<{ compId: string; pinId: string; pos: { x: number; y: number } } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [draggingProbe, setDraggingProbe] = useState<ProbeType | null>(null);
  const [hoveredProbe, setHoveredProbe] = useState<ProbeType | null>(null);

  // Snap to grid (10px)
  const snap = (v: number) => Math.round(v / 10) * 10;

  // Animation frame loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      engine.stepFrame();
      probeManager.syncWithElements(elements);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      // 1. Clear background
      ctx.fillStyle = '#0f131a';
      ctx.fillRect(0, 0, width, height);

      // 2. Draw grid dots
      ctx.fillStyle = '#1e2634';
      for (let x = 10; x < width; x += 20) {
        for (let y = 10; y < height; y += 20) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      // 3. Draw wires
      wires.forEach(wire => {
        const fromElem = elements.find(e => e.id === wire.fromCompId);
        const toElem = elements.find(e => e.id === wire.toCompId);
        if (!fromElem || !toElem) return;

        const p1 = fromElem.pins.find(p => p.id === wire.fromPinId);
        const p2 = toElem.pins.find(p => p.id === wire.toPinId);
        if (!p1 || !p2) return;

        const pos1 = getPinAbsolutePos(fromElem, p1);
        const pos2 = getPinAbsolutePos(toElem, p2);

        drawWire(ctx, wire, pos1, pos2, engine.simTime);
      });

      // 4. Draw wiring preview line if in progress
      if (wiringStart) {
        ctx.beginPath();
        ctx.moveTo(wiringStart.pos.x, wiringStart.pos.y);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 5. Draw elements
      elements.forEach(elem => {
        drawElementSymbol(ctx, elem, selectedElement?.id === elem.id, engine.simTime);
      });

      // 6. Draw probes and probe leads (Cables)
      (Object.values(probeManager.probes) as Probe[]).forEach(probe => {
        drawProbeWithLead(
          ctx,
          probe,
          hoveredProbe === probe.type,
          selectedProbe === probe.type
        );
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [engine, elements, wires, selectedElement, selectedProbe, wiringStart, mousePos, hoveredProbe]);

  // Handle Canvas Resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;

      // Update probe jacks based on canvas bounds (e.g. at the top or bottom bench area)
      probeManager.updateOrigins({
        osc_ch1: { x: 80, y: 15 },
        osc_ch2: { x: 130, y: 15 },
        osc_gnd: { x: 180, y: 15 },
        dmm_pos: { x: canvas.width - 200, y: 15 },
        dmm_neg: { x: canvas.width - 150, y: 15 },
        dmm_clamp: { x: canvas.width - 90, y: 15 }
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [probeManager]);

  // Mouse Down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // 1. Check if clicking on a probe tip to drag it
    for (const probe of Object.values(probeManager.probes) as Probe[]) {
      const dist = Math.hypot(probe.x - mx, probe.y - my);
      if (dist <= 20) {
        probe.isDragging = true;
        probe.attachedTo = undefined; // Detach to drag freely
        setDraggingProbe(probe.type);
        onSelectProbe(probe.type);
        onSelectElement(null);
        return;
      }
    }

    // 2. Check if clicking on a component pin to start wiring
    for (const elem of elements) {
      for (const pin of elem.pins) {
        const pPos = getPinAbsolutePos(elem, pin);
        const dist = Math.hypot(pPos.x - mx, pPos.y - my);
        if (dist <= 12) {
          setWiringStart({
            compId: elem.id,
            pinId: pin.id,
            pos: pPos
          });
          return;
        }
      }
    }

    // 3. Check if clicking on a component body
    let hitComp: CircuitElement | null = null;
    for (let i = elements.length - 1; i >= 0; i--) {
      const elem = elements[i];
      const dist = Math.hypot(elem.x - mx, elem.y - my);
      if (dist <= 30) {
        hitComp = elem;
        break;
      }
    }

    if (hitComp) {
      onSelectElement(hitComp);
      onSelectProbe(null);

      // If switch, toggle it directly!
      if (hitComp.type === 'switch') {
        hitComp.state.isOpen = !hitComp.state.isOpen;
        engine.rebuildTopology();
        onUpdateElements([...elements]);
      }

      setDraggingCompId(hitComp.id);
      setDragOffset({ x: mx - hitComp.x, y: my - hitComp.y });
    } else {
      onSelectElement(null);
      onSelectProbe(null);
    }
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setMousePos({ x: mx, y: my });

    // Dragging probe
    if (draggingProbe) {
      const probe = probeManager.probes[draggingProbe];
      probe.x = mx;
      probe.y = my;

      // Check hover snap target
      const snapTarget = probeManager.findSnapTarget(mx, my, elements, 22);
      if (snapTarget) {
        probe.x = snapTarget.snapPos.x;
        probe.y = snapTarget.snapPos.y;
      }
      return;
    }

    // Hover detection for probes
    let foundHovered: ProbeType | null = null;
    for (const probe of Object.values(probeManager.probes) as Probe[]) {
      const dist = Math.hypot(probe.x - mx, probe.y - my);
      if (dist <= 20) {
        foundHovered = probe.type;
        break;
      }
    }
    setHoveredProbe(foundHovered);

    // Dragging component
    if (draggingCompId) {
      const newX = snap(mx - dragOffset.x);
      const newY = snap(my - dragOffset.y);
      const updated = elements.map(el => (el.id === draggingCompId ? { ...el, x: newX, y: newY } : el));
      onUpdateElements(updated);
    }
  };

  // Mouse Up
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // 1. Finish dragging probe
    if (draggingProbe) {
      const probe = probeManager.probes[draggingProbe];
      probe.isDragging = false;

      // Snap to pin or element
      const snapTarget = probeManager.findSnapTarget(mx, my, elements, 25);
      if (snapTarget) {
        probe.x = snapTarget.snapPos.x;
        probe.y = snapTarget.snapPos.y;
        probe.attachedTo = {
          type: snapTarget.type,
          compId: snapTarget.compId,
          pinId: snapTarget.pinId
        };
      } else {
        probe.attachedTo = undefined; // Floating / unconnected probe
      }

      setDraggingProbe(null);
      return;
    }

    // 2. Finish wiring
    if (wiringStart) {
      // Find destination pin
      for (const elem of elements) {
        for (const pin of elem.pins) {
          // Don't connect pin to itself
          if (elem.id === wiringStart.compId && pin.id === wiringStart.pinId) continue;

          const pPos = getPinAbsolutePos(elem, pin);
          const dist = Math.hypot(pPos.x - mx, pPos.y - my);
          if (dist <= 18) {
            // Add wire
            const newWire: Wire = {
              id: `wire_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
              fromCompId: wiringStart.compId,
              fromPinId: wiringStart.pinId,
              toCompId: elem.id,
              toPinId: pin.id
            };
            const updatedWires = [...wires, newWire];
            onUpdateWires(updatedWires);
            engine.setElementsAndWires(elements, updatedWires);
            break;
          }
        }
      }
      setWiringStart(null);
    }

    // 3. Finish component drag
    if (draggingCompId) {
      setDraggingCompId(null);
      engine.setElementsAndWires(elements, wires);
    }
  };

  // Keyboard shortcuts (Rotate: R, Delete: Del/Backspace)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger shortcuts when typing in input fields, textareas, etc.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (!selectedElement) return;

      if (e.key === 'r' || e.key === 'R') {
        const updated = elements.map(el => {
          if (el.id === selectedElement.id) {
            return { ...el, rotation: (el.rotation + 90) % 360 };
          }
          return el;
        });
        onUpdateElements(updated);
        engine.setElementsAndWires(updated, wires);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Remove component and associated wires
        const updatedElements = elements.filter(el => el.id !== selectedElement.id);
        const updatedWires = wires.filter(
          w => w.fromCompId !== selectedElement.id && w.toCompId !== selectedElement.id
        );
        onUpdateElements(updatedElements);
        onUpdateWires(updatedWires);
        onSelectElement(null);
        engine.setElementsAndWires(updatedElements, updatedWires);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElement, elements, wires, engine]);

  return (
    <div className="relative w-full h-full overflow-hidden flex-1 cursor-crosshair">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="w-full h-full block"
      />

      {/* Guide overlay */}
      <div className="absolute bottom-3 left-3 bg-[#111622]/90 border border-[#232d3f] px-3 py-1.5 rounded text-[11px] text-gray-300 pointer-events-none flex items-center gap-3 backdrop-blur shadow-md">
        <span>💡 <b>端子ドラッグ</b>: 配線接続</span>
        <span><b>プローブドラッグ</b>: 実機のように測定端子へ接続</span>
        <span><b>Rキー</b>: 素子回転</span>
        <span><b>Delキー</b>: 削除</span>
        <span><b>スイッチクリック</b>: 開閉切替</span>
      </div>
    </div>
  );
};
