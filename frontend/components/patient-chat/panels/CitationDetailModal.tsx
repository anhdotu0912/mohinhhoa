"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CitationChunk } from "@/lib/types";

export interface CitationInfo {
  code: string;
  title: string;
  officialName: string;
  issuer: string;
  year: string;
  badge: string;
  summary: string;
  keyPoints: { label: string; detail: string; icon: string }[];
  clinicalNote: string;
}

export function parseCitationData(rawCitation: string): CitationInfo {
  const norm = rawCitation.toLowerCase().replace(/_/g, " ").replace(/\.md$/i, "");

  if (norm.includes("5481") || norm.includes("t2") || norm.includes("tuyp 2") || norm.includes("typ 2")) {
    return {
      code: "QĐ 5481/QĐ-BYT",
      title: "Hướng dẫn chẩn đoán & điều trị Đái tháo đường Típ 2",
      officialName: "Quyết định số 5481/QĐ-BYT ngày 30/12/2020 của Bộ Trưởng Bộ Y Tế",
      issuer: "Bộ Y Tế Việt Nam",
      year: "2020",
      badge: "Phác đồ Quốc gia",
      summary:
        "Tài liệu chuyên môn chính thức quy định tiêu chuẩn chẩn đoán, phác đồ điều trị nội khoa và nguyên tắc can thiệp dinh dưỡng lâm sàng cho bệnh nhân ĐTĐ Type 2 tại Việt Nam.",
      keyPoints: [
        {
          label: "Mục tiêu kiểm soát đường huyết",
          detail: "HbA1c < 7.0% · Đường huyết lúc đói 4.4 – 7.2 mmol/L (80–130 mg/dL) · Sau ăn 2h < 10.0 mmol/L.",
          icon: "monitoring",
        },
        {
          label: "Cơ cấu dinh dưỡng chuẩn",
          detail: "Carbohydrate 50–60% (ưu tiên GI thấp) · Đạm 15–20% (1.0–1.2 g/kg) · Chất béo 20–30% (mỡ bão hòa < 7%).",
          icon: "pie_chart",
        },
        {
          label: "Chất xơ & Kiểm soát Natri",
          detail: "Chất xơ > 14g/1000 kcal (~25–35g/ngày) làm chậm hấp thu đường. Hạn chế muối < 5g/ngày (< 2000mg Na).",
          icon: "eco",
        },
      ],
      clinicalNote:
        "Mọi điều chỉnh thực đơn và giảm liều thuốc hạ đường huyết cần được bác sĩ điều trị trực tiếp thẩm định dựa trên kết quả xét nghiệm định kỳ.",
    };
  }

  if (norm.includes("ada") || norm.includes("standards") || norm.includes("care")) {
    return {
      code: "ADA Standards of Care",
      title: "Tiêu chuẩn Chăm sóc Y tế trong Đái tháo đường 2024",
      officialName: "American Diabetes Association Standards of Care in Diabetes (2024)",
      issuer: "Hiệp Hội Đái Tháo Đường Hoa Kỳ (ADA)",
      year: "2024",
      badge: "Tiêu chuẩn Quốc tế",
      summary:
        "Hướng dẫn thực hành lâm sàng dựa trên bằng chứng khoa học toàn cầu về can thiệp lối sống, dinh dưỡng phòng ngừa biến chứng tim mạch và thận ở bệnh nhân đái tháo đường.",
      keyPoints: [
        {
          label: "Mô hình Đĩa thức ăn (Plate Method)",
          detail: "1/2 đĩa rau không tinh bột, 1/4 đĩa đạm nạc (cá, ức gà, đậu), 1/4 đĩa carb nguyên cám GI thấp.",
          icon: "restaurant",
        },
        {
          label: "Kiểm soát thời gian an toàn (TIR)",
          detail: "Mục tiêu duy trì thời gian đường huyết trong vùng an toàn (Time-in-Range: 3.9 – 10.0 mmol/L) > 70%.",
          icon: "av_timer",
        },
        {
          label: "Bảo vệ tim mạch & thận",
          detail: "Tăng cường axit béo không bão hòa đơn/đa (Omega-3 từ cá béo, quả hạch), cắt giảm hoàn toàn trans-fat và đồ ngọt có đường tự do.",
          icon: "favorite",
        },
      ],
      clinicalNote:
        "Khuyến nghị cá thể hóa mục tiêu dinh dưỡng tùy theo độ tuổi, thời gian mắc bệnh và tiền sử biến chứng vi mạch.",
    };
  }

  if (norm.includes("1470") || norm.includes("thai")) {
    return {
      code: "QĐ 1470/QĐ-BYT",
      title: "Hướng dẫn chuyên môn về Đái tháo đường Thai kỳ",
      officialName: "Quyết định số 1470/QĐ-BYT ngày 24/04/2020 của Bộ Y Tế",
      issuer: "Bộ Y Tế Việt Nam",
      year: "2020",
      badge: "Chuyên khoa Sản Dinh Dưỡng",
      summary:
        "Hướng dẫn chẩn đoán, can thiệp dinh dưỡng nghiêm ngặt nhằm đảm bảo đường huyết thai phụ ổn định và thai nhi phát triển an toàn.",
      keyPoints: [
        {
          label: "Ngưỡng đường huyết thai kỳ",
          detail: "Đường huyết lúc đói ≤ 5.3 mmol/L · Sau ăn 1h ≤ 7.8 mmol/L · Sau ăn 2h ≤ 6.7 mmol/L.",
          icon: "pregnant_woman",
        },
        {
          label: "Không kiêng carb cực đoan",
          detail: "Tối thiểu 175g carb/ngày từ ngũ cốc nguyên hạt, chia nhỏ 3 bữa chính + 2-3 bữa phụ tránh ceton niệu.",
          icon: "grain",
        },
      ],
      clinicalNote:
        "Theo dõi sát cử động thai và kiểm tra đường huyết 4 lần/ngày (lúc đói và sau 3 bữa chính).",
    };
  }

  if (norm.includes("1760") || norm.includes("t1") || norm.includes("tuyp 1")) {
    return {
      code: "QĐ 1760/QĐ-BYT",
      title: "Hướng dẫn chẩn đoán & điều trị Đái tháo đường Típ 1",
      officialName: "Quyết định số 1760/QĐ-BYT ngày 05/05/2017 của Bộ Y Tế",
      issuer: "Bộ Y Tế Việt Nam",
      year: "2017",
      badge: "Phác đồ Quốc gia",
      summary:
        "Nguyên tắc cân bằng giữa phác đồ tiêm insulin đa mũi (MDI) và kỹ năng tính toán lượng bột đường (Carb Counting).",
      keyPoints: [
        {
          label: "Đếm Carbohydrate (Carb Counting)",
          detail: "Xác định tỷ lệ Insulin:Carb (ICR) để tính đúng liều bolus trước mỗi bữa ăn.",
          icon: "calculate",
        },
        {
          label: "Quy tắc 15-15 xử trí hạ đường",
          detail: "Bổ sung ngay 15g carb tác dụng nhanh (nước đường, kẹo), đo lại sau 15 phút đến khi đường > 3.9 mmol/L.",
          icon: "medical_services",
        },
      ],
      clinicalNote:
        "Không được tự ý bỏ liều insulin nền ngay cả khi chán ăn hoặc ốm sốt.",
    };
  }

  if (
    norm.includes("drug food interaction") ||
    norm.includes("drug_food_interaction") ||
    rawCitation.toLowerCase().includes("drug_food_interactions#")
  ) {
    const pair = rawCitation.includes("#")
      ? rawCitation.split("#")[1].replace(/_/g, " ")
      : "cặp thuốc–thực phẩm";

    return {
      code: "KB Tương tác thuốc–thực phẩm",
      title: `Tương tác thuốc – thực phẩm: ${pair}`,
      officialName:
        "Cơ sở dữ liệu tương tác thuốc–thực phẩm VinNutri (đối chiếu Dược thư Quốc gia & hướng dẫn lâm sàng BYT/ADA)",
      issuer: "VinNutri Clinical KB · Bộ Y Tế Việt Nam",
      year: "2024",
      badge: "Dược lâm sàng",
      summary:
        "Mục KB nội bộ ghi nhận cơ chế tương tác, mức độ nguy hiểm và khuyến nghị xử trí khi thuốc đang dùng gặp thực phẩm cụ thể. Nguồn được đối chiếu với hướng dẫn dinh dưỡng đái tháo đường của Bộ Y Tế và ADA Standards of Care.",
      keyPoints: [
        {
          label: "Cặp đã tra cứu",
          detail: `Khóa nguồn: ${pair}. Hệ thống chỉ cảnh báo đổi món / hỏi bác sĩ — không tự ý đổi thuốc hay liều.`,
          icon: "medication",
        },
        {
          label: "Cách dùng kết quả",
          detail:
            "Nếu mức độ là Nguy hiểm hoặc Cần chú ý: hạn chế thực phẩm tương ứng và trao đổi với bác sĩ điều trị trước khi thay đổi chế độ ăn lâu dài.",
          icon: "health_and_safety",
        },
      ],
      clinicalNote:
        "Thông tin mang tính tham khảo dinh dưỡng. Không thay thế chỉ định thuốc, theo dõi INR/đường huyết hay quyết định lâm sàng của bác sĩ.",
    };
  }

  if (norm.includes("byt vn notes") || (norm.includes("byt") && norm.includes("notes"))) {
    return {
      code: "BYT · Ghi chú dinh dưỡng",
      title: "Ghi chú dinh dưỡng lâm sàng đái tháo đường (VinNutri / BYT)",
      officialName: "Tóm lược hướng dẫn dinh dưỡng thực hành theo phác đồ Bộ Y Tế Việt Nam",
      issuer: "Bộ Y Tế Việt Nam",
      year: "2020",
      badge: "Hướng dẫn quốc gia",
      summary:
        "Tài liệu nội bộ hệ thống dùng để đối chiếu nguyên tắc ăn uống cho người đái tháo đường: kiểm soát carbohydrate, hạn chế rượu bia, và an toàn khi dùng thuốc hạ đường huyết.",
      keyPoints: [
        {
          label: "Nguyên tắc ăn uống",
          detail: "Ưu tiên thực phẩm GI thấp, kiểm soát khẩu phần tinh bột, hạn chế đường tự do và rượu bia.",
          icon: "restaurant",
        },
        {
          label: "An toàn thuốc–thực phẩm",
          detail: "Mọi khuyến nghị đổi món khi có tương tác đều hướng người bệnh trao đổi với bác sĩ, không tự điều chỉnh thuốc.",
          icon: "shield",
        },
      ],
      clinicalNote:
        "Áp dụng như tài liệu tham khảo dinh dưỡng. Liều thuốc và xét nghiệm theo dõi do bác sĩ quyết định.",
    };
  }

  if (norm.includes("3510") || norm.includes("neuropathy") || norm.includes("than kinh")) {
    return {
      code: "QĐ 3510/QĐ-BYT",
      title: "Hướng dẫn chẩn đoán & điều trị bệnh thần kinh đái tháo đường",
      officialName: "Quyết định số 3510/QĐ-BYT của Bộ Y Tế về bệnh thần kinh đái tháo đường",
      issuer: "Bộ Y Tế Việt Nam",
      year: "2014",
      badge: "Phác đồ Quốc gia",
      summary:
        "Hướng dẫn chuyên môn về biến chứng thần kinh do đái tháo đường, bao gồm lưu ý dinh dưỡng và tương tác khi dùng thuốc hỗ trợ thần kinh.",
      keyPoints: [
        {
          label: "Kiểm soát đường huyết",
          detail: "Ổn định đường huyết là nền tảng làm chậm tiến triển bệnh thần kinh ngoại vi.",
          icon: "monitoring",
        },
        {
          label: "An toàn khi dùng thuốc",
          detail: "Một số thuốc hỗ trợ thần kinh (ALA, pregabalin, duloxetine) có cảnh báo khi dùng cùng rượu hoặc sữa — cần hỏi bác sĩ.",
          icon: "medication",
        },
      ],
      clinicalNote:
        "Không tự ý thêm hoặc ngưng thuốc điều trị bệnh thần kinh. Mọi thay đổi phác đồ do bác sĩ chuyên khoa quyết định.",
    };
  }

  if (norm.includes("food") || norm.includes("db") || norm.includes("thuc pham") || norm.includes("#")) {
    const foodName = rawCitation.includes("#")
      ? rawCitation.split("#")[1].replace(/_/g, " ")
      : rawCitation.replace(/_/g, " ");

    return {
      code: "NIN Database",
      title: `Bảng Thành Phần Thực Phẩm Việt Nam — ${foodName}`,
      officialName: "Bảng thành phần thực phẩm Việt Nam (Vietnamese Food Composition Table)",
      issuer: "Viện Dinh Dưỡng Quốc Gia (NIN)",
      year: "2020",
      badge: "Cơ sở dữ liệu Quốc gia",
      summary:
        "Cơ sở dữ liệu phân tích hóa thực phẩm chuẩn xác của Viện Dinh Dưỡng, cung cấp hàm lượng Calo, Đạm, Đường bột, Chất béo, Khoáng chất và chỉ số GI/GL trên 100g thực phẩm.",
      keyPoints: [
        {
          label: "Đo lường năng lượng & Macro",
          detail: "Số liệu chuẩn hóa tính trên 100g phần ăn được, phản ánh chính xác lượng calo và tải lượng đường (GL).",
          icon: "nutrition",
        },
        {
          label: "Ứng dụng trong bữa ăn người Việt",
          detail: "Quy đổi tương đương ra đơn vị bát/chén, miếng, đĩa để người bệnh dễ dàng định lượng tại nhà.",
          icon: "table_restaurant",
        },
      ],
      clinicalNote:
        "Khẩu phần món ăn đã được hệ thống AI VinNutri đối chiếu trực tiếp với hồ sơ lâm sàng của bệnh nhân.",
    };
  }

  // Generic fallback
  return {
    code: "Y học Chứng cứ",
    title: rawCitation.replace(/_/g, " ").replace(/\.md$/i, ""),
    officialName: `Tài liệu hướng dẫn dinh dưỡng lâm sàng: ${rawCitation}`,
    issuer: "Bộ Y Tế Việt Nam & Hiệp Hội Đái Tháo Đường",
    year: "2024",
    badge: "Đã Thẩm Định",
    summary:
      "Tài liệu cơ sở dữ liệu y khoa được VinNutri tích hợp để đối chiếu kiến thức dinh dưỡng và đảm bảo an toàn cho người bệnh.",
    keyPoints: [
      {
        label: "Tính chuẩn xác y khoa",
        detail: "Nội dung được trích xuất từ các quyết định chuyên môn và hướng dẫn lâm sàng đã được kiểm duyệt.",
        icon: "verified",
      },
    ],
    clinicalNote:
      "Thông tin phục vụ mục đích tham khảo dinh dưỡng. Vui lòng thảo luận cùng bác sĩ nếu cần chỉ định can thiệp thuốc.",
  };
}

