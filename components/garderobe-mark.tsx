/** The bombé mark, matching Pocket Wardrobe Logos.dc.html / the sidebar's own drawing. */
export function GarderobeMark({ size = 20 }: { size?: number }) {
  const height = size * 1.2;
  return (
    <div style={{ width: size, height, position: "relative", flex: "none" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: size,
          height: size * 0.17,
          background: "var(--oxblood)",
          borderRadius: 100
        }}
      />
      <div
        style={{
          position: "absolute",
          top: size * 0.22,
          left: size * 0.07,
          width: size * 0.85,
          height: size * 0.8,
          border: "1.5px solid var(--oxblood)",
          borderRadius: "8px 8px 5px 5px",
          boxSizing: "border-box"
        }}
      />
      <div
        style={{
          position: "absolute",
          top: size * 0.3,
          left: size * 0.48,
          width: 1.2,
          height: size * 0.65,
          background: "var(--oxblood)"
        }}
      />
    </div>
  );
}
