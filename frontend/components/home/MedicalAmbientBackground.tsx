"use client";

import React from "react";

export function MedicalAmbientBackground() {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden select-none z-0">
      {/* 1. Base Gradient Layer */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#e6fcf5]/70 via-[#f0fdfa]/50 to-[#f8fafc]" />

      {/* 2. Vivid Ambient Glowing Orbs with Organic Floating Motion */}
      <div
        className="absolute -top-20 -right-20 w-[700px] h-[700px] bg-gradient-to-br from-teal-400/25 to-emerald-400/20 rounded-full blur-[80px] animate-orb-float-1"
      />
      <div
        className="absolute top-1/4 -left-28 w-[600px] h-[600px] bg-gradient-to-tr from-emerald-400/20 via-teal-300/18 to-cyan-300/15 rounded-full blur-[90px] animate-orb-float-2"
      />
      <div
        className="absolute -bottom-16 right-1/3 w-[650px] h-[650px] bg-gradient-to-tl from-[#0f766e]/18 to-teal-400/15 rounded-full blur-[85px] animate-orb-float-3"
      />

      {/* 3. Crisp High-Tech Clinical Grid Pattern */}
      <svg
        className="absolute inset-0 w-full h-full opacity-65 mix-blend-multiply"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern
            id="clinical-grid-pattern"
            width="44"
            height="44"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 44 0 L 0 0 0 44"
              fill="none"
              stroke="#0f766e"
              strokeWidth="0.7"
              strokeOpacity="0.22"
            />
            <circle cx="0" cy="0" r="1.2" fill="#0f766e" fillOpacity="0.38" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#clinical-grid-pattern)" />
      </svg>

      {/* 4. Floating Medical Constellation & Animated Circuit Pulses */}
      <svg
        className="absolute inset-0 w-full h-full opacity-75"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Animated circuit lines between nodes */}
        <g stroke="#0f766e" strokeWidth="1.2" opacity="0.45" className="animate-circuit-line">
          <line x1="12%" y1="18%" x2="28%" y2="34%" />
          <line x1="28%" y1="34%" x2="48%" y2="16%" />
          <line x1="68%" y1="22%" x2="86%" y2="40%" />
          <line x1="86%" y1="40%" x2="76%" y2="72%" />
          <line x1="18%" y1="68%" x2="38%" y2="82%" />
        </g>

        {/* Pulse Circles */}
        <g fill="#0f766e">
          <circle cx="12%" cy="18%" r="4" className="animate-ping" style={{ animationDuration: "3.5s" }} opacity="0.4" />
          <circle cx="12%" cy="18%" r="2.5" opacity="0.9" fill="#0f766e" />

          <circle cx="28%" cy="34%" r="5" className="animate-ping" style={{ animationDuration: "4.5s" }} opacity="0.3" />
          <circle cx="28%" cy="34%" r="3" opacity="0.95" fill="#0f766e" />

          <circle cx="48%" cy="16%" r="2.5" opacity="0.75" />

          <circle cx="68%" cy="22%" r="4.5" className="animate-ping" style={{ animationDuration: "5s" }} opacity="0.35" />
          <circle cx="68%" cy="22%" r="3" opacity="0.9" fill="#0f766e" />

          <circle cx="86%" cy="40%" r="2.5" opacity="0.75" />
          <circle cx="76%" cy="72%" r="3.5" opacity="0.85" />
          <circle cx="18%" cy="68%" r="3" opacity="0.75" />
          <circle cx="38%" cy="82%" r="2.5" opacity="0.8" />
        </g>
      </svg>

      {/* 5. Smooth bottom vignette fade */}
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#f8fafc] to-transparent" />
    </div>
  );
}

