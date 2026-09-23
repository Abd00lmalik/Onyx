export function WaveBackground() {
  return (
    <div className="w-full overflow-hidden leading-none -mb-1">
      <svg
        viewBox="0 0 1440 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="w-full h-[60px] sm:h-[80px] lg:h-[100px]"
      >
        {/* Layer 1 — deepest, subtle amber */}
        <path
          d="M0,50 C240,30 480,70 720,50 C960,30 1200,70 1440,50 L1440,100 L0,100Z"
          fill="#FDE68A"
          fillOpacity="0.2"
        >
          <animate
            attributeName="d"
            dur="12s"
            repeatCount="indefinite"
            values="
              M0,50 C240,30 480,70 720,50 C960,30 1200,70 1440,50 L1440,100 L0,100Z;
              M0,55 C240,70 480,35 720,55 C960,70 1200,35 1440,55 L1440,100 L0,100Z;
              M0,50 C240,30 480,70 720,50 C960,30 1200,70 1440,50 L1440,100 L0,100Z"
          />
        </path>

        {/* Layer 2 — mid, cream blend */}
        <path
          d="M0,60 C360,40 720,80 1080,55 C1260,40 1440,60 1440,55 L1440,100 L0,100Z"
          fill="#FEF3C7"
          fillOpacity="0.35"
        >
          <animate
            attributeName="d"
            dur="14s"
            repeatCount="indefinite"
            values="
              M0,60 C360,40 720,80 1080,55 C1260,40 1440,60 1440,55 L1440,100 L0,100Z;
              M0,55 C360,75 720,40 1080,60 C1260,75 1440,55 1440,60 L1440,100 L0,100Z;
              M0,60 C360,40 720,80 1080,55 C1260,40 1440,60 1440,55 L1440,100 L0,100Z"
          />
        </path>

        {/* Layer 3 — front, fades to background */}
        <path
          d="M0,72 C480,55 960,85 1440,68 L1440,100 L0,100Z"
          fill="#FEF3C7"
          fillOpacity="0.25"
        >
          <animate
            attributeName="d"
            dur="16s"
            repeatCount="indefinite"
            values="
              M0,72 C480,55 960,85 1440,68 L1440,100 L0,100Z;
              M0,68 C480,82 960,55 1440,72 L1440,100 L0,100Z;
              M0,72 C480,55 960,85 1440,68 L1440,100 L0,100Z"
          />
        </path>

        {/* Solid cream bottom to blend into next section */}
        <rect x="0" y="88" width="1440" height="12" fill="#FFFBEB" />
      </svg>
    </div>
  )
}
