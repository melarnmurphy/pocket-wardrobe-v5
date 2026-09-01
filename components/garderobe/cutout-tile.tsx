import Image from "next/image";

type CutoutTileProps = {
  src: string | null;
  alt: string;
  centre?: boolean; // shoes and bags centre instead of sitting flush to the bottom
  className?: string;
};

/** The cut-out tile primitive: aspect-ratio .78, garment flush to the bottom of the tile. */
export function CutoutTile({ src, alt, centre = false, className = "" }: CutoutTileProps) {
  return (
    <div
      className={[
        "relative aspect-[.78] overflow-hidden rounded-[3px] bg-[var(--paper)]",
        className
      ].join(" ")}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          className={centre ? "object-contain" : "object-contain object-bottom"}
          sizes="200px"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, #dcc6a8 0 6px, #d0b795 6px 12px)"
          }}
        />
      )}
    </div>
  );
}
