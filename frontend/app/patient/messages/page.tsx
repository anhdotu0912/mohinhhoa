/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  sender: "doctor" | "patient";
  text: string;
  time: string;
  avatar?: string;
}

export default function PatientMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "doctor",
      text: "Chào bạn, tôi đã xem qua nhật ký ăn uống ngày hôm qua của bạn. Lượng đường huyết sáng nay hơi cao (7.2 mmol/L). Bạn có ăn thêm gì sau bữa tối không?",
      time: "09:41 AM",
      avatar:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuCWctY0jrhIB7eg4Mw0V_aJZTcsnlqgVOobdHKVTuEsQtlZWP27yI-rZ89xN5iZj_Jm3XKywJM-iFjRxxYwIP-nH4v96UNy3Vjpr83M7guiUrRkBskY65C5H_HufOqfS9rxHZpNylTyJCcPLBZ6KWj1ZdKE4nHjjTCiXnWcFukJm_AKf0iX7uM5fXK5SghrqPhfMqON_AaU_h6YEp7xss57TWoJZAx_GjdInI3ReJynhHCtmCq4mrzB1A",
    },
    {
      id: "2",
      sender: "patient",
      text: "Dạ chào bác sĩ. Tối qua khoảng 9h em có ăn một nửa quả xoài chín vì thấy hơi đói ạ.",
      time: "09:45 AM",
    },
    {
      id: "3",
      sender: "doctor",
      text: "Xoài chín có chỉ số đường huyết khá cao (GI ~60) và chứa nhiều đường fructose. Việc ăn trái cây ngọt sát giờ ngủ là nguyên nhân chính khiến đường huyết sáng nay tăng.",
      time: "09:48 AM",
      avatar:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBxlOSXIU5P57P9jJtQ1V-QuYakvpL3WnKNwABHDifq_lNdYhGIT5No9JwwAR_6lhz_oEoIuT-p-FWaUnTR2Ou-a73jh5T4MAHO4KIWsDy4sVDiUYDxvnei4PIaVPontMItymDW8amgt3DyjVOIGWVYNj_rQaEjkJWXtNVqCdxbg9dJgv31j7DL4LhIPOAKla6EqqvLwuvO4DxCQSK48OPulnp0Ue7_CJczb6EJKOnvN6qWyYdXB7coog",
    },
    {
      id: "4",
      sender: "doctor",
      text: "Từ nay, nếu đói vào buổi tối, bạn nên đổi sang các loại hạt (hạnh nhân, óc chó) hoặc một ly sữa không đường nhỏ nhé. Cố gắng tránh trái cây sau 8h tối.",
      time: "09:48 AM",
      avatar:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBxlOSXIU5P57P9jJtQ1V-QuYakvpL3WnKNwABHDifq_lNdYhGIT5No9JwwAR_6lhz_oEoIuT-p-FWaUnTR2Ou-a73jh5T4MAHO4KIWsDy4sVDiUYDxvnei4PIaVPontMItymDW8amgt3DyjVOIGWVYNj_rQaEjkJWXtNVqCdxbg9dJgv31j7DL4LhIPOAKla6EqqvLwuvO4DxCQSK48OPulnp0Ue7_CJczb6EJKOnvN6qWyYdXB7coog",
    },
    {
      id: "5",
      sender: "patient",
      text: "Vâng thưa bác sĩ, em hiểu rồi ạ. Em sẽ chú ý hơn. Chiều nay em định đi bộ 30 phút như lịch trình, có cần điều chỉnh gì không ạ?",
      time: "09:55 AM",
    },
  ]);

  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      sender: "patient",
      text: inputMessage.trim(),
      time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputMessage("");

    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "doctor",
          text: "Rất tốt bạn nhé! Đi bộ 30 phút chiều nay sẽ giúp tiêu hao bớt năng lượng và cải thiện dung nạp glucose. Nhớ mang theo một ít nước lọc khi tập luyện.",
          time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          avatar:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuC9lCTnhb6crkPDfJQm40Bpy4jvPKJCwB0eBU1kSXSnet2uKVsPfmlTG5OjpF5d80gOt_N89tnFbzORbAPDU92jLxP1JwtCrRnc_YCj8v6uFnAyQha1cbetwvGdUDwWTqdjUDgNEE7qOFeYB_Te-9nPRQ_iHkO6JN9U8wsqfz3-aQ8UirV-AaO63s2kJQYnlOw01xQdlLlLGa59AZIISNS_k3rm9WmnLt4no2mxy34KhH06kFWPJWAEfg",
        },
      ]);
    }, 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* Chat Thread Canvas */}
      <div className="flex-1 overflow-y-auto chat-scroll p-md md:p-lg flex flex-col items-center">
        <div className="w-full max-w-[800px] flex flex-col gap-lg pb-xl">
          {/* Date Divider */}
          <div className="flex justify-center my-sm">
            <span className="bg-surface-container-high text-on-surface-variant font-caption text-caption px-md py-xs rounded-full">
              Hôm nay, 09:41 AM
            </span>
          </div>

          {/* Chat Messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-sm items-end ${
                msg.sender === "patient" ? "self-end max-w-[85%] md:max-w-[70%]" : "self-start max-w-[85%] md:max-w-[70%]"
              }`}
            >
              {msg.sender === "doctor" && (
                <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container-high shrink-0 mb-6">
                  <img
                    alt="Dr. Minh Avatar"
                    className="w-full h-full object-cover"
                    src={
                      msg.avatar ||
                      "https://lh3.googleusercontent.com/aida-public/AB6AXuCWctY0jrhIB7eg4Mw0V_aJZTcsnlqgVOobdHKVTuEsQtlZWP27yI-rZ89xN5iZj_Jm3XKywJM-iFjRxxYwIP-nH4v96UNy3Vjpr83M7guiUrRkBskY65C5H_HufOqfS9rxHZpNylTyJCcPLBZ6KWj1ZdKE4nHjjTCiXnWcFukJm_AKf0iX7uM5fXK5SghrqPhfMqON_AaU_h6YEp7xss57TWoJZAx_GjdInI3ReJynhHCtmCq4mrzB1A"
                    }
                  />
                </div>
              )}

              <div className={`flex flex-col gap-xs ${msg.sender === "patient" ? "items-end" : ""}`}>
                <div
                  className={`p-md rounded-lg shadow-sm relative ${
                    msg.sender === "patient"
                      ? "bg-primary text-on-primary font-body text-body rounded-br-none"
                      : "bg-surface-container-high text-on-surface font-body text-body rounded-bl-none border border-outline-variant"
                  }`}
                >
                  {msg.text}
                </div>
                <span
                  className={`font-caption text-caption text-on-surface-variant ${
                    msg.sender === "patient" ? "mr-1" : "ml-1"
                  }`}
                >
                  {msg.time}
                </span>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-sm items-end self-start max-w-[85%] md:max-w-[70%] mt-sm">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container-high shrink-0 mb-1">
                <img
                  alt="Dr. Minh Avatar"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9lCTnhb6crkPDfJQm40Bpy4jvPKJCwB0eBU1kSXSnet2uKVsPfmlTG5OjpF5d80gOt_N89tnFbzORbAPDU92jLxP1JwtCrRnc_YCj8v6uFnAyQha1cbetwvGdUDwWTqdjUDgNEE7qOFeYB_Te-9nPRQ_iHkO6JN9U8wsqfz3-aQ8UirV-AaO63s2kJQYnlOw01xQdlLlLGa59AZIISNS_k3rm9WmnLt4no2mxy34KhH06kFWPJWAEfg"
                />
              </div>
              <div className="flex flex-col gap-xs">
                <div className="bg-surface-container-high p-md rounded-lg rounded-bl-none border border-outline-variant shadow-sm flex items-center gap-1 h-[44px]">
                  <div className="w-2 h-2 bg-outline rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                  <div className="w-2 h-2 bg-outline rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                  <div className="w-2 h-2 bg-outline rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Area (Fixed Bottom) */}
      <div className="p-md md:px-lg bg-surface-container-lowest border-t border-outline-variant shrink-0 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
        <div className="w-full max-w-[800px] mx-auto flex items-center gap-sm">
          {/* Attachment Button */}
          <button className="p-sm text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded-full transition-colors cursor-pointer shrink-0">
            <span className="material-symbols-outlined text-[24px]">attach_file</span>
          </button>

          {/* Input Box */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSendMessage();
              }}
              className="w-full bg-surface text-on-surface font-body text-body placeholder:text-on-surface-variant/70 border border-outline-variant rounded-lg py-sm px-md pr-10 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow h-10"
              placeholder="Nhập tin nhắn..."
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-xs text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[20px]">mic</span>
            </button>
          </div>

          {/* Send Button */}
          <button
            onClick={handleSendMessage}
            className="w-10 h-10 bg-primary text-on-primary rounded-lg flex items-center justify-center hover:bg-primary-container transition-colors shadow-sm shrink-0 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