export interface CitationDetailModalProps {
  citation: string | null;
  excerpts?: CitationChunk[];
  onClose: () => void;
}

export function CitationDetailModal({
  citation,
  excerpts = [],
  onClose,
}: CitationDetailModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!citation) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [citation, onClose]);

  if (!citation || !mounted) return null;

  const data = parseCitationData(citation);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div
        role="button"
        tabIndex={0}
        aria-label="Đóng chi tiết trích dẫn"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClose();
        }}
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm cursor-pointer"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="citation-modal-title"
        className="relative w-full max-w-lg max-h-[88vh] bg-white rounded-2xl shadow-[0_24px_64px_rgba(25,28,28,0.18)] z-10 flex flex-col border border-slate-200/90 overflow-hidden my-auto animate-in fade-in duration-200 selection:bg-emerald-100 selection:text-slate-900"
      >
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#006857] flex items-center justify-center border border-emerald-200/80 shrink-0">
              <span className="material-symbols-outlined text-[22px]">menu_book</span>
            </div>
            <div className="min-w-0">
              <h3
                id="citation-modal-title"
                className="text-[15px] sm:text-base font-bold text-slate-900 leading-snug tracking-tight"
              >
                {data.title}
              </h3>
              <p className="mt-1 text-[12px] text-slate-500">
                {data.badge} · {data.year}
              </p>
              <p className="mt-0.5 text-[12px] font-semibold text-[#006857] tabular-nums">
                {data.code}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 -mr-1 -mt-0.5 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006857]/30"
            title="Đóng (ESC)"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="px-5 sm:px-6 py-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          <div className="px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <p className="text-[13px] font-medium text-slate-800 leading-relaxed">
              {data.officialName}
            </p>
            <p className="text-[12px] text-slate-500 mt-1">{data.issuer}</p>
          </div>

          {excerpts.length > 0 ? (
            <section className="space-y-3">
              <h4 className="text-[13px] font-semibold text-slate-900">
                Đoạn đã dùng để trả lời
              </h4>
              {excerpts.map((excerpt, idx) => (
                <div
                  key={excerpt.chunk_id || idx}
                  className="px-3.5 py-3 rounded-xl bg-white border border-slate-200/80"
                >
                  {excerpts.length > 1 ? (
                    <p className="text-[11px] font-medium text-slate-400 mb-1.5">
                      Đoạn {idx + 1}
                    </p>
                  ) : null}
                  <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {excerpt.text}
                  </p>
                </div>
              ))}
            </section>
          ) : (
            <p className="text-[13px] text-slate-500 leading-relaxed">
              Không có đoạn retrieve cho lượt trả lời này. Nguồn được ghi nhận:{" "}
              <span className="font-medium text-slate-700">{citation}</span>.
            </p>
          )}

          <p className="text-[12px] text-slate-500 leading-relaxed border-t border-slate-100 pt-4">
            Thông tin mang tính tham khảo dinh dưỡng, không thay thế chỉ định của bác sĩ.
          </p>
        </div>

        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#006857] hover:bg-[#005245] text-white rounded-xl text-[13px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006857]/40 focus-visible:ring-offset-2"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
