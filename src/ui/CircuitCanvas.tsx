import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CircuitElement, Wire, getPinAbsolutePos, Pin } from '../components-model/element-base';
import { CircuitEngine } from '../simulator/circuit-engine';
import { ProbeManager, ProbeType, Probe } from '../instruments/probe-system';
import { drawElementSymbol, drawWire, drawProbeWithLead } from './circuit-renderer';
import { RotateCcw, Copy, Trash2, RotateCw, Edit3, Plus, CornerDownRight, Check, X } from 'lucide-react';

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
  selectedWire?: Wire | null;
  onSelectWire?: (wire: Wire | null) => void;
  onDeleteWire?: (wireId: string) => void;
  onDeleteElement?: (elem: CircuitElement) => void;
  onRotateElement?: (elem: CircuitElement) => void;
}

// Distance from point p to line segment v-w
function distToSegment(
  p: { x: number; y: number },
  v: { x: number; y: number },
  w: { x: number; y: number }
): { dist: number; proj: { x: number; y: number } } {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) {
    return { dist: Math.hypot(p.x - v.x, p.y - v.y), proj: v };
  }
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
  return { dist: Math.hypot(p.x - proj.x, p.y - proj.y), proj };
}

// Context Menu State
interface ContextMenu {
  screenX: number;
  screenY: number;
  type: 'element' | 'wire' | 'canvas';
  targetElement?: CircuitElement;
  targetWire?: Wire;
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
  onSelectProbe = () => {},
  selectedWire = null,
  onSelectWire = () => {},
  onDeleteWire = () => {},
  onDeleteElement = () => {},
  onRotateElement = () => {}
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pan (viewport offset) states
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const panOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Clipboard for copy-paste (KiCad-style)
  const clipboardRef = useRef<CircuitElement | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  };

  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  useEffect(() => {
    panOffsetRef.current = panOffset;
  }, [panOffset]);

  // Interaction states
  const [draggingCompId, setDraggingCompId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Wiring states
  const [wiringStart, setWiringStart] = useState<{ compId: string; pinId: string; pos: { x: number; y: number } } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Rewiring (reconnecting existing wire endpoint)
  const [rewiring, setRewiring] = useState<{
    wireId: string;
    draggingEnd: 'from' | 'to';
    fixedPos: { x: number; y: number };
  } | null>(null);

  // Hover states
  const [hoveredProbe, setHoveredProbe] = useState<ProbeType | null>(null);
  const [hoveredWireId, setHoveredWireId] = useState<string | null>(null);
  const [hoveredCompId, setHoveredCompId] = useState<string | null>(null);
  const [draggingProbe, setDraggingProbe] = useState<ProbeType | null>(null);

  // Snap to grid (10px)
  const snap = (v: number) => Math.round(v / 10) * 10;

  // Reset viewport to origin (0, 0)
  const handleResetPan = () => {
    setPanOffset({ x: 0, y: 0 });
    panOffsetRef.current = { x: 0, y: 0 };
    showToast('原点 (0, 0) に戻りました');
  };

  // Copy element
  const copyElement = (elem: CircuitElement) => {
    clipboardRef.current = {
      ...elem,
      pins: elem.pins.map(p => ({ ...p })),
      params: { ...elem.params },
      state: { ...elem.state }
    };
    showToast(`「${elem.name}」をコピーしました (Ctrl+V で貼付)`);
  };

  // Paste element at target position or cursor
  const pasteElement = (targetPos?: { x: number; y: number }) => {
    if (!clipboardRef.current) {
      showToast('クリップボードは空です');
      return;
    }
    const base = clipboardRef.current;
    const posX = targetPos ? snap(targetPos.x) : base.x + 30;
    const posY = targetPos ? snap(targetPos.y) : base.y + 30;
    const newId = `${base.type}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const newElem: CircuitElement = {
      ...base,
      id: newId,
      x: posX,
      y: posY,
      pins: base.pins.map(p => ({ ...p })),
      params: { ...base.params },
      state: { voltage: 0, current: 0, power: 0, isOpen: base.state.isOpen }
    };
    const updated = [...elements, newElem];
    onUpdateElements(updated);
    onSelectElement(newElem);
    onSelectWire(null);
    showToast(`「${newElem.name}」を貼り付けました`);
  };

  // Duplicate element (Ctrl+D)
  const duplicateElement = (elem: CircuitElement) => {
    copyElement(elem);
    pasteElement({ x: elem.x + 30, y: elem.y + 30 });
  };

  // Helper to find wire endpoint positions
  const getWirePins = useCallback(
    (wire: Wire) => {
      const fromElem = elements.find(e => e.id === wire.fromCompId);
      const toElem = elements.find(e => e.id === wire.toCompId);
      if (!fromElem || !toElem) return null;

      const p1 = fromElem.pins.find(p => p.id === wire.fromPinId);
      const p2 = toElem.pins.find(p => p.id === wire.toPinId);
      if (!p1 || !p2) return null;

      return {
        fromElem,
        toElem,
        p1,
        p2,
        pos1: getPinAbsolutePos(fromElem, p1),
        pos2: getPinAbsolutePos(toElem, p2)
      };
    },
    [elements]
  );

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
      const panX = panOffsetRef.current.x;
      const panY = panOffsetRef.current.y;

      // 1. Clear background
      ctx.fillStyle = '#0f131a';
      ctx.fillRect(0, 0, width, height);

      // 2. Draw grid dots aligned to pan offset
      ctx.fillStyle = '#1e2634';
      const gridStep = 20;
      const startGridX = ((panX % gridStep) + gridStep) % gridStep;
      const startGridY = ((panY % gridStep) + gridStep) % gridStep;
      for (let x = startGridX; x < width; x += gridStep) {
        for (let y = startGridY; y < height; y += gridStep) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      // Draw subtle origin indicator if visible
      if (panX >= -50 && panX <= width + 50 && panY >= -50 && panY <= height + 50) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(panX - 14, panY);
        ctx.lineTo(panX + 14, panY);
        ctx.moveTo(panX, panY - 14);
        ctx.lineTo(panX, panY + 14);
        ctx.stroke();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.font = '9px monospace';
        ctx.fillText('(0, 0)', panX + 4, panY - 4);
        ctx.restore();
      }

      // 3. Render World Elements (Wires, Previews, Components)
      ctx.save();
      ctx.translate(panX, panY);

      // Draw wires
      wires.forEach(wire => {
        // If this wire is currently being rewired, draw special preview
        if (rewiring && rewiring.wireId === wire.id) {
          ctx.beginPath();
          ctx.moveTo(rewiring.fixedPos.x, rewiring.fixedPos.y);
          ctx.lineTo(mousePos.x, mousePos.y);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Dragging handle circle
          ctx.beginPath();
          ctx.arc(mousePos.x, mousePos.y, 6, 0, 2 * Math.PI);
          ctx.fillStyle = '#0284c7';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
          return;
        }

        const info = getWirePins(wire);
        if (!info) return;

        const isSel = selectedWire?.id === wire.id;
        const isHov = hoveredWireId === wire.id;

        drawWire(ctx, wire, info.pos1, info.pos2, engine.simTime, isSel, isHov);
      });

      // Draw wiring preview line if creating a new wire
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

      // Draw elements
      elements.forEach(elem => {
        const isSel = selectedElement?.id === elem.id;
        drawElementSymbol(ctx, elem, isSel, engine.simTime);
      });

      ctx.restore();

      // 4. Draw Probes & Leads (Screen coordinates)
      (Object.values(probeManager.probes) as Probe[]).forEach(probe => {
        const screenProbe: Probe = {
          ...probe,
          x: probe.x + panX,
          y: probe.y + panY
        };
        drawProbeWithLead(
          ctx,
          screenProbe,
          hoveredProbe === probe.type,
          selectedProbe === probe.type
        );
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    engine,
    elements,
    wires,
    selectedElement,
    selectedProbe,
    selectedWire,
    hoveredWireId,
    wiringStart,
    rewiring,
    mousePos,
    hoveredProbe,
    getWirePins
  ]);

  // Handle Canvas Resize via ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;

    const updateSize = () => {
      if (!canvas || !canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);

      if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
        canvas.width = width;
        canvas.height = height;

        probeManager.updateOrigins({
          osc_ch1: { x: 80, y: 15 },
          osc_ch2: { x: 130, y: 15 },
          osc_gnd: { x: 180, y: 15 },
          dmm_pos: { x: width - 200, y: 15 },
          dmm_neg: { x: width - 150, y: 15 },
          dmm_clamp: { x: width - 90, y: 15 }
        });
      }
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    resizeObserver.observe(canvas.parentElement);
    window.addEventListener('resize', updateSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [probeManager]);

  // Handle Wheel scroll for smooth canvas panning
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const nextX = Math.round(panOffsetRef.current.x - e.deltaX);
      const nextY = Math.round(panOffsetRef.current.y - e.deltaY);
      panOffsetRef.current = { x: nextX, y: nextY };
      setPanOffset({ x: nextX, y: nextY });
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  // Context Menu opener
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const pan = panOffsetRef.current;
    const wx = mx - pan.x;
    const wy = my - pan.y;

    // Check hit element
    for (let i = elements.length - 1; i >= 0; i--) {
      const elem = elements[i];
      if (Math.hypot(elem.x - wx, elem.y - wy) <= 30) {
        onSelectElement(elem);
        onSelectWire(null);
        setContextMenu({
          screenX: e.clientX,
          screenY: e.clientY,
          type: 'element',
          targetElement: elem
        });
        return;
      }
    }

    // Check hit wire
    for (const wire of wires) {
      const info = getWirePins(wire);
      if (!info) continue;
      const { dist } = distToSegment({ x: wx, y: wy }, info.pos1, info.pos2);
      if (dist <= 10) {
        onSelectWire(wire);
        onSelectElement(null);
        setContextMenu({
          screenX: e.clientX,
          screenY: e.clientY,
          type: 'wire',
          targetWire: wire
        });
        return;
      }
    }

    // Canvas background
    setContextMenu({
      screenX: e.clientX,
      screenY: e.clientY,
      type: 'canvas'
    });
  };

  // Close context menu on outside click or Esc
  useEffect(() => {
    const handleWindowClick = () => {
      if (contextMenu) setContextMenu(null);
    };
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, [contextMenu]);

  // Mouse Down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (contextMenu) setContextMenu(null);
    if (e.button !== 0) return; // Only process left click

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const pan = panOffsetRef.current;
    const wx = mx - pan.x;
    const wy = my - pan.y;

    // 1. Check if clicking on a probe tip to drag it
    for (const probe of Object.values(probeManager.probes) as Probe[]) {
      const dist = Math.hypot(probe.x - wx, probe.y - wy);
      if (dist <= 20) {
        probe.isDragging = true;
        probe.attachedTo = undefined;
        setDraggingProbe(probe.type);
        onSelectProbe(probe.type);
        onSelectElement(null);
        onSelectWire(null);
        return;
      }
    }

    // 2. Check if clicking on endpoints of selected wire to start rewiring (KiCad-style wire reconnect)
    if (selectedWire) {
      const info = getWirePins(selectedWire);
      if (info) {
        if (Math.hypot(info.pos1.x - wx, info.pos1.y - wy) <= 14) {
          // Dragging from-pin endpoint
          setRewiring({
            wireId: selectedWire.id,
            draggingEnd: 'from',
            fixedPos: info.pos2
          });
          return;
        } else if (Math.hypot(info.pos2.x - wx, info.pos2.y - wy) <= 14) {
          // Dragging to-pin endpoint
          setRewiring({
            wireId: selectedWire.id,
            draggingEnd: 'to',
            fixedPos: info.pos1
          });
          return;
        }
      }
    }

    // 3. Check if clicking on any wire endpoint directly to reconnect
    for (const wire of wires) {
      const info = getWirePins(wire);
      if (!info) continue;
      if (Math.hypot(info.pos1.x - wx, info.pos1.y - wy) <= 10) {
        onSelectWire(wire);
        onSelectElement(null);
        setRewiring({
          wireId: wire.id,
          draggingEnd: 'from',
          fixedPos: info.pos2
        });
        return;
      }
      if (Math.hypot(info.pos2.x - wx, info.pos2.y - wy) <= 10) {
        onSelectWire(wire);
        onSelectElement(null);
        setRewiring({
          wireId: wire.id,
          draggingEnd: 'to',
          fixedPos: info.pos1
        });
        return;
      }
    }

    // 4. Check if clicking on a component pin to start wiring
    for (const elem of elements) {
      for (const pin of elem.pins) {
        const pPos = getPinAbsolutePos(elem, pin);
        const dist = Math.hypot(pPos.x - wx, pPos.y - wy);
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

    // 5. Check if clicking on a component body
    let hitComp: CircuitElement | null = null;
    for (let i = elements.length - 1; i >= 0; i--) {
      const elem = elements[i];
      const dist = Math.hypot(elem.x - wx, elem.y - wy);
      if (dist <= 30) {
        hitComp = elem;
        break;
      }
    }

    if (hitComp) {
      onSelectElement(hitComp);
      onSelectWire(null);
      onSelectProbe(null);

      // Toggle switch directly on click
      if (hitComp.type === 'switch') {
        hitComp.state.isOpen = !hitComp.state.isOpen;
        engine.rebuildTopology();
        onUpdateElements([...elements]);
      }

      setDraggingCompId(hitComp.id);
      setDragOffset({ x: wx - hitComp.x, y: wy - hitComp.y });
      return;
    }

    // 6. Check if clicking on a wire body (select wire)
    for (const wire of wires) {
      const info = getWirePins(wire);
      if (!info) continue;
      const { dist } = distToSegment({ x: wx, y: wy }, info.pos1, info.pos2);
      if (dist <= 8) {
        onSelectWire(wire);
        onSelectElement(null);
        onSelectProbe(null);
        return;
      }
    }

    // 7. Background click: Start canvas pan
    onSelectElement(null);
    onSelectWire(null);
    onSelectProbe(null);
    isPanningRef.current = true;
    setIsPanning(true);
    panStartRef.current = { x: mx, y: my };
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const pan = panOffsetRef.current;
    const wx = mx - pan.x;
    const wy = my - pan.y;

    // Track mouse in world coordinates
    let curWorldX = wx;
    let curWorldY = wy;

    // Check snapping to pins for wiring preview or rewiring
    if (wiringStart || rewiring) {
      for (const elem of elements) {
        for (const pin of elem.pins) {
          const pPos = getPinAbsolutePos(elem, pin);
          if (Math.hypot(pPos.x - wx, pPos.y - wy) <= 15) {
            curWorldX = pPos.x;
            curWorldY = pPos.y;
            break;
          }
        }
      }
    }
    setMousePos({ x: curWorldX, y: curWorldY });

    // Canvas panning
    if (isPanningRef.current) {
      const dx = mx - panStartRef.current.x;
      const dy = my - panStartRef.current.y;
      panStartRef.current = { x: mx, y: my };
      const nextX = panOffsetRef.current.x + dx;
      const nextY = panOffsetRef.current.y + dy;
      panOffsetRef.current = { x: nextX, y: nextY };
      setPanOffset({ x: nextX, y: nextY });
      return;
    }

    // Dragging probe
    if (draggingProbe) {
      const probe = probeManager.probes[draggingProbe];
      probe.x = wx;
      probe.y = wy;

      const snapTarget = probeManager.findSnapTarget(wx, wy, elements, 22);
      if (snapTarget) {
        probe.x = snapTarget.snapPos.x;
        probe.y = snapTarget.snapPos.y;
      }
      return;
    }

    // Dragging component
    if (draggingCompId) {
      const newX = snap(wx - dragOffset.x);
      const newY = snap(wy - dragOffset.y);
      const updated = elements.map(el => (el.id === draggingCompId ? { ...el, x: newX, y: newY } : el));
      onUpdateElements(updated);
      return;
    }

    // Hover detection for probes
    let foundHoveredProbe: ProbeType | null = null;
    for (const probe of Object.values(probeManager.probes) as Probe[]) {
      if (Math.hypot(probe.x - wx, probe.y - wy) <= 20) {
        foundHoveredProbe = probe.type;
        break;
      }
    }
    setHoveredProbe(foundHoveredProbe);

    // Hover detection for elements
    let foundComp: string | null = null;
    for (let i = elements.length - 1; i >= 0; i--) {
      const elem = elements[i];
      if (Math.hypot(elem.x - wx, elem.y - wy) <= 30) {
        foundComp = elem.id;
        break;
      }
    }
    setHoveredCompId(foundComp);

    // Hover detection for wires
    let foundWire: string | null = null;
    for (const wire of wires) {
      const info = getWirePins(wire);
      if (!info) continue;
      const { dist } = distToSegment({ x: wx, y: wy }, info.pos1, info.pos2);
      if (dist <= 8) {
        foundWire = wire.id;
        break;
      }
    }
    setHoveredWireId(foundWire);
  };

  // Mouse Up
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const pan = panOffsetRef.current;
    const wx = mx - pan.x;
    const wy = my - pan.y;

    // Finish canvas pan
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
    }

    // 1. Finish dragging probe
    if (draggingProbe) {
      const probe = probeManager.probes[draggingProbe];
      probe.isDragging = false;

      const snapTarget = probeManager.findSnapTarget(wx, wy, elements, 25);
      if (snapTarget) {
        probe.x = snapTarget.snapPos.x;
        probe.y = snapTarget.snapPos.y;
        probe.attachedTo = {
          type: snapTarget.type,
          compId: snapTarget.compId,
          pinId: snapTarget.pinId
        };
      } else {
        probe.attachedTo = undefined;
      }

      setDraggingProbe(null);
      return;
    }

    // 2. Finish rewiring (reconnecting wire endpoint to another pin)
    if (rewiring) {
      let targetPin: { elem: CircuitElement; pin: Pin } | null = null;
      for (const elem of elements) {
        for (const pin of elem.pins) {
          const pPos = getPinAbsolutePos(elem, pin);
          if (Math.hypot(pPos.x - wx, pPos.y - wy) <= 18) {
            targetPin = { elem, pin };
            break;
          }
        }
        if (targetPin) break;
      }

      if (targetPin) {
        const wireToUpdate = wires.find(w => w.id === rewiring.wireId);
        if (wireToUpdate) {
          // Avoid connecting pin to itself
          const otherCompId = rewiring.draggingEnd === 'from' ? wireToUpdate.toCompId : wireToUpdate.fromCompId;
          const otherPinId = rewiring.draggingEnd === 'from' ? wireToUpdate.toPinId : wireToUpdate.fromPinId;

          if (!(otherCompId === targetPin.elem.id && otherPinId === targetPin.pin.id)) {
            const updated = wires.map(w => {
              if (w.id === rewiring.wireId) {
                return rewiring.draggingEnd === 'from'
                  ? { ...w, fromCompId: targetPin!.elem.id, fromPinId: targetPin!.pin.id }
                  : { ...w, toCompId: targetPin!.elem.id, toPinId: targetPin!.pin.id };
              }
              return w;
            });
            onUpdateWires(updated);
            engine.setElementsAndWires(elements, updated);
            showToast('配線の接続先を変更しました');
          }
        }
      }
      setRewiring(null);
    }

    // 3. Finish wiring
    if (wiringStart) {
      for (const elem of elements) {
        for (const pin of elem.pins) {
          if (elem.id === wiringStart.compId && pin.id === wiringStart.pinId) continue;

          const pPos = getPinAbsolutePos(elem, pin);
          const dist = Math.hypot(pPos.x - wx, pPos.y - wy);
          if (dist <= 18) {
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
            showToast('配線を接続しました');
            break;
          }
        }
      }
      setWiringStart(null);
    }

    // 4. Finish component drag
    if (draggingCompId) {
      setDraggingCompId(null);
      engine.setElementsAndWires(elements, wires);
    }
  };

  // Keyboard shortcuts (KiCad-style: R, Del, Ctrl+C/V, Ctrl+D, M, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

      // Escape key: cancel ongoing wiring/rewiring, close context menu, or clear selection
      if (e.key === 'Escape') {
        if (wiringStart) {
          setWiringStart(null);
          showToast('配線をキャンセルしました');
          return;
        }
        if (rewiring) {
          setRewiring(null);
          showToast('繋ぎ直しをキャンセルしました');
          return;
        }
        if (contextMenu) {
          setContextMenu(null);
          return;
        }
        onSelectElement(null);
        onSelectWire(null);
        return;
      }

      // Copy: Ctrl+C / Cmd+C
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        if (selectedElement) {
          e.preventDefault();
          copyElement(selectedElement);
        }
        return;
      }

      // Paste: Ctrl+V / Cmd+V
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        pasteElement({ x: mousePos.x, y: mousePos.y });
        return;
      }

      // Duplicate: Ctrl+D / Cmd+D
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        if (selectedElement) {
          e.preventDefault();
          duplicateElement(selectedElement);
        }
        return;
      }

      // Rotate: R (Target selected element OR hovered element under cursor, KiCad-style)
      if (e.key === 'r' || e.key === 'R') {
        const targetElem = selectedElement || elements.find(el => el.id === hoveredCompId);
        if (targetElem) {
          e.preventDefault();
          onRotateElement(targetElem);
          showToast(`「${targetElem.name}」を回転しました (R)`);
        }
        return;
      }

      // Move: M (Start moving selected or hovered component)
      if (e.key === 'm' || e.key === 'M') {
        const targetElem = selectedElement || elements.find(el => el.id === hoveredCompId);
        if (targetElem) {
          e.preventDefault();
          onSelectElement(targetElem);
          setDraggingCompId(targetElem.id);
          setDragOffset({ x: 0, y: 0 });
          showToast(`「${targetElem.name}」を移動中 (M)`);
        }
        return;
      }

      // Delete: Delete or Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElement) {
          e.preventDefault();
          onDeleteElement(selectedElement);
          showToast(`「${selectedElement.name}」を削除しました`);
        } else if (selectedWire) {
          e.preventDefault();
          onDeleteWire(selectedWire.id);
          showToast('配線を削除しました');
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedElement,
    selectedWire,
    hoveredCompId,
    elements,
    mousePos,
    wiringStart,
    rewiring,
    contextMenu,
    onRotateElement,
    onDeleteElement,
    onDeleteWire,
    onSelectElement,
    onSelectWire
  ]);

  const hasOffset = panOffset.x !== 0 || panOffset.y !== 0;

  return (
    <div
      onContextMenu={handleContextMenu}
      className={`relative w-full h-full overflow-hidden flex-1 select-none ${
        isPanning
          ? 'cursor-grabbing'
          : rewiring
          ? 'cursor-grab'
          : hoveredWireId
          ? 'cursor-pointer'
          : 'cursor-crosshair'
      }`}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="w-full h-full block"
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-[#162032]/95 border border-cyan-500/40 text-cyan-200 px-4 py-1.5 rounded-full text-xs font-medium shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-200">
          <Check className="w-3.5 h-3.5 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Viewport Control Overlay (Top-Right: Reset View button) */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
        <button
          onClick={handleResetPan}
          title="原点に戻る (表示位置をリセット)"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border shadow-lg text-xs font-medium transition cursor-pointer backdrop-blur active:scale-95 ${
            hasOffset
              ? 'bg-[#182338]/95 hover:bg-[#223350] text-cyan-300 border-cyan-500/50 shadow-cyan-950/40 ring-1 ring-cyan-500/30'
              : 'bg-[#121620]/80 hover:bg-[#1a2130] text-gray-400 border-[#263143]'
          }`}
        >
          <RotateCcw className={`w-3.5 h-3.5 ${hasOffset ? 'text-cyan-400 animate-pulse' : 'text-gray-400'}`} />
          <span>原点に戻る</span>
          {hasOffset && (
            <span className="text-[10px] text-cyan-400/80 font-mono ml-0.5">
              ({panOffset.x > 0 ? `+${panOffset.x}` : panOffset.x}, {panOffset.y > 0 ? `+${panOffset.y}` : panOffset.y})
            </span>
          )}
        </button>
      </div>

      {/* Guide overlay (KiCad-style shortcuts) */}
      <div className="absolute bottom-3 right-3 bg-[#111622]/90 border border-[#232d3f] px-3 py-1.5 rounded text-[11px] text-gray-300 pointer-events-none flex flex-wrap items-center gap-3 backdrop-blur shadow-md z-10">
        <span>🖱️ <b>端子ドラッグ</b>: 配線</span>
        <span>⚡ <b>配線端点ドラッグ</b>: 繋ぎ直し</span>
        <span><b>R</b>: 回転</span>
        <span><b>Ctrl+C/V</b>: コピペ</span>
        <span><b>Ctrl+D</b>: 複製</span>
        <span><b>Del</b>: 削除</span>
        <span><b>右クリック</b>: メニュー</span>
      </div>

      {/* Context Menu Popup (KiCad-style right-click) */}
      {contextMenu && (
        <div
          style={{ left: contextMenu.screenX, top: contextMenu.screenY }}
          className="fixed z-50 min-w-[160px] bg-[#141a26]/98 border border-[#2d3a52] rounded-xl py-1.5 px-1 text-xs text-gray-200 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'element' && contextMenu.targetElement && (
            <>
              <div className="px-2.5 py-1 text-[10px] font-mono text-cyan-400 border-b border-[#232d40] mb-1">
                {contextMenu.targetElement.name}
              </div>
              <button
                onClick={() => {
                  onRotateElement(contextMenu.targetElement!);
                  setContextMenu(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-[#202c40] rounded text-left transition"
              >
                <div className="flex items-center gap-2">
                  <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>回転</span>
                </div>
                <span className="text-[10px] text-gray-500 font-mono">R</span>
              </button>
              <button
                onClick={() => {
                  duplicateElement(contextMenu.targetElement!);
                  setContextMenu(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-[#202c40] rounded text-left transition"
              >
                <div className="flex items-center gap-2">
                  <Copy className="w-3.5 h-3.5 text-emerald-400" />
                  <span>複製</span>
                </div>
                <span className="text-[10px] text-gray-500 font-mono">Ctrl+D</span>
              </button>
              <button
                onClick={() => {
                  copyElement(contextMenu.targetElement!);
                  setContextMenu(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-[#202c40] rounded text-left transition"
              >
                <div className="flex items-center gap-2">
                  <Copy className="w-3.5 h-3.5 text-blue-400" />
                  <span>コピー</span>
                </div>
                <span className="text-[10px] text-gray-500 font-mono">Ctrl+C</span>
              </button>
              <div className="border-t border-[#232d40] my-1"></div>
              <button
                onClick={() => {
                  onDeleteElement(contextMenu.targetElement!);
                  setContextMenu(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-red-950/40 text-red-400 rounded text-left transition"
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>削除</span>
                </div>
                <span className="text-[10px] text-red-500/70 font-mono">Del</span>
              </button>
            </>
          )}

          {contextMenu.type === 'wire' && contextMenu.targetWire && (
            <>
              <div className="px-2.5 py-1 text-[10px] font-mono text-cyan-400 border-b border-[#232d40] mb-1">
                配線 (Wire)
              </div>
              <div className="px-2.5 py-1 text-[10px] text-gray-400">
                端点をドラッグで繋ぎ直せます
              </div>
              <button
                onClick={() => {
                  onDeleteWire(contextMenu.targetWire!.id);
                  setContextMenu(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-red-950/40 text-red-400 rounded text-left transition"
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>配線を削除</span>
                </div>
                <span className="text-[10px] text-red-500/70 font-mono">Del</span>
              </button>
            </>
          )}

          {contextMenu.type === 'canvas' && (
            <>
              <button
                onClick={() => {
                  pasteElement({ x: mousePos.x, y: mousePos.y });
                  setContextMenu(null);
                }}
                disabled={!clipboardRef.current}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition ${
                  clipboardRef.current
                    ? 'hover:bg-[#202c40] text-gray-200'
                    : 'opacity-40 cursor-not-allowed text-gray-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                  <span>貼り付け</span>
                </div>
                <span className="text-[10px] text-gray-500 font-mono">Ctrl+V</span>
              </button>
              <button
                onClick={() => {
                  handleResetPan();
                  setContextMenu(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-[#202c40] rounded text-left transition"
              >
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5 text-gray-400" />
                  <span>原点に戻る</span>
                </div>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
