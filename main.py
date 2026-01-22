import os
import json
import csv
import pandas as pd
import uuid
from datetime import datetime
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, BooleanObject, IndirectObject, DictionaryObject
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import red
import io

# Configuration Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, 'templates')
MAPPINGS_DIR = os.path.join(BASE_DIR, 'mappings')
FILLED_DIR = os.path.join(BASE_DIR, 'filled')
FILLED_META_DIR = os.path.join(BASE_DIR, 'filled_metadata')

# Ensure directories exist
for d in [FILLED_DIR, FILLED_META_DIR]:
    os.makedirs(d, exist_ok=True)

class AuditLogger:
    @staticmethod
    def log_run(run_data):
        """
        Logs the execution run to a history file and saves the mapping snapshot.
        """
        # 1. Save Run History (Append to JSONL)
        history_path = os.path.join(FILLED_META_DIR, 'run_history.jsonl')
        try:
            with open(history_path, 'a') as f:
                f.write(json.dumps(run_data) + "\n")
        except Exception as e:
            print(f"Audit Log Error: {e}")
            
        # 2. Save Mapping Snapshot
        if 'mapping_snapshot' in run_data:
            snapshot_id = run_data.get('mapping_snapshot_id')
            if snapshot_id:
                # Sanitize snapshot_id for filename
                s_id = "".join([c for c in snapshot_id if c.isalnum() or c in ['_', '-']])
                snap_path = os.path.join(FILLED_META_DIR, f"{s_id}_mapping.json")
                try:
                    with open(snap_path, 'w') as f:
                        json.dump(run_data['mapping_snapshot'], f, indent=2)
                except Exception as e:
                    print(f"Audit Snapshot Error: {e}")

def extract_form_fields_with_coords(pdf_path):
    """
    Extracts form fields with their page number and coordinates (Rect).
    Returns a dict: {field_name: {page: int, rect: [x, y, w, h]}}
    """
    reader = PdfReader(pdf_path)
    fields_map = {}
    
    # Iterate pages to find widgets
    for p_idx, page in enumerate(reader.pages):
        if '/Annots' in page:
            for annot in page['/Annots']:
                annot_obj = annot.get_object()
                if annot_obj.get('/Subtype') == '/Widget':
                    # Try to get the name
                    name = annot_obj.get('/T')
                    if not name and annot_obj.get('/Parent'):
                        # Parent name (simplification)
                        parent = annot_obj['/Parent'].get_object()
                        name = parent.get('/T')
                    
                    if name:
                        rect = annot_obj.get('/Rect')
                        tooltip = annot_obj.get('/TU')
                        
                        if rect:
                            rect = [float(x) for x in rect]
                            x_ll, y_ll, x_ur, y_ur = rect
                            
                            # Use CropBox if available (visible area), else MediaBox
                            box = page.cropbox if page.cropbox else page.mediabox
                            page_w = float(box.width)
                            page_h = float(box.height)
                            
                            # Normalize based on page dimensions
                            rel_x = (x_ll - float(box.left)) / page_w
                            rel_w = (x_ur - x_ll) / page_w
                            rel_h = (y_ur - y_ll) / page_h
                            rel_y = (float(box.top) - y_ur) / page_h
                            
                            fields_map[name] = {
                                "page": p_idx + 1,
                                "rect": [x_ll, y_ll, x_ur, y_ur], # RAW [x1, y1, x2, y2]
                                "rect_pct": [rel_x, rel_y, rel_w, rel_h],
                                "page_height": page_h,
                                "page_width": page_w,
                                "tooltip": tooltip or ""
                            }
    return fields_map

