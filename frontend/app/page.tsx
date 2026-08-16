/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="bg-background font-body text-on-surface antialiased pt-16 min-h-screen flex flex-col justify-between">
      {/* TopNavBar Component for Landing Page */}
      <nav className="fixed top-0 left-0 right-0 w-full z-50 bg-surface/80 dark:bg-surface-container-lowest/80 backdrop-blur-md border-b border-outline-variant/30">
        <div className="w-full max-w-[1500px] mx-auto px-6 md:px-12 h-16 flex justify-between items-center">
          <div className="flex items-center gap-lg">
            <Link className="font-h1 text-h1 text-primary dark:text-primary-fixed tracking-tight" href="/">
              VMEC-10
            </Link>
            <div className="hidden md:flex gap-lg ml-lg">
              <a className="text-on-surface-variant dark:text-on-surface-variant hover:text-primary transition-colors font-body-bold text-body-bold" href="#tinh-nang">
                Tính năng
              </a>
              <a className="text-on-surface-variant dark:text-on-surface-variant hover:text-primary transition-colors font-body-bold text-body-bold" href="#cach-hoat-dong">
                Cách hoạt động
              </a>
              <a className="text-on-surface-variant dark:text-on-surface-variant hover:text-primary transition-colors font-body-bold text-body-bold" href="#ve-chung-toi">
                Về chúng tôi
              </a>
              <a className="text-on-surface-variant dark:text-on-surface-variant hover:text-primary transition-colors font-body-bold text-body-bold" href="#lien-he">
                Liên hệ
              </a>
            </div>
          </div>
          <div className="flex items-center gap-md">
            <Link href="/login" className="font-body-bold text-body-bold text-primary hover:text-primary-fixed transition-colors">
              Đăng nhập
            </Link>
            <Link href="/register" className="bg-primary text-on-primary font-body-bold text-body-bold h-10 px-md rounded-button flex items-center justify-center hover:opacity-90 transition-opacity">
              Bắt đầu
            </Link>
          </div>
        </div>
      </nav>

      <main className="w-full flex-grow">
        {/* Hero Section */}
        <section className="w-full py-12 md:py-20 border-b border-outline-variant/10">
          <div className="w-full max-w-[1500px] mx-auto px-6 md:px-12 lg:px-16 flex flex-col md:flex-row items-center gap-10 md:gap-16 min-h-[75vh]">
            <div className="flex-1 flex flex-col items-start gap-lg z-10 relative">
              <h1 className="text-display font-h1 text-on-surface tracking-tight text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                Dinh dưỡng AI chuẩn lâm sàng cho bệnh nhân mãn tính
              </h1>
              <p className="font-h2 text-h2 text-on-surface-variant max-w-3xl font-normal leading-relaxed text-lg md:text-xl">
                Cá nhân hóa thực đơn theo bệnh lý với sự phê duyệt của bác sĩ chuyên khoa. Nâng cao hiệu quả điều trị thông qua dinh dưỡng chính xác.
              </p>
              <div className="flex flex-wrap gap-md mt-sm">
                <Link href="/register" className="bg-[#2f8f7a] text-white font-body-bold text-body-bold h-12 px-8 rounded-button flex items-center justify-center hover:opacity-90 transition-opacity shadow-subtle text-base">
                  Bắt đầu miễn phí
                </Link>
                <Link href="/patient" className="bg-transparent border border-[#2f8f7a] text-[#2f8f7a] font-body-bold text-body-bold h-12 px-8 rounded-button flex items-center justify-center hover:bg-surface-variant transition-colors text-base">
                  Xem demo
                </Link>
              </div>
            </div>
            <div className="flex-1 relative w-full aspect-[4/3] max-w-2xl rounded-card overflow-hidden shadow-hover border border-outline-variant/50 bg-surface">
              <img
                className="w-full h-full object-cover"
                alt="Clinical nutrition dashboard interface"
                src="/images/doctor_review_portal.jpg"
              />
            </div>
          </div>
        </section>

        {/* Vấn đề Section */}
        <section className="w-full bg-surface-container-lowest py-section-py border-t border-outline-variant/30">
          <div className="w-full max-w-[1500px] mx-auto px-6 md:px-12 lg:px-16">
            <div className="text-center mb-xl">
              <h2 className="text-title font-h1 text-on-surface mb-sm">Thách thức trong quản lý dinh dưỡng</h2>
              <p className="font-body text-body text-on-surface-variant max-w-2xl mx-auto">
                Việc tuân thủ chế độ ăn bệnh lý thường gặp nhiều khó khăn trong thực tế.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
              {/* Col 1 */}
              <div className="bg-surface border border-outline-variant/50 rounded-card p-xl shadow-subtle flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-error-container/20 flex items-center justify-center mb-md">
                  <span className="material-symbols-outlined text-error text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    warning
                  </span>
                </div>
                <h3 className="font-h2 text-h2 text-on-surface mb-xs">Khó tự lập thực đơn</h3>
                <p className="font-body text-body text-on-surface-variant">
                  Người bệnh gặp khó khăn khi chọn món ăn phù hợp với chỉ số sức khỏe và bệnh lý phức tạp.
                </p>
              </div>
              {/* Col 2 */}
              <div className="bg-surface border border-outline-variant/50 rounded-card p-xl shadow-subtle flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-secondary-container/20 flex items-center justify-center mb-md">
                  <span className="material-symbols-outlined text-secondary text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    science
                  </span>
                </div>
                <h3 className="font-h2 text-h2 text-on-surface mb-xs">Thiếu căn cứ khoa học</h3>
                <p className="font-body text-body text-on-surface-variant">
                  Các thông tin trên mạng thiếu độ tin cậy, mâu thuẫn và không sát thực tế lâm sàng của từng cá nhân.
                </p>
              </div>
              {/* Col 3 */}
              <div className="bg-surface border border-outline-variant/50 rounded-card p-xl shadow-subtle flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-tertiary-container/20 flex items-center justify-center mb-md">
                  <span className="material-symbols-outlined text-tertiary text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    analytics
                  </span>
                </div>
                <h3 className="font-h2 text-h2 text-on-surface mb-xs">Khó theo dõi tuân thủ</h3>
                <p className="font-body text-body text-on-surface-variant">
                  Không có công cụ ghi nhận, định lượng và đánh giá mức độ tuân thủ điều trị dinh dưỡng hàng ngày.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Cách hoạt động Section */}
        <section className="w-full py-section-py" id="cach-hoat-dong">
          <div className="w-full max-w-[1500px] mx-auto px-6 md:px-12 lg:px-16">
            <div className="text-center mb-xl">
              <h2 className="text-title font-h1 text-on-surface mb-sm">Quy trình vận hành chuẩn y khoa</h2>
              <p className="font-body text-body text-on-surface-variant max-w-2xl mx-auto">
                Sự kết hợp giữa trí tuệ nhân tạo và chuyên môn y tế.
              </p>
            </div>
            <div className="relative max-w-5xl mx-auto">
              {/* Connecting Line */}
              <div className="hidden md:block absolute top-1/2 left-0 w-full h-[2px] bg-outline-variant/50 -translate-y-1/2 z-0"></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-lg relative z-10">
                {/* Step 1 */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-[#2f8f7a] flex items-center justify-center text-white mb-md border-4 border-background shadow-subtle">
                    <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      person_add
                    </span>
                  </div>
                  <div className="bg-surface border border-outline-variant/50 rounded-lg px-md py-sm shadow-subtle w-full">
                    <span className="font-label text-label text-primary uppercase tracking-wider mb-xs block">Bước 1</span>
                    <h4 className="font-body-bold text-body-bold text-on-surface">Khai báo hồ sơ</h4>
                  </div>
                </div>
                {/* Step 2 */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-[#2f8f7a] flex items-center justify-center text-white mb-md border-4 border-background shadow-subtle">
                    <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      psychology
                    </span>
                  </div>
                  <div className="bg-surface border border-outline-variant/50 rounded-lg px-md py-sm shadow-subtle w-full">
                    <span className="font-label text-label text-primary uppercase tracking-wider mb-xs block">Bước 2</span>
                    <h4 className="font-body-bold text-body-bold text-on-surface">AI gợi ý thực đơn</h4>
                  </div>
                </div>
                {/* Step 3 */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-[#2f8f7a] flex items-center justify-center text-white mb-md border-4 border-background shadow-subtle">
                    <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      verified
                    </span>
                  </div>
                  <div className="bg-surface border border-outline-variant/50 rounded-lg px-md py-sm shadow-subtle w-full">
                    <span className="font-label text-label text-primary uppercase tracking-wider mb-xs block">Bước 3</span>
                    <h4 className="font-body-bold text-body-bold text-on-surface">Bác sĩ duyệt</h4>
                  </div>
                </div>
                {/* Step 4 */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-[#2f8f7a] flex items-center justify-center text-white mb-md border-4 border-background shadow-subtle">
                    <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                  </div>
                  <div className="bg-surface border border-outline-variant/50 rounded-lg px-md py-sm shadow-subtle w-full">
                    <span className="font-label text-label text-primary uppercase tracking-wider mb-xs block">Bước 4</span>
                    <h4 className="font-body-bold text-body-bold text-on-surface">Theo dõi tuân thủ</h4>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tính năng nổi bật Section (Bento Grid) */}
        <section className="w-full bg-surface-container-lowest py-section-py border-t border-outline-variant/30" id="tinh-nang">
          <div className="w-full max-w-[1500px] mx-auto px-6 md:px-12 lg:px-16">
            <div className="text-center mb-xl">
              <h2 className="text-title font-h1 text-on-surface mb-sm">Tính năng nền tảng</h2>
              <p className="font-body text-body text-on-surface-variant max-w-2xl mx-auto">
                Công cụ mạnh mẽ hỗ trợ cả bệnh nhân và chuyên gia y tế.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
              {/* Feature 1 */}
              <div className="bg-surface border border-outline-variant/50 rounded-card p-lg shadow-subtle hover:shadow-hover transition-shadow col-span-1 md:col-span-2 flex flex-col md:flex-row gap-lg items-center">
                <div className="flex-1">
                  <div className="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center mb-md text-primary">
                    <span className="material-symbols-outlined text-[20px]">database</span>
                  </div>
                  <h3 className="font-h2 text-h2 text-on-surface mb-xs">RAG trên CSDL Việt Nam</h3>
                  <p className="font-body text-body text-on-surface-variant">
                    Tối ưu hóa gợi ý dựa trên cơ sở dữ liệu thực phẩm và thói quen ăn uống đặc thù của người Việt, đảm bảo tính khả thi.
                  </p>
                </div>
                <div className="flex-1 h-32 w-full bg-surface-variant rounded-lg border border-outline-variant/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-outline text-[48px] opacity-50">account_tree</span>
                </div>
              </div>
              {/* Feature 2 */}
              <div className="bg-surface border border-outline-variant/50 rounded-card p-lg shadow-subtle hover:shadow-hover transition-shadow flex flex-col justify-center">
                <div className="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center mb-md text-primary">
                  <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
                </div>
                <h3 className="font-h2 text-h2 text-on-surface mb-xs">HITL bác sĩ duyệt</h3>
                <p className="font-body text-body text-on-surface-variant text-sm">
                  Mô hình Human-in-the-loop đảm bảo an toàn y tế tuyệt đối.
                </p>
              </div>
              {/* Feature 3 */}
              <div className="bg-surface border border-outline-variant/50 rounded-card p-lg shadow-subtle hover:shadow-hover transition-shadow">
                <div className="w-10 h-10 rounded-full bg-error-container/20 flex items-center justify-center mb-md text-error">
                  <span className="material-symbols-outlined text-[20px]">health_and_safety</span>
                </div>
                <h3 className="font-h2 text-h2 text-on-surface mb-xs">Cảnh báo dị ứng</h3>
                <p className="font-body text-body text-on-surface-variant text-sm">
                  Hệ thống tự động phát hiện và loại trừ các thực phẩm rủi ro.
                </p>
              </div>
              {/* Feature 4 */}
              <div className="bg-surface border border-outline-variant/50 rounded-card p-lg shadow-subtle hover:shadow-hover transition-shadow">
                <div className="w-10 h-10 rounded-full bg-secondary-container/20 flex items-center justify-center mb-md text-secondary">
                  <span className="material-symbols-outlined text-[20px]">update</span>
                </div>
                <h3 className="font-h2 text-h2 text-on-surface mb-xs">Theo dõi tự động</h3>
                <p className="font-body text-body text-on-surface-variant text-sm">
                  Ghi nhận lượng calo và dinh dưỡng tiêu thụ hàng ngày dễ dàng.
                </p>
              </div>
              {/* Feature 5 */}
              <div className="bg-surface border border-outline-variant/50 rounded-card p-lg shadow-subtle hover:shadow-hover transition-shadow">
                <div className="w-10 h-10 rounded-full bg-tertiary-container/20 flex items-center justify-center mb-md text-tertiary">
                  <span className="material-symbols-outlined text-[20px]">monitoring</span>
                </div>
                <h3 className="font-h2 text-h2 text-on-surface mb-xs">Biểu đồ tiến độ</h3>
                <p className="font-body text-body text-on-surface-variant text-sm">
                  Trực quan hóa dữ liệu sức khỏe giúp đánh giá hiệu quả điều trị.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Dành cho ai Section */}
        <section className="w-full py-section-py">
          <div className="w-full max-w-[1500px] mx-auto px-6 md:px-12 lg:px-16">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
              {/* Patient Card */}
              <div className="bg-surface border border-outline-variant/50 rounded-card p-xl shadow-subtle flex flex-col justify-between h-full relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-container/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                <div className="z-10">
                  <div className="w-14 h-14 rounded-full bg-[#2f8f7a]/10 flex items-center justify-center mb-lg">
                    <span className="material-symbols-outlined text-[#2f8f7a] text-[32px]">person</span>
                  </div>
                  <h3 className="font-h1 text-h1 text-on-surface mb-sm">Cho Bệnh nhân</h3>
                  <p className="font-body text-body text-on-surface-variant mb-xl text-base">
                    Quản lý sức khỏe chủ động qua dinh dưỡng chính xác, dễ dàng tiếp cận với phác đồ chuẩn y khoa.
                  </p>
                </div>
                <Link href="/patient" className="bg-[#2f8f7a] text-white font-body-bold text-body-bold h-10 px-lg rounded-button self-start flex items-center justify-center hover:opacity-90 transition-opacity z-10 w-auto">
                  Tham gia ngay
                </Link>
              </div>
              {/* Doctor Card */}
              <div className="bg-surface border border-outline-variant/50 rounded-card p-xl shadow-subtle flex flex-col justify-between h-full relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-secondary-container/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                <div className="z-10">
                  <div className="w-14 h-14 rounded-full bg-secondary-container/20 flex items-center justify-center mb-lg">
                    <span className="material-symbols-outlined text-secondary text-[32px]">medical_services</span>
                  </div>
                  <h3 className="font-h1 text-h1 text-on-surface mb-sm">Cho Bác sĩ</h3>
                  <p className="font-body text-body text-on-surface-variant mb-xl text-base">
                    Tối ưu hóa quy trình tư vấn và giám sát bệnh nhân từ xa với dữ liệu cấu trúc và công cụ AI hỗ trợ quyết định.
                  </p>
                </div>
                <Link href="/patient" className="bg-transparent border border-outline-variant text-on-surface font-body-bold text-body-bold h-10 px-lg rounded-button self-start flex items-center justify-center hover:bg-surface-variant transition-colors z-10 w-auto">
                  Đăng ký chuyên gia
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Component for Landing Page */}
      <footer className="w-full bg-surface-container dark:bg-surface-container-lowest border-t border-outline-variant py-xl">
        <div className="w-full max-w-[1500px] mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-start gap-lg">
          <div>
            <div className="font-h2 text-h2 text-primary dark:text-primary-fixed mb-sm">VMEC-10</div>
            <p className="font-caption text-caption text-on-surface-variant max-w-sm">
              © 2024 VMEC-10. Vietnamese AI nutrition and lifestyle assistant. Built for clinical precision.
            </p>
          </div>
          <div className="flex flex-wrap gap-md font-caption text-caption text-on-surface-variant">
            <a className="hover:underline transition-all focus:ring-2 focus:ring-primary rounded-xs" href="#">
              Điều khoản sử dụng
            </a>
            <a className="hover:underline transition-all focus:ring-2 focus:ring-primary rounded-xs" href="#">
              Chính sách bảo mật
            </a>
            <a className="hover:underline transition-all focus:ring-2 focus:ring-primary rounded-xs" href="#">
              Trợ giúp
            </a>
            <a className="hover:underline transition-all focus:ring-2 focus:ring-primary rounded-xs" href="#">
              API
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
