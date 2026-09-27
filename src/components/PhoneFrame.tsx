import type { ReactNode } from "react";

/**
 * A silver iPhone-style frame drawn in CSS (so live UI can run inside it).
 * Width drives everything; the aspect matches a 6.3" display.
 */
export function PhoneFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative aspect-[9/19.2] w-[min(300px,76vw)] ${className}`}>
      {/* side buttons */}
      <span aria-hidden className="absolute -left-[3px] top-[19%] h-[5%] w-[3px] rounded-l bg-[#c9c9cd]" />
      <span aria-hidden className="absolute -left-[3px] top-[27%] h-[9%] w-[3px] rounded-l bg-[#c9c9cd]" />
      <span aria-hidden className="absolute -left-[3px] top-[38%] h-[9%] w-[3px] rounded-l bg-[#c9c9cd]" />
      <span aria-hidden className="absolute -right-[3px] top-[30%] h-[13%] w-[3px] rounded-r bg-[#c9c9cd]" />

      {/* titanium band */}
      <div
        className="absolute inset-0 rounded-[17%/8%] p-[2.5px]"
        style={{
          background: "linear-gradient(150deg,#f4f4f5 0%,#b8b8bd 22%,#e9e9eb 48%,#a6a6ab 74%,#efeff1 100%)",
          boxShadow: "0 50px 90px -40px rgb(0 0 0 / 0.45), 0 18px 36px -18px rgb(0 0 0 / 0.3)",
        }}
      >
        {/* black bezel */}
        <div className="h-full w-full rounded-[16.4%/7.7%] bg-[#0b0b0c] p-[3.2%]">
          {/* screen */}
          <div className="relative h-full w-full overflow-hidden rounded-[13.5%/6.4%] bg-white">
            <StatusBar />
            {children}
            {/* home indicator */}
            <span aria-hidden className="absolute bottom-[1.4%] left-1/2 h-[4px] w-[36%] -translate-x-1/2 rounded-full bg-black/80" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div aria-hidden className="absolute inset-x-0 top-0 z-20 flex h-[6.2%] items-center justify-between px-[9%] pt-[1.5%]">
      <span className="text-[11px] font-semibold tracking-tight">9:41</span>
      {/* dynamic island */}
      <span className="absolute left-1/2 top-[22%] h-[52%] w-[32%] -translate-x-1/2 rounded-full bg-black" />
      <span className="flex items-center gap-[3px]">
        <svg viewBox="0 0 18 12" className="h-[9px] w-auto" fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg viewBox="0 0 16 12" className="h-[9px] w-auto" fill="currentColor">
          <path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.1-1.2A10.2 10.2 0 0 0 8 .6C5.3.6 2.8 1.6.9 3.4L2 4.6a8.6 8.6 0 0 1 6-2.4Zm0 3.3c1.4 0 2.7.5 3.7 1.4l1.1-1.2A7 7 0 0 0 8 3.9a7 7 0 0 0-4.8 1.8l1.1 1.2c1-.9 2.3-1.4 3.7-1.4Zm0 3.3c-.6 0-1.1.2-1.5.6L8 11l1.5-1.6c-.4-.4-.9-.6-1.5-.6Z" />
        </svg>
        <span className="relative ml-[1px] h-[9px] w-[19px] rounded-[3px] border border-black/40 p-[1px]">
          <span className="block h-full w-[80%] rounded-[1.5px] bg-black" />
        </span>
      </span>
    </div>
  );
}
