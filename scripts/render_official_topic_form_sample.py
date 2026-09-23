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

def dotted_line(x, y, width=483, size=12, font="TNR"):
    dot_width = pdfmetrics.stringWidth(".", font, size) + 1.15
    count = max(1, int(width / dot_width))
    line = c.beginText(x, y)
    line.setFont(font, size)
    line.setCharSpace(1.15)
    line.textLine("." * count)
    c.drawText(line)


# Header: 10 pt, matching the source Word form.
text(175, h-34, "TRƯỜNG ĐẠI HỌC TÔN ĐỨC THẮNG", 10, align="center")
text(175, h-49, "KHOA MỸ THUẬT CÔNG NGHIỆP", 10, "TNR-Bold", "center")
text(420, h-34, "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", 10, align="center")
text(420, h-49, "Độc lập - Tự do - Hạnh phúc", 10, align="center")
c.setLineWidth(0.8)
c.line(96, h-57, 254, h-57)
c.line(382, h-57, 500, h-57)

# Main title: 18 pt; program and round: 16 pt.
text(w/2, h-92, "PHIẾU ĐĂNG KÝ ĐỀ TÀI CHÍNH THỨC", 18, "TNR-Bold", "center")
text(w/2, h-115, "ĐỒ ÁN TỐT NGHIỆP/ĐỒ ÁN TỔNG HỢP", 16, "TNR-Bold", "center")
text(w/2, h-135, "ĐỢT 12/2026", 16, "TNR-Bold", "center")

# Student information: 12 pt regular with approximately 26 pt line spacing.
y = h-166
text(64, y, "HỌ VÀ TÊN :", 12)
text(153, y, "Nguyễn Văn A", 12)
text(399, y, "MSSV:", 12)
text(442, y, "12345678", 12)
y -= 26
text(64, y, "LỚP :", 12)
text(153, y, "220H0101", 12)
text(291, y, "NGÀNH:", 12)
text(351, y, "Thiết kế nội thất", 12)
y -= 26
text(64, y, "EMAIL:", 12)
text(119, y, "nguyenvana.personal@gmail.com", 12)
y -= 26
text(64, y, "ĐIỆN THOẠI:", 12)
text(145, y, "0901234567", 12)
y -= 26
text(64, y, "ĐỊA CHỈ TẠM TRÚ:", 12)
text(179, y, "19 Nguyễn Hữu Thọ, Phường Tân Hưng, TP.HCM", 12)
y -= 26
text(64, y, "MÔN HỌC:", 12)
text(134, y, "Đồ án tốt nghiệp", 12)
text(300, y, "MÃ MÔN HỌC:", 12)
text(391, y, "701099", 12)
text(463, y, "NHÓM:", 12)
text(510, y, "01", 12)

text(w/2, y-27, "Đăng ký đề tài chính thức lần thứ : 1", 12, "TNR-Italic", "center")

# Topic title: bold 12 pt; unused rows remain dotted like the source form.
y -= 66
text(64, y, "TÊN ĐỀ TÀI :", 12, "TNR-Bold")
text(160, y, "Thiết kế nội thất Trung tâm văn hóa nghệ thuật đương đại", 12, "TNR-Bold")
dotted_line(114, y-22, 425, 12, "TNR-Bold")
dotted_line(114, y-43, 425, 12, "TNR-Bold")

text(w/2, y-78, "MÔ TẢ CHI TIẾT ĐỊNH HƯỚNG THIẾT KẾ CỦA ĐỀ TÀI :", 12, "TNR-Bold", "center")
description = ("Đề tài hướng đến việc tổ chức không gian văn hóa đa chức năng, kết hợp trưng bày, "
               "giáo dục và trải nghiệm nghệ thuật. Giải pháp thiết kế chú trọng tính linh hoạt, "
               "khả năng tiếp cận, bản sắc địa phương và các tiêu chí phát triển bền vững.")
style = ParagraphStyle("desc", fontName="TNR", fontSize=12, leading=20.7, alignment=TA_JUSTIFY)
paragraph = Paragraph(description, style)
_, ph = paragraph.wrap(483, 90)
description_top = y - 101
paragraph.drawOn(c, 56, description_top - ph + 12)

# The source has eight description rows. The filled sample uses three; five remain dotted.
dot_y = description_top - ph - 2
for _ in range(5):
    dotted_line(56, dot_y, 483, 12)
    dot_y -= 20.7

text(w/2, dot_y-8, "Tôi xin cam đoan thực hiện đúng đề tài đã đăng ký.", 12, "TNR-Bold", "center")
signature_y = dot_y - 53
text(177, signature_y, "Ý KIẾN CỦA GIẢNG VIÊN HƯỚNG DẪN", 12, "TNR-Bold", "center")
text(458, signature_y+16, "Tp.HCM, ngày 23 tháng 09 năm 2026", 12, "TNR-Italic", "center")
text(484, signature_y, "NGƯỜI ĐĂNG KÝ", 12, align="center")
text(484, signature_y-16, "(ký và ghi rõ họ tên)", 12, align="center")
text(484, signature_y-72, "Nguyễn Văn A", 12, "TNR-Bold", "center")

c.save()
print(OUT)
