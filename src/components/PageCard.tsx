"use client";

import { useState, useEffect } from "react";
import { toggleCompletedPages } from "../lib/db";

interface PageCardProps {
  userId: string;
  pageNumbers: number[];
  initialCompleted: boolean;
  onStatusChange?: (pageNumbers: number[], isCompleted: boolean) => void;
  disabled?: boolean;
  toggleFn?: (userId: string, pageNumbers: number[], isCompleted: boolean) => Promise<void>;
}

export default function PageCard({ userId, pageNumbers, initialCompleted, onStatusChange, disabled, toggleFn }: PageCardProps) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCompleted(initialCompleted);
  }, [initialCompleted]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (loading || disabled) return;

    setLoading(true);
    const newCompleted = !completed;
    try {
      if (toggleFn) {
        await toggleFn(userId, pageNumbers, newCompleted);
      } else {
        await toggleCompletedPages(userId, pageNumbers, newCompleted);
      }
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
      className={`group relative flex flex-col justify-between p-4 md:p-5 rounded-2xl border select-none transition-all duration-300 transform ${
        disabled 
          ? "bg-[#EAE3D5]/20 border-red-500/20 text-[#0F3D2C]/30 cursor-not-allowed opacity-50"
          : completed
            ? "bg-[#E8F4EC] border-[#0F3D2C] text-[#0F3D2C] shadow-md shadow-[#0F3D2C]/5 cursor-pointer hover:-translate-y-1"
            : "bg-[#FFFFFF] border-[#0F3D2C]/10 hover:border-[#0F3D2C]/40 text-[#0F3D2C]/70 shadow-sm cursor-pointer hover:-translate-y-1"
      }`}
    >
      <div className="flex justify-between items-center w-full mb-2">
        <span className="text-[10px] md:text-xs font-bold tracking-wider text-[#D5A85A] uppercase">
          {isMultiple ? "Səhifələr" : "Səhifə"}
        </span>
        <div className="flex items-center justify-center">
          {disabled ? (
            <span className="text-xs">🔒</span>
          ) : (
            <div
              className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                completed
                  ? "bg-[#0F3D2C] border-[#0F3D2C]"
                  : "border-[#0F3D2C]/20 group-hover:border-[#0F3D2C]"
              }`}
            >
              {completed && (
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="text-2xl md:text-3xl font-extrabold font-mono text-center w-full py-1.5 text-[#0F3D2C] group-hover:text-[#D5A85A] transition-colors">
        {displayLabel}
      </div>

      <div className="mt-2.5 text-[10px] md:text-xs text-center font-bold tracking-wide">
        <span className={disabled ? "text-red-500/50" : completed ? "text-[#0F3D2C] font-bold" : "text-[#0F3D2C]/50"}>
          {disabled ? "Kilidli" : completed ? "Tamamlandı" : "Oxunmayıb"}
        </span>
      </div>
      
      {loading && (
        <div className="absolute inset-0 bg-white/70 rounded-2xl flex items-center justify-center z-10">
          <svg className="animate-spin h-5 w-5 text-[#0F3D2C]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      )}
    </div>
  );
}
