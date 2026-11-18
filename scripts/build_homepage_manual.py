# -*- coding: utf-8 -*-
"""부캉이 굿즈샵 홈페이지 이용 매뉴얼 PPT. 화면 단위 가이드 형식."""
from lxml import etree
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

NAVY = RGBColor(0x14, 0x1A, 0x22)
CREAM = RGBColor(0xF6, 0xF3, 0xEC)
TEAL = RGBColor(0x1A, 0x9A, 0x82)
TEAL_DARK = RGBColor(0x0F, 0x7A, 0x68)
INK = RGBColor(0x1C, 0x24, 0x30)
MUTED = RGBColor(0x6E, 0x73, 0x78)
SOFT = RGBColor(0x8A, 0x84, 0x78)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
CARD = RGBColor(0xFF, 0xFF, 0xFF)
LINE = RGBColor(0xE4, 0xDE, 0xD4)
CHIP = RGBColor(0xEE, 0xF7, 0xF4)
RESULT = RGBColor(0xE7, 0xF6, 0xF2)
FONT = "Malgun Gothic"

OUT = r"c:\Users\so073\OneDrive\바탕 화면\메캉\shopping_mall_v3.2\shopping_mall_v3.2\부캉이_굿즈샵_홈페이지_이용매뉴얼.pptx"


def set_run(run, text, size, color, bold=False):
    run.text = text
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = FONT
    rpr = run._r.get_or_add_rPr()
    for tag in ("a:latin", "a:ea", "a:cs"):
        el = rpr.find(qn(tag))
        if el is None:
            el = etree.SubElement(rpr, qn(tag))
        el.set("typeface", FONT)


def add_text(slide, x, y, w, h, paragraphs, anchor=MSO_ANCHOR.TOP, align=PP_ALIGN.LEFT):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.auto_size = None
    tf.margin_left = Emu(0)
    tf.margin_right = Emu(0)
    tf.margin_top = Emu(0)
    tf.margin_bottom = Emu(0)
    tf.vertical_anchor = anchor
    for i, para in enumerate(paragraphs):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = para.get("align", align)
        p.space_before = Pt(para.get("before", 0))
        p.space_after = Pt(para.get("after", 0))
        if para.get("spc"):
            p.line_spacing = para["spc"]
        runs = para["runs"] if "runs" in para else [(para["text"], para.get("size", 12), para.get("color", INK), para.get("bold", False))]
        for text, size, color, bold in runs:
            set_run(p.add_run(), text, size, color, bold)
    return box


def rect(slide, x, y, w, h, fill, line=None, radius=0.08):
    shape = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE,
        Inches(x), Inches(y), Inches(w), Inches(h),
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    if line is None:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = line
        shape.line.width = Pt(1)
    if radius:
        try:
            shape.adjustments[0] = radius
        except Exception:
            pass
    shape.shadow.inherit = False
    return shape


def bg(slide, color):
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = color


def footer(slide, n, total=15):
    rect(slide, 0.55, 7.12, 12.23, 0.01, LINE, radius=0)
    add_text(slide, 0.55, 7.16, 8, 0.28, [{"text": "부캉이 굿즈샵  ·  홈페이지 이용 매뉴얼", "size": 10, "color": SOFT}])
    add_text(slide, 10.4, 7.16, 2.38, 0.28, [{"text": f"{n}  /  {total}", "size": 10, "color": SOFT, "align": PP_ALIGN.RIGHT}])


def kicker(slide, text):
    add_text(slide, 0.55, 0.28, 12, 0.28, [{"text": text, "size": 11, "color": TEAL, "bold": True}])


def title(slide, text, y=0.52):
    add_text(slide, 0.55, y, 12.2, 0.48, [{"text": text, "size": 26, "color": INK, "bold": True}])


def lead(slide, text, y=1.02):
    add_text(slide, 0.55, y, 12.2, 0.36, [{"text": text, "size": 13, "color": MUTED}])


