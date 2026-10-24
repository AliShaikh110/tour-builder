/** A slowly turning wireframe sphere with one hotspot, for the empty state. */
export function GlobeArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 160" fill="none" aria-hidden="true" className={className}>
      <g stroke="currentColor" strokeWidth="1.25">
        <circle cx="80" cy="80" r="64" strokeOpacity="0.3" />
        <ellipse cx="80" cy="80" rx="64" ry="16" strokeOpacity="0.22" />
        <ellipse cx="80" cy="50" rx="55" ry="11" strokeOpacity="0.14" />
        <ellipse cx="80" cy="110" rx="55" ry="11" strokeOpacity="0.14" />
        {[0, 1, 2, 3].map((i) => (
          <ellipse
            key={i}
            cx="80"
            cy="80"
            rx="64"
            ry="64"
            strokeOpacity="0.28"
            className="globe-meridian"
            style={{ animationDelay: `${-i * 4}s` }}
          />
        ))}
      </g>
      <circle cx="104" cy="92" r="9" fill="var(--primary)" fillOpacity="0.18" className="globe-pulse" />
      <circle cx="104" cy="92" r="4" fill="var(--primary)" />
    </svg>
  );
}
