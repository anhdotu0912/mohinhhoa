const col1 = [
    { icon: "🥗", title: "Dinh dưỡng đúng bệnh lý", text: "Thực đơn cá nhân hóa cho đái tháo đường típ 1, típ 2, thai kỳ và biến chứng thần kinh." },
    { icon: "🩺", title: "Bác sĩ phê duyệt (HITL)", text: "Mọi kế hoạch đều được chuyên gia y tế kiểm duyệt trước khi áp dụng." },
    { icon: "📚", title: "RAG Groundedness", text: "Khuyến nghị dựa trên Bảng thành phần thực phẩm VN & guideline lâm sàng." },
    { icon: "⚠️", title: "Cảnh báo tương tác", text: "Tự động kiểm tra dị ứng và tương tác thực phẩm với thuốc." },
];

const col2 = [
    { icon: "💬", title: "“Hãy để thức ăn là thuốc”", text: "Dinh dưỡng đúng là một nửa của điều trị. — Hippocrates" },
    { icon: "📊", title: "Nutrition Calculator", text: "Tính calo, đường, muối theo chỉ số HbA1c, GFR thực tế." },
    { icon: "🧠", title: "AI Agent LangGraph", text: "Luồng tư duy: truy vấn → tư vấn → lập kế hoạch → theo dõi." },
    { icon: "🔒", title: "Bảo mật PII/PHI", text: "Dữ liệu y tế được bảo vệ tuyệt đối, không dùng để train model." },
];

const col3 = [
    { icon: "🍚", title: "Kiểm soát đường huyết", text: "Giảm 1% HbA1c giúp giảm tới 37% biến chứng vi mạch." },
    { icon: "🧂", title: "Ăn nhạt hơn mỗi ngày", text: "Dưới 2300mg natri/ngày giúp kiểm soát huyết áp hiệu quả." },
    { icon: "📝", title: "Food Log thông minh", text: "Nhật ký ăn uống tự động tinh chỉnh kế hoạch theo thời gian." },
    { icon: "❤️", title: "Đồng hành mỗi bữa ăn", text: "Cải thiện hiệu quả điều trị thông qua dinh dưỡng đúng." },
];

function Card({ icon, title, text }: { icon: string; title: string; text: string }) {
    return (
        <div className="mq-card">
            <div className="mq-icon">{icon}</div>
            <h4>{title}</h4>
            <p>{text}</p>
        </div>
    );
}

function Column({ items, dir, speed }: { items: typeof col1; dir: "up" | "down"; speed: number }) {
    return (
        <div className="mq-col-mask">
            <div className={`mq-col ${dir === "up" ? "mq-up" : "mq-down"}`} style={{ animationDuration: `${speed}s` }}>
                {[...items, ...items].map((c, i) => (
                    <Card key={i} {...c} />
                ))}
            </div>
        </div>
    );
}

export default function HeroMarquee() {
    return (
        <header className="mq-hero">
            {/* Nền ảnh bác sĩ + overlay */}
            <div className="mq-bg" />
            <div className="mq-overlay" />

            {/* Nội dung trái */}
            <div className="mq-left">
                <div className="badge">
                    <span className="dot"></span> HITL Verified · Doctor Approved
                </div>
                <h1>
                    Clinical AI Nutrition
                    <br />
                    for <span className="grad">Chronic Patients</span>
                </h1>
                <p className="mq-sub">
                    Cá nhân hóa thực đơn theo bệnh lý với sự phê duyệt của chuyên gia.
                    Cải thiện hiệu quả điều trị thông qua dinh dưỡng đúng.
                </p>
                <div className="hero-btns">
                    <a href="#" className="btn btn-primary btn-lg">Get started for free</a>
                    <a href="#" className="btn btn-outline btn-lg">▶ &nbsp;Watch the demo</a>
                </div>
            </div>

            {/* Các cột thẻ trôi lên / xuống */}
            <div className="mq-right">
                <Column items={col1} dir="up" speed={22} />
                <Column items={col2} dir="down" speed={26} />
                <Column items={col3} dir="up" speed={30} />
            </div>
        </header>
    );
}
