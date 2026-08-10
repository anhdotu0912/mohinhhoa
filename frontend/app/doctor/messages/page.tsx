"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/shared/TopBar";
import { MOCK_PATIENTS } from "@/lib/mock-data";

interface ChatMessage {
  id: string;
  sender: "doctor" | "patient";
  text: string;
  time: string;
}

interface ConversationThread {
  id: string;
  patientId: string;
  patientName: string;
  avatar: string;
  statusText: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount?: number;
  messages: ChatMessage[];
}

const initialConversations: ConversationThread[] = [
  {
    id: "BN-10293",
    patientId: "BN-10293",
    patientName: "Nguyễn Văn A",
    avatar: MOCK_PATIENTS[0].avatar,
    statusText: "Đang hoạt động",
    lastMessage: "Bác sĩ ơi, tôi thấy hơi chóng mặt...",
    lastMessageTime: "10:30",
    unreadCount: 1,
    messages: [
      {
        id: "m1",
        sender: "patient",
        text: "Chào bác sĩ, dạo này tôi tuân thủ thực đơn nhưng thỉnh thoảng thấy hơi mệt và chóng mặt vào buổi chiều. Không biết có sao không ạ?",
        time: "10:25",
      },
      {
        id: "m2",
        sender: "doctor",
        text: "Chào chú A. Hiện tượng chóng mặt có thể do lượng đường huyết giảm nhẹ vào giữa buổi. Chú có đang dùng bữa phụ lúc 3h chiều như trong kế hoạch không ạ?",
        time: "10:30",
      },
      {
        id: "m3",
        sender: "patient",
        text: "À, mấy hôm nay tôi có bỏ qua bữa phụ đó vì thấy cũng không đói lắm.",
        time: "10:32",
      },
    ],
  },
  {
    id: "BN-10294",
    patientId: "BN-10294",
    patientName: "Trần Thị B",
    avatar: MOCK_PATIENTS[1].avatar,
    statusText: "Hoạt động 2 giờ trước",
    lastMessage: "Cảm ơn bác sĩ, thực đơn rất tốt.",
    lastMessageTime: "Hôm qua",
    messages: [
      {
        id: "m10",
        sender: "patient",
        text: "Cảm ơn bác sĩ, thực đơn tuần này tôi ăn thấy rất vừa miệng và không bị chướng bụng nữa.",
        time: "Hôm qua 16:40",
      },
      {
        id: "m11",
        sender: "doctor",
        text: "Rất tốt chị B. Hãy tiếp tục duy trì uống đủ nước và theo dõi chỉ số huyết áp hằng ngày nhé.",
        time: "Hôm qua 17:05",
      },
    ],
  },
  {
    id: "BN-10295",
    patientId: "BN-10295",
    patientName: "Lê Văn C",
    avatar: MOCK_PATIENTS[2].avatar,
    statusText: "Ngoại tuyến",
    lastMessage: "Tôi có thể ăn thêm trái cây không?",
    lastMessageTime: "T2",
    messages: [
      {
        id: "m20",
        sender: "patient",
        text: "Bác sĩ cho tôi hỏi buổi tối tôi có thể ăn thêm ổi hoặc dưa hấu không?",
        time: "Thứ Hai 19:15",
      },
      {
        id: "m21",
        sender: "doctor",
        text: "Chào anh C. Anh nên ưu tiên ổi (khoảng 1/2 quả), nên hạn chế dưa hấu vì lượng đường chỉ số GI khá cao đối với người bệnh Gout và đường huyết nhé.",
        time: "Thứ Hai 19:40",
      },
    ],
  },
];

