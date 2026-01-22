import json
import os
from dataclasses import dataclass
from typing import List, Optional, Dict, Any

@dataclass
class CanonicalField:
    field_id: str
    canonical_name: str
    display_label: str
    description: str
    synonyms: List[str]
    data_type: str
    section: str
    required_flag: bool
    pii_sensitivity_level: str 
    policy_tags: List[str]
    validation_regex: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    allowed_values: Optional[List[str]] = None
    example_values: Optional[List[str]] = None
    mapping_rationale: Optional[str] = None

    def to_embedding_string(self) -> str:
        """
        Constructs a rich string representation for vector embedding.
        We include synonyms and descriptions to maximize semantic matching.
        The LLM will match against this.
        """
        synonym_str = ", ".join(self.synonyms)
        return f"{self.display_label}: {self.description}. Synonyms: {synonym_str}. Section: {self.section}."

class CanonicalSchemaService:
    def __init__(self, schema_path: str):
        self.fields: Dict[str, CanonicalField] = {}
        self.schema_path = schema_path
        self.load_schema()

    def load_schema(self):
        if not os.path.exists(self.schema_path):
            print(f"Schema file not found at {self.schema_path}")
            return
        
        with open(self.schema_path, 'r') as f:
            data = json.load(f)
            for item in data:
                field = CanonicalField(
                    field_id=item['field_id'],
                    canonical_name=item['canonical_name'],
                    display_label=item.get('display_label', item['canonical_name']),
                    description=item.get('description', ''),
                    synonyms=item.get('synonyms', []),
                    data_type=item['data_type'],
                    section=item['section'],
                    required_flag=item['required_flag'],
                    pii_sensitivity_level=item.get('pii_sensitivity_level', 'Medium'),
                    policy_tags=item.get('policy_tags', []),
                    validation_regex=item.get('validation_regex'),
                    min_value=item.get('min_value'),
                    max_value=item.get('max_value'),
                    allowed_values=item.get('allowed_values'),
                    example_values=item.get('example_values'),
                    mapping_rationale=item.get('mapping_rationale')
                )
                self.fields[field.field_id] = field
        print(f"Loaded {len(self.fields)} canonical fields.")

    def get_field(self, field_id: str) -> Optional[CanonicalField]:
        return self.fields.get(field_id)

    def get_all_fields(self) -> List[CanonicalField]:
        return list(self.fields.values())

    def save_schema(self):
        """Persists the current schema to disk."""
        data = []
        for f in self.fields.values():
            filtered_dict = {k: v for k, v in vars(f).items() if v is not None}
            data.append(filtered_dict)
        
        with open(self.schema_path, 'w') as f:
            json.dump(data, f, indent=4)
        print("Schema saved successfully.")

    def add_field(self, field_data: Dict[str, Any]) -> CanonicalField:
        # Basic validation
        if field_data['field_id'] in self.fields:
            raise ValueError(f"Field ID {field_data['field_id']} already exists.")
        
        field = CanonicalField(
            field_id=field_data['field_id'],
            canonical_name=field_data['canonical_name'],
            display_label=field_data.get('display_label', field_data['canonical_name']),
            description=field_data.get('description', ''),
            synonyms=field_data.get('synonyms', []),
            data_type=field_data.get('data_type', 'string'),
            section=field_data.get('section', 'General'),
            required_flag=field_data.get('required_flag', False),
            pii_sensitivity_level=field_data.get('pii_sensitivity_level', 'Low'),
            policy_tags=field_data.get('policy_tags', []),
            validation_regex=field_data.get('validation_regex'),
            min_value=field_data.get('min_value'),
            max_value=field_data.get('max_value'),
            allowed_values=field_data.get('allowed_values'),
            example_values=field_data.get('example_values'),
            mapping_rationale=field_data.get('mapping_rationale')
        )
        self.fields[field.field_id] = field
        self.save_schema()
        return field

    def update_field(self, field_id: str, updates: Dict[str, Any]) -> CanonicalField:
        if field_id not in self.fields:
            raise KeyError(f"Field ID {field_id} not found.")
        
        field = self.fields[field_id]
        
        # Update attributes dynamically
        for k, v in updates.items():
            if hasattr(field, k):
                setattr(field, k, v)
        
        self.save_schema()
        return field

    def delete_field(self, field_id: str):
        if field_id in self.fields:
            del self.fields[field_id]
            self.save_schema()

# Global Instance (Lazy Loading)
_schema_service: Optional[CanonicalSchemaService] = None

def get_schema_service():
    global _schema_service
    if _schema_service is None:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        schema_path = os.path.join(base_dir, 'data', 'canonical_fields.json')
        _schema_service = CanonicalSchemaService(schema_path)
    return _schema_service