def card(slide, x, y, w, h, heading, lines, accent=False):
    rect(slide, x, y, w, h, CARD, LINE, 0.06)
    if accent:
        rect(slide, x, y, 0.06, h, TEAL, radius=0)
    add_text(slide, x + 0.22, y + 0.16, w - 0.4, 0.32, [{"text": heading, "size": 14, "color": INK, "bold": True}])
    paras = [{"text": line, "size": 12, "color": MUTED, "after": 5, "spc": 1.05} for line in lines]
    add_text(slide, x + 0.22, y + 0.52, w - 0.42, h - 0.66, paras)


def step_card(slide, x, y, w, h, num, heading, body, result):
    rect(slide, x, y, w, h, CARD, LINE, 0.06)
    add_text(slide, x + 0.2, y + 0.16, 0.4, 0.32, [{"text": str(num), "size": 16, "color": TEAL, "bold": True}])
    add_text(slide, x + 0.55, y + 0.18, w - 0.75, 0.32, [{"text": heading, "size": 14, "color": INK, "bold": True}])
    add_text(slide, x + 0.2, y + 0.58, w - 0.4, h - 1.15, [{"text": body, "size": 12, "color": MUTED, "spc": 1.15}])
    rect(slide, x + 0.18, y + h - 0.48, w - 0.36, 0.32, RESULT, radius=0.15)
    add_text(slide, x + 0.28, y + h - 0.44, w - 0.52, 0.26, [{"text": result, "size": 11, "color": TEAL_DARK, "bold": True}])


def chip_row(slide, x, y, items, w=2.35):
    for i, (label, value) in enumerate(items):
        cx = x + i * (w + 0.12)
        rect(slide, cx, y, w, 0.62, CHIP, radius=0.12)
        add_text(slide, cx + 0.14, y + 0.06, w - 0.24, 0.22, [{"text": label, "size": 10, "color": TEAL, "bold": True}])
        add_text(slide, cx + 0.14, y + 0.28, w - 0.24, 0.26, [{"text": value, "size": 12, "color": INK, "bold": True}])


def style_cell(cell, text, size, color, bold=False, fill=None, align=PP_ALIGN.LEFT):
    cell.text = ""
    cell.margin_left = Inches(0.1)
    cell.margin_right = Inches(0.08)
    cell.margin_top = Inches(0.06)
    cell.margin_bottom = Inches(0.04)
    cell.vertical_anchor = MSO_ANCHOR.MIDDLE
    if fill:
        cell.fill.solid()
        cell.fill.fore_color.rgb = fill
    p = cell.text_frame.paragraphs[0]
    p.alignment = align
    set_run(p.add_run(), text, size, color, bold)
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    for border in ("lnL", "lnR", "lnT", "lnB"):
        ln = etree.SubElement(tcPr, qn(f"a:{border}"))
        ln.set("w", "6350")
        sf = etree.SubElement(ln, qn("a:solidFill"))
        srgb = etree.SubElement(sf, qn("a:srgbClr"))
        srgb.set("val", "E4DED4")


SHOTS = r"c:\Users\so073\AppData\Local\Temp\manual-shots"


def screen_slide(prs, blank, n, total, label, heading, summary, image, notes):
    s = prs.slides.add_slide(blank)
    bg(s, CREAM)
    footer(s, n, total)
    kicker(s, label)
    title(s, heading)
    lead(s, summary)
    s.shapes.add_picture(SHOTS + "\\" + image, Inches(0.48), Inches(1.5), width=Inches(8.65))
    rect(s, 9.3, 1.5, 3.52, 5.4, CARD, LINE, 0.06)
    add_text(s, 9.48, 1.68, 3.2, 5.0, [
        {"text": line, "size": 13, "color": INK if i == 0 else MUTED, "bold": i == 0, "after": 8, "spc": 1.12}
        for i, line in enumerate(notes)
    ])
    return s


