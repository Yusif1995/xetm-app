"use client";

interface ProgressBarProps {
  completed: number;
  total: number;
  label?: string;
}

export default function ProgressBar({ completed, total, label }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="w-full bg-[#1a1a2e]/40 border border-[#c9a84c]/10 rounded-xl p-4 md:p-5 shadow-inner">
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-sm md:text-base font-semibold text-[#fdf6e3]/95">
          {label || "Tamamlanma Nisbəti"}
        </span>
        <span className="text-sm md:text-base font-bold text-[#c9a84c]">
          {completed} / {total} səhifə ({percentage}%)
        </span>
      </div>
      
      {/* Progress track */}
      <div className="w-full h-3.5 bg-[#1a1a2e]/65 rounded-full overflow-hidden border border-[#c9a84c]/25 p-0.5">
        <div
          className="h-full bg-gradient-to-r from-[#1a5c38] to-[#c9a84c] rounded-full transition-all duration-500 ease-out shadow-lg shadow-[#c9a84c]/20"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
