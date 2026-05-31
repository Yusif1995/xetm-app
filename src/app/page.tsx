import AyahDisplay from "@/components/AyahDisplay";
import LoginButton from "@/components/LoginButton";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="relative flex-1 flex flex-col justify-center items-center p-4 md:p-8 min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#1a5c38]/40 to-[#1a1a2e] overflow-hidden">
      {/* Decorative Islamic Background Pattern (CSS-based overlapping geometric structures) */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#c9a84c_1px,transparent_1px)] [background-size:24px_24px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border-[8px] border-[#c9a84c] rounded-full rotate-45 animate-[spin_120s_linear_infinite]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border-[4px] border-dashed border-[#c9a84c] rounded-full rotate-12 animate-[spin_90s_linear_infinite]"></div>
      </div>

      {/* Decorative Corner Stars (Rub el Hizb 8-pointed star in CSS) */}
      <div className="absolute top-8 left-8 w-6 h-6 flex items-center justify-center pointer-events-none">
        <div className="absolute w-5 h-5 bg-[#c9a84c] rotate-0 rounded-sm"></div>
        <div className="absolute w-5 h-5 bg-[#c9a84c] rotate-45 rounded-sm"></div>
        <div className="absolute w-2.5 h-2.5 bg-[#1a1a2e] rotate-0 rounded-full z-10"></div>
      </div>
      <div className="absolute top-8 right-8 w-6 h-6 flex items-center justify-center pointer-events-none">
        <div className="absolute w-5 h-5 bg-[#c9a84c] rotate-0 rounded-sm"></div>
        <div className="absolute w-5 h-5 bg-[#c9a84c] rotate-45 rounded-sm"></div>
        <div className="absolute w-2.5 h-2.5 bg-[#1a1a2e] rotate-0 rounded-full z-10"></div>
      </div>
      <div className="absolute bottom-8 left-8 w-6 h-6 flex items-center justify-center pointer-events-none">
        <div className="absolute w-5 h-5 bg-[#c9a84c] rotate-0 rounded-sm"></div>
        <div className="absolute w-5 h-5 bg-[#c9a84c] rotate-45 rounded-sm"></div>
        <div className="absolute w-2.5 h-2.5 bg-[#1a1a2e] rotate-0 rounded-full z-10"></div>
      </div>
      <div className="absolute bottom-8 right-8 w-6 h-6 flex items-center justify-center pointer-events-none">
        <div className="absolute w-5 h-5 bg-[#c9a84c] rotate-0 rounded-sm"></div>
        <div className="absolute w-5 h-5 bg-[#c9a84c] rotate-45 rounded-sm"></div>
        <div className="absolute w-2.5 h-2.5 bg-[#1a1a2e] rotate-0 rounded-full z-10"></div>
      </div>

      {/* Main Glassmorphic Container with Islamic geometric border */}
      <div className="relative z-10 w-full max-w-lg bg-[#1a1a2e]/85 backdrop-blur-md rounded-2xl p-6 md:p-10 border-4 border-double border-[#c9a84c] shadow-2xl flex flex-col items-center">
        
        {/* Top Rub el Hizb central ornament */}
        <div className="w-12 h-12 flex items-center justify-center mb-6 relative">
          <div className="absolute w-10 h-10 bg-gradient-to-br from-[#c9a84c] to-[#b0913e] rotate-0 rounded-sm shadow"></div>
          <div className="absolute w-10 h-10 bg-gradient-to-br from-[#c9a84c] to-[#b0913e] rotate-45 rounded-sm shadow"></div>
          <div className="absolute w-4 h-4 bg-[#1a1a2e] rotate-0 rounded-full z-10 border border-[#c9a84c]/40 flex items-center justify-center font-bold text-[#c9a84c] text-[8px]">
            🕋
          </div>
        </div>

        {/* Brand/Heading */}
        <h1 className="text-3xl md:text-4xl font-amiri font-bold text-center text-transparent bg-clip-text bg-gradient-to-b from-[#fdf6e3] via-[#c9a84c] to-[#b0913e] mb-2 tracking-wide">
          QURAN XƏTM
        </h1>
        <p className="text-xs md:text-sm text-[#fdf6e3]/60 text-center tracking-widest uppercase mb-6 font-semibold border-b border-[#c9a84c]/20 pb-4 w-full">
          Tamamlama İzləyicisi
        </p>

        {/* Featured Ayah/Hadith component */}
        <div className="w-full mb-8">
          <AyahDisplay />
        </div>

        {/* Action button container */}
        <div className="w-full space-y-4">
          <LoginButton />
          
          <div className="text-center pt-2">
            <Link 
              href="/progress" 
              className="inline-block text-xs md:text-sm text-[#c9a84c] hover:text-[#fdf6e3] transition-colors border-b border-dashed border-[#c9a84c]/40 hover:border-[#fdf6e3]/40 pb-0.5"
            >
              Ümumi gedişatı izlə (Girişsiz bax)
            </Link>
          </div>
        </div>

        {/* Footer ornament */}
        <div className="mt-8 text-[10px] text-[#fdf6e3]/30 tracking-widest uppercase font-medium">
          © {new Date().getFullYear()} Xətm Qrupu
        </div>
      </div>
    </main>
  );
}
