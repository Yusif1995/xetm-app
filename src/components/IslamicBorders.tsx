"use client";

export function IslamicBorders() {
  return (
    <>
      {/* Left Islamic geometric star pattern overlay */}
      <div className="fixed -left-12 top-0 bottom-0 w-36 pointer-events-none z-0 hidden lg:block opacity-[0.07] select-none">
        <svg className="w-full h-full text-[#c9a84c]" fill="none">
          <defs>
            <pattern id="islamic-star-pattern" width="80" height="80" patternUnits="userSpaceOnUse">
              <rect x="20" y="20" width="40" height="40" stroke="currentColor" strokeWidth="0.8" fill="none" />
              <rect x="20" y="20" width="40" height="40" stroke="currentColor" strokeWidth="0.8" fill="none" transform="rotate(45 40 40)" />
              <line x1="0" y1="40" x2="80" y2="40" stroke="currentColor" strokeWidth="0.5" />
              <line x1="40" y1="0" x2="40" y2="80" stroke="currentColor" strokeWidth="0.5" />
              <line x1="0" y1="0" x2="80" y2="80" stroke="currentColor" strokeWidth="0.5" />
              <line x1="0" y1="80" x2="80" y2="0" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#islamic-star-pattern)" />
        </svg>
      </div>

      {/* Right Islamic geometric star pattern overlay */}
      <div className="fixed -right-12 top-0 bottom-0 w-36 pointer-events-none z-0 hidden lg:block opacity-[0.07] select-none">
        <svg className="w-full h-full text-[#c9a84c]" fill="none">
          <rect width="100%" height="100%" fill="url(#islamic-star-pattern)" />
        </svg>
      </div>
    </>
  );
}
