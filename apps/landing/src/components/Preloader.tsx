"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function Preloader() {
  const [isLoading, setIsLoading] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setIsFading(true), 1200);
    const removeTimer = setTimeout(() => setIsLoading(false), 1700);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!isLoading) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#06180c] transition-opacity duration-500 ${
        isFading ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* Ambient background glow */}
      <div className="absolute h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl animate-pulse" />

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center px-4 text-center">
        {/* Animated Food Icon & Spinner Ring */}
        <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
          {/* Outer Rotating Glowing Ring */}
          <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 border-t-amber-500 animate-spin" />
          
          {/* Inner Food Icon */}
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-950 border border-emerald-800/80 text-2xl shadow-lg">
            🍲
          </div>
        </div>

        {/* Brand Logo */}
        <div className="relative mb-3 h-9 w-40 sm:h-10 sm:w-44">
          <Image
            src="/brand/zaavo-wordmark-reversed.svg"
            alt="Zaavo"
            fill
            priority
            className="object-contain"
          />
        </div>

        {/* Tagline */}
        <p className="font-display text-xs font-semibold uppercase tracking-widest text-[#a4b5a6]">
          Silchar&apos;s Food App
        </p>

        {/* Progress Bar */}
        <div className="mt-6 h-1 w-44 overflow-hidden rounded-full bg-emerald-950/80 border border-emerald-800/40">
          <div className="h-full w-full bg-gradient-to-r from-amber-500 via-emerald-400 to-amber-500 animate-[loading-bar_1.4s_ease-in-out_infinite]" />
        </div>
      </div>

      <style jsx global>{`
        @keyframes loading-bar {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
