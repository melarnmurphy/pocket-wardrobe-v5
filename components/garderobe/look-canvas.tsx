"use client";

import { useRef, useState } from "react";
import { PillButton } from "./pill-button";

type CanvasPiece = {
  garmentId: string;
  category: string;
  previewUrl: string | null;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
};

type LookCanvasProps = {
  pieces: CanvasPiece[];
  onSave: (
    placements: { garment_id: string; x: number; y: number; z: number; scale: number; rotation: number }[]
  ) => Promise<void>;
};

/** 6d / w1b — cut-outs arranged with a mouse. Position is 0–1 of the canvas box. */
export function LookCanvas({ pieces: initialPieces, onSave }: LookCanvasProps) {
  const [pieces, setPieces] = useState(initialPieces);
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  function moveTo(garmentId: string, clientX: number, clientY: number) {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;

    const x = clamp((clientX - box.left) / box.width, 0, 1);
    const y = clamp((clientY - box.top) / box.height, 0, 1);

    setPieces((current) =>
      current.map((piece) => (piece.garmentId === garmentId ? { ...piece, x, y } : piece))
    );
  }

  async function handleSave() {
    setSaving(true);
    await onSave(
      pieces.map((piece) => ({
        garment_id: piece.garmentId,
        x: piece.x,
        y: piece.y,
        z: piece.z,
        scale: piece.scale,
        rotation: piece.rotation
      }))
    );
    setSaving(false);
  }

  return (
    <div>
      <div
        ref={boxRef}
        className="relative aspect-[.9] w-full overflow-hidden rounded-[4px] bg-[var(--paper)]"
        onPointerMove={(event) => {
          if (dragId) moveTo(dragId, event.clientX, event.clientY);
        }}
        onPointerUp={() => setDragId(null)}
        onPointerLeave={() => setDragId(null)}
      >
        {pieces.map((piece) => (
          <button
            key={piece.garmentId}
            type="button"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragId(piece.garmentId);
            }}
            style={{
              position: "absolute",
              left: `${piece.x * 100}%`,
              top: `${piece.y * 100}%`,
              transform: `translate(-50%, -50%) rotate(${piece.rotation}deg) scale(${piece.scale})`,
              zIndex: piece.z,
              touchAction: "none",
              cursor: dragId === piece.garmentId ? "grabbing" : "grab"
            }}
            className="h-16 w-14 overflow-hidden rounded-[3px] border border-[rgba(30,26,23,.11)] bg-[var(--cream)]"
          >
            {piece.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={piece.previewUrl} alt={piece.category} className="h-full w-full object-contain" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[9px] text-[var(--stone)]">
                {piece.category}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="pt-3">
        <PillButton fullWidth={false} onClick={handleSave} disabled={saving}>
          {saving ? "saving…" : "save arrangement"}
        </PillButton>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
