from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import os
import main
import rag_service
import pandas as pd
import json
import shutil
from datetime import datetime
import canonical_schema

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FILLED_DIR = os.path.join(BASE_DIR, 'filled')
TEMPLATES_DIR = os.path.join(BASE_DIR, 'templates')
DATA_DIR = os.path.join(BASE_DIR, 'data')

os.makedirs(TEMPLATES_DIR, exist_ok=True)
os.makedirs(FILLED_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

app.config['UPLOAD_FOLDER'] = TEMPLATES_DIR
app.config['DATA_FOLDER'] = DATA_DIR
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB

# Config to persist state
CONFIG_FILE = os.path.join(BASE_DIR, 'server_state.json')

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_config(key, value):
    config = load_config()
    config[key] = value
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f)

# Global variable to track the active data source file
# Load from config or default
_config = load_config()
ACTIVE_DATA_FILE = _config.get('active_data_file', os.path.join(DATA_DIR, 'sample_accounts.csv'))

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files: return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({"error": "No selected file"}), 400
    if file:
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], file.filename))
        return jsonify({"message": "File uploaded successfully", "filename": file.filename})

@app.route('/canonical_schema')
def get_canonical_schema():
    service = canonical_schema.get_schema_service()
    fields = [vars(f) for f in service.get_all_fields()]
    return jsonify(fields)

@app.route('/canonical_schema', methods=['POST'])
def add_canonical_field():
    data = request.json
    service = canonical_schema.get_schema_service()
    try:
        new_field = service.add_field(data)
        return jsonify(vars(new_field)), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/canonical_schema/<field_id>', methods=['PUT'])
