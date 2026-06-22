"use client";

import { UserDoc, getUserAssignment } from "../lib/db";
import { useAuth } from "../lib/auth";
import { useState } from "react";

interface UserRowProps {
  user: UserDoc;
  isAdminView?: boolean;
  onAssignPagesClick?: (user: UserDoc) => void;
  onRoleToggle?: (user: UserDoc) => void;
  onNotifyClick?: (user: UserDoc) => void;
  onRemoveUserClick?: (user: UserDoc) => void;
}

export default function UserRow({ 
  user, 
  isAdminView, 
  onAssignPagesClick, 
  onRoleToggle,
  onNotifyClick,
  onRemoveUserClick
}: UserRowProps) {
  const { user: currentUser, activeGroupId } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const isSelf = currentUser?.uid === user.uid;
  const assignment = getUserAssignment(user, activeGroupId);
  const totalAssigned = assignment.assignedPages?.length || 0;
  const totalCompleted = assignment.completedPages?.filter(p => assignment.assignedPages.includes(p)).length || 0;
  const percentage = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;
  const remainingPages = totalAssigned - totalCompleted;

  // Gecikmə yoxlanışı
  const today = new Date().toISOString().split("T")[0];
  const isLate = assignment.assignmentEndDate && assignment.assignmentEndDate < today && totalCompleted < totalAssigned;
  
  // Status vizualı
  let statusColor = "bg-gray-100 text-gray-600 border-gray-200";
  let statusText = "Təyin edilməyib";
  
  if (totalAssigned > 0) {
    if (totalCompleted === totalAssigned) {
      statusColor = "bg-green-100 text-green-700 border-green-200";
      statusText = "Tamamlandı";
    } else if (isLate) {
      statusColor = "bg-red-100 text-red-700 border-red-200 animate-pulse";
      statusText = "Gecikir";
    } else if (totalCompleted > 0) {
      statusColor = "bg-yellow-100 text-yellow-700 border-yellow-200";
      statusText = "Davam edir";
    } else {
      statusColor = "bg-blue-100 text-blue-700 border-blue-200";
      statusText = "Başlamayıb";
    }
  }

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
        className={`border-b border-[#0F3D2C]/10 transition-colors cursor-pointer select-none text-[#0F3D2C] ${
          isLate 
            ? "bg-red-50/50 hover:bg-red-100/50 border-l-4 border-l-red-500" 
            : "bg-white hover:bg-[#FAF7F2]"
        }`}
      >
        <td className="px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[#0F3D2C]/60 mr-0.5">
              {isExpanded ? "▲" : "▼"}
            </span>

            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.name}
                className="w-8 h-8 rounded-full border border-[#0F3D2C]/20 shadow-sm"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#EAE3D5] border border-[#0F3D2C]/20 flex items-center justify-center font-bold text-[#0F3D2C] text-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-xs md:text-sm font-bold text-[#0F3D2C]">{user.name}</span>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 md:px-6 md:py-4 text-[11px] md:text-xs text-[#0F3D2C]/80 font-mono">
          <div className="max-w-[120px] md:max-w-[200px] truncate font-bold" title={formatPages(assignment.assignedPages)}>
            {formatPages(assignment.assignedPages)}
          </div>
          {assignment.assignmentStartDate && assignment.assignmentEndDate && (
            <div className="text-[9px] text-[#D5A85A] mt-0.5 font-sans">
              📅 {formatDateDisplay(assignment.assignmentStartDate)} — {formatDateDisplay(assignment.assignmentEndDate)}
            </div>
          )}
        </td>
        <td className="px-4 py-3 md:px-6 md:py-4 text-xs font-mono font-semibold">
          <span>{totalCompleted} / {totalAssigned}</span>
          {remainingPages > 0 && (
            <span className={`text-[9.5px] block font-sans ${isLate ? "text-red-500 font-bold" : "text-[#0F3D2C]/50"}`}>
              ({remainingPages} səh qalıb)
            </span>
          )}
        </td>
        <td className="px-4 py-3 md:px-6 md:py-4 text-xs font-extrabold text-[#D5A85A]">
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
              {onAssignPagesClick && (
                <button
                  onClick={() => onAssignPagesClick(user)}
                  className="px-2 py-1 bg-[#0F3D2C]/5 hover:bg-[#0F3D2C]/10 text-[#0F3D2C] border border-[#0F3D2C]/20 rounded-md text-[9px] font-bold transition-all"
                >
                  Təyin et
                </button>
              )}

              {onNotifyClick && (
                <button
                  onClick={() => onNotifyClick(user)}
                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md text-[9px] font-bold transition-all"
                >
                  Mesaj
                </button>
              )}

              {onRoleToggle && (
                <button
                  onClick={() => onRoleToggle(user)}
                  disabled={isSelf}
                  className={`px-2 py-1 rounded-md text-[9px] font-bold border transition-all ${
                    user.role === "admin"
                      ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                      : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                  } disabled:opacity-40`}
                >
                  {user.role === "admin" ? "Admin" : "Üzv"}
                </button>
              )}

              {onRemoveUserClick && (
                <button
                  onClick={() => onRemoveUserClick(user)}
                  disabled={isSelf}
                  className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-md text-[9px] font-bold transition-all disabled:opacity-40"
                >
                  Çıxar
                </button>
              )}
            </div>
          </td>
        )}
      </tr>

      {/* Expanded detailed page completion map sub-row */}
      {isExpanded && (
        <tr className="bg-[#FAF7F2]/50 text-[#0F3D2C]">
          <td colSpan={isAdminView ? 6 : 5} className="px-6 py-4 border-b border-[#0F3D2C]/10">
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <span className="text-[11px] font-bold text-[#D5A85A] uppercase tracking-wider">
                  Səhifə-səhifə tamamlama vəziyyəti:
                </span>
                <div className="flex items-center gap-3 text-[10px] font-semibold text-[#0F3D2C]/60">
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#E8F4EC] border border-[#0F3D2C]" />
                    <span>Oxunub</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-white border border-[#0F3D2C]/20" />
                    <span>Oxunmayıb</span>
                  </div>
                </div>
              </div>

              {totalAssigned === 0 ? (
                <p className="text-xs italic text-[#0F3D2C]/40 py-2">İştirakçıya hələ heç bir səhifə təyin edilməyib.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 py-1">
                  {[...assignment.assignedPages].sort((a,b)=>a-b).map((page) => {
                    const completed = (assignment.completedPages || []).includes(page);
                    return (
                      <span 
                        key={page}
                        className={`w-7 h-7 rounded-lg border text-[10px] font-bold font-mono flex items-center justify-center transition-all ${
                          completed 
                            ? "bg-[#E8F4EC] border-[#0F3D2C] text-[#0F3D2C]" 
                            : "bg-white border-[#0F3D2C]/15 text-[#0F3D2C]/30 hover:border-[#0F3D2C]/40"
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
              {assignment.previousAssignedPages && assignment.previousAssignedPages.length > 0 && (
                <div className="pt-2 border-t border-[#0F3D2C]/10">
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block mb-2">
                    Əvvəlki yarımçıq qalmış səhifələr (Tarix: {formatDateDisplay(assignment.previousStartDate)} — {formatDateDisplay(assignment.previousEndDate)}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[...assignment.previousAssignedPages].sort((a,b)=>a-b).map((page) => {
                      const completed = (assignment.previousCompletedPages || []).includes(page);
                      return (
                        <span 
                          key={`prev-${page}`}
                          className={`w-7 h-7 rounded-lg border text-[10px] font-bold font-mono flex items-center justify-center transition-all ${
                            completed 
                              ? "bg-red-50 border-red-500/80 text-red-600" 
                              : "bg-white border-red-500/20 text-red-500/30"
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
