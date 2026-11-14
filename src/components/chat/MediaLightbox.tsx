import React, { useState } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface MediaLightboxProps {
  src: string;
  type: 'image' | 'video';
  fileName?: string;
  onClose: () => void;
}

export const MediaLightbox: React.FC<MediaLightboxProps> = ({
  src,
  type,
  fileName = 'file',
  onClose
}) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/95 backdrop-blur-2xl p-4 animate-fade-in select-none">
      {/* Top action toolbar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <div className="text-xs text-slate-300 font-mono truncate max-w-xs sm:max-w-md bg-obsidian-900/80 px-3 py-1.5 rounded-xl border border-white/10">
          {fileName}
        </div>

        <div className="flex items-center gap-2">
          {type === 'image' && (
            <>
              <button
                onClick={handleZoomOut}
                className="p-2 rounded-xl bg-obsidian-900/80 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomIn}
                className="p-2 rounded-xl bg-obsidian-900/80 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleRotate}
                className="p-2 rounded-xl bg-obsidian-900/80 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Rotate"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            onClick={handleDownload}
            className="p-2 rounded-xl bg-obsidian-900/80 border border-white/10 text-slate-300 hover:text-cyan-400 transition-all cursor-pointer"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main media container */}
      <div className="max-w-5xl max-h-[85vh] flex items-center justify-center overflow-hidden">
        {type === 'image' ? (
          <img
            src={src}
            alt={fileName}
            className="max-w-full max-h-[80vh] object-contain transition-transform duration-150 rounded-xl shadow-2xl"
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`
            }}
          />
        ) : (
          <video
            src={src}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-[80vh] rounded-xl shadow-2xl"
          />
        )}
      </div>
    </div>
  );
};