def find_section_headers(reader):
    """
    Scans PDF pages for likely Section Headers.
    Returns: { page_num: [(y_coord, "Header Text"), ...] }
    """
    headers_by_page = {}
    
    # Common Section Keywords
    section_keywords = [
        "section", "part", "details", "information", "declaration", 
        "agreement", "authorization", "certification", "beneficiary", 
        "instructions", "application", "applicant", "profile"
    ]
    
    for p_idx, page in enumerate(reader.pages):
        headers = []
        page_h = float(page.mediabox.height)
        
        def visitor_header(text, cm, tm, fontDict, fontSize):
            y = tm[5]
            clean = text.strip()
            if not clean or len(clean) < 3: return
            
            is_header = False
            clean_lower = clean.lower()
            
            # 1. Font Size Strategy (Headers usually larger)
            if fontSize > 10: 
                # Check for All Caps or Title Case
                if clean.isupper() or clean.istitle():
                    is_header = True
            
            # 2. Keyword Strategy (Even if font is small)
            if any(k in clean_lower for k in section_keywords):
                # Must be reasonably short to be a header, not a sentence
                if len(clean) < 60:
                    is_header = True
            
            # 3. Bold Helper (If font name contains 'Bold')
            if fontDict and 'Bold' in fontDict.get('/BaseFont', ''):
                if len(clean) < 60:
                    is_header = True

            if is_header:
                # Basic cleaning of typical header noise
                clean = clean.replace(':', '').strip()
                headers.append((y, clean))

        try:
            page.extract_text(visitor_text=visitor_header)
        except: pass
        
        # Sort headers by Y desc (Top to Bottom)
        headers.sort(key=lambda x: x[0], reverse=True) 
        headers_by_page[p_idx + 1] = headers
        
    return headers_by_page

def find_nearby_label(page, rect):
    """
    Spatial Scanner: Finds text visually close to a field.
    """
    if not rect: return ""
    x1, y1, x2, y2 = [float(z) for z in rect]
    
    nearby_text = []
    
    # Expanded search zones
    # Above: Up to 50pts
    # Left: Up to 250pts (for long labels like "Date of Incorporation")
    
    def visitor_label(text, cm, tm, fontDict, fontSize):
        if not text or len(text.strip()) < 2: return
        tx = tm[4]
        ty = tm[5]
        
        # 1. Check Above (Standard Label)
        # Tighter X constraint to avoid catching column headers for other fields
        if (x1 - 10) < tx < (x2 + 10):
            if y2 < ty < (y2 + 40): # Look slightly higher
                nearby_text.append(('above', ty, text.strip()))
                return

        # 2. Check Left (Inline Label)
        # Look broadly to the left
        if (y1 - 5) < ty < (y2 + 15):
             if (x1 - 250) < tx < x1:
                nearby_text.append(('left', tx, text.strip()))
                return

    try:
        page.extract_text(visitor_text=visitor_label)
    except: pass
    
    if not nearby_text: return ""
    
    # Prioritize Left labels for small fields (Checkboxes), Above for text boxes
    w = x2 - x1
    h = y2 - y1
    is_checkbox = (w < 20 and h < 20)
    
    above_matches = [x for x in nearby_text if x[0] == 'above']
    left_matches = [x for x in nearby_text if x[0] == 'left']
    
    if is_checkbox and left_matches:
        left_matches.sort(key=lambda x: x[1], reverse=True) # closest tx
        return left_matches[0][2]
    
    if above_matches:
        above_matches.sort(key=lambda x: x[1]) # closest ty
        return above_matches[0][2] 
        
    if left_matches:
        left_matches.sort(key=lambda x: x[1], reverse=True)
        return left_matches[0][2]
        
    return ""

