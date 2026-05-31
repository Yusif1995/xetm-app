"use client";

import { UserDoc } from "../lib/db";

interface UserRowProps {
  user: UserDoc;
  isAdminView?: boolean;
  onAssignPagesClick?: (user: UserDoc) => void;
}

export default function UserRow({ user, isAdminView, onAssignPagesClick }: UserRowProps) {
  const totalAssigned = user.assignedPages?.length || 0;
  const totalCompleted = user.completedPages?.filter(p => user.assignedPages.includes(p)).length || 0;
  const percentage = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;
  
  // Status check color codes
  let statusColor = "bg-red-500/10 text-red-400 border-red-500/25";
  let statusText = "Başlamayıb";
  
  if (totalAssigned > 0) {
    if (totalCompleted === totalAssigned) {
      statusColor = "bg-green-500/10 text-green-400 border-green-500/25";
      statusText = "Tamamlandı";
    } else if (totalCompleted > 0) {
      statusColor = "bg-yellow-500/10 text-yellow-400 border-yellow-500/25";
      statusText = "Davam edir";
    }
  } else {
    statusColor = "bg-gray-500/10 text-gray-400 border-gray-500/25";
    statusText = "Təyin edilməyib";
  }

  // Helper to format array of numbers to ranges, e.g. [1, 2, 3, 5] -> "1-3, 5"
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

  return (
    <tr className="border-b border-[#c9a84c]/10 bg-[#1a1a2e]/25 hover:bg-[#1a5c38]/5 transition-colors">
      <td className="px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center gap-3">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.name}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-[#c9a84c]/30 shadow"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#1a5c38]/40 border border-[#c9a84c]/30 flex items-center justify-center font-bold text-[#c9a84c] text-xs md:text-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-xs md:text-sm font-semibold text-[#fdf6e3]">{user.name}</span>
            {isAdminView && (
              <span className="text-[10px] md:text-xs text-[#fdf6e3]/50 truncate max-w-[120px] md:max-w-none">{user.email}</span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 md:px-6 md:py-4 text-[11px] md:text-sm text-[#fdf6e3]/80 font-mono">
        <div className="max-w-[120px] md:max-w-[200px] truncate" title={formatPages(user.assignedPages)}>
          {formatPages(user.assignedPages)}
        </div>
      </td>
      <td className="px-4 py-3 md:px-6 md:py-4 text-xs md:text-sm text-[#fdf6e3]/80 font-mono">
        {totalCompleted} / {totalAssigned}
      </td>
      <td className="px-4 py-3 md:px-6 md:py-4 text-xs md:text-sm font-bold text-[#c9a84c]">
        {percentage}%
      </td>
      <td className="px-4 py-3 md:px-6 md:py-4">
        <span className={`inline-block px-2.5 py-1 text-[10px] md:text-xs font-semibold rounded-full border ${statusColor}`}>
          {statusText}
        </span>
      </td>
      {isAdminView && onAssignPagesClick && (
        <td className="px-4 py-3 md:px-6 md:py-4 text-right">
          <button
            onClick={() => onAssignPagesClick(user)}
            className="px-2.5 py-1.5 bg-[#c9a84c]/10 hover:bg-[#c9a84c] text-[#c9a84c] hover:text-[#1a1a2e] border border-[#c9a84c]/30 hover:border-[#c9a84c] rounded-md text-xs font-semibold transition-all duration-300 transform active:scale-95 whitespace-nowrap"
          >
            Səhifə Təyin Et
          </button>
        </td>
      )}
    </tr>
  );
}
