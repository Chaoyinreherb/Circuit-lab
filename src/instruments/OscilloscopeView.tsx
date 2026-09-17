import React, { useRef, useEffect, useState } from 'react';
import { CircuitEngine } from '../simulator/circuit-engine';
import { ProbeManager } from './probe-system';
import { Activity, Play, Pause, RotateCcw, Move } from 'lucide-react';

interface OscilloscopeProps {
  engine: CircuitEngine;
  probeManager: ProbeManager;
}

export const OscilloscopeView: React.FC<OscilloscopeProps> = ({ engine, probeManager }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Timebase
  const [timeDivIndex, setTimeDivIndex] = useState<number>(6); // Default 1ms/div
  const timeDivs = [20e-6, 50e-6, 100e-6, 200e-6, 500e-6, 1e-3, 2e-3, 5e-3, 10e-3, 20e-3, 50e-3];
  const timeDivLabels = ['20µs', '50µs', '100µs', '200µs', '500µs', '1ms', '2ms', '5ms', '10ms', '20ms', '50ms'];

  // Channels
  const [ch1VoltDivIndex, setCh1VoltDivIndex] = useState<number>(5); // 1V/div
  const [ch2VoltDivIndex, setCh2VoltDivIndex] = useState<number>(5); // 1V/div
  const voltDivs = [0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0];
  const voltDivLabels = ['50mV', '100mV', '200mV', '500mV', '1V', '2V', '5V', '10V'];

  const [ch1Enabled, setCh1Enabled] = useState<boolean>(true);
  const [ch2Enabled, setCh2Enabled] = useState<boolean>(true);

  // Position / Offset controls (Move screen feature)
  const [timeOffset, setTimeOffset] = useState<number>(0); // in seconds
  const [ch1Offset, setCh1Offset] = useState<number>(0); // in divisions (-4 to +4)
  const [ch2Offset, setCh2Offset] = useState<number>(0); // in divisions (-4 to +4)

  // Drag-to-pan state on the canvas
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialTimeOffset, setInitialTimeOffset] = useState<number>(0);
  const [initialCh1Offset, setInitialCh1Offset] = useState<number>(0);
  const [initialCh2Offset, setInitialCh2Offset] = useState<number>(0);

  // Trigger controls
  const [triggerSource, setTriggerSource] = useState<'ch1' | 'ch2' | 'none'>('ch1');
  const [triggerLevel, setTriggerLevel] = useState<number>(0.0);
  const [triggerSlope, setTriggerSlope] = useState<'rising' | 'falling'>('rising');
  const [isTriggered, setIsTriggered] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Readouts
  const [statsCh1, setStatsCh1] = useState({ vpp: 0, vrms: 0, freq: 0 });
  const [statsCh2, setStatsCh2] = useState({ vpp: 0, vrms: 0, freq: 0 });

  const timeDiv = timeDivs[timeDivIndex];
  const ch1VoltDiv = voltDivs[ch1VoltDivIndex];
  const ch2VoltDiv = voltDivs[ch2VoltDivIndex];

  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      // 1. Clear background CRT dark
      ctx.fillStyle = '#080c10';
      ctx.fillRect(0, 0, width, height);

      // 2. Draw 10 x 8 grid
      const divX = width / 10;
      const divY = height / 8;

      ctx.strokeStyle = '#1a2332';
      ctx.lineWidth = 1;

      // Vertical lines
      for (let i = 0; i <= 10; i++) {
        ctx.beginPath();
        ctx.moveTo(i * divX, 0);
        ctx.lineTo(i * divX, height);
        ctx.stroke();

        if (i < 10) {
          for (let sub = 1; sub < 5; sub++) {
            ctx.beginPath();
            ctx.moveTo(i * divX + (sub * divX) / 5, height / 2 - 3);
            ctx.lineTo(i * divX + (sub * divX) / 5, height / 2 + 3);
            ctx.strokeStyle = '#223045';
            ctx.stroke();
            ctx.strokeStyle = '#1a2332';
          }
        }
      }

      // Horizontal lines
      for (let j = 0; j <= 8; j++) {
        ctx.beginPath();
        ctx.moveTo(0, j * divY);
        ctx.lineTo(width, j * divY);
        ctx.stroke();

        if (j < 8) {
          for (let sub = 1; sub < 5; sub++) {
            ctx.beginPath();
            ctx.moveTo(width / 2 - 3, j * divY + (sub * divY) / 5);
            ctx.lineTo(width / 2 + 3, j * divY + (sub * divY) / 5);
            ctx.strokeStyle = '#223045';
            ctx.stroke();
            ctx.strokeStyle = '#1a2332';
          }
        }
      }

      // Center crosshairs (Origin)
      ctx.strokeStyle = '#2d3f59';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();

      // Zero-level markers for CH1 and CH2 on left border
      if (ch1Enabled) {
        const ch1ZeroY = height / 2 - ch1Offset * divY;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(0, ch1ZeroY);
        ctx.lineTo(6, ch1ZeroY - 4);
        ctx.lineTo(6, ch1ZeroY + 4);
        ctx.closePath();
        ctx.fill();
      }
      if (ch2Enabled) {
        const ch2ZeroY = height / 2 - ch2Offset * divY;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(0, ch2ZeroY);
        ctx.lineTo(6, ch2ZeroY - 4);
        ctx.lineTo(6, ch2ZeroY + 4);
        ctx.closePath();
        ctx.fill();
      }

      // 3. Extract and synchronize waveforms from history buffer
      const history = engine.getHistory();
      if (history.length > 5) {
        const ch1Probe = probeManager.probes.osc_ch1;
        const ch2Probe = probeManager.probes.osc_ch2;
        const gndProbe = probeManager.probes.osc_gnd;

        const gndNode = (gndProbe.attachedTo && gndProbe.attachedTo.pinId)
          ? engine.getPinNode(gndProbe.attachedTo.compId, gndProbe.attachedTo.pinId)
          : 0;

        const ch1Node = (ch1Probe.attachedTo && ch1Probe.attachedTo.pinId)
          ? engine.getPinNode(ch1Probe.attachedTo.compId, ch1Probe.attachedTo.pinId)
          : -1;

        const ch2Node = (ch2Probe.attachedTo && ch2Probe.attachedTo.pinId)
          ? engine.getPinNode(ch2Probe.attachedTo.compId, ch2Probe.attachedTo.pinId)
          : -1;

        const totalTime = timeDiv * 10;
        const samplesNeeded = Math.max(10, Math.round(totalTime / engine.timeStep));
        const halfSamples = Math.floor(samplesNeeded / 2);

        // Determine which node is trigger source
        let trigNode = -1;
        if (triggerSource === 'ch1' && ch1Enabled && ch1Node !== -1) {
          trigNode = ch1Node;
        } else if (triggerSource === 'ch2' && ch2Enabled && ch2Node !== -1) {
          trigNode = ch2Node;
        }

        let triggerIndex = -1;
        if (trigNode !== -1 && history.length > samplesNeeded) {
          const maxSearchIdx = history.length - 1 - halfSamples;
          const minSearchIdx = Math.max(1, maxSearchIdx - samplesNeeded * 2);

          for (let i = maxSearchIdx; i >= minSearchIdx; i--) {
            const vPrev = (history[i - 1].nodes[trigNode] ?? 0) - (history[i - 1].nodes[gndNode] ?? 0);
            const vCurr = (history[i].nodes[trigNode] ?? 0) - (history[i].nodes[gndNode] ?? 0);

            if (triggerSlope === 'rising') {
              if (vPrev <= triggerLevel && vCurr > triggerLevel) {
                triggerIndex = i;
                break;
              }
            } else {
              if (vPrev >= triggerLevel && vCurr < triggerLevel) {
                triggerIndex = i;
                break;
              }
            }
          }
        }

        setIsTriggered(triggerIndex !== -1);

        // Determine window startIndex
        let startIndex: number;
        if (triggerIndex !== -1) {
          startIndex = Math.max(0, triggerIndex - halfSamples);
        } else {
          startIndex = Math.max(0, history.length - samplesNeeded);
        }

        // Apply timeOffset to baseTime
        const baseTime = (history[startIndex]?.time ?? 0) - timeOffset;

        // Map (time, voltage) to canvas coordinates
        const toCanvas = (t: number, v: number, voltDiv: number, offsetDiv: number) => {
          const x = ((t - baseTime) / totalTime) * width;
          const y = height / 2 - ((v / voltDiv) + offsetDiv) * divY;
          return { x, y };
        };

        // Draw Channel 1 (Red)
        if (ch1Enabled && ch1Node !== -1) {
          ctx.save();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
          ctx.shadowBlur = 5;
          ctx.beginPath();

          let minV = Infinity;
          let maxV = -Infinity;
          let sumSquares = 0;
          let sampleCount = 0;

          let started = false;
          // Loop with wide window so panning doesn't clip
          const startLoop = Math.max(0, startIndex - Math.round(samplesNeeded * 2));
          const endLoop = Math.min(history.length, startIndex + Math.round(samplesNeeded * 3));

          for (let i = startLoop; i < endLoop; i++) {
            const pt = history[i];
            const v = (pt.nodes[ch1Node] ?? 0) - (pt.nodes[gndNode] ?? 0);
            const { x, y } = toCanvas(pt.time, v, ch1VoltDiv, ch1Offset);

            if (x < -20 || x > width + 20) {
              started = false;
              continue;
            }

            if (!started) {
              ctx.moveTo(x, y);
              started = true;
            } else {
              ctx.lineTo(x, y);
            }

            if (x >= 0 && x <= width) {
              if (v < minV) minV = v;
              if (v > maxV) maxV = v;
              sumSquares += v * v;
              sampleCount++;
            }
          }
          ctx.stroke();
          ctx.restore();

          if (sampleCount > 0 && Math.abs(maxV - minV) > 1e-4) {
            setStatsCh1({
              vpp: maxV - minV,
              vrms: Math.sqrt(sumSquares / sampleCount),
              freq: 50
            });
          }
        }

        // Draw Channel 2 (Cyan/Blue)
        if (ch2Enabled && ch2Node !== -1) {
          ctx.save();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
          ctx.shadowBlur = 5;
          ctx.beginPath();

          let minV = Infinity;
          let maxV = -Infinity;
          let sumSquares = 0;
          let sampleCount = 0;

          let started = false;
          const startLoop = Math.max(0, startIndex - Math.round(samplesNeeded * 2));
          const endLoop = Math.min(history.length, startIndex + Math.round(samplesNeeded * 3));

          for (let i = startLoop; i < endLoop; i++) {
            const pt = history[i];
            const v = (pt.nodes[ch2Node] ?? 0) - (pt.nodes[gndNode] ?? 0);
            const { x, y } = toCanvas(pt.time, v, ch2VoltDiv, ch2Offset);

            if (x < -20 || x > width + 20) {
              started = false;
              continue;
            }

            if (!started) {
              ctx.moveTo(x, y);
              started = true;
            } else {
              ctx.lineTo(x, y);
            }

            if (x >= 0 && x <= width) {
              if (v < minV) minV = v;
              if (v > maxV) maxV = v;
              sumSquares += v * v;
              sampleCount++;
            }
          }
          ctx.stroke();
          ctx.restore();

          if (sampleCount > 0 && Math.abs(maxV - minV) > 1e-4) {
            setStatsCh2({
              vpp: maxV - minV,
              vrms: Math.sqrt(sumSquares / sampleCount),
              freq: 50
            });
          }
        }
      }

      // Draw Center Trigger T-Marker at origin (width / 2) with timeOffset shift
      const trigMarkerX = width / 2 + (timeOffset / (timeDiv * 10)) * width;
      if (trigMarkerX >= 0 && trigMarkerX <= width) {
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.moveTo(trigMarkerX - 4, 2);
        ctx.lineTo(trigMarkerX + 4, 2);
        ctx.lineTo(trigMarkerX, 8);
        ctx.closePath();
        ctx.fill();
      }

      // Draw Trigger Level Indicator on right axis
      if (triggerSource !== 'none') {
        const trigVoltDiv = triggerSource === 'ch1' ? ch1VoltDiv : ch2VoltDiv;
        const trigOffset = triggerSource === 'ch1' ? ch1Offset : ch2Offset;
        const trigY = height / 2 - ((triggerLevel / trigVoltDiv) + trigOffset) * divY;
        ctx.fillStyle = triggerSource === 'ch1' ? '#ef4444' : '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(width - 7, trigY - 4);
        ctx.lineTo(width - 1, trigY);
        ctx.lineTo(width - 7, trigY + 4);
        ctx.closePath();
        ctx.fill();
      }

      // --- Bottom Status Bar (OSD: Time/div, CH1 V/div, CH2 V/div, Position) ---
      // Placed at the bottom of the screen with dark backdrop, completely separated from top probe badges!
      ctx.fillStyle = 'rgba(10, 14, 20, 0.85)';
      ctx.fillRect(0, height - 20, width, 20);
      ctx.strokeStyle = '#1e2736';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height - 20);
      ctx.lineTo(width, height - 20);
      ctx.stroke();

      ctx.font = '10px monospace';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText(`TIME: ${timeDivLabels[timeDivIndex]}/div`, 8, height - 6);

      if (ch1Enabled) {
        ctx.fillStyle = '#ef4444';
        ctx.fillText(`CH1: ${voltDivLabels[ch1VoltDivIndex]}/div`, 110, height - 6);
      }
      if (ch2Enabled) {
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`CH2: ${voltDivLabels[ch2VoltDivIndex]}/div`, 210, height - 6);
      }

      // Show Position offset indicator if moved
      if (Math.abs(timeOffset) > 1e-6 || Math.abs(ch1Offset) > 0.05 || Math.abs(ch2Offset) > 0.05) {
        ctx.fillStyle = '#fbbf24';
        const hPosText = Math.abs(timeOffset) > 1e-6 ? `H:${(timeOffset * 1000).toFixed(1)}ms ` : '';
        ctx.fillText(`POS [${hPosText}]`, 310, height - 6);
      }

      if (!isPaused) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [timeDivIndex, ch1VoltDivIndex, ch2VoltDivIndex, ch1Enabled, ch2Enabled, ch1Offset, ch2Offset, timeOffset, triggerSource, triggerLevel, triggerSlope, isPaused]);

  // Drag handlers on canvas to PAN / MOVE display
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialTimeOffset(timeOffset);
    setInitialCh1Offset(ch1Offset);
    setInitialCh2Offset(ch2Offset);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    // Horizontal shift: dragging right moves waveform right (increases timeOffset)
    const totalTime = timeDiv * 10;
    const dt = (dx / canvas.width) * totalTime;
    setTimeOffset(initialTimeOffset + dt);

    // Vertical shift: dragging up moves waveform up
    const divY = canvas.height / 8;
    const dDiv = -dy / divY;
    if (ch1Enabled && !ch2Enabled) {
      setCh1Offset(initialCh1Offset + dDiv);
    } else if (ch2Enabled && !ch1Enabled) {
      setCh2Offset(initialCh2Offset + dDiv);
    } else {
      // Both enabled: move both or shift active
      setCh1Offset(initialCh1Offset + dDiv);
      setCh2Offset(initialCh2Offset + dDiv);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetPositions = () => {
    setTimeOffset(0);
    setCh1Offset(0);
    setCh2Offset(0);
  };

  return (
    <div className="bg-[#151921] border border-[#27303f] rounded-lg shadow-xl p-3 flex flex-col gap-2 select-none text-xs">
      {/* Top Bar / Header */}
      <div className="flex items-center justify-between border-b border-[#27303f] pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="font-bold tracking-wider text-gray-200">OSCILLOSCOPE 2-CH</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
            isPaused
              ? 'bg-red-950 text-red-400 border-red-800'
              : isTriggered
              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
              : 'bg-amber-950 text-amber-400 border-amber-800'
          }`}>
            {isPaused ? 'STOPPED' : isTriggered ? "TRIG'D" : 'AUTO (ROLL)'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Reset position button */}
          {(Math.abs(timeOffset) > 1e-6 || Math.abs(ch1Offset) > 0.05 || Math.abs(ch2Offset) > 0.05) && (
            <button
              onClick={resetPositions}
              title="画面位置を中央にリセット"
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#222c3d] hover:bg-[#2e3b52] text-amber-300 border border-amber-500/40 text-[10px] transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>位置リセット</span>
            </button>
          )}

          {/* Quick run/pause */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded font-semibold text-[11px] transition-colors ${
              isPaused ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'
            }`}
          >
            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            {isPaused ? 'RUN' : 'STOP'}
          </button>
        </div>
      </div>

      {/* Probe connection banners row (Cleanly placed OUTSIDE screen canvas to avoid overlap!) */}
      <div className="flex items-center justify-between gap-1.5 bg-[#0e121a] px-2 py-1 rounded border border-[#1e2736] text-[10px]">
        <div className="flex items-center gap-1.5 truncate">
          <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span>
          <span className="text-gray-400">CH1:</span>
          <span className="font-mono text-red-300 font-semibold truncate">
            {probeManager.probes.osc_ch1.attachedTo
              ? `${probeManager.probes.osc_ch1.attachedTo.compId}.${probeManager.probes.osc_ch1.attachedTo.pinId}`
              : '未接続'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 truncate">
          <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0"></span>
          <span className="text-gray-400">CH2:</span>
          <span className="font-mono text-cyan-300 font-semibold truncate">
            {probeManager.probes.osc_ch2.attachedTo
              ? `${probeManager.probes.osc_ch2.attachedTo.compId}.${probeManager.probes.osc_ch2.attachedTo.pinId}`
              : '未接続'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 truncate">
          <span className="w-2 h-2 rounded-full bg-gray-500 flex-shrink-0"></span>
          <span className="text-gray-400">GND:</span>
          <span className="font-mono text-gray-300 truncate">
            {probeManager.probes.osc_gnd.attachedTo ? '接続済' : '内部GND'}
          </span>
        </div>
      </div>

      {/* Screen Canvas (Supports Mouse Drag-to-Pan) */}
      <div className="relative group">
        <canvas
          ref={canvasRef}
          width={460}
          height={220}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`w-full bg-[#080c10] border border-[#1e2736] rounded shadow-inner cursor-grab ${
            isDragging ? 'cursor-grabbing' : ''
          }`}
        />

        {/* Floating Pan Hint Tooltip */}
        <div className="absolute top-2 left-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-black/75 px-1.5 py-0.5 rounded text-[9px] text-gray-400 flex items-center gap-1">
          <Move className="w-3 h-3 text-cyan-400" />
          <span>画面ドラッグで波形位置を自由に移動</span>
        </div>
      </div>

      {/* Measured Values Readout */}
      <div className="grid grid-cols-2 gap-2 bg-[#0d1017] p-2 rounded border border-[#1e2736] text-[11px]">
        <div className="flex flex-col gap-0.5 text-red-400">
          <div className="font-semibold flex items-center justify-between">
            <span>[CH1 RED]</span>
            <span>Vpp: {statsCh1.vpp.toFixed(2)} V</span>
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>Vrms: {statsCh1.vrms.toFixed(2)} V</span>
            <span>Freq: ~{statsCh1.freq} Hz</span>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 text-cyan-400">
          <div className="font-semibold flex items-center justify-between">
            <span>[CH2 BLUE]</span>
            <span>Vpp: {statsCh2.vpp.toFixed(2)} V</span>
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>Vrms: {statsCh2.vrms.toFixed(2)} V</span>
            <span>Freq: ~{statsCh2.freq} Hz</span>
          </div>
        </div>
      </div>

      {/* Controls: Time/Div, Ch1 V/Div, Ch2 V/Div */}
      <div className="grid grid-cols-3 gap-2 bg-[#12161e] p-2 rounded border border-[#1e2736]">
        {/* Timebase */}
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-gray-300">HORIZONTAL</span>
          <div className="flex items-center justify-between bg-[#1a202c] px-2 py-1 rounded">
            <span className="text-gray-400">Time/Div</span>
            <select
              value={timeDivIndex}
              onChange={(e) => setTimeDivIndex(Number(e.target.value))}
              className="bg-[#2d3748] text-white rounded px-1 py-0.5 text-xs outline-none cursor-pointer"
            >
              {timeDivLabels.map((lbl, idx) => (
                <option key={lbl} value={idx}>{lbl}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Channel 1 */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-red-400">CH1 (RED)</span>
            <input
              type="checkbox"
              checked={ch1Enabled}
              onChange={(e) => setCh1Enabled(e.target.checked)}
              className="accent-red-500 cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between bg-[#1a202c] px-2 py-1 rounded">
            <span className="text-gray-400">V/Div</span>
            <select
              value={ch1VoltDivIndex}
              onChange={(e) => setCh1VoltDivIndex(Number(e.target.value))}
              className="bg-[#2d3748] text-white rounded px-1 py-0.5 text-xs outline-none cursor-pointer"
            >
              {voltDivLabels.map((lbl, idx) => (
                <option key={lbl} value={idx}>{lbl}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Channel 2 */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-cyan-400">CH2 (BLUE)</span>
            <input
              type="checkbox"
              checked={ch2Enabled}
              onChange={(e) => setCh2Enabled(e.target.checked)}
              className="accent-cyan-500 cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between bg-[#1a202c] px-2 py-1 rounded">
            <span className="text-gray-400">V/Div</span>
            <select
              value={ch2VoltDivIndex}
              onChange={(e) => setCh2VoltDivIndex(Number(e.target.value))}
              className="bg-[#2d3748] text-white rounded px-1 py-0.5 text-xs outline-none cursor-pointer"
            >
              {voltDivLabels.map((lbl, idx) => (
                <option key={lbl} value={idx}>{lbl}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Position Offset Controls (Waveform Movement Control) */}
      <div className="bg-[#12161e] p-2 rounded border border-[#1e2736] flex flex-col gap-1.5 text-[11px]">
        <div className="flex items-center justify-between text-gray-300 font-semibold">
          <div className="flex items-center gap-1">
            <Move className="w-3.5 h-3.5 text-amber-400" />
            <span>POSITION (画面位置の移動調整)</span>
          </div>
          <button
            onClick={resetPositions}
            className="text-[10px] text-gray-400 hover:text-amber-300 underline cursor-pointer"
          >
            初期位置に戻す
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* H-POS */}
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>H-POS (時間)</span>
              <span className="font-mono text-white">{(timeOffset * 1000).toFixed(1)}ms</span>
            </div>
            <input
              type="range"
              min={-(timeDiv * 10)}
              max={timeDiv * 10}
              step={(timeDiv * 10) / 100}
              value={timeOffset}
              onChange={(e) => setTimeOffset(Number(e.target.value))}
              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>

          {/* CH1-POS */}
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-[10px] text-red-400">
              <span>CH1-POS (垂直)</span>
              <span className="font-mono text-white">{ch1Offset.toFixed(1)} div</span>
            </div>
            <input
              type="range"
              min={-4}
              max={4}
              step={0.1}
              value={ch1Offset}
              onChange={(e) => setCh1Offset(Number(e.target.value))}
              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
          </div>

          {/* CH2-POS */}
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-[10px] text-cyan-400">
              <span>CH2-POS (垂直)</span>
              <span className="font-mono text-white">{ch2Offset.toFixed(1)} div</span>
            </div>
            <input
              type="range"
              min={-4}
              max={4}
              step={0.1}
              value={ch2Offset}
              onChange={(e) => setCh2Offset(Number(e.target.value))}
              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        </div>
      </div>

      {/* Trigger Controls Row */}
      <div className="bg-[#12161e] p-2 rounded border border-[#1e2736] flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-amber-400">TRIGGER:</span>
          <select
            value={triggerSource}
            onChange={(e) => setTriggerSource(e.target.value as any)}
            className="bg-[#1a202c] text-white px-2 py-0.5 rounded border border-gray-700 outline-none cursor-pointer"
          >
            <option value="ch1">Source: CH1</option>
            <option value="ch2">Source: CH2</option>
            <option value="none">Source: OFF (Roll)</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">極性:</span>
          <select
            value={triggerSlope}
            onChange={(e) => setTriggerSlope(e.target.value as any)}
            className="bg-[#1a202c] text-white px-1.5 py-0.5 rounded border border-gray-700 outline-none cursor-pointer"
          >
            <option value="rising">↗ 立上り (Rising)</option>
            <option value="falling">↘ 立下り (Falling)</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">レベル:</span>
          <input
            type="number"
            step="0.5"
            value={triggerLevel}
            onChange={(e) => setTriggerLevel(Number(e.target.value))}
            className="w-16 bg-[#1a202c] text-white px-1.5 py-0.5 rounded border border-gray-700 outline-none font-mono text-right"
          />
          <span className="text-gray-400">V</span>
        </div>
      </div>
    </div>
  );
};
