"use client";

import { UserDoc } from "../lib/db";
import { useAuth } from "../lib/auth";
import { useState } from "react";

interface UserRowProps {
  user: UserDoc;
  isAdminView?: boolean;
  onAssignPagesClick?: (user: UserDoc) => void;
  onRoleToggle?: (user: UserDoc) => void;
  onDeleteClick?: (user: UserDoc) => void;
  onNotifyClick?: (user: UserDoc) => void;
}

export default function UserRow({ 
  user, 
  isAdminView, 
  onAssignPagesClick, 
  onRoleToggle,
  onDeleteClick,
  onNotifyClick
}: UserRowProps) {
  const { user: currentUser } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const isSelf = currentUser?.uid === user.uid;
  const totalAssigned = user.assignedPages?.length || 0;
  const totalCompleted = user.completedPages?.filter(p => user.assignedPages.includes(p)).length || 0;
  const percentage = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;
  const remainingPages = totalAssigned - totalCompleted;

  // Gecikmə yoxlanışı (Vaxtı keçib amma bitirməyib)
  const today = new Date().toISOString().split("T")[0];
  const isLate = user.assignmentEndDate && user.assignmentEndDate < today && totalCompleted < totalAssigned;
  
  // Status vizualı
  let statusColor = "bg-gray-500/10 text-gray-400 border-gray-500/25";
  let statusText = "Təyin edilməyib";
  
  if (totalAssigned > 0) {
    if (totalCompleted === totalAssigned) {
      statusColor = "bg-green-500/10 text-green-400 border-green-500/25";
      statusText = "Tamamlandı";
    } else if (isLate) {
      statusColor = "bg-red-500/10 text-red-400 border-red-500/25 animate-pulse";
      statusText = "Gecikir";
    } else if (totalCompleted > 0) {
      statusColor = "bg-yellow-500/10 text-yellow-400 border-yellow-500/25";
      statusText = "Davam edir";
    } else {
      statusColor = "bg-blue-500/10 text-blue-400 border-blue-500/25";
      statusText = "Başlamayıb";
    }
  }

  // Səhifələri diapazon kimi göstərmək: [41, 42, 43, 44, 45] -> "41-45"
  const formatPages = (pages: number[]) => {
    if (!pages || pages.length === 0) return "Təyin olunmayıb";
    const sorted = [...pages].sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sorted[0];
    let end = sorted[0];
    
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = sorted[i];
        end = sorted[i];
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    return ranges.join(", ");
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <>
      <tr 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`border-b border-[#c9a84c]/10 transition-colors cursor-pointer select-none ${
          isLate 
            ? "bg-red-950/10 hover:bg-red-900/15 border-l-4 border-l-red-500" 
            : "bg-[#05180d]/40 hover:bg-[#1a5c38]/10"
        }`}
      >
        <td className="px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center gap-3">
            {/* Expand indicator arrow */}
            <span className="text-[10px] text-[#c9a84c] mr-0.5">
              {isExpanded ? "▲" : "▼"}
            </span>

            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.name}
                className="w-8 h-8 rounded-full border border-[#c9a84c]/30 shadow"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#1a5c38]/40 border border-[#c9a84c]/30 flex items-center justify-center font-bold text-[#c9a84c] text-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-xs md:text-sm font-semibold text-[#fdf6e3]">{user.name}</span>
              {isAdminView && (
                <span className="text-[9px] text-[#fdf6e3]/50 truncate max-w-[120px]">{user.email}</span>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 md:px-6 md:py-4 text-[11px] md:text-xs text-[#fdf6e3]/80 font-mono">
          <div className="max-w-[120px] md:max-w-[200px] truncate font-bold text-[#fdf6e3]" title={formatPages(user.assignedPages)}>
            {formatPages(user.assignedPages)}
          </div>
          {user.assignmentStartDate && user.assignmentEndDate && (
            <div className="text-[9px] text-[#c9a84c] mt-0.5 font-sans">
              📅 {formatDateDisplay(user.assignmentStartDate)} — {formatDateDisplay(user.assignmentEndDate)}
            </div>
          )}
        </td>
        <td className="px-4 py-3 md:px-6 md:py-4 text-xs font-mono">
          <span className="text-[#fdf6e3]/90">{totalCompleted} / {totalAssigned}</span>
          {remainingPages > 0 && (
            <span className={`text-[9.5px] block font-sans ${isLate ? "text-red-400 font-bold" : "text-[#fdf6e3]/50"}`}>
              ({remainingPages} səh qalıb)
            </span>
          )}
        </td>
        <td className="px-4 py-3 md:px-6 md:py-4 text-xs font-bold text-[#c9a84c]">
          {percentage}%
        </td>
        <td className="px-4 py-3 md:px-6 md:py-4">
          <span className={`inline-block px-2.5 py-0.5 text-[9px] font-bold rounded-full border ${statusColor}`}>
            {statusText}
          </span>
        </td>
        {isAdminView && (
          <td className="px-4 py-3 md:px-6 md:py-4 text-right" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-end gap-1.5">


              {/* Page assign shortcut */}
              {onAssignPagesClick && (
                <button
                  onClick={() => onAssignPagesClick(user)}
                  className="px-2 py-1 bg-[#c9a84c]/10 hover:bg-[#c9a84c]/20 text-[#c9a84c] border border-[#c9a84c]/30 rounded-md text-[9px] font-bold transition-all"
                >
                  Təyin et
                </button>
              )}

              {/* Send message button */}
              {onNotifyClick && (
                <button
                  onClick={() => onNotifyClick(user)}
                  className="px-2 py-1 bg-blue-950/20 text-blue-400 border border-blue-500/30 hover:bg-blue-900/30 rounded-md text-[9px] font-bold transition-all"
                >
                  Mesaj
                </button>
              )}

              {/* Role Toggle button */}
              {onRoleToggle && (
                <button
                  onClick={() => onRoleToggle(user)}
                  disabled={isSelf}
                  className={`px-2 py-1 rounded-md text-[9px] font-bold border transition-all ${
                    user.role === "admin"
                      ? "bg-purple-950/20 text-purple-400 border-purple-500/30 hover:bg-purple-900/30"
                      : "bg-gray-950/20 text-gray-400 border-gray-500/30 hover:bg-gray-900/30"
                  } disabled:opacity-40`}
                >
                  {user.role === "admin" ? "Admin" : "Üzv"}
                </button>
              )}

              {/* Delete button */}
              {onDeleteClick && (
                <button
                  onClick={() => onDeleteClick(user)}
                  disabled={isSelf}
                  className="px-2 py-1 bg-red-950/20 hover:bg-red-950/50 text-red-400 border border-red-500/30 rounded-md text-[9px] font-bold transition-all disabled:opacity-40"
                >
                  Sil
                </button>
              )}
            </div>
          </td>
        )}
      </tr>

      {/* Expanded detailed page completion map sub-row */}
      {isExpanded && (
        <tr className="bg-[#030e07]/60">
          <td colSpan={isAdminView ? 6 : 5} className="px-6 py-4 border-b border-[#c9a84c]/10">
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <span className="text-[11px] font-bold text-[#c9a84c] uppercase tracking-wider">
                  Səhifə-səhifə tamamlama vəziyyəti:
                </span>
                <div className="flex items-center gap-3 text-[10px] font-semibold text-[#fdf6e3]/60">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#1a5c38]" />
                    <span>Oxunub</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#030e07]/60 border border-[#c9a84c]/20" />
                    <span>Oxunmayıb</span>
                  </div>
                </div>
              </div>

              {totalAssigned === 0 ? (
                <p className="text-xs italic text-[#fdf6e3]/40 py-2">İştirakçıya hələ heç bir səhifə təyin edilməyib.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 py-1">
                  {[...user.assignedPages].sort((a,b)=>a-b).map((page) => {
                    const completed = (user.completedPages || []).includes(page);
                    return (
                      <span 
                        key={page}
                        className={`w-7 h-7 rounded-lg border text-[10px] font-bold font-mono flex items-center justify-center transition-all ${
                          completed 
                            ? "bg-[#1a5c38] border-[#1a5c38] text-[#fdf6e3]" 
                            : "bg-[#030e07]/60 border-[#c9a84c]/15 text-[#fdf6e3]/30 hover:border-[#c9a84c]/40"
                        }`}
                        title={`Səhifə ${page} (${completed ? "Oxunub" : "Oxunmayıb"})`}
                      >
                        {page}
                      </span>
                    );
                  })}
                </div>
              )}
              
              {/* Previous unfinished pages display if exists */}
              {user.previousAssignedPages && user.previousAssignedPages.length > 0 && (
                <div className="pt-2 border-t border-[#c9a84c]/10">
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block mb-2">
                    Əvvəlki yarımçıq qalmış səhifələr (Tarix: {formatDateDisplay(user.previousStartDate)} — {formatDateDisplay(user.previousEndDate)}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[...user.previousAssignedPages].sort((a,b)=>a-b).map((page) => {
                      const completed = (user.previousCompletedPages || []).includes(page);
                      return (
                        <span 
                          key={`prev-${page}`}
                          className={`w-7 h-7 rounded-lg border text-[10px] font-bold font-mono flex items-center justify-center transition-all ${
                            completed 
                              ? "bg-red-500/20 border-red-500/80 text-red-400" 
                              : "bg-[#030e07]/60 border-red-500/20 text-red-500/30"
                          }`}
                          title={`Əvvəlki Səhifə ${page} (${completed ? "Oxunub" : "Oxunmayıb"})`}
                        >
                          {page}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
