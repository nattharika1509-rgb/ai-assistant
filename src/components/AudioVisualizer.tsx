

interface AudioVisualizerProps {
  isActive: boolean;
  color?: string;
  count?: number;
}

export function AudioVisualizer({ isActive, color = "var(--color-primary)", count = 12 }: AudioVisualizerProps) {
  return (
    <div style={{ display: "flex", gap: "4px", alignItems: "flex-end", height: "32px" }}>
      {Array.from({ length: count }).map((_, i) => {
        // คำนวณความเร็วของแอนิเมชันให้ต่างกันในแต่ละแท่ง เพื่อความสมจริง
        const duration = 0.5 + Math.random() * 0.8;
        const delay = Math.random() * 0.5;

        return (
          <div
            key={i}
            className="audio-bar"
            style={{
              backgroundColor: color,
              height: "100%",
              width: "3px",
              animationPlayState: isActive ? "running" : "paused",
              animationDuration: isActive ? `${duration}s` : "0s",
              animationDelay: `${delay}s`,
              transform: isActive ? undefined : "scaleY(0.15)",
              opacity: isActive ? 1 : 0.4,
              transition: "transform 0.3s ease, opacity 0.3s ease",
            }}
          />
        );
      })}
    </div>
  );
}
