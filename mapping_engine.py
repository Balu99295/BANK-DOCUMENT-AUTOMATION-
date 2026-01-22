from typing import List, Dict, Any, Optional
import rag_service
import os
import json
from datetime import datetime

class DynamicMappingEngine:
    """
    The Core Intelligence of the System (Intelligent Field Mapper).
    
    HOW IT WORKS:
    1. **Ingestion**: The system maintains a Vector Database of 100+ Canonical Fields (Standard Banking Schema).
       Each field has an embedding derived from its Name, Description, and Synonyms.
       
    2. **Reading Templates**: When a new PDF is uploaded, we extract its form fields (e.g., "txt_fname", "DOB_v2").
    
    3. **Vector Analysis**: 
       For each unknown PDF field, we generate a semantic query:
       "Label: {label}. Section: {section}. Placeholder: {placeholder}"
       
    4. **Semantic Matching**: 
       We compare this query against our Canonical Field embeddings using Cosine Similarity.
       - Distance < 0.35: Excellent Match (Auto-Approve)
       - Distance < 0.65: Likely Match (Suggest for Review)
       - Distance > 0.65: Weak Match (Suggest New Field)
       
    5. **Continuous Learning**: User overrides are saved, creating a "feedback loop".
    """
    def __init__(self):
        self.mappings_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mappings')
        os.makedirs(self.mappings_dir, exist_ok=True)

    def get_mapping_file_path(self, template_id: str) -> str:
        # Sanitize template_id (usually filename)
        safe_name = "".join([c for c in template_id if c.isalpha() or c.isdigit() or c in ['_', '-', '.']])
        return os.path.join(self.mappings_dir, f"{safe_name}.mapping.json")

    def load_saved_params(self, template_id: str) -> Dict[str, Any]:
        path = self.get_mapping_file_path(template_id)
        if os.path.exists(path):
            with open(path, 'r') as f:
                return json.load(f)
        return {}

    def save_mappings(self, template_id: str, field_mappings: List[Dict[str, Any]]):
        path = self.get_mapping_file_path(template_id)
        data = {
            "template_id": template_id,
            "last_updated": datetime.now().isoformat(),
            "mappings": field_mappings
        }
        with open(path, 'w') as f:
            json.dump(data, f, indent=2)

    def map_template_fields(self, template_id: str, template_fields: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Main entry point for "Reading" a template.
        Optimized with Batch Processing and Context Awareness.
        """
        mapped_fields = []
        saved_data = self.load_saved_params(template_id)
        saved_map = {}
        if saved_data and 'mappings' in saved_data:
             for m in saved_data['mappings']:
                 # Map both ID and resolved name to the mapping for robustness
                 if 'id' in m: saved_map[m['id']] = m
                 if 'name' in m: saved_map[m['name']] = m
        
        # Prepare Batch
        to_process_indices = []
        queries = []

        # First Loop: Identify which fields need new mapping
        for i, field in enumerate(template_fields):
            field_id = field.get('id', field.get('name'))
            
            # Check existing
            existing = saved_map.get(field_id)
            if existing and existing.get('mapping_status') in ['approved', 'manual_override']:
                # Persist all critical metadata
                field.update({
                    'mapping_proposal': existing['mapping_proposal'],
                    'name': existing.get('name'),
                    'mapping_status': existing['mapping_status'],
                    'mapping_source': existing.get('mapping_source', 'historical'),
                    'reviewed_by': existing.get('reviewed_by'),
                    'confidence': existing.get('confidence', 'High')
                })
            else:
                # Needs analysis
                label = field.get('label', '')
                section = field.get('section', '')
                placeholder = field.get('placeholder', '')
                context = field.get('context', '') 
                
                # ENHANCED QUERY
                query_text = f"Field Label: {label}. Context: {context}. Section: {section}. Placeholder: {placeholder}"
                queries.append(query_text)
                to_process_indices.append(i) 

        # Execute Batch Search
        if queries:
            print(f"MappingEngine: Batch processing {len(queries)} fields for {template_id}...")
            batch_results = rag_service.rag_service.search_canonical_field_batch(queries, n_results=5) # Top-K=5
            
            for idx, candidates in zip(to_process_indices, batch_results):
                field = template_fields[idx]
                field_id = field.get('id', field.get('name'))
                
                best_match = None
                confidence = "Low"
                source = "Unmapped"
                mapping_status = "suggest_new"
                explanation = "No strong semantic match found."
                
                if candidates:
                    top_candidate = candidates[0]
                    distance = top_candidate['score']
                    
                    # 1. High Confidence
                    if distance < 0.40:
                        best_match = top_candidate['metadata']['field_id']
                        confidence = "High"
                        source = "auto_embedding_strong"
                        mapping_status = "auto"
                        explanation = f"Strong semantic match ({distance:.2f})"
                    
                    # 2. Medium Confidence / Ambiguous
                    elif distance < 0.75:
                        best_match = top_candidate['metadata']['field_id']
                        confidence = "Medium"
                        source = "auto_embedding_weak"
                        mapping_status = "pending_review"
                        explanation = f"Likely match ({distance:.2f}), needs review."
                        
                        # LLM Disambiguation Trigger (Logic only for now)
                        # If top 2 are very close (diff < 0.05), mark as ambiguous
                        if len(candidates) > 1 and abs(candidates[0]['score'] - candidates[1]['score']) < 0.05:
                            explanation += f" Ambiguous: Could also be {candidates[1]['metadata']['canonical_name']}."
                            # In future: call self.disambiguate_with_llm(field, candidates)
                    
                    else:
                        explanation = f"Weak match ({distance:.2f})."
                
                # Update Field
                field.update({
                    'original_name': field_id,
                    'name': best_match if best_match else field_id, # Fallback to ID if no match
                    'mapping_status': mapping_status,
                    'confidence': confidence,
                    'mapping_source': source,
                    'mapping_proposal': {
                        "canonical_field_id": best_match,
                        "suggested_new_field_name": field.get('label', field_id).lower().replace(' ', '_'),
                        "confidence": confidence,
                        "explanation": explanation,
                        "candidates": [c['metadata']['field_id'] for c in candidates] if candidates else [],
                        "scores": [c['score'] for c in candidates] if candidates else []
                    }
                })
                
                template_fields[idx] = field

        # Save all results
        self.save_mappings(template_id, template_fields)
        return template_fields

    def update_mapping(self, template_id: str, field_id: str, canonical_id: str, status: str = "manual_override", user: str = "human"):
        """
        Updates a specific field mapping based on user feedback.
        LOGS CORRECTION if user changes the AI's guess.
        """
        mapped_fields = []
        # Load existing
        saved_data = self.load_saved_params(template_id)
        if saved_data and 'mappings' in saved_data:
            mapped_fields = saved_data['mappings']
        
        # Find and update
        found = None
        for field in mapped_fields:
            # We check both original_name and id to be safe
            fid = field.get('original_name', field.get('id', ''))
            if fid == field_id:
                found = field
                break

        if found:
            original_guess = found.get('mapping_proposal', {}).get('canonical_field_id')
            
            # Log Correction if changed
            if original_guess and original_guess != canonical_id:
                self.log_correction(template_id, field_id, found.get('label', ''), original_guess, canonical_id)

            found['name'] = canonical_id
            found['mapping_proposal']['canonical_field_id'] = canonical_id
            found['mapping_status'] = status
            found['reviewed_by'] = user
            found['mapping_source'] = "manual_correction"
            found['confidence'] = "High" # Human is always high confidence
        
        self.save_mappings(template_id, mapped_fields)
        return True

    def log_correction(self, template, field_id, label, original_ai, correct_human):
        """Active Learning: Log correction for future training"""
        log_path = os.path.join(self.mappings_dir, "corrections.log")
        entry = {
            "timestamp": datetime.now().isoformat(),
            "template": template,
            "field_label": label,
            "ai_guess": original_ai,
            "human_correction": correct_human
        }
        try:
            with open(log_path, "a") as f:
                f.write(json.dumps(entry) + "\n")
        except: pass

# Global Instance
mapping_engine = DynamicMappingEngine()