def analyze_template(template_path):
    """
    Analyzes the PDF to determine fields.
    Includes Section-Aware Context Detection, Spatial Label Scanning, AND AcroForm Export Value extraction.
    """
    filename = os.path.basename(template_path)
    
    # --- 0. SMART CACHE CHECK ---
    try:
        import mapping_engine
        engine = mapping_engine.mapping_engine
        mapping_path = engine.get_mapping_file_path(filename)
        
        if os.path.exists(mapping_path):
            pdf_mtime = os.path.getmtime(template_path)
            map_mtime = os.path.getmtime(mapping_path)
            if map_mtime >= pdf_mtime:
                saved = engine.load_saved_params(filename)
                if saved and 'mappings' in saved and len(saved['mappings']) > 0:
                    return saved['mappings']
    except Exception as e:
        print(f"Cache check warning: {e}")

    try:
        reader = PdfReader(template_path)
        
        # PRE-SCAN FOR SECTIONS
        section_map = find_section_headers(reader)
        
        has_acrorequest = "/AcroForm" in reader.root_object if reader.root_object else False
        fields_found = reader.get_fields()
        
        if fields_found or has_acrorequest:
            print(f"[{filename}] Detected AcroForm fields.")
            form_fields = fields_found if fields_found else {}
            coords_map = extract_form_fields_with_coords(template_path)
            
            raw_fields = []
            for field_name, field_data in form_fields.items():
                
                meta = coords_map.get(field_name, {})
                page_num = meta.get('page', 1)
                rect = meta.get('rect')
                
                # Check for Checkbox Export Values
                export_options = []
                field_type = field_data.get('/FT')
                if field_type == '/Btn':
                    # Inspect /AP -> /N for appearance states
                    ap_dict = field_data.get('/AP', {}).get('/N', {})
                    if hasattr(ap_dict, 'keys'): # Ensure it's a dict or check keys
                         for k in ap_dict.keys():
                             if k != '/Off':
                                 export_options.append(str(k)) # Store as string (e.g. '/Yes')
                    elif '/Opt' in field_data:
                        # Sometimes options are in /Opt
                        export_options = [str(x) for x in field_data['/Opt']]
                
                # A. Section Context
                detected_section = "General"
                field_y = 0
                if rect:
                    field_y = max(float(rect[1]), float(rect[3]))
                
                if page_num in section_map:
                    for hy, htext in section_map[page_num]:
                        if hy > field_y:
                            detected_section = htext
                        else: break
                
                # B. Spatial Context
                visual_label = ""
                if rect and 0 <= (page_num - 1) < len(reader.pages):
                     visual_label = find_nearby_label(reader.pages[page_num - 1], rect)
                
                heuristic_label = field_name.split('.')[-1].replace('_', ' ').title()
                final_label = visual_label if visual_label else heuristic_label
                
                context = f"Section: {detected_section}."
                if visual_label: context += f" Visual Label: '{visual_label}'."
                context += f" Page: {page_num}"

                raw_fields.append({
                    "id": field_name, 
                    "label": final_label, 
                    "name": field_name, 
                    "type": "checkbox" if field_type == '/Btn' else "text", # Simple type inference
                    "section": detected_section, 
                    "context": context,
                    "placeholder": "",
                    "required": False,
                    "source": "acroform",
                    "rect": rect, 
                    "rect_pct": meta.get('rect_pct'),
                    "page": page_num,
                    "page_dims": [meta.get('page_width'), meta.get('page_height')] if meta.get('page_width') else None,
                    "export_options": export_options # Crucial for checking boxes
                })
            
            # --- THE INTELLIGENCE LAYER ---
            import mapping_engine
            import importlib
            importlib.reload(mapping_engine)
            
            mapped_fields = mapping_engine.mapping_engine.map_template_fields(filename, raw_fields)
            return mapped_fields
            
    except Exception as e:
        print(f"Error reading PDF fields: {e}")
        import traceback
        traceback.print_exc()

    # Fallback: Heuristic Scan of Flat PDF
    print(f"[{filename}] No AcroForm. Running Static Scan...")
    static_fields = scan_for_static_fields(template_path)
    
    if static_fields:
        import mapping_engine
        import importlib
        importlib.reload(mapping_engine)
        mapped_fields = mapping_engine.mapping_engine.map_template_fields(filename, static_fields)
        return mapped_fields

    return []

