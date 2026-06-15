"use client";

interface ProgressBarProps {
  completed: number;
  total: number;
  label?: string;
}

export default function ProgressBar({ completed, total, label }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="w-full bg-white border border-[#0F3D2C]/10 rounded-2xl p-4 md:p-5 shadow-sm">
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-sm md:text-base font-bold text-[#0F3D2C] font-sans">
          {label || "Tamamlanma Nisbəti"}
        </span>
        <span className="text-sm md:text-base font-extrabold text-[#D5A85A] font-mono">
          {completed} / {total} səhifə ({percentage}%)
        </span>
      </div>
      
      {/* Progress track */}
      <div className="w-full h-3 bg-[#EFE9DF] rounded-full overflow-hidden p-0.5 border border-[#0F3D2C]/5 shadow-inner">
        <div
          className="h-full bg-gradient-to-r from-[#0F3D2C] to-[#155e34] rounded-full transition-all duration-700"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
