import { CircuitElement, Wire, getPinAbsolutePos, formatValueWithUnit } from '../components-model/element-base';
import { ProbeManager, Probe } from '../instruments/probe-system';

/**
 * Maps voltage to a color:
 * > 0V : Green -> Yellow -> Red
 * = 0V : Green (#10b981)
 * < 0V : Green -> Cyan -> Blue
 */
export function getVoltageColor(v: number): string {
  if (isNaN(v)) return '#4b5563';
  if (Math.abs(v) < 0.05) return '#10b981'; // Green for GND
  if (v > 0) {
    const intensity = Math.min(1.0, v / 12.0);
    // Green (16, 185, 129) to Red (239, 68, 68)
    const r = Math.round(16 + intensity * (239 - 16));
    const g = Math.round(185 - intensity * (185 - 68));
    const b = Math.round(129 - intensity * (129 - 68));
    return `rgb(${r},${g},${b})`;
  } else {
    const intensity = Math.min(1.0, -v / 12.0);
    // Green to Cyan/Blue (59, 130, 246)
    const r = Math.round(16 + intensity * (59 - 16));
    const g = Math.round(185 - intensity * (185 - 130));
    const b = Math.round(129 + intensity * (246 - 129));
    return `rgb(${r},${g},${b})`;
  }
}

/**
 * Draw component symbol onto 2D canvas
 */
