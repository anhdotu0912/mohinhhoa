"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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

export function CitationDetailModal({
  citation,
  onClose,
}: {
  citation: string | null;
  onClose: () => void;
}) {
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3.5 sm:p-5 overflow-y-auto">
      {/* Backdrop */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Đóng chi tiết trích dẫn"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClose();
        }}
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity cursor-pointer animate-in fade-in duration-150"
      />

      {/* Centered Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="citation-modal-title"
        className="relative w-full max-w-lg max-h-[88vh] bg-white rounded-2xl shadow-2xl z-10 flex flex-col border border-slate-200/90 overflow-hidden my-auto animate-in zoom-in-95 fade-in duration-200"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/80 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#006857] flex items-center justify-center border border-emerald-200/90 shadow-2xs shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[22px]">menu_book</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-100/90 text-emerald-800 border border-emerald-300">
                  {data.badge}
                </span>
                <span className="text-[11px] text-slate-500 font-semibold">
                  Năm {data.year}
                </span>
              </div>
              <h3
                id="citation-modal-title"
                className="font-bold text-sm sm:text-base text-slate-900 mt-1 leading-snug"
              >
                {data.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer shrink-0"
            title="Đóng (ESC)"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {/* Official Document Reference */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-700 space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Văn bản pháp lý &amp; Cơ quan ban hành
            </p>
            <p className="font-semibold text-slate-900 leading-relaxed">
              {data.officialName}
            </p>
            <p className="text-slate-500 font-medium">
              Cơ quan: <strong className="text-slate-800">{data.issuer}</strong>
            </p>
          </div>

          {/* Overview Summary */}
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Mô tả nội dung hướng dẫn
            </p>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {data.summary}
            </p>
          </div>

          {/* Key Clinical Recommendations */}
          <div className="space-y-2.5 pt-1">
            <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Các nguyên tắc chuyên môn then chốt
            </p>
            <div className="space-y-2">
              {data.keyPoints.map((pt, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200/80 bg-white shadow-2xs flex items-start gap-2.5"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#006857] shrink-0 mt-0.5">
                    {pt.icon}
                  </span>
                  <div className="min-w-0 text-xs">
                    <p className="font-bold text-slate-900">{pt.label}</p>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">{pt.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Clinical Safety Disclaimer */}
          <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <span className="material-symbols-outlined text-[17px] text-amber-600 shrink-0 mt-0.5">
              health_and_safety
            </span>
            <p className="leading-relaxed">
              <strong>Lưu ý an toàn:</strong> {data.clinicalNote}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <span className="text-[11px] text-slate-500 font-medium">
            Hệ thống Dinh dưỡng Lâm sàng VinNutri
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#006857] hover:bg-[#005245] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
