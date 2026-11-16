"""Render the source-backed presentation diagram as PNG and SVG (requires Pillow)."""

from html import escape
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


OUT = Path(__file__).resolve().parent
W, H = 1920, 1480
SCALE = 2
BG, INK, MUTED = "#f6f8fc", "#13243b", "#52627a"
BLUE, TEAL, PURPLE = "#2563eb", "#087f8c", "#7250b5"
im = Image.new("RGB", (W * SCALE, H * SCALE), BG)
draw = ImageDraw.Draw(im)
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
       '<title>VinNutri — Kiến trúc hệ thống 3 tầng</title>',
       '<desc>Next.js gọi FastAPI; service và AI xử lý nghiệp vụ; PostgreSQL và Qdrant cung cấp dữ liệu. Các hộp ghi đường dẫn mã nguồn để đối chiếu.</desc>',
       f'<rect width="{W}" height="{H}" fill="{BG}"/>']
arrows = []


def rect(x, y, w, h, fill, stroke=None, radius=20):
    draw.rounded_rectangle(tuple(int(v * SCALE) for v in (x, y, x+w, y+h)),
                           radius=radius*SCALE, fill=fill, outline=stroke, width=2*SCALE)
    svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke or "none"}" stroke-width="2"/>')


def text(x, y, value, size=28, color=INK, bold=False, center=False):
    font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf", size*SCALE)
    if center:
        x -= draw.textlength(value, font=font) / SCALE / 2
    draw.text((int(x*SCALE), int(y*SCALE)), value, font=font, fill=color)
    svg.append(f'<text x="{x}" y="{y}" dominant-baseline="text-before-edge" font-family="Arial, sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{escape(value)}</text>')


def arrow(points, color=MUTED, width=3):
    arrows.append((points, color, width))


def paint_arrow(points, color, width):
    draw.line([(int(x*SCALE), int(y*SCALE)) for x, y in points], fill=color, width=width*SCALE)
    x, y = points[-1]
    px, py = points[-2]
    dx, dy = x-px, y-py
    norm = (dx*dx + dy*dy) ** .5
    ux, uy = dx/norm, dy/norm
    tri = [(x,y), (x-13*ux+7*uy,y-13*uy-7*ux), (x-13*ux-7*uy,y-13*uy+7*ux)]
    draw.polygon([(int(a*SCALE),int(b*SCALE)) for a,b in tri], fill=color)
    coords = ' '.join(f'{a},{b}' for a,b in points)
    svg.append(f'<polyline points="{coords}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linejoin="round"/>')
    svg.append(f'<polygon points="{" ".join(f"{a},{b}" for a,b in tri)}" fill="{color}"/>')


def layer(y, h, number, title, subtitle, color, fill):
    rect(60, y, 1800, h, fill)
    rect(85, y+22, 48, 48, color, radius=12)
    text(109, y+29, str(number), 28, "#ffffff", True, True)
    text(151, y+27, title, 31, color, True)
    text(1815, y+31, subtitle, 24, MUTED, center=False)


text(70, 40, "VinNutri | Kiến trúc hệ thống 3 tầng", 49, bold=True)
text(73, 104, "Sơ đồ tổng quan đối chiếu mã nguồn dự án P-014", 28, MUTED)
rect(660, 163, 600, 62, "#e4eaf4", radius=31)
text(960, 177, "BỆNH NHÂN  /  BÁC SĨ", 28, bold=True, center=True)
arrow([(960,225),(960,260)])

layer(260, 188, 1, "TẦNG GIAO DIỆN", "", BLUE, "#e9f0ff")
text(960, 292, "Next.js", 38, BLUE, True, True)
text(960, 345, "Nhập hồ sơ · Xem thực đơn · Chat · Bác sĩ phê duyệt", 30, center=True)
text(960, 395, "frontend/app/   +   frontend/lib/api.ts", 25, MUTED, center=True)