def build():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    prs.core_properties.title = "부캉이 굿즈샵 홈페이지 이용 매뉴얼"
    prs.core_properties.subject = "고객몰 화면 단위 이용 가이드"
    prs.core_properties.author = "정예성"
    blank = prs.slide_layouts[6]
    total = 19

    # 1 cover
    s = prs.slides.add_slide(blank)
    bg(s, NAVY)
    add_text(s, 0.7, 1.15, 10, 0.3, [{"text": "SITE USER GUIDE", "size": 13, "color": TEAL, "bold": True}])
    add_text(s, 0.68, 1.7, 11, 1.7, [
        {"text": "부캉이 굿즈샵", "size": 40, "color": WHITE, "bold": True, "after": 0},
        {"text": "홈페이지 이용 매뉴얼", "size": 40, "color": WHITE, "bold": True, "before": 2},
    ])
    add_text(s, 0.7, 3.65, 9, 0.7, [
        {"text": "상단 메뉴부터 주문 완료까지", "size": 16, "color": RGBColor(0xC5, 0xCB, 0xD1), "after": 2},
        {"text": "고객 화면을 화면 단위로 정리한 가이드", "size": 16, "color": RGBColor(0xC5, 0xCB, 0xD1)},
    ])
    rect(s, 0.7, 4.7, 1.15, 0.015, TEAL, radius=0)
    metas = [("제공 대상", "부캉 커머스몰"), ("보고자", "정예성  ·  Megazone Cloud"), ("문서 정보", "v3.2  ·  2026-11-07")]
    for i, (lab, val) in enumerate(metas):
        x = 0.7 + i * 3.15
        add_text(s, x, 5.0, 2.9, 0.22, [{"text": lab, "size": 11, "color": TEAL}])
        add_text(s, x, 5.26, 2.9, 0.3, [{"text": val, "size": 14, "color": WHITE, "bold": True}])
    add_text(s, 0.7, 6.7, 8, 0.28, [{"text": "고객몰  ·  홈 · 상품 · 회원 · 주문 · 커뮤니티", "size": 12, "color": RGBColor(0x8E, 0x98, 0xA3)}])
    add_text(s, 10.3, 6.45, 2.4, 0.55, [
        {"text": "MEGAZONE", "size": 12, "color": WHITE, "bold": True, "align": PP_ALIGN.RIGHT},
        {"text": "CLOUD", "size": 12, "color": TEAL, "bold": True, "align": PP_ALIGN.RIGHT, "before": 0},
    ])

    # 2 purpose
    s = prs.slides.add_slide(blank)
    bg(s, CREAM); footer(s, 2, total)
    kicker(s, "PURPOSE")
    title(s, "제공 목적 및 범위")
    lead(s, "부캉이 굿즈샵 고객 홈페이지에서 상품을 찾고, 가입하고, 주문하는 순서를 안내합니다.")
    card(s, 0.55, 1.6, 4.0, 4.85, "목적", [
        "홈에서 상품으로 가는 경로",
        "회원·배송지·주문 내역의 위치",
        "각 화면에서 입력하는 항목",
        "배송비, 로그인, 옵션처럼",
        "막히기 쉬운 규칙",
    ])
    card(s, 4.7, 1.6, 4.0, 4.85, "다루는 화면", [
        "상단 메뉴, 검색, 장바구니",
        "홈 배너와 카테고리",
        "상품 색상과 사이즈",
        "가입, 로그인, 아이디 찾기",
        "비밀번호 재설정",
        "주문, 마이페이지, 게시판, 푸터",
    ])
    card(s, 8.85, 1.6, 3.95, 4.85, "범위 밖", [
        "관리자 상품·주문·게시판",
        "서버 설치와 배포",
        "도메인, 인증서 설정",
        "결제사 가맹, 메일 계정",
        "",
        "고객이 브라우저에서",
        "누르는 화면만 다룹니다.",
    ])

    # 3 sitemap
    s = prs.slides.add_slide(blank)
    bg(s, CREAM); footer(s, 3, total)
    kicker(s, "MAP")
    title(s, "화면 지도")
    lead(s, "모든 페이지 위에 같은 상단이 있고, 본문 아래에는 푸터가 있습니다.")
    menus = [
        ("전체 굿즈", "등록된 상품 전체"),
        ("인형·키링", "봉제 인형, 인형 키링"),
        ("리빙", "무드등, 볼"),
        ("문구·데스크", "노트, 마우스패드"),
        ("의류", "티셔츠"),
        ("부캉이 이야기", "캐릭터 소개"),
        ("커뮤니티", "공지, Q&A, 자유글"),
    ]
    for i, (name, desc) in enumerate(menus):
        col = i % 4
        row = 0 if i < 4 else 1
        if i >= 4:
            x = 0.55 + (i - 4) * 4.2
            w = 4.02
        else:
            x = 0.55 + col * 3.15
            w = 3.02
        y = 1.55 + row * 1.42
        rect(s, x, y, w, 1.28, CARD, LINE, 0.08)
        add_text(s, x + 0.2, y + 0.22, w - 0.4, 0.32, [{"text": name, "size": 15, "color": INK, "bold": True}])
        add_text(s, x + 0.2, y + 0.64, w - 0.4, 0.4, [{"text": desc, "size": 13, "color": MUTED}])
    icons = [
        ("돋보기", "상품명 검색. 한 번에 최대 7개"),
        ("가방", "장바구니. 숫자는 담긴 품목 수"),
        ("사람", "로그인 전 가입·로그인, 이후 내 정보"),
    ]
    for i, (name, desc) in enumerate(icons):
        x = 0.55 + i * 4.2
        rect(s, x, 4.55, 4.02, 1.95, CARD, LINE, 0.08)
        add_text(s, x + 0.22, 4.75, 3.6, 0.3, [{"text": name, "size": 15, "color": INK, "bold": True}])
        add_text(s, x + 0.22, 5.2, 3.6, 0.9, [{"text": desc, "size": 13, "color": MUTED, "spc": 1.15}])

    # 4 overview
    s = prs.slides.add_slide(blank)
    bg(s, CREAM); footer(s, 4, total)
    kicker(s, "OVERVIEW")
    title(s, "이용 순서")
    lead(s, "둘러보기 → 옵션 선택 → 로그인 → 결제 → 주문 확인. 둘러보기와 검색은 로그인 없이 됩니다.")
    steps = [
        ("홈에서 고르기", "배너, 카테고리, 추천 상품에서 마음에 드는 굿즈를 엽니다.", "결과: 상품 상세"),
        ("색상·사이즈", "있는 상품만 고릅니다. 티셔츠는 S부터 XL 순입니다.", "결과: 구매할 옵션"),
        ("로그인", "비회원이면 가입합니다. 구매·글쓰기는 로그인 후입니다.", "결과: 이름 표시"),
        ("장바구니·결제", "수량을 확인하고 배송지를 입력한 뒤 결제합니다.", "결과: 주문 완료"),
        ("이후 확인", "주문 내역에서 리뷰를 쓰고, 소식은 커뮤니티에서 봅니다.", "결과: 마이페이지"),
    ]
    for i, (h, b, r) in enumerate(steps[:3]):
        step_card(s, 0.55 + i * 4.2, 1.58, 4.02, 2.35, i + 1, h, b, r)
    for i, (h, b, r) in enumerate(steps[3:]):
        step_card(s, 0.55 + i * 4.2, 4.1, 4.02, 2.35, i + 4, h, b, r)
    rect(s, 8.95, 4.1, 3.85, 2.35, CARD, LINE, 0.06)
    add_text(s, 9.15, 4.28, 3.5, 0.7, [{"text": "바로 구매도 장바구니를 거칩니다.", "size": 14, "color": INK, "bold": True}])
    add_text(s, 9.15, 5.1, 3.5, 1.1, [{"text": "누르면 상품이 담긴 뒤 장바구니 화면으로 이동합니다. 결제 창은 바로 열리지 않습니다.", "size": 13, "color": MUTED, "spc": 1.15}])

    screens = [
        (5, 'SCREEN  ·  홈', '첫 화면', '배너는 6초마다 바뀌고, 마우스를 올리거나 키보드로 고르면 멈춥니다.', 'home.png', [
            '이 화면에서',
            '로고는 홈으로 돌아갑니다.',
            '메뉴 7개로 분류를 엽니다.',
            '← → 와 01 / 03 으로 배너를 넘깁니다.',
            '■ 는 자동 재생을 멈추고, ▶ 는 다시 재생합니다.',
            '배너 문구는 해당 상품으로 이동합니다.',
        ]),
        (6, 'SCREEN  ·  홈', '추천 상품', '배너 아래에는 카테고리와 골라 담을 상품이 이어집니다.', 'home-picks.png', [
            '이 화면에서',
            '인형, 키링, 무드등, 볼이 먼저 나옵니다.',
            '이어서 노트, 마우스패드, 티셔츠가 있습니다.',
            '카드를 누르면 상품 상세로 갑니다.',
            '오른쪽 전체 굿즈 보기는 목록입니다.',
        ]),
        (7, 'SCREEN  ·  목록', '전체 굿즈', '상단 메뉴의 전체 굿즈입니다. 등록된 상품 7개가 보입니다.', 'category.png', [
            '이 화면에서',
            '인형·키링, 리빙, 문구·데스크, 의류로 좁힐 수 있습니다.',
            '카드에는 상품명과 가격이 있습니다.',
            '정렬은 오른쪽에서 바꿉니다.',
        ]),
        (8, 'SCREEN  ·  상품', '색상과 사이즈', '티셔츠는 화이트·블랙, 사이즈는 S부터 XL입니다.', 'product-option.png', [
            '이 화면에서',
            '색을 고르면 대표 사진이 바뀝니다.',
            '사이즈를 고르면 아래에 수량과 금액이 생깁니다.',
            '바로 구매는 장바구니에 담은 뒤 장바구니로 이동합니다.',
            '장바구니 담기는 이동을 한 번 더 묻습니다.',
            '찜하기는 저장되지 않습니다.',
        ]),
        (9, 'SCREEN  ·  검색', '상품명 검색', '돋보기를 누르면 입력창이 열립니다. 예시는 티셔츠입니다.', 'search.png', [
            '이 화면에서',
            '한글·영문 상품명에 포함된 상품만 나옵니다.',
            '한 번에 최대 7개입니다.',
            '항목을 누르면 그 상품으로 이동합니다.',
            '없으면 검색 결과가 없습니다.',
            '바깥을 누르거나 Esc로 닫힙니다.',
        ]),
        (10, 'SCREEN  ·  회원', '로그인', '사람 아이콘에서 로그인과 회원가입으로 들어갑니다.', 'login.png', [
            '이 화면에서',
            '아이디와 비밀번호를 입력합니다.',
            '로그인은 1시간 동안 유지됩니다.',
            '아이디 찾기, 비밀번호 찾기가 아래에 있습니다.',
            '구매와 글쓰기는 로그인 후입니다.',
        ]),
        (11, 'SCREEN  ·  회원', '회원가입', '아이디, 비밀번호, 이름, 이메일, 휴대폰, 주소가 필요합니다.', 'register.png', [
            '이 화면에서',
            '아이디는 영문·숫자 4~16자, 중복 확인.',
            '비밀번호는 10자 이상, 영문·숫자·특수문자.',
            '주소는 주소검색으로 넣습니다.',
            '필수 약관에 동의해야 가입됩니다.',
        ]),
        (12, 'SCREEN  ·  주문', '장바구니', '담긴 품목 수만큼 가방 아이콘에 숫자가 붙습니다.', 'cart.png', [
            '이 화면에서',
            '수량 변경, 빼기, 선택 후 주문하기.',
            '5만 원 미만은 배송비 2,800원입니다.',
            '5만 원 이상이면 배송비는 0원입니다.',
            '비우기는 장바구니를 비웁니다.',
        ]),
        (13, 'SCREEN  ·  주문', '배송지와 결제', '주문하기를 누르면 받는 분과 주소가 채워져 있습니다.', 'order.png', [
            '이 화면에서',
            '저장된 배송지가 기본으로 들어갑니다.',
            '주소찾기로 이번 주문 주소를 바꿀 수 있습니다.',
            '결제하기를 누르면 결제 창이 열립니다.',
            '취소를 하면 주문은 완료되지 않습니다.',
        ]),
        (14, 'SCREEN  ·  마이페이지', '내 정보', '로그인한 뒤 사람 아이콘의 회원정보관리입니다.', 'mypage.png', [
            '이 화면에서',
            '회원 정보는 비밀번호를 다시 확인한 뒤 수정합니다.',
            '배송지 관리는 다음 주문에만 반영됩니다.',
            '주문 내역에서 리뷰를 씁니다. 10자 이상.',
            '1:1 문의는 안내 문구만 있습니다. 질문은 Q&A에 남깁니다.',
        ]),
        (15, 'SCREEN  ·  커뮤니티', '게시판', '공지, Q&A, 이벤트, 자유게시판이 한 목록입니다.', 'board.png', [
            '이 화면에서',
            '글쓰기는 로그인 후입니다.',
            '일반 회원은 자유게시판과 Q&A.',
            '공지와 이벤트는 관리자만 작성합니다.',
            '비밀글은 작성자와 관리자만 봅니다.',
        ]),
        (16, 'SCREEN  ·  하단', '푸터', '모든 페이지 아래에 같은 안내가 있습니다.', 'footer.png', [
            '이 화면에서',
            '상품·배송 문의는 Q&A로 갑니다.',
            '부캉이 소식은 공지사항입니다.',
            '이용약관과 개인정보처리방침은 창으로 열립니다.',
            '사업자 정보는 예시 문구입니다.',
        ]),
    ]
    for n, label, heading, summary, image, notes in screens:
        screen_slide(prs, blank, n, total, label, heading, summary, image, notes)

    # 13 rules table
    s = prs.slides.add_slide(blank)
    bg(s, CREAM); footer(s, 17, total)
    kicker(s, "RULES")
    title(s, "화면에서 자주 만나는 기준")
    lead(s, "고객에게 안내할 때 아래 문장 그대로 설명할 수 있습니다.")
    rows = [
        ("상황", "화면", "이렇게 안내"),
        ("로그인 없이 구매", "로그인이 필요합니다", "로그인하거나 가입한 뒤 다시 담기"),
        ("색·사이즈 미선택", "옵션을 선택해 주세요", "있는 상품만 색과 사이즈를 고름"),
        ("5만 원 미만", "배송비 2,800원", "상품 합계 기준. 5만 원부터 무료"),
        ("5만 원 이상", "배송비 0원", "상단 공지의 무료배송과 같음"),
        ("1시간 지난 로그인", "세션이 만료되었습니다", "다시 로그인. 장바구니는 계정에 남음"),
        ("비밀번호 링크", "15분, 한 번", "못 받았으면 1분 뒤 다시 요청"),
        ("찜하기", "버튼만 보임", "저장되지 않음. 장바구니를 사용"),
    ]
    table = s.shapes.add_table(len(rows), 3, Inches(0.55), Inches(1.55), Inches(12.25), Inches(5.2)).table
    table.columns[0].width = Inches(2.7)
    table.columns[1].width = Inches(4.3)
    table.columns[2].width = Inches(5.25)
    for r, row in enumerate(rows):
        for c, val in enumerate(row):
            head = r == 0
            style_cell(
                table.cell(r, c), val, 12,
                WHITE if head else INK, head,
                TEAL_DARK if head else (WHITE if r % 2 else RGBColor(0xFB, 0xF9, 0xF5)),
            )

    # 14 checklist
    s = prs.slides.add_slide(blank)
    bg(s, CREAM); footer(s, 18, total)
    kicker(s, "CHECKLIST")
    title(s, "고객 안내 전에 확인할 것")
    lead(s, "새 담당자가 홈페이지를 설명할 때 아래 세 묶음만 보면 됩니다.")
    groups = [
        ("둘러보기", [
            "로고가 홈으로 돌아가는지",
            "메뉴 7개가 해당 목록으로 가는지",
            "배너 이전·다음·정지·재생",
            "검색어에 상품이 나오는지",
            "없는 검색어에 빈 안내가 나오는지",
        ]),
        ("구매", [
            "색상 선택 시 사진이 바뀌는지",
            "티셔츠 사이즈가 S부터인지",
            "비로그인 구매가 막히는지",
            "장바구니 배지 숫자가 맞는지",
            "5만 원 전후 배송비가 맞는지",
            "결제 취소 시 완료 화면이 아닌지",
        ]),
        ("회원·글", [
            "가입 필수 항목과 약관",
            "아이디 찾기 두 가지 방법",
            "재설정 메일이 이름 기준인지",
            "배송지 수정이 다음 주문에만",
            "리뷰가 주문 내역에서 쓰이는지",
            "Q&A 비밀글이 구분되는지",
        ]),
    ]
    for i, (h, lines) in enumerate(groups):
        x = 0.55 + i * 4.2
        rect(s, x, 1.58, 4.02, 5.15, CARD, LINE, 0.06)
        rect(s, x, 1.58, 4.02, 0.08, TEAL, radius=0)
        add_text(s, x + 0.22, 1.82, 3.6, 0.4, [{"text": h, "size": 16, "color": INK, "bold": True}])
        paras = []
        for n, line in enumerate(lines, 1):
            paras.append({"runs": [(f"{n}   ", 13, TEAL, True), (line, 13, MUTED, False)], "after": 10})
        add_text(s, x + 0.22, 2.4, 3.6, 4.0, paras)

    # 15 thanks
    s = prs.slides.add_slide(blank)
    bg(s, NAVY)
    add_text(s, 0.7, 1.7, 10, 0.3, [{"text": "THANK YOU", "size": 13, "color": TEAL, "bold": True}])
    add_text(s, 0.68, 2.15, 11, 0.8, [{"text": "정예성", "size": 40, "color": WHITE, "bold": True}])
    add_text(s, 0.7, 3.15, 10, 0.7, [
        {"text": "Megazone Cloud  ·  클라우드 기반 AI 보안 엔지니어링 양성과정", "size": 15, "color": RGBColor(0xC5, 0xCB, 0xD1), "after": 6},
        {"text": "문의  yeah105299@gmail.com  ·  010-2940-1365", "size": 15, "color": RGBColor(0xC5, 0xCB, 0xD1)},
    ])
    rect(s, 0.7, 4.35, 1.15, 0.015, TEAL, radius=0)
    add_text(s, 0.7, 4.6, 11, 1.3, [
        {"text": "이 문서는 부캉이 굿즈샵 고객몰 v3.2 화면 기준입니다.", "size": 14, "color": WHITE, "after": 6},
        {"text": "관리자 화면, 서버 구축, 결제사·메일 계정 발급 절차는 포함하지 않습니다.", "size": 14, "color": RGBColor(0xC5, 0xCB, 0xD1)},
    ])
    add_text(s, 10.3, 6.45, 2.4, 0.55, [
        {"text": "MEGAZONE", "size": 12, "color": WHITE, "bold": True, "align": PP_ALIGN.RIGHT},
        {"text": "CLOUD", "size": 12, "color": TEAL, "bold": True, "align": PP_ALIGN.RIGHT},
    ])

    prs.save(OUT)
    print(OUT)


if __name__ == "__main__":
    build()
