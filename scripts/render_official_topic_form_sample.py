from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "Phieu-dang-ky-de-tai-mau-cap-nhat.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

pdfmetrics.registerFont(TTFont("TNR", r"C:\Windows\Fonts\times.ttf"))
pdfmetrics.registerFont(TTFont("TNR-Bold", r"C:\Windows\Fonts\timesbd.ttf"))
pdfmetrics.registerFont(TTFont("TNR-Italic", r"C:\Windows\Fonts\timesi.ttf"))

c = canvas.Canvas(str(OUT), pagesize=A4)
w, h = A4

def text(x, y, value, size=11, font="TNR", align="left"):
    c.setFont(font, size)
    if align == "center":
        c.drawCentredString(x, y, value)
    elif align == "right":
        c.drawRightString(x, y, value)
    else:
        c.drawString(x, y, value)

text(175, h-45, "TRƯỜNG ĐẠI HỌC TÔN ĐỨC THẮNG", 11, align="center")
text(175, h-62, "KHOA MỸ THUẬT CÔNG NGHIỆP", 11, "TNR-Bold", "center")
text(420, h-45, "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", 11, align="center")
text(420, h-62, "Độc lập - Tự do - Hạnh phúc", 11, align="center")
c.line(95, h-70, 255, h-70); c.line(350, h-70, 490, h-70)
text(w/2, h-118, "PHIẾU ĐĂNG KÝ ĐỀ TÀI CHÍNH THỨC", 18, "TNR-Bold", "center")
text(w/2, h-142, "ĐỒ ÁN TỐT NGHIỆP/ĐỒ ÁN TỔNG HỢP - ĐỢT 12/2026", 13, "TNR-Bold", "center")

rows = [
    ("HỌ VÀ TÊN:", "Nguyễn Văn A", "MSSV:", "12345678"),
    ("LỚP:", "220H0101", "NGÀNH:", "Thiết kế nội thất"),
    ("EMAIL:", "nguyenvana.personal@gmail.com", "ĐIỆN THOẠI:", "0901234567"),
    ("MÔN HỌC:", "Đồ án tốt nghiệp", "MÃ MÔN/NHÓM:", "701099 / 01"),
]
y = h-190
for l1, v1, l2, v2 in rows:
    text(62, y, l1, 10, "TNR-Bold"); text(145, y, v1, 10)
    if l2:
        text(340, y, l2, 10, "TNR-Bold"); text(435, y, v2, 10)
    y -= 27

text(62, y, "ĐỊA CHỈ TẠM TRÚ:", 10, "TNR-Bold")
text(175, y, "19 Nguyễn Hữu Thọ, Phường Tân Hưng, TP.HCM", 10)
y -= 27

text(w/2, y-2, "Đăng ký đề tài chính thức lần thứ: 1", 11, "TNR-Italic", "center")
y -= 38
text(62, y, "TÊN ĐỀ TÀI:", 11, "TNR-Bold")
text(150, y, "Thiết kế nội thất Trung tâm văn hóa nghệ thuật đương đại", 11, "TNR-Bold")
y -= 40
text(w/2, y, "MÔ TẢ CHI TIẾT ĐỊNH HƯỚNG THIẾT KẾ CỦA ĐỀ TÀI", 12, "TNR-Bold", "center")
y -= 28
description = ("Đề tài hướng đến việc tổ chức không gian văn hóa đa chức năng, kết hợp trưng bày, "
               "giáo dục và trải nghiệm nghệ thuật. Giải pháp thiết kế chú trọng tính linh hoạt, "
               "khả năng tiếp cận, bản sắc địa phương và các tiêu chí phát triển bền vững.")
style = ParagraphStyle("desc", fontName="TNR", fontSize=11, leading=20, alignment=TA_JUSTIFY)
paragraph = Paragraph(description, style)
_, ph = paragraph.wrap(455, 100)
paragraph.drawOn(c, 70, y-ph+8)
y -= ph + 4
for _ in range(4):
    c.line(70, y, 525, y); y -= 22

text(w/2, y-5, "Tôi xin cam đoan thực hiện đúng đề tài đã đăng ký.", 11, "TNR-Bold", "center")
y -= 48
text(180, y, "CÁN BỘ HƯỚNG DẪN", 11, "TNR-Bold", "center")
text(435, y, "TP.HCM, ngày 23 tháng 09 năm 2026", 10, "TNR-Italic", "center")
text(180, y-18, "(ký và ghi rõ họ tên)", 10, align="center")
text(435, y-22, "NGƯỜI ĐĂNG KÝ", 11, "TNR-Bold", "center")
text(435, y-38, "(ký và ghi rõ họ tên)", 10, align="center")
text(180, y-75, "ThS. KTS. Giảng viên Hướng dẫn", 10, "TNR-Bold", "center")
text(435, y-75, "Nguyễn Văn A", 10, "TNR-Bold", "center")

c.save()
print(OUT)
