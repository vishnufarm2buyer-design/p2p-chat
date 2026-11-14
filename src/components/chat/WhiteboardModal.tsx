import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, Undo2, Trash2, Download, Palette } from 'lucide-react';
import { peerManager } from '@/services/webrtc/peerManager';

interface WhiteboardModalProps {
  peerUserId: string;
  peerUserName: string;
  onClose: () => void;
}

interface DrawStroke {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  size: number;
}

const COLORS = ['#06b6d4', '#ec4899', '#eab308', '#22c55e', '#a855f7', '#ffffff', '#000000'];
const SIZES = [2, 5, 10, 20];

export const WhiteboardModal: React.FC<WhiteboardModalProps> = ({
  peerUserId,
  peerUserName,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedSize, setSelectedSize] = useState(SIZES[1]);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Redraw / clear helper
  const drawLine = useCallback((stroke: DrawStroke) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(stroke.fromX, stroke.fromY);
    ctx.lineTo(stroke.toX, stroke.toY);
    ctx.stroke();
  }, []);

  const clearCanvas = useCallback((broadcast = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (broadcast) {
      peerManager.sendWhiteboardData(peerUserId, { action: 'clear' });
    }
  }, [peerUserId]);

  // Listen to peer whiteboard packets
  useEffect(() => {
    const unbind = peerManager.onWhiteboardData((senderId, payload) => {
      if (senderId !== peerUserId) return;
      if (payload.action === 'draw' && payload.stroke) {
        drawLine(payload.stroke);
      } else if (payload.action === 'clear') {
        clearCanvas(false);
      }
    });

    return () => {
      unbind();
    };
  }, [peerUserId, drawLine, clearCanvas]);

  // Handle Canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
  }, []);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getCoordinates(e);
    if (!coords) return;
    setIsDrawing(true);
    lastPosRef.current = coords;
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPosRef.current) return;
    const coords = getCoordinates(e);
    if (!coords) return;

    const stroke: DrawStroke = {
      fromX: lastPosRef.current.x,
      fromY: lastPosRef.current.y,
      toX: coords.x,
      toY: coords.y,
      color: selectedColor,
      size: selectedSize
    };

    drawLine(stroke);
    peerManager.sendWhiteboardData(peerUserId, { action: 'draw', stroke });

    lastPosRef.current = coords;
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    lastPosRef.current = null;
  };

  const handleExportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `whiteboard-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/90 backdrop-blur-2xl p-2 sm:p-6 animate-fade-in select-none">
      <div className="w-full max-w-4xl h-[90vh] bg-obsidian-900 border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/[0.08] bg-obsidian-950/60">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-semibold text-white">Direct P2P Whiteboard</h3>
              <p className="text-[11px] text-slate-400">Collaborating with {peerUserName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportImage}
              className="p-2 rounded-xl bg-obsidian-850 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Save Image"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => clearCanvas(true)}
              className="p-2 rounded-xl bg-obsidian-850 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-all cursor-pointer"
              title="Clear Canvas"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition-all cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative bg-obsidian-950/95 overflow-hidden touch-none cursor-crosshair">
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          />
        </div>

        {/* Toolbar */}
        <div className="px-4 py-3 bg-obsidian-950/80 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
          {/* Colors */}
          <div className="flex items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedColor(c)}
                style={{ backgroundColor: c }}
                className={`w-6 h-6 rounded-full border-2 transition-transform active:scale-125 cursor-pointer ${
                  selectedColor === c ? 'border-white scale-110 shadow-md shadow-white/30' : 'border-transparent'
                }`}
              />
            ))}
          </div>

          {/* Stroke sizes */}
          <div className="flex items-center gap-2">
            {SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSize(s)}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono font-medium border transition-all cursor-pointer ${
                  selectedSize === s
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-obsidian-850 border-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {s}px
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
