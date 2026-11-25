import html as _h
import os


def _wrap(body: str, title: str = "Preview") -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{_h.escape(title)}</title>
<style>
  *  {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Segoe UI', system-ui, Arial, sans-serif;
    font-size: 13.5px;
    line-height: 1.65;
    background: #f8fafc;
    color: #1e293b;
    padding: 28px 32px;
    min-height: 100%;
  }}
  /* ── DOCX / general ── */
  h1 {{ font-size: 1.5rem; margin: 1.1em 0 .5em; color: #0f172a; }}
  h2 {{ font-size: 1.2rem; margin: 1em 0 .4em; color: #1e293b; }}
  h3 {{ font-size: 1rem;   margin: .9em 0 .35em; color: #334155; }}
  h4, h5, h6 {{ font-size: .9rem; margin: .8em 0 .3em; color: #475569; }}
  p  {{ margin: .45em 0; }}
  ul, ol {{ padding-left: 1.6em; margin: .5em 0; }}
  li {{ margin: .2em 0; }}
  strong, b {{ font-weight: 700; }}
  em, i     {{ font-style: italic; }}
  table  {{ border-collapse: collapse; width: 100%; margin: 1em 0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.07); }}
  thead th {{ background: #1e3a8a; color: #fff; font-weight: 600; padding: 9px 13px; text-align: left; font-size: 12px; letter-spacing: .03em; }}
  tbody td {{ padding: 7px 13px; border-bottom: 1px solid #f1f5f9; }}
  tbody tr:nth-child(even) td {{ background: #f8fafc; }}
  tbody tr:hover td {{ background: #eff6ff; }}

  /* ── XLSX ── */
  .xlsx-tabs {{ display: flex; gap: 4px; margin-bottom: 0; flex-wrap: wrap; }}
  .xlsx-tabs button {{
    padding: 6px 18px; font-size: 12px; font-weight: 600; cursor: pointer;
    border: 1px solid #e2e8f0; border-bottom: none; border-radius: 6px 6px 0 0;
    background: #f1f5f9; color: #64748b; transition: all .15s;
  }}
  .xlsx-tabs button.active {{ background: #fff; color: #1e3a8a; border-color: #c7d2fe; }}
  .xlsx-sheet {{ display: none; background: #fff; border: 1px solid #c7d2fe; border-radius: 0 8px 8px 8px; overflow: auto; max-height: calc(100vh - 100px); }}
  .xlsx-sheet.active {{ display: block; }}
  .xlsx-sheet table {{ box-shadow: none; border-radius: 0; margin: 0; }}
  .xlsx-sheet thead th {{ background: #1e3a8a; font-size: 11.5px; padding: 8px 12px; }}
  .xlsx-sheet tbody td {{ font-size: 12.5px; white-space: nowrap; padding: 6px 12px; }}
  .xlsx-empty {{ padding: 32px; text-align: center; color: #94a3b8; }}

  /* ── PPTX ── */
  .slide-grid {{ display: grid; grid-template-columns: 200px 1fr; gap: 20px; align-items: start; }}
  .slide-thumbs {{ display: flex; flex-direction: column; gap: 8px; position: sticky; top: 0; max-height: calc(100vh - 80px); overflow-y: auto; padding-right: 4px; }}
  .slide-thumb {{
    background: #fff; border: 2px solid #e2e8f0; border-radius: 8px;
    padding: 10px; cursor: pointer; transition: all .15s; font-size: 11px;
    color: #64748b; min-height: 72px; overflow: hidden;
  }}
  .slide-thumb.active {{ border-color: #6366f1; background: #eef2ff; color: #4338ca; }}
  .slide-thumb:hover {{ border-color: #a5b4fc; }}
  .slide-num {{ font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px; }}
  .slide-title {{ font-weight: 700; font-size: 12px; color: inherit; }}
  .slide-main {{
    background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
    padding: 32px 36px; min-height: 400px; box-shadow: 0 2px 12px rgba(0,0,0,.06);
  }}
  .slide-main .slide-num {{ font-size: 11px; margin-bottom: 16px; }}
  .slide-main h1 {{ font-size: 1.6rem; margin-bottom: .6em; }}
  .slide-main p  {{ margin: .4em 0; font-size: 14px; }}
  .slide-empty {{ color: #94a3b8; font-style: italic; }}
  .slide-hidden {{ display: none; }}
</style>
<script>
function showSheet(id) {{
  document.querySelectorAll('.xlsx-sheet').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.xlsx-tabs button').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelector('[data-sheet="' + id + '"]').classList.add('active');
}}
function showSlide(n) {{
  document.querySelectorAll('.slide-main').forEach(s => s.classList.add('slide-hidden'));
  document.querySelectorAll('.slide-thumb').forEach(t => t.classList.remove('active'));
  document.getElementById('slide-' + n).classList.remove('slide-hidden');
  document.querySelector('[data-slide="' + n + '"]').classList.add('active');
}}
</script>
</head>
<body>
{body}
</body>
</html>"""


def docx_to_html(file_path: str) -> str:
    import mammoth
    with open(file_path, "rb") as f:
        result = mammoth.convert_to_html(f)
    name = os.path.splitext(os.path.basename(file_path))[0]
    return _wrap(result.value or "<p>No content found.</p>", title=name)


def xlsx_to_html(file_path: str) -> str:
    from openpyxl import load_workbook
    wb = load_workbook(file_path, read_only=True, data_only=True)
    sheets = list(wb.worksheets)
    if not sheets:
        return _wrap("<p>No sheets found.</p>")

    tabs_html = '<div class="xlsx-tabs">'
    body_html = ""
    for si, ws in enumerate(sheets):
        sid = f"sheet{si}"
        active_cls = " active" if si == 0 else ""
        tabs_html += f'<button class="btn{active_cls}" data-sheet="{sid}" onclick="showSheet(\'{sid}\')">{_h.escape(ws.title)}</button>'

        rows = list(ws.iter_rows(values_only=True))
        # skip trailing all-None rows
        while rows and all(c is None for c in rows[-1]):
            rows.pop()

        if not rows:
            body_html += f'<div id="{sid}" class="xlsx-sheet{active_cls}"><div class="xlsx-empty">Empty sheet</div></div>'
            continue

        tbl = '<div style="overflow-x:auto"><table><thead><tr>'
        for cell in rows[0]:
            tbl += f'<th>{_h.escape(str(cell)) if cell is not None else ""}</th>'
        tbl += '</tr></thead><tbody>'
        for row in rows[1:]:
            if all(c is None for c in row):
                continue
            tbl += '<tr>'
            for cell in row:
                val = str(cell) if cell is not None else ""
                tbl += f'<td>{_h.escape(val)}</td>'
            tbl += '</tr>'
        tbl += '</tbody></table></div>'
        body_html += f'<div id="{sid}" class="xlsx-sheet{active_cls}">{tbl}</div>'

    tabs_html += '</div>'
    name = os.path.splitext(os.path.basename(file_path))[0]
    return _wrap(tabs_html + body_html, title=name)


def pptx_to_html(file_path: str) -> str:
    from pptx import Presentation
    prs = Presentation(file_path)
    slides = list(prs.slides)
    if not slides:
        return _wrap("<p>No slides found.</p>")

    thumbs_html = '<div class="slide-grid"><div class="slide-thumbs">'
    mains_html  = '<div style="min-width:0">'

    for i, slide in enumerate(slides, 1):
        # collect text shapes in order
        texts = []
        title_text = ""
        for shape in slide.shapes:
            if not shape.has_text_frame:
                continue
            for para in shape.text_frame.paragraphs:
                t = para.text.strip()
                if t:
                    texts.append(_h.escape(t))
            # first shape with text as title
            if not title_text and shape.text_frame.text.strip():
                title_text = shape.text_frame.text.strip()[:60]

        active_cls = " active" if i == 1 else ""
        hidden_cls = " slide-hidden" if i != 1 else ""

        # Thumbnail
        preview_lines = "".join(f'<div style="font-size:10px;margin:.15em 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t}</div>' for t in texts[:4])
        thumbs_html += f'''
          <div class="slide-thumb{active_cls}" data-slide="{i}" onclick="showSlide({i})">
            <div class="slide-num">Slide {i}</div>
            <div class="slide-title">{_h.escape(title_text[:40]) if title_text else "—"}</div>
            {preview_lines}
          </div>'''

        # Full slide content
        if texts:
            content = f'<h1>{texts[0]}</h1>' + "".join(f"<p>{t}</p>" for t in texts[1:])
        else:
            content = '<p class="slide-empty">No text content on this slide.</p>'

        mains_html += f'''
          <div id="slide-{i}" class="slide-main{hidden_cls}">
            <div class="slide-num">Slide {i} of {len(slides)}</div>
            {content}
          </div>'''

    thumbs_html += '</div>'
    mains_html  += '</div>'
    name = os.path.splitext(os.path.basename(file_path))[0]
    return _wrap(thumbs_html + mains_html + '</div>', title=name)