if __name__ == "__main__":
    # If run directly, we add new fields to the schema
    service = get_schema_service()
    
    new_fields = [
        # Loan / Credit
        {"field_id": "loan_amount_requested", "canonical_name": "Loan Amount", "data_type": "number", "section": "LOAN_DETAILS", "synonyms": ["Requested Amount", "Facility Amount"]},
        {"field_id": "loan_tenure_months", "canonical_name": "Loan Tenure (Months)", "data_type": "number", "section": "LOAN_DETAILS", "synonyms": ["Term in Months", "Duration"]},
        {"field_id": "loan_purpose", "canonical_name": "Loan Purpose", "data_type": "text", "section": "LOAN_DETAILS", "synonyms": ["Purpose of Credit", "Use of Funds"]},
        {"field_id": "collateral_type", "canonical_name": "Collateral Type", "data_type": "text", "section": "LOAN_DETAILS", "synonyms": ["Security Type", "Asset Pledged"]},
        {"field_id": "collateral_value", "canonical_name": "Collateral Value", "data_type": "number", "section": "LOAN_DETAILS", "synonyms": ["Security Value", "Asset Value"]},
        
        # Credit History
        {"field_id": "existing_loans_count", "canonical_name": "Number of Existing Loans", "data_type": "number", "section": "CREDIT_HISTORY", "synonyms": ["Active Loans", "Current Facilities"]},
        {"field_id": "total_monthly_liability", "canonical_name": "Total Monthly Liabilities", "data_type": "number", "section": "CREDIT_HISTORY", "synonyms": ["Monthly Repayments", "Total Obligations"]},
        {"field_id": "bankruptcy_history", "canonical_name": "Bankruptcy History", "data_type": "boolean", "section": "CREDIT_HISTORY", "synonyms": ["Insolvency Record", "Declared Bankrupt"]},
        
        # Next of Kin / Emergency
        {"field_id": "nok_name", "canonical_name": "Next of Kin Name", "data_type": "text", "section": "RELATIONSHIPS", "synonyms": ["Emergency Contact Name", "Beneficiary Name"]},
        {"field_id": "nok_relationship", "canonical_name": "Next of Kin Relationship", "data_type": "text", "section": "RELATIONSHIPS", "synonyms": ["Relationship to Applicant"]},
        {"field_id": "nok_phone", "canonical_name": "Next of Kin Phone", "data_type": "phone", "section": "RELATIONSHIPS", "synonyms": ["Emergency Contact No"]},
        
        # Business (for SME)
        {"field_id": "business_reg_number", "canonical_name": "Business Registration No", "data_type": "text", "section": "BUSINESS_DETAILS", "synonyms": ["Company Reg No", "UEN", "ACN"]},
        {"field_id": "date_of_incorporation", "canonical_name": "Date of Incorporation", "data_type": "date", "section": "BUSINESS_DETAILS", "synonyms": ["Company Start Date", "Registration Date"]},
        {"field_id": "business_type", "canonical_name": "Business Type", "data_type": "text", "section": "BUSINESS_DETAILS", "synonyms": ["Entity Type", "Constitution"]},
        {"field_id": "nature_of_business", "canonical_name": "Nature of Business", "data_type": "text", "section": "BUSINESS_DETAILS", "synonyms": ["Industry Description", "Activity"]},
        {"field_id": "annual_turnover", "canonical_name": "Annual Turnover", "data_type": "number", "section": "BUSINESS_DETAILS", "synonyms": ["Revenue", "Gross Sales"]},
        
        # Digital Banking
        {"field_id": "security_question", "canonical_name": "Security Question", "data_type": "text", "section": "SECURITY", "synonyms": ["Challenge Question"]},
        {"field_id": "security_answer", "canonical_name": "Security Answer", "data_type": "text", "section": "SECURITY", "synonyms": ["Challenge Answer"]},
        {"field_id": "promo_code", "canonical_name": "Promotion Code", "data_type": "text", "section": "ACCOUNT_DETAILS", "synonyms": ["Campaign Code", "Discount Code"]},
        
        # Compliance
        {"field_id": "kyc_risk_rating", "canonical_name": "KYC Risk Rating", "data_type": "text", "section": "OFFICE_USE", "synonyms": ["Risk Score", "Due Diligence Level"]},
        {"field_id": "verification_source", "canonical_name": "Verification Source", "data_type": "text", "section": "OFFICE_USE", "synonyms": ["Vetted By", "Check Source"]},
        {"field_id": "sanctions_check", "canonical_name": "Sanctions Check Passed", "data_type": "boolean", "section": "OFFICE_USE", "synonyms": ["AML Check", "Watchlist Screening"]},
        
        # Tax Extended
        {"field_id": "tax_residency_3", "canonical_name": "Tax Residency Country 3", "data_type": "text", "section": "FATCA_CRS", "synonyms": []},
        {"field_id": "tin_3", "canonical_name": "Tax ID Number 3", "data_type": "text", "section": "FATCA_CRS", "synonyms": []},
        
        # Addresses
        {"field_id": "mailing_address_line1", "canonical_name": "Mailing Address Line 1", "data_type": "text", "section": "CONTACT_DETAILS", "synonyms": ["Correspondence Address 1"]},
        {"field_id": "mailing_address_line2", "canonical_name": "Mailing Address Line 2", "data_type": "text", "section": "CONTACT_DETAILS", "synonyms": ["Correspondence Address 2"]},
        {"field_id": "mailing_city", "canonical_name": "Mailing City", "data_type": "text", "section": "CONTACT_DETAILS", "synonyms": ["Correspondence City"]},
        {"field_id": "mailing_country", "canonical_name": "Mailing Country", "data_type": "text", "section": "CONTACT_DETAILS", "synonyms": ["Correspondence Country"]},
        {"field_id": "mailing_zip", "canonical_name": "Mailing Zip Code", "data_type": "text", "section": "CONTACT_DETAILS", "synonyms": ["Correspondence Postal Code"]}
    ]
    
    print(f"Checking {len(new_fields)} additional fields...")
    for f in new_fields:
        try:
            service.add_field(f)
            print(f"Added: {f['canonical_name']}")
        except ValueError:
            pass # Already exists
            
    # Force re-ingestion in RAG
    import rag_service
    # We delete the collection and re-create to force update (simple way)
    # Actually, RAG service checks if collection empty.
    # We can just run the ingest method directly.
    rag_service.rag_service.ingest_schema()