def scan_for_static_fields(template_path):
    """
    Heuristic Scanner for flat PDFs.
    Detects labels based on:
    1. Text ending in ':'
    2. Common form keywords
    3. Visual proximity to lines/boxes (implied)
    """
    print(f"Running Static Scanner on {os.path.basename(template_path)}...")
    reader = PdfReader(template_path)
    fields = []
    
    # Enhanced Keywords
    keywords = [
        "Name", "Date", "Signature", "Account", "Address", "Phone", "Mobile", "Email", 
        "SSN", "Title", "City", "State", "Zip", "Country", "Nationality", "Gender", 
        "Sex", "Marital", "Income", "Occupation", "Employer", "Reference", "Beneficiary",
        "Relationship", "Tax", "ID", "Number", "No.", "Code", "Amount", "Value"
    ]
    
    for page_num, page in enumerate(reader.pages):
        page_height = float(page.mediabox.height)
        page_width = float(page.mediabox.width)
        extracted_items = []
        
        def visitor_body(text, cm, tm, fontDict, fontSize):
            if text and len(text.strip()) > 1:
                x = tm[4]
                y = tm[5]
                extracted_items.append({
                    "text": text.strip(),
                    "x": x, "y": y,
                    "w": len(text) * (fontSize or 10) * 0.5
                })
        try: page.extract_text(visitor_text=visitor_body)
        except: continue
            
        for item in extracted_items:
            raw_text = item['text']
            clean_text = raw_text.replace(':', '').strip()
            
            # Heuristic 1: Ends with Colon (Strong Signal)
            has_colon = raw_text.strip().endswith(':')
            
            # Heuristic 2: Keyword Match
            is_keyword = any(k.lower() in clean_text.lower() for k in keywords)
            
            # Heuristic 3: All Caps (often labels)
            is_upper = clean_text.isupper() and len(clean_text) > 3
            
            if has_colon or is_keyword or is_upper:
                # Determine "Write Zone"
                # Usually to the right
                target_x = item['x'] + item['w'] + 5
                target_y = item['y']
                
                # Check bounds
                if target_x > page_width - 20: continue 
                
                # Unique ID
                field_id = f"static_{clean_text}_{page_num}_{int(item['x'])}"
                field_id = "".join(c for c in field_id if c.isalnum() or c=='_')
                
                rect = [target_x, target_y, target_x + 150, target_y + 15] 
                
                fields.append({
                    "id": field_id, "label": clean_text, "name": field_id,
                    "type": "text", "section": "General", 
                    "context": f"Page {page_num+1}. Label detected: '{clean_text}'",
                    "source": "static_scan", "rect": rect,
                    "rect_pct": [target_x/page_width, target_y/page_height, 150/page_width, 15/page_height],
                    "page": page_num + 1, "page_dims": [page_width, page_height]
                })
                
    print(f"Static Scanner found {len(fields)} potential fields.")
    return fields

