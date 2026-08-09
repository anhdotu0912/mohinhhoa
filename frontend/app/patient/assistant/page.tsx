/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  sender: "ai" | "user";
  text: string;
  thoughts?: string[];
  recommendations?: string[];
  reference?: string;
}

export default function PatientAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "user",
      text: "Gợi ý giúp tôi một bữa tối nhẹ nhàng, ít muối và không có thịt đỏ nhé.",
    },
    {
      id: "2",
      sender: "ai",
      text: "Dựa trên hồ sơ sức khỏe của bạn (cần kiểm soát huyết áp) và yêu cầu bữa tối, tôi gợi ý thực đơn sau:",
      thoughts: [
        "Phân tích hồ sơ: Bệnh nhân nam, 55 tuổi, tiền sử tăng huyết áp.",
        "Truy vấn CSDL: Tìm món ăn < 500mg Na, protein từ thực vật/cá.",
        "Kiểm tra ràng buộc: Loại trừ thịt đỏ, đảm bảo calo ~400kcal.",
        "Tổng hợp: Đề xuất 3 món phù hợp.",
      ],
      recommendations: [
        "Cá hồi áp chảo sốt chanh dây: Khoảng 150g cá hồi, áp chảo với chút dầu oliu. Sốt chanh dây chua ngọt tự nhiên, không cần thêm muối.",
        "Salad cải bó xôi và cà chua bi: Trộn với dầu giấm, cung cấp nhiều kali giúp cân bằng natri.",
        "Nửa bát cơm gạo lứt: Cung cấp chất xơ hòa tan.",
      ],
      reference: "CSDL Thành phần Thực phẩm Việt Nam & Hướng dẫn điều trị Tăng huyết áp",
    },
  ]);

  const [inputQuery, setInputQuery] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showReferences, setShowReferences] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sampleQuestions = [
    { text: "Gợi ý thực đơn giảm muối cho hôm nay", icon: "restaurant" },
    { text: "Món nào phù hợp với người tiểu đường?", icon: "medical_services" },
    { text: "Giải thích vì sao tôi cần giảm đạm", icon: "science" },
    { text: "Thực đơn tuần này của tôi có gì?", icon: "calendar_month" },
  ];

  const autocompleteChips = [
    "Cách làm sốt chanh dây?",
    "Đổi cá hồi thành ức gà được không?",
    "Gợi ý đồ uống kèm theo",
  ];

  const handleSend = (textToSend?: string) => {
    const query = textToSend || inputQuery;
    if (!query.trim()) return;

    const newMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: query.trim(),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputQuery("");

    // Simulate AI response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: `Cảm ơn bạn đã hỏi về "${query}". Hệ thống NutriAI đã ghi nhận yêu cầu và sẽ gợi ý thực đơn đáp ứng đúng phác đồ dinh dưỡng y khoa của bạn.`,
          thoughts: [
            "Phân tích yêu cầu bổ sung từ bệnh nhân.",
            "Tra cứu chỉ số Dinh dưỡng & Khuyến nghị Lâm sàng.",
          ],
        },
      ]);
    }, 1000);
  };

  return (
    <div className="flex-1 flex h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* Column 1: Lịch sử trò chuyện (Left Panel - 240px) */}
      {showHistory && (
        <div className="w-[240px] flex-shrink-0 bg-surface-container-lowest border-r border-outline-variant flex flex-col animate-fadeIn transition-all duration-300">
          <div className="p-md flex items-center justify-between border-b border-outline-variant/40">
            <span className="font-h2 text-h2 text-on-surface font-semibold text-sm">Lịch sử chat</span>
            <button
              onClick={() => setShowHistory(false)}
              className="text-on-surface-variant hover:text-primary p-1 rounded-md hover:bg-surface-container-low transition-colors"
              title="Ẩn lịch sử"
            >
              <span className="material-symbols-outlined text-[18px]">first_page</span>
            </button>
          </div>
          <div className="p-md pt-xs">
            <button
              onClick={() => setMessages([])}
              className="w-full bg-surface-container-lowest border border-primary text-primary font-body-bold rounded-lg py-sm px-md flex items-center justify-center gap-sm hover:bg-surface-container-low transition-colors shadow-xs text-xs"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Cuộc trò chuyện mới
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-sm pb-md flex flex-col gap-sm">
            <div className="px-sm py-xs">
              <span className="font-label text-label text-on-surface-variant uppercase text-[11px] font-semibold tracking-wider">
                GẦN ĐÂY
              </span>
            </div>
            <button className="w-full text-left p-sm rounded-lg bg-surface-container-low border-l-2 border-primary group transition-all">
              <p className="font-body-bold text-on-surface truncate text-sm font-semibold">
                Thực đơn giảm muối cho tuần này
              </p>
              <p className="font-caption text-caption text-on-surface-variant truncate mt-xs group-hover:text-primary transition-colors text-xs">
                Hôm nay, 14:30
              </p>
            </button>
            <button className="w-full text-left p-sm rounded-lg hover:bg-surface-container-high transition-colors">
              <p className="font-body text-on-surface truncate text-sm">Phân tích chỉ số huyết áp ngày 12/05</p>
              <p className="font-caption text-caption text-on-surface-variant truncate mt-xs text-xs">
                Hôm qua, 09:15
              </p>
            </button>

            <div className="px-sm py-xs mt-md">
              <span className="font-label text-label text-on-surface-variant uppercase text-[11px] font-semibold tracking-wider">
                TRƯỚC ĐÓ
              </span>
            </div>
            <button className="w-full text-left p-sm rounded-lg hover:bg-surface-container-high transition-colors">
              <p className="font-body text-on-surface truncate text-sm">Lượng đạm phù hợp cho bữa tối</p>
              <p className="font-caption text-caption text-on-surface-variant truncate mt-xs text-xs">
                3 ngày trước
              </p>
            </button>
            <button className="w-full text-left p-sm rounded-lg hover:bg-surface-container-high transition-colors">
              <p className="font-body text-on-surface truncate text-sm">Giải thích kết quả xét nghiệm sinh hóa</p>
              <p className="font-caption text-caption text-on-surface-variant truncate mt-xs text-xs">
                5 ngày trước
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Column 2: Main Chat Thread Container */}
      <div className="flex-1 bg-background flex flex-col h-full overflow-hidden relative">
        {/* Toggle Control Bar */}
        <div className="bg-surface-container-lowest/90 backdrop-blur-md border-b border-outline-variant/60 px-md py-xs flex justify-between items-center z-10 shrink-0 shadow-xs">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-1.5 px-sm py-1 rounded-md text-xs font-medium transition-all ${
              showHistory
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low border border-outline-variant"
            }`}
            title={showHistory ? "Ẩn lịch sử trò chuyện" : "Hiện lịch sử trò chuyện"}
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
            <span>{showHistory ? "Ẩn lịch sử" : "Hiện lịch sử"}</span>
          </button>

          <div className="text-xs text-on-surface-variant font-medium hidden sm:block">
            Phân tích y khoa & Tư vấn Dinh dưỡng Cá nhân
          </div>

          <button
            onClick={() => setShowReferences(!showReferences)}
            className={`flex items-center gap-1.5 px-sm py-1 rounded-md text-xs font-medium transition-all ${
              showReferences
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low border border-outline-variant"
            }`}
            title={showReferences ? "Ẩn tài liệu tham khảo" : "Hiện tài liệu tham khảo"}
          >
            <span className="material-symbols-outlined text-[16px]">library_books</span>
            <span>{showReferences ? "Ẩn tham khảo" : "Hiện tham khảo"}</span>
          </button>
        </div>

        {/* Scrollable Chat Area */}
        <div className="flex-1 overflow-y-auto p-lg flex flex-col gap-xl scroll-smooth">
          {/* AI Welcome Header */}
          <div className="flex flex-col items-center justify-center mt-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center mb-md shadow-sm border border-outline-variant/30">
              <span className="material-symbols-outlined text-[32px] text-on-primary-container">smart_toy</span>
            </div>
            <h3 className="font-h2 text-h2 text-on-surface mb-sm font-bold text-xl">
              Xin chào, tôi có thể giúp gì cho bạn?
            </h3>
            <p className="font-body text-body text-on-surface-variant text-center max-w-md text-sm">
              Tôi là Trợ lý AI NutriAI, chuyên gia tư vấn dinh dưỡng cá nhân của bạn.
            </p>

            {/* Sample Questions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-sm mt-lg w-full max-w-2xl">
              {sampleQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(q.text)}
                  className="p-sm bg-surface-container-lowest border border-outline-variant rounded-xl text-left hover:border-primary hover:bg-surface-container-low transition-colors shadow-sm flex items-start gap-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-primary mt-[2px] text-[18px]">
                    {q.icon}
                  </span>
                  <span className="font-body text-body text-on-surface text-sm">{q.text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Messages */}
          {messages.map((msg) =>
            msg.sender === "user" ? (
              <div key={msg.id} className="flex justify-end w-full">
                <div className="max-w-[75%] bg-primary text-on-primary rounded-2xl rounded-tr-sm p-md shadow-sm">
                  <p className="font-body text-body">{msg.text}</p>
                </div>
              </div>
            ) : (
              <div key={msg.id} className="flex gap-md w-full max-w-[85%]">
                <div className="w-8 h-8 rounded-full bg-primary-container flex-shrink-0 flex items-center justify-center mt-1 border border-outline-variant/30">
                  <span className="material-symbols-outlined text-[18px] text-on-primary-container">
                    smart_toy
                  </span>
                </div>
                <div className="flex flex-col gap-sm w-full">
                  {/* Agent Thought Process Accordion */}
                  {msg.thoughts && msg.thoughts.length > 0 && (
                    <details className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden group">
                      <summary className="p-sm px-md flex items-center justify-between cursor-pointer hover:bg-surface-container-high transition-colors list-none">
                        <div className="flex items-center gap-sm">
                          <span className="material-symbols-outlined text-[16px] text-on-surface-variant group-open:animate-pulse">
                            psychology
                          </span>
                          <span className="font-label text-label text-on-surface-variant font-semibold text-xs">
                            Luồng tư duy của Agent
                          </span>
                        </div>
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant group-open:rotate-180 transition-transform">
                          expand_more
                        </span>
                      </summary>
                      <div className="p-md pt-0 border-t border-outline-variant/50">
                        <div className="flex flex-col gap-sm relative mt-sm pl-sm border-l-2 border-outline-variant/30">
                          {msg.thoughts.map((thought, tIdx) => (
                            <div key={tIdx} className="relative pl-md">
                              <div className="absolute left-[-21px] top-1 w-2 h-2 rounded-full bg-primary"></div>
                              <p className="font-mono text-[11px] text-on-surface-variant">{thought}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </details>
                  )}

                  {/* AI Message Bubble */}
                  <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl rounded-tl-sm p-md shadow-sm">
                    <p className="font-body text-body text-on-surface mb-sm">{msg.text}</p>
                    {msg.recommendations && (
                      <ul className="list-disc pl-md font-body text-body text-on-surface flex flex-col gap-xs mb-sm">
                        {msg.recommendations.map((rec, rIdx) => (
                          <li key={rIdx}>
                            <strong>{rec.split(":")[0]}:</strong>
                            {rec.split(":")[1]}
                          </li>
                        ))}
                      </ul>
                    )}
                    {msg.reference && (
                      <button
                        onClick={() => setShowReferences(true)}
                        className="inline-flex items-center gap-xs px-sm py-xs bg-surface-container-low border border-outline-variant rounded-lg hover:border-primary transition-colors text-on-surface-variant hover:text-primary mt-2 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">description</span>
                        <span className="font-caption text-caption font-medium text-xs">
                          📄 Xem tài liệu tham khảo: {msg.reference}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
          {/* Scroll Anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area (Fixed Bottom) */}
        <div className="p-md bg-background border-t border-outline-variant shrink-0 relative">
          {/* Autocomplete Chips */}
          <div className="flex gap-sm mb-sm overflow-x-auto absolute top-[-40px] left-0 w-full px-md">
            {autocompleteChips.map((chip, cIdx) => (
              <button
                key={cIdx}
                onClick={() => handleSend(chip)}
                className="whitespace-nowrap px-sm py-xs bg-surface-container-lowest border border-outline-variant rounded-full font-caption text-caption text-on-surface-variant hover:bg-surface-container-low shadow-sm text-xs cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="relative bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all flex items-end p-xs">
            <button className="p-sm text-on-surface-variant hover:text-primary transition-colors mb-[2px]">
              <span className="material-symbols-outlined text-[20px]">attach_file</span>
            </button>
            <textarea
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="flex-1 bg-transparent border-none focus:ring-0 resize-none font-body text-body text-on-surface p-sm min-h-[40px] max-h-[120px] focus:outline-none"
              placeholder="Nhập câu hỏi của bạn..."
              rows={1}
            />
            <button
              onClick={() => handleSend()}
              className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center hover:bg-primary-container transition-colors shrink-0 mb-[2px] mr-[2px] cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">send</span>
            </button>
          </div>
        </div>
      </div>

      {/* Column 3: Tài liệu tham khảo Panel (Right Panel - 320px) */}
      {showReferences && (
        <div className="w-[320px] flex-shrink-0 bg-surface-container-lowest border-l border-outline-variant flex flex-col animate-fadeIn transition-all duration-300">
          <div className="p-md border-b border-outline-variant/50 flex items-center justify-between">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-primary text-[20px]">library_books</span>
              <h3 className="font-h2 text-h2 text-on-surface font-semibold text-base">Tài liệu tham khảo</h3>
            </div>
            <button
              onClick={() => setShowReferences(false)}
              className="text-on-surface-variant hover:text-primary p-1 rounded-md hover:bg-surface-container-low transition-colors"
              title="Ẩn tham khảo"
            >
              <span className="material-symbols-outlined text-[18px]">last_page</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-md flex flex-col gap-md bg-surface/50">
            <p className="font-caption text-caption text-on-surface-variant text-xs mb-xs">
              Các nguồn dữ liệu được sử dụng để tạo ra câu trả lời bên cạnh.
            </p>

            {/* Source Card 1 */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex justify-between items-start mb-sm">
                <div className="flex items-center gap-xs text-primary bg-primary/10 px-xs py-[2px] rounded text-[10px] font-bold">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  ĐỘ LIÊN QUAN: CAO
                </div>
                <span className="material-symbols-outlined text-on-surface-variant text-[18px]">open_in_new</span>
              </div>
              <h4 className="font-body-bold text-body-bold text-on-surface mb-xs flex items-start gap-xs font-semibold text-sm">
                <span className="material-symbols-outlined text-[18px] text-primary mt-[2px] shrink-0">
                  article
                </span>
                CSDL Thành phần Thực phẩm Việt Nam
              </h4>
              <p className="font-caption text-caption text-on-surface-variant line-clamp-3 text-xs">
                Viện Dinh dưỡng Quốc gia. Bảng thành phần thực phẩm Việt Nam (2007). Hàm lượng Natri trong 100g cá hồi tươi, các loại rau củ...
              </p>
            </div>

            {/* Source Card 2 */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex justify-between items-start mb-sm">
                <div className="flex items-center gap-xs text-on-surface-variant bg-surface-container-high px-xs py-[2px] rounded text-[10px] font-bold">
                  <span className="material-symbols-outlined text-[14px]">info</span>
                  ĐỘ LIÊN QUAN: TRUNG BÌNH
                </div>
              </div>
              <h4 className="font-body-bold text-body-bold text-on-surface mb-xs flex items-start gap-xs font-semibold text-sm">
                <span className="material-symbols-outlined text-[18px] text-secondary mt-[2px] shrink-0">
                  book
                </span>
                Hướng dẫn điều trị Tăng huyết áp
              </h4>
              <p className="font-caption text-caption text-on-surface-variant line-clamp-3 text-xs">
                Bộ Y tế (2022). Hướng dẫn chẩn đoán và điều trị tăng huyết áp. Khuyến nghị chế độ ăn DASH, giảm muối &lt; 5g/ngày...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
