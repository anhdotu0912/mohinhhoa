/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { resolveUserAvatar, userInitials } from "@/lib/avatar";
import { useAuthStore } from "@/lib/auth-store";
import {
  usePatientChatHistoryStore,
  groupSessionsByRecency,
  type ChatSession,
} from "@/lib/patient-chat-history-store";

interface PatientChatSidebarProps {
  onSelectSession?: (sessionId: string) => void;
  onNewChat?: () => void;
}

export function PatientChatSidebar({
  onSelectSession,
  onNewChat,
}: PatientChatSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthStore((s) => s.token);
  const displayName = useAuthStore((s) => s.displayName);
  const email = useAuthStore((s) => s.email);
  const avatar = useAuthStore((s) => s.avatar);
  const logout = useAuthStore((s) => s.logout);
  const setUserProfile = useAuthStore((s) => s.setUserProfile);

  const avatarSrc = resolveUserAvatar(avatar);
  const initials = userInitials(displayName || email || "BN");

  const sessions = usePatientChatHistoryStore((s) => s.sessions);
  const activeSessionId = usePatientChatHistoryStore((s) => s.activeSessionId);
  const isSidebarOpen = usePatientChatHistoryStore((s) => s.isSidebarOpen);
  const toggleSidebar = usePatientChatHistoryStore((s) => s.toggleSidebar);
  const setSidebarOpen = usePatientChatHistoryStore((s) => s.setSidebarOpen);
  const createNewSession = usePatientChatHistoryStore((s) => s.createNewSession);
  const selectSession = usePatientChatHistoryStore((s) => s.selectSession);
  const renameSession = usePatientChatHistoryStore((s) => s.renameSession);
  const deleteSession = usePatientChatHistoryStore((s) => s.deleteSession);
  const togglePinSession = usePatientChatHistoryStore((s) => s.togglePinSession);
  const clearAllSessions = usePatientChatHistoryStore((s) => s.clearAllSessions);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Context Menu State
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  // Inline Rename State
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirm Modal State
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .getCurrentUser(token)
      .then((user) => {
        if (cancelled) return;
        setUserProfile({
          displayName: user.full_name?.trim() || user.email,
          avatar: user.avatar ?? null,
          assignedDoctor: user.assigned_doctor ?? null,
        });
      })
      .catch(() => {
        /* giữ avatar đã persist nếu API không sẵn */
      });
    return () => {
      cancelled = true;
    };
  }, [token, setUserProfile]);

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuSessionId) {
        setMenuSessionId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuSessionId(null);
        setEditingSessionId(null);
        setSessionToDelete(null);
        setShowClearConfirm(false);
      }
    };

    window.addEventListener("click", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuSessionId]);

  // Focus input when inline editing starts
  useEffect(() => {
    if (editingSessionId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSessionId]);

  // Filter sessions by search query
  const filteredSessions = React.useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase().trim();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  const grouped = React.useMemo(() => {
    return groupSessionsByRecency(filteredSessions);
  }, [filteredSessions]);

  const navigateToChat = () => {
    if (pathname !== "/patient") {
      router.push("/patient");
    }
  };

  const handleStartNewChat = () => {
    void createNewSession().then(() => {
      onNewChat?.();
      navigateToChat();
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    });
  };

  const handleSelectSession = (id: string) => {
    void selectSession(id).then(() => {
      onSelectSession?.(id);
      navigateToChat();
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    });
  };

  const handleOpenContextMenu = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - 180),
    });
    setMenuSessionId(session.id);
  };

  const handleStartRename = (session: ChatSession) => {
    setMenuSessionId(null);
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveRename = (id: string) => {
    if (editTitle.trim()) {
      void renameSession(id, editTitle.trim());
    }
    setEditingSessionId(null);
  };

  const handleDeleteConfirm = () => {
    if (sessionToDelete) {
      void deleteSession(sessionToDelete.id);
      setSessionToDelete(null);
    }
  };

  const handleClearAllConfirm = () => {
    void clearAllSessions();
    setShowClearConfirm(false);
  };

  const renderGroup = (title: string, groupSessions: ChatSession[], iconName?: string) => {
    if (groupSessions.length === 0) return null;

    return (
      <div key={title} className="mb-4">
        <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          {iconName && (
            <span className="material-symbols-outlined text-[14px] text-slate-400">
              {iconName}
            </span>
          )}
          <span>{title}</span>
        </div>

        <div className="flex flex-col gap-0.5 mt-1">
          {groupSessions.map((s) => {
            const isActive = s.id === activeSessionId;
            const isEditing = s.id === editingSessionId;

            if (isEditing) {
              return (
                <div
                  key={s.id}
                  className="px-2.5 py-1.5 rounded-xl bg-white border border-emerald-500/80 shadow-xs flex items-center gap-1.5"
                >
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveRename(s.id);
                      if (e.key === "Escape") setEditingSessionId(null);
                    }}
                    className="flex-1 text-xs font-medium text-slate-900 bg-transparent outline-none py-0.5"
                    placeholder="Nhập tên cuộc trò chuyện..."
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveRename(s.id)}
                    className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                    title="Lưu"
                  >
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingSessionId(null)}
                    className="p-1 rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
                    title="Hủy"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              );
            }

            return (
              <div
                key={s.id}
                onClick={() => handleSelectSession(s.id)}
                className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-[13px] font-medium transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "bg-emerald-50/90 text-[#006857] font-semibold shadow-2xs border border-emerald-500/20"
                    : "text-slate-700 hover:bg-slate-200/60 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                  <span
                    className={`material-symbols-outlined text-[17px] shrink-0 transition-colors ${
                      isActive ? "text-[#006857]" : "text-slate-400 group-hover:text-slate-600"
                    }`}
                  >
                    {s.pinned ? "push_pin" : "chat_bubble"}
                  </span>
                  <span className="truncate leading-tight">{s.title || "Cuộc trò chuyện"}</span>
                </div>

                {/* 3-dot context menu trigger */}
                <button
                  type="button"
                  onClick={(e) => handleOpenContextMenu(e, s)}
                  className={`p-1 rounded-md hover:bg-slate-300/60 text-slate-400 hover:text-slate-700 transition-all shrink-0 ${
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                  title="Tùy chọn"
                >
                  <span className="material-symbols-outlined text-[16px]">more_vert</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const sidebarContent = (
    <div className="w-[260px] h-full flex flex-col bg-[#f0f4f9]/90 backdrop-blur-xl border-r border-slate-200/80 select-none">
      {/* Top Header: Hamburger, Brand, Clear All & New Chat Button */}
      <div className="p-3 pb-2.5 flex flex-col gap-2.5 border-b border-slate-200/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-1.5 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer flex items-center justify-center"
              title="Đóng thanh bên"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>
            <Link
              href="/patient"
              className="flex items-center gap-1.5 hover:opacity-90 transition-opacity"
            >
              <span className="font-extrabold text-sm text-[#006857] tracking-tight">
                VMEC-10
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100/90 text-emerald-800 border border-emerald-200/60">
                AI
              </span>
            </Link>
          </div>

          {sessions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
              title="Xóa tất cả lịch sử chat"
            >
              <span className="material-symbols-outlined text-[17px]">delete_sweep</span>
            </button>
          )}
        </div>

        {/* Gemini Style "+ New Chat" Button */}
        <button
          type="button"
          onClick={handleStartNewChat}
          className="w-full bg-white hover:bg-emerald-50 text-emerald-950 border border-slate-200/90 hover:border-emerald-400/60 shadow-2xs font-semibold text-xs sm:text-sm py-2.5 px-3.5 rounded-full flex items-center gap-2.5 transition-all duration-200 group cursor-pointer active:scale-[0.98]"
        >
          <div className="w-6 h-6 rounded-full bg-emerald-100/80 group-hover:bg-[#006857] text-[#006857] group-hover:text-white flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-[16px]">add</span>
          </div>
          <span className="font-semibold">Cuộc trò chuyện mới</span>
        </button>

        {/* Quick Search */}
        {sessions.length > 5 && (
          <div className="relative mt-0.5">
            <span className="material-symbols-outlined text-[16px] text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm đoạn chat..."
              className="w-full bg-white/70 focus:bg-white border border-slate-200/80 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-emerald-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scrollable Sessions List */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2 py-3">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-8 px-4 text-slate-400 flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-[28px] text-slate-300">
              forum
            </span>
            <p className="text-xs font-medium">Chưa có cuộc trò chuyện nào</p>
            <button
              type="button"
              onClick={handleStartNewChat}
              className="text-xs text-[#006857] font-semibold hover:underline mt-1 cursor-pointer"
            >
              Bắt đầu ngay
            </button>
          </div>
        ) : (
          <>
            {renderGroup("Đã ghim", grouped.pinned, "push_pin")}
            {renderGroup("Hôm nay", grouped.today)}
            {renderGroup("Hôm qua", grouped.yesterday)}
            {renderGroup("7 ngày qua", grouped.last7Days)}
            {renderGroup("Trước đó", grouped.older)}
          </>
        )}
      </div>

      {/* Bottom User Account Section */}
      <div className="p-2.5 border-t border-slate-200/70 bg-[#f0f4f9] flex flex-col gap-1.5">
        {/* Clickable Profile Card -> Directly opens /patient/profile */}
        <Link
          href="/patient/profile"
          onClick={() => {
            if (window.innerWidth < 768) setSidebarOpen(false);
          }}
          className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/90 border border-transparent hover:border-slate-200/80 hover:shadow-2xs transition-all group cursor-pointer text-left"
          title="Xem hồ sơ sức khỏe cá nhân"
        >
          <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-emerald-500/40 group-hover:border-emerald-600 transition-colors shadow-2xs shrink-0 bg-emerald-50">
            <div
              translate="no"
              className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#006857]"
            >
              {initials}
            </div>
            {avatarSrc ? (
              <img
                key={avatarSrc}
                src={avatarSrc}
                alt="Avatar"
                className="relative z-10 w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : null}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-bold text-xs sm:text-[13px] text-slate-900 truncate group-hover:text-[#006857] transition-colors">
              {displayName?.trim() || "Bệnh nhân"}
            </span>
            <span className="text-[10.5px] text-slate-500 truncate">
              {email || "Hồ sơ sức khỏe"}
            </span>
          </div>
        </Link>

        {/* Logout Button directly underneath */}
        <button
          type="button"
          onClick={() => {
            logout();
            router.replace("/login");
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-rose-600 hover:bg-slate-200/60 transition-all cursor-pointer group"
          title="Đăng xuất khỏi hệ thống"
        >
          <span className="material-symbols-outlined text-[17px] text-slate-500 group-hover:text-rose-600 transition-colors">
            logout
          </span>
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent / Collapsible Sidebar */}
      <aside
        className={`hidden md:flex flex-col h-full shrink-0 transition-[width,opacity] duration-250 ease-in-out overflow-hidden z-20 ${
          isSidebarOpen ? "w-[260px] opacity-100" : "w-0 opacity-0 pointer-events-none"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer with Backdrop */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-10 h-full shadow-2xl animate-in slide-in-from-left duration-250">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Floating Context Menu Popover */}
      {menuSessionId && menuPosition && (
        <div
          style={{ top: menuPosition.top, left: menuPosition.left }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 w-44 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200/90 py-1.5 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-150"
        >
          {(() => {
            const currentSession = sessions.find((s) => s.id === menuSessionId);
            if (!currentSession) return null;

            return (
              <>
                <button
                  type="button"
                  onClick={() => handleStartRename(currentSession)}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2.5 transition-colors cursor-pointer font-medium"
                >
                  <span className="material-symbols-outlined text-[16px] text-slate-500">
                    edit
                  </span>
                  <span>Đổi tên</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void togglePinSession(currentSession.id);
                    setMenuSessionId(null);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2.5 transition-colors cursor-pointer font-medium"
                >
                  <span className="material-symbols-outlined text-[16px] text-slate-500">
                    {currentSession.pinned ? "keep_off" : "push_pin"}
                  </span>
                  <span>{currentSession.pinned ? "Bỏ ghim" : "Ghim lên đầu"}</span>
                </button>

                <div className="h-px bg-slate-100 my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setSessionToDelete(currentSession);
                    setMenuSessionId(null);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-rose-50 text-rose-600 flex items-center gap-2.5 transition-colors cursor-pointer font-medium"
                >
                  <span className="material-symbols-outlined text-[16px] text-rose-500">
                    delete
                  </span>
                  <span>Xóa cuộc trò chuyện</span>
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* Delete Single Session Confirmation Modal */}
      {sessionToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSessionToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[22px]">delete</span>
            </div>
            <h3 className="font-bold text-slate-900 text-sm md:text-base">
              Xóa cuộc trò chuyện?
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Bạn có chắc chắn muốn xóa &ldquo;{sessionToDelete.title}&rdquo; không? Hành động này không thể hoàn tác.
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 shadow-xs transition-colors cursor-pointer"
              >
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Sessions Confirmation Modal */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[22px]">delete_sweep</span>
            </div>
            <h3 className="font-bold text-slate-900 text-sm md:text-base">
              Xóa toàn bộ lịch sử trò chuyện?
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Tất cả các phiên tư vấn dinh dưỡng đã lưu sẽ bị xóa hoàn toàn khỏi trình duyệt của bạn.
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleClearAllConfirm}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 shadow-xs transition-colors cursor-pointer"
              >
                Xóa tất cả
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
