# Kế hoạch quản lý dự án (sản phẩm B)

| Tệp | Nội dung |
|---|---|
| `PM_Report.docx`, `PM_Report.pdf` | Báo cáo Project Management Plan (35 trang) |
| `ULS_PM_Plan.xlsx` | WBS, CPM, PERT, Gantt, nguồn lực, rủi ro, RACI, tài chính, EVA (công thức sống) |
| `PM_slides_brief.md` | Hướng dẫn làm slide 15 phút và câu hỏi dự kiến |
| `timelog.csv` | Giờ công thật của nhóm |
| `figures/` | Hình dùng trong báo cáo |

Mọi số liệu sinh từ `docs/tools/pm_model.py`, nên báo cáo, Excel và hình luôn khớp nhau.

## Dựng lại

```bash
cd docs/tools
python build_pm_excel.py ../pm/ULS_PM_Plan.xlsx
python build_pm_charts.py ../pm/figures
python build_pm_report.py ../pm              # ra PM_Report.md và PM_Report.docx
python finalize_pm_docx.py ../pm/PM_Report.docx ../pm/PM_Report.pdf   # cần Microsoft Word
```

Đổi giả định (đơn giá, hệ số, giờ công) ở `pm_model.py` hoặc ở sheet GiaDinh của Excel (ô vàng).