export default function DoctorMessagesPage() {
  const [conversations, setConversations] = useState<ConversationThread[]>(initialConversations);
  const [activeConvId, setActiveConvId] = useState<string>("BN-10293");
  const [inputText, setInputText] = useState("");

  const activeConv =
    conversations.find((c) => c.id === activeConvId) || conversations[0];

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const newMsg: ChatMessage = {
      id: `m_${Date.now()}`,
      sender: "doctor",
      text: inputText.trim(),
      time: new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id === activeConvId) {
          return {
            ...conv,
            lastMessage: newMsg.text,
            lastMessageTime: newMsg.time,
            messages: [...conv.messages, newMsg],
          };
        }
        return conv;
      })
    );

    setInputText("");
  };

  return (
    <>
      <TopBar
        title="Tin nhắn"
        rightSlot={
          <div className="flex items-center gap-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-caption text-on-surface-variant hidden sm:inline">
              Bác sĩ Minh (Trực tuyến)
            </span>
          </div>
        }
      />

      <main className="flex-1 flex h-[calc(100vh-64px)] overflow-hidden bg-background">
        {/* Left Panel: Chat List (28% desktop) */}
        <div className="w-full md:w-1/4 border-r border-outline-variant bg-surface-bright flex flex-col h-full z-0">
          <div className="p-md border-b border-outline-variant bg-surface">
            <h3 className="font-body-bold text-body-bold text-on-surface font-semibold text-base">
              Danh sách hội thoại
            </h3>
            <p className="font-caption text-caption text-on-surface-variant text-xs mt-0.5">
              Hỗ trợ & tư vấn cho bệnh nhân
            </p>
          </div>

          <div className="flex flex-col flex-1 overflow-y-auto divide-y divide-outline-variant/30">
            {conversations.map((conv) => {
              const isActive = conv.id === activeConvId;
              return (
                <div
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`flex items-center gap-md p-md cursor-pointer transition-all ${
                    isActive
                      ? "bg-surface-container-low border-l-4 border-primary"
                      : "hover:bg-surface-container-low"
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={conv.avatar}
                      alt={conv.patientName}
                      className="w-11 h-11 rounded-full object-cover border border-outline-variant"
                    />
                    {conv.statusText.includes("Đang hoạt động") && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-body-bold text-body-bold text-on-surface font-semibold text-sm truncate">
                        {conv.patientName}
                      </span>
                      <span className="font-caption text-caption text-on-surface-variant text-xs shrink-0 ml-xs">
                        {conv.lastMessageTime}
                      </span>
                    </div>
                    <p className="font-caption text-caption text-on-surface-variant text-xs truncate">
                      {conv.lastMessage}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel: Chat Thread (72% desktop) */}
        <div className="flex-1 flex flex-col h-full bg-surface-lowest relative w-full md:w-3/4">
          {/* Chat Header */}
          <div className="h-14 px-lg border-b border-outline-variant bg-surface flex justify-between items-center shrink-0">
            <div className="flex items-center gap-sm">
              <img
                src={activeConv.avatar}
                alt={activeConv.patientName}
                className="w-9 h-9 rounded-full object-cover border border-outline-variant"
              />
              <div>
                <h2 className="font-h2 text-h2 text-on-surface font-semibold text-sm">
                  {activeConv.patientName}
                </h2>
                <div className="flex items-center gap-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="font-caption text-caption text-on-surface-variant text-xs">
                    {activeConv.statusText} • Mã BN: {activeConv.patientId}
                  </span>
                </div>
              </div>
            </div>

            <Link
              href={`/doctor/patients/${activeConv.patientId}`}
              className="text-xs text-primary font-body-bold hover:underline flex items-center gap-xs cursor-pointer border border-primary/40 px-sm py-xs rounded-lg hover:bg-primary-container/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">person</span>
              Hồ sơ bệnh nhân
            </Link>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-lg flex flex-col gap-md bg-surface">
            {/* Date Divider */}
            <div className="flex justify-center my-xs">
              <span className="font-caption text-caption text-on-surface-variant bg-surface-container px-md py-1 rounded-full text-xs font-medium">
                Hôm nay
              </span>
            </div>

            {activeConv.messages.map((msg) => {
              const isDoctor = msg.sender === "doctor";
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    isDoctor ? "items-end self-end max-w-[80%]" : "items-start max-w-[80%]"
                  }`}
                >
                  <div className="flex items-end gap-xs mb-0.5">
                    {!isDoctor && (
                      <img
                        src={activeConv.avatar}
                        alt={activeConv.patientName}
                        className="w-8 h-8 rounded-full object-cover shrink-0 mb-1"
                      />
                    )}
                    <div
                      className={`px-md py-sm rounded-2xl text-sm leading-relaxed ${
                        isDoctor
                          ? "bg-primary text-on-primary rounded-br-none shadow-xs font-medium"
                          : "bg-surface-container-high text-on-surface rounded-bl-none"
                      }`}
                    >
                      <p className="font-body text-body">{msg.text}</p>
                    </div>
                  </div>
                  <span className={`font-caption text-caption text-on-surface-variant text-[11px] ${isDoctor ? "mr-1" : "ml-9"}`}>
                    {msg.time}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Input Bar */}
          <div className="p-md bg-surface border-t border-outline-variant flex items-center gap-sm shrink-0">
            <button
              type="button"
              className="p-sm text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-surface-container cursor-pointer"
              title="Đính kèm tệp"
            >
              <span className="material-symbols-outlined">add_circle</span>
            </button>
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendMessage();
                }}
                placeholder="Nhập tin nhắn tư vấn cho bệnh nhân..."
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-2.5 font-body text-body text-on-surface text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <button
              type="button"
              onClick={handleSendMessage}
              className="bg-primary hover:bg-primary-container text-on-primary px-lg py-2.5 rounded-xl font-label text-label flex items-center gap-xs transition-all shadow-xs cursor-pointer active:scale-95 text-xs font-semibold"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              <span>Gửi</span>
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