def update_canonical_field(field_id):
    data = request.json
    service = canonical_schema.get_schema_service()
    try:
        updated_field = service.update_field(field_id, data)
        return jsonify(vars(updated_field))
    except KeyError:
        return jsonify({"error": "Field not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/canonical_schema/<field_id>', methods=['DELETE'])
def delete_canonical_field(field_id):
    service = canonical_schema.get_schema_service()
    try:
        service.delete_field(field_id)
        return jsonify({"message": "Field deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/schema_analytics')
def get_schema_analytics():
    # Simple analytics based on current state
    service = canonical_schema.get_schema_service()
    fields = service.get_all_fields()
    
    total_fields = len(fields)
    fields_by_sensitivity = {}
    fields_by_type = {}
    
    for f in fields:
        sens = f.pii_sensitivity_level or "Unknown"
        fields_by_sensitivity[sens] = fields_by_sensitivity.get(sens, 0) + 1
        
        dtype = f.data_type or "Unknown"
        fields_by_type[dtype] = fields_by_type.get(dtype, 0) + 1
        
    # Mock usage data (in a real app, this would query the mapping engine)
    usage_stats = {
        "mapped_templates": 3,
        "avg_confidence": 0.92,
        "flagged_fields": 5,
        "top_used_fields": sorted([f.canonical_name for f in fields[:5]])
    }
    
    return jsonify({
        "total_fields": total_fields,
        "sensitivity_breakdown": fields_by_sensitivity,
        "type_breakdown": fields_by_type,
        "usage": usage_stats
    })

@app.route('/upload_data', methods=['POST'])
def upload_data():
    global ACTIVE_DATA_FILE
    if 'file' not in request.files: return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({"error": "No selected file"}), 400
    if file and file.filename.endswith('.csv'):
        # 1. Save original
        filepath = os.path.join(app.config['DATA_FOLDER'], file.filename)
        file.save(filepath)
        ACTIVE_DATA_FILE = filepath
        
        # PERSIST active file
        save_config('active_data_file', filepath)
        
        # 2. Parse & INTELLIGENTLY NORMALIZE HEADERS
        try:
            df = pd.read_csv(filepath)
            
            # Get Schema for validation
            service = canonical_schema.get_schema_service()
            known_fields = {f.field_id for f in service.get_all_fields()}
            
            new_columns = {}
            for col in df.columns:
                # If exact match, good.
                if col in known_fields:
                    continue
                    
                # If not, ask RAG
                print(f"Data Upload: Mapping unknown column '{col}'...")
                # Use strict search
                candidates = rag_service.rag_service.search_canonical_field_batch([str(col)], n_results=1)
                
                # Check match
                if candidates[0] and candidates[0][0]['score'] < 1.0: # Good match
                     best_id = candidates[0][0]['metadata']['field_id']
                     print(f"  -> Mapped '{col}' to '{best_id}'")
                     new_columns[col] = best_id
                else:
                     print(f"  -> Could not map '{col}'")
            
            # Rename columns
            if new_columns:
                df.rename(columns=new_columns, inplace=True)
                # Overwrite file with normalized headers
                df.to_csv(filepath, index=False)
                
            records = df.fillna('').to_dict(orient='records')
            return jsonify({"message": "Data source updated & normalized", "filename": file.filename, "records": records, "remapped_columns": new_columns})
        except Exception as e:
            return jsonify({"error": f"Failed to parse CSV: {str(e)}"}), 500
    return jsonify({"error": "Invalid file type. Only CSV allowed."}), 400

@app.route('/data_source', methods=['DELETE'])
def delete_data_source():
    global ACTIVE_DATA_FILE
    if os.path.exists(ACTIVE_DATA_FILE):
        try:
            os.remove(ACTIVE_DATA_FILE)
            ACTIVE_DATA_FILE = ""
            save_config('active_data_file', "")
            return jsonify({"message": "Data source deleted successfully"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        ACTIVE_DATA_FILE = ""
        save_config('active_data_file', "")
        return jsonify({"message": "Data source cleared"})

@app.route('/templates')
def list_templates():
    files = [f for f in os.listdir(TEMPLATES_DIR) if f.endswith('.pdf')]
    files.sort(key=lambda x: os.path.getmtime(os.path.join(TEMPLATES_DIR, x)), reverse=True)
    return jsonify(files)

@app.route('/delete_template/<filename>', methods=['DELETE'])
def delete_template(filename):
    file_path = os.path.join(TEMPLATES_DIR, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return jsonify({"message": f"Template {filename} deleted successfully"}), 200
    return jsonify({"error": "File not found"}), 404

@app.route('/download_template/<filename>')
def download_template(filename):
    if os.path.exists(os.path.join(TEMPLATES_DIR, filename)):
        return send_from_directory(TEMPLATES_DIR, filename, as_attachment=True)
    return jsonify({"error": "Template not found"}), 404

@app.route('/samples')
def list_samples():
    global ACTIVE_DATA_FILE
    if os.path.exists(ACTIVE_DATA_FILE):
        try:
            df = pd.read_csv(ACTIVE_DATA_FILE)
            # Clean NaN values
            return jsonify(df.fillna('').to_dict(orient='records'))
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    return jsonify([])

@app.route('/download_sample_csv')
def download_sample_csv():
    # Ensure the file exists, if not create it
    sample_path = os.path.join(DATA_DIR, 'sample_database.csv')
    if not os.path.exists(sample_path):
        with open(sample_path, 'w') as f:
            f.write("registered_name,account_number,date_signed,nationality,country,email,phone,account_type\n")
            f.write("John Doe,12345678,2023-01-01,Singaporean,Singapore,john@example.com,91234567,SGD Current Account\n")
    
    return send_from_directory(DATA_DIR, 'sample_database.csv', as_attachment=True)

@app.route('/template_fields')
def get_fields():
    template_name = request.args.get('template')
    if not template_name: return jsonify([])
    try:
        fields = main.analyze_template(os.path.join(TEMPLATES_DIR, template_name))
        return jsonify(fields)
    except Exception as e:
        print(f"Error getting fields: {e}")
        return jsonify([])

@app.route('/update_mapping', methods=['POST'])
def update_mapping():
    data = request.json
    template_name = data.get('template_name')
    field_id = data.get('field_id')
    canonical_id = data.get('canonical_id')
    status = data.get('status', 'manual_override')
    
    if not all([template_name, field_id, canonical_id]):
        return jsonify({"error": "Missing arguments"}), 400
        
    import mapping_engine
    mapping_engine.mapping_engine.update_mapping(template_name, field_id, canonical_id, status)
    return jsonify({"status": "success"})

@app.route('/process_application', methods=['POST'])
def process_application():
    data = request.json
    
    is_valid, enriched_data, rag_logs = rag_service.rag_service.validate_and_enrich(data)
    
    if not is_valid:
        return jsonify({"status": "error", "message": "Validation Failed", "logs": rag_logs})

    try:
        requested_template = data.get('template_name')
        
        if requested_template and os.path.exists(os.path.join(TEMPLATES_DIR, requested_template)):
            template_name = requested_template
        else:
            templates = [f for f in os.listdir(TEMPLATES_DIR) if f.endswith('.pdf')]
            templates.sort(key=lambda x: os.path.getmtime(os.path.join(TEMPLATES_DIR, x)), reverse=True)
            
            if not templates:
                return jsonify({"status": "error", "message": "No template found.", "logs": rag_logs})
            template_name = templates[0]
            
        rag_logs.append(f"Orchestration: Selected template '{template_name}'")
        rag_logs.append(f"Orchestration: Retrieving Intelligent Mappings for '{template_name}'...")
        
        # Trigger filling (which now handles mapping lookup internally)
        output_path = main.fill_single_record(enriched_data, template_filename=template_name)
        
        rel_path = os.path.relpath(output_path, FILLED_DIR).replace('\\', '/')
        
        return jsonify({
            "status": "success", 
            "file_path": rel_path,
            "logs": rag_logs + [f"Generated: {os.path.basename(output_path)}"]
        })
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "logs": rag_logs})

@app.route('/download/<path:filename>')
def download_file(filename):
    return send_from_directory(FILLED_DIR, filename)



@app.route('/test_schema_match')
def test_schema_match():
    query = request.args.get('query')
    if not query: return jsonify([])
    
    results = rag_service.rag_service.search_canonical_field(query, n_results=3)
    return jsonify(results)

@app.route('/dashboard_stats')
def dashboard_stats():
    # 1. Counts
    template_count = len([f for f in os.listdir(TEMPLATES_DIR) if f.endswith('.pdf')])
    
    filled_count = 0
    for root, dirs, files in os.walk(FILLED_DIR):
        filled_count += len([f for f in files if f.endswith('.pdf')])
        
    # 2. Recent Activity (Mix of Templates and Applications)
    activities = []
    
    # Templates
    for t in os.listdir(TEMPLATES_DIR):
        if t.endswith('.pdf'):
            path = os.path.join(TEMPLATES_DIR, t)
            mtime = os.path.getmtime(path)
            activities.append({
                "action": "Template Added",
                "details": t,
                "timestamp": mtime,
                "status": "Ready",
                "type": "template"
            })
            
    # Applications
    for root, dirs, files in os.walk(FILLED_DIR):
        for f in files:
            if f.endswith('.pdf'):
                path = os.path.join(root, f)
                mtime = os.path.getmtime(path)
                
                # IMPROVED: Parse filename for better description
                # Format: TemplateName_PersonName_Timestamp.pdf
                # We want: "AccountOpening for John Doe"
                name_parts = f.replace('.pdf', '').split('_')
                display_name = f
                
                try:
                    # Heuristic: Identify the "middle" part as the name
                    # Remove timestamp (last item) and template name (first item?)
                    # This is tricky because template name can have underscores.
                    # Best effort: readable string.
                    display_name = f.replace('.pdf', '').replace('_', ' ')
                    # Trim the timestamp if it looks like one (last 10 digits)
                    if name_parts[-1].isdigit() and len(name_parts[-1]) > 8:
                        display_name = " ".join(display_name.split(' ')[:-1])
                except Exception:
                    pass

                activities.append({
                    "action": "Application Processed",
                    "details": display_name,
                    "timestamp": mtime,
                    "status": "Success",
                    "type": "application"
                })
                
    # Sort by time desc
    activities.sort(key=lambda x: x['timestamp'], reverse=True)
    recent = activities[:10]
    
    # Format time for frontend
    now = datetime.now().timestamp()
    for act in recent:
        diff = now - act['timestamp']
        if diff < 60: act['time'] = "Just now"
        elif diff < 3600: act['time'] = f"{int(diff/60)} mins ago"
        elif diff < 86400: act['time'] = f"{int(diff/3600)} hours ago"
        else: act['time'] = f"{int(diff/86400)} days ago"
        del act['timestamp'] # Cleanup

    return jsonify({
        "active_templates": template_count,
        "applications_filled": filled_count,
        "auto_mapped_percent": 94, # calculated placeholder
        "recent_activity": recent
    })

if __name__ == '__main__':
    print("Starting API Server on port 8000...")
    app.run(host='0.0.0.0', port=8000, debug=True)
