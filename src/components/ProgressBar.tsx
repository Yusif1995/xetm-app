"use client";

interface ProgressBarProps {
  completed: number;
  total: number;
  label?: string;
}

export default function ProgressBar({ completed, total, label }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="w-full bg-[#05180d]/40 border border-[#c9a84c]/20 rounded-xl p-4 md:p-5 shadow-inner">
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-sm md:text-base font-semibold text-[#fdf6e3]/95 font-sans">
          {label || "Tamamlanma Nisbəti"}
        </span>
        <span className="text-sm md:text-base font-bold text-[#c9a84c]">
          {completed} / {total} səhifə ({percentage}%)
        </span>
      </div>
      
      {/* Progress track */}
      <div className="islamic-progress-container">
        <div
          className="islamic-progress-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
