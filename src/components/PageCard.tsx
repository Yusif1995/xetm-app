"use client";

import { useState, useEffect } from "react";
import { toggleCompletedPages } from "../lib/db";

interface PageCardProps {
  userId: string;
  pageNumbers: number[];
  initialCompleted: boolean;
  onStatusChange?: (pageNumbers: number[], isCompleted: boolean) => void;
}

export default function PageCard({ userId, pageNumbers, initialCompleted, onStatusChange }: PageCardProps) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCompleted(initialCompleted);
  }, [initialCompleted]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    const newCompleted = !completed;
    try {
      await toggleCompletedPages(userId, pageNumbers, newCompleted);
      setCompleted(newCompleted);
      if (onStatusChange) {
        onStatusChange(pageNumbers, newCompleted);
      }
    } catch (err) {
      console.error("Error toggling pages:", err);
    } finally {
      setLoading(false);
    }
  };

  const isMultiple = pageNumbers.length > 1;
  const displayLabel = isMultiple 
    ? `${pageNumbers[0]} - ${pageNumbers[pageNumbers.length - 1]}` 
    : pageNumbers[0];

  return (
    <div
      onClick={handleToggle}
      className={`group relative flex flex-col justify-between p-4 md:p-5 rounded-xl border cursor-pointer select-none transition-all duration-300 transform hover:-translate-y-1 ${
        completed
          ? "bg-[#1a5c38]/20 border-[#1a5c38] text-[#fdf6e3] shadow-md shadow-[#1a5c38]/10"
          : "bg-[#1a1a2e]/40 border-[#c9a84c]/20 hover:border-[#c9a84c]/50 text-[#fdf6e3]/75"
      }`}
    >
      <div className="flex justify-between items-center w-full mb-2">
        <span className="text-[10px] md:text-xs font-semibold tracking-wider text-[#c9a84c] uppercase">
          {isMultiple ? "Səhifələr" : "Səhifə"}
        </span>
        <div className="flex items-center justify-center">
          <div
            className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
              completed
                ? "bg-[#1a5c38] border-[#1a5c38]"
                : "border-[#c9a84c]/40 group-hover:border-[#c9a84c]"
            }`}
          >
            {completed && (
              <svg className="w-3.5 h-3.5 text-[#fdf6e3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      </div>

      <div className="text-2xl md:text-3xl font-extrabold font-mono text-center w-full py-1.5 text-[#fdf6e3] group-hover:text-[#c9a84c] transition-colors">
        {displayLabel}
      </div>

      <div className="mt-2.5 text-[10px] md:text-xs text-center font-medium tracking-wide">
        <span className={completed ? "text-[#1a5c38] font-bold" : "text-[#c9a84c]/70"}>
          {completed ? "Tamamlandı" : "Oxunmayıb"}
        </span>
      </div>
      
      {loading && (
        <div className="absolute inset-0 bg-[#1a1a2e]/70 rounded-xl flex items-center justify-center z-10">
          <svg className="animate-spin h-5 w-5 text-[#c9a84c]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      )}
    </div>
  );
}

