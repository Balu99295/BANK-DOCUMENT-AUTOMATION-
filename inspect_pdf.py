
import sys
import os
from pypdf import PdfReader

def inspect_pdf(pdf_path):
    if not os.path.exists(pdf_path):
        print(f"Error: File {pdf_path} not found.")
        return

    print(f"Inspecting: {pdf_path}")
    reader = PdfReader(pdf_path)
    
    if '/AcroForm' not in reader.trailer['/Root']:
        print("No AcroForm detected in this PDF.")
    else:
        print("AcroForm detected!")
        fields = reader.get_fields()
        if fields:
            print(f"Found {len(fields)} fields:")
            for field_name, field_data in fields.items():
                print(f"  - Name: {field_name}")
                print(f"    Type: {field_data.get('/FT')}")
                if '/V' in field_data:
                    print(f"    Current Value: {field_data['/V']}")
                if '/Opt' in field_data:
                    print(f"    Options: {field_data['/Opt']}")
        else:
            print("AcroForm present but no fields returned by get_fields().")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python inspect_pdf.py <path_to_pdf>")
    else:
        inspect_pdf(sys.argv[1])