arrow([(960,448),(960,604)])
rect(998, 467, 570, 43, BG, radius=9)
text(1014, 473, "HTTP API: gửi yêu cầu / nhận kết quả", 25, MUTED)

layer(530, 474, 2, "TẦNG XỬ LÝ NGHIỆP VỤ", "", TEAL, "#e6f4f2")
rect(690, 604, 540, 116, "#ffffff", "#b1dcd6")
text(960, 618, "FastAPI — /api/v1", 34, TEAL, True, True)
text(960, 665, "Nhận yêu cầu · Kiểm tra dữ liệu và quyền", 25, center=True)

arrow([(825,720),(825,755),(510,755),(510,794)], TEAL)
arrow([(1095,720),(1095,755),(1410,755),(1410,794)], TEAL)
rect(102, 794, 816, 177, "#ffffff", "#b1dcd6")
text(510, 811, "Services + Meal Planner", 33, TEAL, True, True)
text(510, 861, "Hồ sơ · Tạo / duyệt thực đơn · Thông báo", 27, center=True)
text(510, 913, "backend/app/services/  +  agents/meal_planner_agent.py", 23, MUTED, center=True)
rect(1002, 794, 816, 177, "#ffffff", "#b1dcd6")
text(1410, 811, "AI: LangGraph + RAG", 33, TEAL, True, True)
text(1410, 861, "Nạp hồ sơ → Chọn chức năng → Kiểm tra an toàn", 26, center=True)
text(1410, 913, "backend/app/agents/graph.py  +  rag/  +  guardrails/", 23, MUTED, center=True)
text(85, 982, "", 16)

arrow([(510,971),(510,1172)], PURPLE)
arrow([(1410,971),(1410,1172)], PURPLE)
arrow([(1240,971),(1240,1040),(710,1040),(710,1172)], PURPLE)
rect(89, 1027, 386, 39, BG, radius=8)
text(105, 1033, "Đọc / ghi dữ liệu nghiệp vụ", 24, MUTED)
rect(1435, 1027, 380, 39, BG, radius=8)
text(1452, 1033, "Tìm kiến thức liên quan", 24, MUTED)

layer(1090, 257, 3, "TẦNG DỮ LIỆU", "", PURPLE, "#f0eafb")
rect(102, 1172, 816, 146, "#ffffff", "#d5c6ee")
text(510, 1184, "PostgreSQL", 34, PURPLE, True, True)
text(510, 1232, "Tài khoản · Hồ sơ · Thực đơn · Lịch sử", 27, center=True)
text(510, 1277, "backend/app/models/  +  db/session.py", 24, MUTED, center=True)
rect(1002, 1172, 816, 146, "#ffffff", "#d5c6ee")
text(1410, 1184, "Qdrant", 34, PURPLE, True, True)
text(1410, 1232, "Vector + nội dung + nguồn: tài liệu / thực phẩm", 26, center=True)
text(1410, 1277, "backend/app/rag/qdrant.py  +  retriever.py", 24, MUTED, center=True)

text(75, 1371, "Luồng chính: giao diện gửi yêu cầu → backend xử lý → đọc / ghi dữ liệu → trả kết quả về giao diện.", 26, bold=True)
text(75, 1414, "Đối chiếu triển khai: /chat chạy LangGraph; /chat/stream gọi các node trực tiếp; tạo thực đơn gọi Meal Planner qua service.", 23, MUTED)
text(75, 1447, "Backend chia module, triển khai chung (Modular Monolith). Qdrant mặc định lưu cục bộ; sơ đồ lược bỏ nhà cung cấp LLM / embedding.", 23, MUTED)

for points, color, width in arrows:
    paint_arrow(points, color, width)
svg.append("</svg>")
im.save(OUT / "vinnutri-kien-truc-3-tang.png", optimize=True)
(OUT / "vinnutri-kien-truc-3-tang.svg").write_text("\n".join(svg), encoding="utf-8")
print(f"Created PNG ({im.width} x {im.height}) and SVG in {OUT}")