# ==========================================
# UNIVERSAL DOCUMENT FILLER ENGINE
# ==========================================
class UniversalDocumentFiller:
    def __init__(self, template_path):
        self.template_path = template_path
        self.reader = PdfReader(template_path)
        self.writer = PdfWriter()
        
    def fill(self, record, output_path):
        fields = analyze_template(self.template_path)
        
        # Split fields by Mode
        acroform_data = {}
        overlay_fields = []
        
        for f in fields:
            # Get Canonical Name to find Value in Record
            key = f.get('name', f.get('id', ''))
            val = record.get(key, '')
            
            if not str(val).strip(): 
                continue # Skip empty
            
            # Decide: AcroForm vs Overlay
            if f.get('source') == 'acroform' and f.get('id'):
                internal_name = f['id']
                
                # Checkbox Handling
                if f.get('type') == 'checkbox':
                    # If val is truthy, find the 'On' export value
                    if str(val).lower() in ['true', 'yes', '1', 'on']:
                        options = f.get('export_options', [])
                        if options:
                            acroform_data[internal_name] = options[0] # Pick first non-Off option
                        else:
                            acroform_data[internal_name] = '/Yes' # Fallback
                    # If false, we just leave it or set to /Off (usually leaving it is better/safer)
                else:
                    acroform_data[internal_name] = str(val)
            else:
                # Overlay Mode
                overlay_fields.append(f)

        # 1. Fill AcroForm Fields using pypdf native Update
        self.writer.append(self.reader)
        
        if acroform_data:
            # Update all pages (fields are global in PDF usually, but attached to pages)
            # We iterate pages to ensure widget annotations are updated
            for page in self.writer.pages:
                self.writer.update_page_form_field_values(page, acroform_data)
            
            # FORCE RE-RENDER (NeedAppearances)
            # This is critical for Chrome/Adobe to show the data
            if "/AcroForm" not in self.writer.root_object:
                self.writer.root_object[NameObject('/AcroForm')] = \
                    self.writer._add_object(DictionaryObject())
            
            current_acroform = self.writer.root_object['/AcroForm']
            current_acroform[NameObject('/NeedAppearances')] = BooleanObject(True)

        # 2. Fill Overlay Fields
        if overlay_fields:
            # Group by page
            fields_by_page = {}
            for f in overlay_fields:
                p = f.get('page', 1) - 1
                if p not in fields_by_page: fields_by_page[p] = []
                fields_by_page[p].append(f)
                
            for i, page in enumerate(self.writer.pages):
                if i in fields_by_page:
                    self._apply_overlay(page, fields_by_page[i], record)

        # 3. Save
        with open(output_path, "wb") as f:
            self.writer.write(f)
            
        return fields # Return mapping snapshot for audit

    def _apply_overlay(self, page, fields, record):
        """Draws data onto a specific page using High-Precision Layout."""
        # Canvas Setup
        packet = io.BytesIO()
        try:
             pw = float(page.mediabox.width)
             ph = float(page.mediabox.height)
        except:
             pw, ph = 612, 792 # Fallback Letter
             
        c = canvas.Canvas(packet, pagesize=(pw, ph))
        
        for field in fields:
            key = field.get('name', field.get('id'))
            val = record.get(key, '')
            if not str(val).strip(): continue
            
            rect = field.get('rect') 
            if not rect: continue
            
            x1, y1, x2, y2 = [float(z) for z in rect]
            x = min(x1, x2)
            y = min(y1, y2)
            w = abs(x2 - x1)
            h = abs(y2 - y1)
            
            self._draw_text_field(c, val, x, y, w, h)
                
        c.save()
        packet.seek(0)
        overlay = PdfReader(packet)
        page.merge_page(overlay.pages[0])

    def _draw_text_field(self, c, text, x, y, w, h):
        text = str(text).strip()
        c.saveState()
        path = c.beginPath()
        path.rect(x, y, w, h)
        c.clipPath(path, stroke=0, fill=0)
        
        max_font_size = min(12, h * 0.8)
        c.setFont("Helvetica", max_font_size)
        
        # Simple Bottom Align
        # draw_y = y + 2
        
        # Center Vertical
        draw_y = y + (h/2) - (max_font_size/2) + 1
        
        c.setFillColorRGB(0, 0, 0.2)
        c.drawString(x + 2, draw_y, text)
        c.restoreState()


def fill_single_record(record, template_filename):
    """
    Main Entry Point for Filling.
    """
    template_path = os.path.join(TEMPLATES_DIR, template_filename)
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Template {template_filename} not found.")

    # 1. Create Output Path
    timestamp = datetime.now().strftime("%Y%m%d")
    output_subdir = os.path.join(FILLED_DIR, timestamp)
    os.makedirs(output_subdir, exist_ok=True)
    
    run_id = str(uuid.uuid4())
    safe_name = "".join([c for c in record.get('registered_name', 'Unknown') if c.isalpha() or c.isdigit() or c==' ']).strip()
    safe_name = safe_name.replace(" ", "_")
    output_filename = f"{safe_name}_{run_id[-6:]}_{template_filename}"
    output_path = os.path.join(output_subdir, output_filename)

    # 2. Execute Universal Filler
    print(f"[{template_filename}] Filling with UniversalDocumentFiller...")
    filler = UniversalDocumentFiller(template_path)
    mapping_snapshot = filler.fill(record, output_path)
    
    # 3. Audit Logging
    AuditLogger.log_run({
        "run_id": run_id,
        "template_id": template_filename,
        "operator_id": record.get('operator_id', 'system'),
        "timestamp": datetime.now().isoformat(),
        "mapping_snapshot_id": f"{safe_name}_{run_id[-6:]}",
        "mapping_snapshot": mapping_snapshot,
        "input_payload_keys": list(record.keys()), # Don't log full PII payload
        "filled_pdf_path": output_path
    })
        
    return output_path
