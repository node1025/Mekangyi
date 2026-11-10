# -*- coding: utf-8 -*-
"""Generate A-00 VPC/subnet/SG design DOCX for role-split document."""
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.shared import Pt, Cm
from docx.oxml import OxmlElement
from docx.oxml.ns import qn


def set_cell_shading(cell, fill: str) -> None:
    props = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    shd.set(qn("w:val"), "clear")
    props.append(shd)


def add_table(doc, headers, rows, header_fill="D9E2F3"):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = table.rows[0].cells
    for i, text in enumerate(headers):
        hdr[i].text = text
        set_cell_shading(hdr[i], header_fill)
        for p in hdr[i].paragraphs:
            for run in p.runs:
                run.bold = True
                run.font.size = Pt(9)
    for r_idx, row in enumerate(rows):
        cells = table.rows[r_idx + 1].cells
        for c_idx, text in enumerate(row):
            cells[c_idx].text = str(text)
            for p in cells[c_idx].paragraphs:
                for run in p.runs:
                    run.font.size = Pt(9)
    return table


def main() -> None:
    out = Path(r"C:\Users\wins_user\Documents\카카오톡 받은 파일\A-00_공통기반_VPC설계안_v1.0.docx")
    out.parent.mkdir(parents=True, exist_ok=True)

    doc = Document()
    sec = doc.sections[0]
    sec.top_margin = Cm(2.0)
    sec.bottom_margin = Cm(2.0)
    sec.left_margin = Cm(2.5)
    sec.right_margin = Cm(2.5)

    title = doc.add_heading("A-00 공통 기반 — VPC·서브넷·보안 그룹·DB 배치 설계안", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    meta = doc.add_paragraph()
    meta.add_run("문서 버전: v1.0\n").bold = False
    meta.add_run("대상 서비스: 부캉이 굿즈샵(Mekangyi) — 고객몰·관리자·API·MariaDB\n")
    meta.add_run("리전: ap-northeast-2 (서울), 가용 영역: 2개 (2a, 2c)\n")
    meta.add_run("참고: 서비스구축_역할분담_v1.0 — A-00 산출물 초안\n")

    doc.add_heading("1. 목적 및 범위", level=1)
    doc.add_paragraph(
        "본 문서는 A-00 공통 기반 산출물(VPC·서브넷·보안 그룹 구성도, IP 할당표, "
        "DB 배치안, 프라이빗 서브넷 외부 통신 경로)을 정의하기 위한 설계 기준과 "
        "확정안 예시를 제공한다. 인프라·보안·백엔드·운영이 동일한 전제 하에 "
        "구축·검증할 수 있도록 한다."
    )

    doc.add_heading("2. 사전 합의 항목", level=1)
    add_table(
        doc,
        ["항목", "결정 질문", "본 설계안(예)"],
        [
            ("리전·AZ", "DR·지연 요구?", "ap-northeast-2, AZ 2개"),
            ("트래픽", "인터넷 vs 제한 접속?", "고객몰: 인터넷 / 관리자: 허용 IP·VPN"),
            ("컴포넌트", "VPC 내 배치 대상?", "ALB, API(EC2/ECS), RDS MariaDB, NAT"),
            ("환경", "dev/stg/prod?", "단일 VPC 3-Tier(실습); 확장 시 VPC 분리"),
            ("가용성", "Multi-AZ·NAT 수?", "RDS Multi-AZ 또는 단일+백업; NAT 1개(비용) 또는 AZ별 2개"),
        ],
    )

    doc.add_heading("3. VPC 및 CIDR", level=1)
    doc.add_paragraph("VPC CIDR: 10.10.0.0/16")
    doc.add_paragraph(
        "DNS 호스트명·DNS 지원 활성화. 퍼블릭·프라이빗(앱)·DB 전용 tier를 AZ별로 대칭 배치한다. "
        "서브넷은 일반적으로 /24(256 IP)를 사용하며, ALB·NAT·ENI·오토스케일 여유를 고려한다."
    )

    doc.add_heading("4. IP 주소·서브넷 할당표", level=1)
    add_table(
        doc,
        [
            "서브넷명",
            "CIDR",
            "가용 영역",
            "용도",
            "배치 리소스",
            "라우팅",
            "확장 여유",
        ],
        [
            ("pub-2a", "10.10.0.0/24", "ap-northeast-2a", "퍼블릭", "ALB, NAT Gateway", "0.0.0.0/0 → IGW", "미사용 IP 충분"),
            ("pub-2c", "10.10.1.0/24", "ap-northeast-2c", "퍼블릭", "ALB(다중 AZ), NAT(선택)", "0.0.0.0/0 → IGW", "동일"),
            ("app-2a", "10.10.10.0/24", "ap-northeast-2a", "프라이빗 앱", "API EC2/ECS, 게이트웨이", "0.0.0.0/0 → NAT", "ASG 확장"),
            ("app-2c", "10.10.11.0/24", "ap-northeast-2c", "프라이빗 앱", "API 스탠바이", "0.0.0.0/0 → NAT", "동일"),
            ("db-2a", "10.10.20.0/24", "ap-northeast-2a", "DB 전용", "RDS MariaDB(Primary)", "로컬만(인터넷 없음)", "RDS 서브넷 그룹"),
            ("db-2c", "10.10.21.0/24", "ap-northeast-2c", "DB 전용", "RDS 보조 AZ", "로컬만", "Multi-AZ"),
        ],
    )
    doc.add_paragraph(
        "예약 CIDR: 10.10.30.0/23 — 향후 캐시(ElastiCache)·컨테이너(EKS) 등 확장용."
    )
    doc.add_paragraph(
        "정적 웹(고객몰·관리자 빌드 산출물)은 S3 + CloudFront 배포를 권장한다. "
        "API 및 관리자 경계 게이트웨이는 app 서브넷에 둔다."
    )

    doc.add_heading("5. 보안 그룹(SG) 구성", level=1)
    doc.add_paragraph(
        "원칙: CIDR 대입보다 SG 간 참조(sg-alb → sg-app → sg-db)를 우선한다. "
        "관리자 ALB는 허용 CIDR 또는 VPN 대역만 인바운드한다."
    )
    add_table(
        doc,
        ["SG 이름", "인바운드", "아웃바운드", "연결 리소스"],
        [
            (
                "sg-alb-public",
                "443(실습 시 80) from 0.0.0.0/0",
                "→ sg-app (앱 포트, 예: 5002)",
                "인터넷 대면 ALB(고객몰 API·게이트웨이)",
            ),
            (
                "sg-alb-admin",
                "443 from 관리자 허용 CIDR/VPN",
                "→ sg-app",
                "관리자 전용 ALB",
            ),
            (
                "sg-app",
                "앱 포트 only from sg-alb-*",
                "3306 → sg-db; 443 → NAT(외부 API)",
                "API·게이트웨이 EC2/ECS",
            ),
            (
                "sg-db",
                "3306 only from sg-app",
                "없음 또는 제한적",
                "RDS MariaDB",
            ),
        ],
    )

    doc.add_heading("6. 네트워크 구성도(텍스트)", level=1)
    doc.add_paragraph(
        "[Internet] → IGW → [pub: ALB] → [app: API/Gateway] → [db: RDS MariaDB]\n"
        "[app] → NAT GW(in pub) → Internet (패키지, Cloudinary, SMTP 등)\n"
        "[Admin/VPN CIDR] → ALB(관리자) → [app: 관리자 게이트웨이] → API\n"
        "※ 구성도 그림은 draw.io / PowerPoint로 본 문서와 동일 CIDR·SG명을 사용해 작성한다."
    )

    doc.add_heading("7. DB 배치안", level=1)
    doc.add_heading("7.1 권장안: Amazon RDS for MariaDB", level=2)
    doc.add_paragraph(
        "• 배치: db-2a / db-2c 서브넷 그룹\n"
        "• 엔진: MariaDB (애플리케이션 MARIADB_URI 호환)\n"
        "• 가용성: Multi-AZ(권장) 또는 단일 AZ + 자동 백업 7일\n"
        "• 접근: sg-app에서만 3306, 퍼블릭 접근 비활성화\n"
        "• 자격증명: Secrets Manager 또는 Parameter Store (평문 .env 미사용)\n"
        "• 개발/통합 DB: 별도 DB명(_dev, _test_dev) — 운영 DB와 분리(애플리케이션 정책과 동일)"
    )
    doc.add_heading("7.2 대안: EC2 자가 설치 MariaDB", level=2)
    doc.add_paragraph(
        "비용·학습 목적 시에만 db 서브넷 EC2 + EBS. OS·DB 패치·백업·스냅샷 절차를 "
        "별도 운영 문서에 명시해야 한다."
    )
    add_table(
        doc,
        ["기준", "RDS", "EC2 MariaDB"],
        [
            ("백업·패치", "자동화 용이", "운영자 책임"),
            ("보안", "db 서브넷 격리 동일", "동일 + OS 관리"),
            ("과제·문서화", "백업·Multi-AZ 기술 용이", "수동 절차 명시 필요"),
        ],
    )

    doc.add_heading("8. 프라이빗 서브넷 외부 통신 경로", level=1)
    add_table(
        doc,
        ["목적", "대상 예", "경로", "비고"],
        [
            ("OS·패키지", "인터넷", "NAT Gateway(퍼블릭 서브넷)", "AZ별 NAT 또는 단일 NAT"),
            ("이미지 CDN", "Cloudinary HTTPS", "NAT → 443", "SG egress 허용"),
            ("메일", "SMTP 587/465", "NAT", "로컬 메일함 아닌 운영 시"),
            ("AWS API(선택)", "S3, Secrets Manager", "VPC Interface Endpoint", "NAT·이그레스 비용 절감"),
            ("DB", "RDS 엔드포인트", "VPC 내부 라우팅만", "NAT/IGW 미연결"),
        ],
    )
    doc.add_paragraph(
        "DB 서브넷: 기본 라우트 없음(0.0.0.0/0 미설정). DB 인스턴스는 인터넷으로 나가지 않는다."
    )

    doc.add_heading("9. 역할 분담(검토)", level=1)
    add_table(
        doc,
        ["결정 사항", "주 담당", "검토"],
        [
            ("VPC CIDR·서브넷", "인프라(A-00)", "보안, 개발"),
            ("SG·NACL", "보안·인프라", "백엔드(리슨 포트)"),
            ("RDS 스펙", "인프라", "백엔드·비용"),
            ("관리자 접근 CIDR", "보안·운영", "프론트·관리자 URL"),
        ],
    )

    doc.add_heading("10. A-00 산출물 체크리스트", level=1)
    for item in [
        "VPC·서브넷·IGW·NAT·ALB 포함 네트워크 구성도 1장",
        "본 문서 §4 IP 할당표(확정 CIDR 반영)",
        "SG 매트릭스(포트·참조 SG)",
        "DB 배치 및 RDS vs EC2 결정 근거",
        "프라이빗 egress 표(NAT / VPC Endpoint)",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_paragraph()
    p = doc.add_paragraph("— 문서 끝 —")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.save(out)
    print(str(out))


if __name__ == "__main__":
    main()