export function drawElementSymbol(
  ctx: CanvasRenderingContext2D,
  elem: CircuitElement,
  isSelected: boolean,
  currentSimTime: number
): void {
  ctx.save();
  ctx.translate(elem.x, elem.y);
  ctx.rotate((elem.rotation * Math.PI) / 180);

  // Selection bounding box
  if (isSelected) {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(-40, -30, 80, 60);
    ctx.setLineDash([]);
  }

  const baseStroke = elem.color || '#94a3b8';
  ctx.strokeStyle = baseStroke;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (elem.type) {
    case 'resistor': {
      // Zigzag resistor
      ctx.beginPath();
      ctx.moveTo(-30, 0);
      ctx.lineTo(-18, 0);
      const zig = [-14, -10, -6, -2, 2, 6, 10, 14, 18];
      zig.forEach((x, i) => {
        const y = i % 2 === 0 ? -8 : 8;
        ctx.lineTo(x, y);
      });
      ctx.lineTo(18, 0);
      ctx.lineTo(30, 0);
      ctx.stroke();

      // Label
      drawLabel(ctx, formatValueWithUnit(elem.params.resistance ?? 1000, 'Ω'), 0, 16);
      break;
    }

    case 'capacitor': {
      // Two parallel plates
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(-6, 0);
      ctx.moveTo(-6, -14);
      ctx.lineTo(-6, 14);

      ctx.moveTo(6, -14);
      ctx.lineTo(6, 14);
      ctx.moveTo(6, 0);
      ctx.lineTo(20, 0);
      ctx.stroke();

      drawLabel(ctx, formatValueWithUnit(elem.params.capacitance ?? 10e-6, 'F'), 0, 18);
      break;
    }

    case 'inductor': {
      // Coiled loops
      ctx.beginPath();
      ctx.moveTo(-25, 0);
      ctx.lineTo(-18, 0);
      for (let i = 0; i < 3; i++) {
        ctx.arc(-12 + i * 12, 0, 6, Math.PI, 0, false);
      }
      ctx.lineTo(25, 0);
      ctx.stroke();

      drawLabel(ctx, formatValueWithUnit(elem.params.inductance ?? 0.1, 'H'), 0, 16);
      break;
    }

    case 'diode':
    case 'led':
    case 'zener': {
      // Triangle and cathode bar
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(-8, 0);

      // Triangle
      ctx.moveTo(-8, -10);
      ctx.lineTo(8, 0);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fillStyle = elem.state.isConducting ? (elem.color || '#ef4444') : '#334155';
      ctx.fill();
      ctx.stroke();

      // Cathode line
      ctx.beginPath();
      if (elem.type === 'zener') {
        // Zener bent cathode
        ctx.moveTo(8, -10);
        ctx.lineTo(5, -10);
        ctx.lineTo(8, -10);
        ctx.lineTo(8, 10);
        ctx.lineTo(11, 10);
      } else {
        ctx.moveTo(8, -10);
        ctx.lineTo(8, 10);
      }
      ctx.moveTo(8, 0);
      ctx.lineTo(20, 0);
      ctx.stroke();

      // LED arrows and glow
      if (elem.type === 'led') {
        ctx.save();
        ctx.strokeStyle = elem.color || '#ef4444';
        ctx.lineWidth = 1.5;
        // Two light emission arrows
        ctx.beginPath();
        ctx.moveTo(4, -12);
        ctx.lineTo(12, -20);
        ctx.lineTo(8, -20);
        ctx.moveTo(10, -10);
        ctx.lineTo(18, -18);
        ctx.lineTo(14, -18);
        ctx.stroke();

        // Glow if active
        if ((elem.state.lightIntensity ?? 0) > 0.1) {
          ctx.beginPath();
          ctx.arc(0, 0, 18, 0, 2 * Math.PI);
          ctx.fillStyle = elem.color || '#ef4444';
          ctx.globalAlpha = 0.35 * (elem.state.lightIntensity ?? 1);
          ctx.fill();
        }
        ctx.restore();
      }

      drawLabel(ctx, elem.name || elem.type, 0, 16);
      break;
    }

    case 'npn': {
      // BJT NPN: Base lead, vertical bar, Collector lead, Emitter lead with arrow
      ctx.beginPath();
      // Base
      ctx.moveTo(-20, 0);
      ctx.lineTo(-5, 0);
      // Vertical bar
      ctx.moveTo(-5, -15);
      ctx.lineTo(-5, 15);
      // Collector
      ctx.moveTo(-5, -7);
      ctx.lineTo(15, -20);
      // Emitter
      ctx.moveTo(-5, 7);
      ctx.lineTo(15, 20);
      ctx.stroke();

      // Arrow on Emitter pointing outward
      ctx.beginPath();
      ctx.fillStyle = baseStroke;
      ctx.moveTo(15, 20);
      ctx.lineTo(6, 17);
      ctx.lineTo(10, 11);
      ctx.closePath();
      ctx.fill();

      // Circle around transistor
      ctx.beginPath();
      ctx.arc(3, 0, 19, 0, 2 * Math.PI);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.stroke();

      drawLabel(ctx, `NPN (β=${elem.params.beta ?? 200})`, 0, 26);
      break;
    }

    case 'pnp': {
      // BJT PNP: Arrow on Emitter pointing inward
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(-5, 0);
      ctx.moveTo(-5, -15);
      ctx.lineTo(-5, 15);
      ctx.moveTo(-5, -7);
      ctx.lineTo(15, -20);
      ctx.moveTo(-5, 7);
      ctx.lineTo(15, 20);
      ctx.stroke();

      // Arrow pointing towards base on Emitter
      ctx.beginPath();
      ctx.fillStyle = baseStroke;
      ctx.moveTo(0, 10);
      ctx.lineTo(9, 14);
      ctx.lineTo(4, 19);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.arc(3, 0, 19, 0, 2 * Math.PI);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.stroke();

      drawLabel(ctx, `PNP (β=${elem.params.beta ?? 200})`, 0, 26);
      break;
    }

    case 'dc_voltage': {
      // Circle with + and -
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, 2 * Math.PI);
      ctx.stroke();
      // Leads
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(0, -16);
      ctx.moveTo(0, 16);
      ctx.lineTo(0, 20);
      ctx.stroke();

      // Signs
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', 0, -8);
      ctx.fillStyle = '#3b82f6';
      ctx.fillText('-', 0, 8);

      drawLabel(ctx, `${elem.params.voltage ?? 5} V`, 26, 0);
      break;
    }

    case 'ac_voltage': {
      // Circle with ~ wave
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(0, -16);
      ctx.moveTo(0, 16);
      ctx.lineTo(0, 20);
      ctx.stroke();

      // Sine wave symbol
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.bezierCurveTo(-4, -8, -4, -8, 0, 0);
      ctx.bezierCurveTo(4, 8, 4, 8, 8, 0);
      ctx.stroke();

      drawLabel(ctx, `${elem.params.amplitude ?? 5}Vpk ${elem.params.frequency ?? 50}Hz`, 26, 0);
      break;
    }

    case 'ground': {
      // Triangular ground lines
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(0, 0);
      ctx.moveTo(-14, 0);
      ctx.lineTo(14, 0);
      ctx.moveTo(-9, 5);
      ctx.lineTo(9, 5);
      ctx.moveTo(-4, 10);
      ctx.lineTo(4, 10);
      ctx.stroke();
      break;
    }

    case 'switch': {
      const isClosed = !elem.state.isOpen;
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(-8, 0);
      ctx.moveTo(8, 0);
      ctx.lineTo(20, 0);
      ctx.stroke();

      // Terminals circles
      ctx.beginPath();
      ctx.arc(-8, 0, 3, 0, 2 * Math.PI);
      ctx.arc(8, 0, 3, 0, 2 * Math.PI);
      ctx.stroke();

      // Switch blade
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      if (isClosed) {
        ctx.lineTo(8, 0);
      } else {
        ctx.lineTo(6, -12);
      }
      ctx.stroke();

      drawLabel(ctx, isClosed ? 'ON (閉)' : 'OFF (開)', 0, 16);
      break;
    }

    case 'ammeter': {
      // Circle with 'A'
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, 2 * Math.PI);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(-16, 0);
      ctx.moveTo(16, 0);
      ctx.lineTo(20, 0);
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('A', 0, 0);

      const val = elem.state.current;
      drawLabel(ctx, formatValueWithUnit(val, 'A'), 0, 22);
      break;
    }

    case 'subcircuit': {
      // Custom subcircuit / Op-amp
      ctx.beginPath();
      ctx.moveTo(-30, -25);
      ctx.lineTo(30, 0);
      ctx.lineTo(-30, 25);
      ctx.closePath();
      ctx.fillStyle = '#1e1b4b';
      ctx.fill();
      ctx.stroke();

      // Signs
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('+', -20, -10);
      ctx.fillText('-', -20, 15);
      ctx.fillText('OUT', 12, 0);

      drawLabel(ctx, elem.name, 0, 30);
      break;
    }

    default: {
      // Generic IC box
      ctx.strokeRect(-25, -20, 50, 40);
      drawLabel(ctx, elem.name, 0, 0);
    }
  }

  // Draw Pin Terminals
  elem.pins.forEach(pin => {
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.save();
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Draw connecting wires with current animation (charge dots moving along wires)
 */
export function drawWire(
  ctx: CanvasRenderingContext2D,
  wire: Wire,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  simTime: number
): void {
  const vColor = getVoltageColor(wire.voltage ?? 0);

  // Glow line
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = vColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Current animation: moving dots
  const current = wire.current ?? 0;
  if (Math.abs(current) > 1e-6) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 5) {
      const dotSpacing = 16;
      const numDots = Math.floor(dist / dotSpacing);

      // Speed proportional to current
      const speed = Math.sign(current) * Math.min(100, Math.max(10, Math.abs(current) * 500));
      const offset = (simTime * speed) % dotSpacing;

      ctx.fillStyle = '#fef08a'; // Yellow charge
      for (let i = 0; i < numDots; i++) {
        let frac = (i * dotSpacing + offset) / dist;
        frac = ((frac % 1) + 1) % 1; // keep in [0, 1]
        const x = p1.x + dx * frac;
        const y = p1.y + dy * frac;

        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }
}

/**
 * Draw realistic instrument probe cable (hanging bezier curve) and probe tip
 */
export function drawProbeWithLead(
  ctx: CanvasRenderingContext2D,
  probe: Probe,
  isHovered: boolean,
  isSelected: boolean = false
): void {
  const startX = probe.originX;
  const startY = probe.originY;
  const endX = probe.x;
  const endY = probe.y;

  // Calculate natural cable sagging curve
  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.hypot(dx, dy);
  const sag = Math.max(40, dist * 0.25);

  const cp1X = startX + dx * 0.25;
  const cp1Y = startY + dy * 0.25 + sag;
  const cp2X = startX + dx * 0.75;
  const cp2Y = startY + dy * 0.75 + sag;

  // Draw thick rubberized cable
  ctx.save();

  // Cable shadow
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.bezierCurveTo(cp1X, cp1Y + 4, cp2X, cp2Y + 4, endX, endY + 4);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.lineWidth = isSelected ? 7 : 5;
  ctx.stroke();

  // Cable core
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
  ctx.strokeStyle = probe.leadColor;
  ctx.lineWidth = isSelected ? 5.5 : 4;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Cable highlight line
  ctx.strokeStyle = isSelected ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = isSelected ? 2 : 1;
  ctx.stroke();

  // Draw Jack Socket at instrument panel
  ctx.beginPath();
  ctx.arc(startX, startY, isSelected ? 9 : 7, 0, 2 * Math.PI);
  ctx.fillStyle = '#1e2430';
  ctx.fill();
  ctx.strokeStyle = probe.color;
  ctx.lineWidth = isSelected ? 3.5 : 2.5;
  ctx.stroke();

  // Draw Probe Body / Tip
  ctx.translate(endX, endY);

  if (probe.type === 'dmm_clamp') {
    // Current Clamp Head
    ctx.fillStyle = probe.color;
    ctx.beginPath();
    ctx.arc(0, 0, isSelected ? 14 : 12, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Clamp Jaws
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI, false);
    ctx.strokeStyle = '#1e2430';
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (probe.type === 'osc_gnd' || probe.type === 'dmm_neg') {
    // Alligator Clip / Black Probe
    ctx.fillStyle = probe.color;
    ctx.beginPath();
    ctx.rect(-6, -14, 12, 16);
    ctx.fill();
    ctx.stroke();

    // Clip jaw tip
    ctx.beginPath();
    ctx.moveTo(-4, 2);
    ctx.lineTo(0, 8);
    ctx.lineTo(4, 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fill();
  } else {
    // Oscilloscope Probe Pen / DMM Red Pin
    ctx.fillStyle = probe.color;
    ctx.beginPath();
    ctx.moveTo(-5, -24);
    ctx.lineTo(5, -24);
    ctx.lineTo(4, -4);
    ctx.lineTo(1, 0);
    ctx.lineTo(0, 6); // Sharp metal tip
    ctx.lineTo(-1, 0);
    ctx.lineTo(-4, -4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Metal needle tip
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 8);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Label tag on probe
  ctx.font = 'bold 9px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(probe.name.split(' ')[0], 0, -28);

  // Strong target halo if selected
  if (isSelected) {
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, 2 * Math.PI);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (probe.attachedTo || isHovered) {
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, 2 * Math.PI);
    ctx.strokeStyle = probe.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}
