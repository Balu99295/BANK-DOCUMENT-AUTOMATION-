# Bank Document Automation - System Overview

This document provides a technical and operational overview of the Bank Document Automation System. It describes the modules, architecture, and key workflows currently running in the production environment.

---

## 1. System Objective
To automate the generation of banking documents by effectively bridging the gap between **Structured Data** (CSVs, Databases) and **Unstructured Templates** (PDF Forms, Scanned Documents) using local Agentic AI.

---

## 2. Core Modules

### A. The Canonical Schema ("The Golden Record")
The system revolves around a central **Standard Banking Schema** (defined in `canonical_schema.py`).
*   **Role**: Acts as the universal translator.
*   **Function**: All external data is mapped to this schema, and all PDF fields are mapped to this schema. This decouples data from templates.
*   **Tech**: Stored in **ChromaDB** as vector embeddings for semantic search.

### B. Intelligent Mapping Engine (`mapping_engine.py`)
This is the "AI Agent" responsible for onboarding new templates.
*   **Discovery**: Scans PDFs for fields (AcroForm) or visual text labels (Flat PDF).
*   **Semantic Analysis**: Converts field labels into vectors and finds their "Standard" equivalent in the Canonical Schema.
*   **Advanced Logic**:
    *   **Confidence Scoring**: Assigns High/Medium/Low confidence tags.
    *   **Ambiguity Detection**: Flags fields where the AI isn't sure (e.g., similar top candidates).
    *   **Active Learning**: Logs human corrections to `mappings/corrections.log` to improve future suggestions.

### C. Universal Document Filler (`main.py`)
A robust, deterministic engine that handles the actual file generation.
*   **Dual-Mode Operation**:
    1.  **AcroForm Mode**: Fills native PDF fields, handling Checkboxes, Radio Buttons, and formatted text. Sets `/NeedAppearances` for compatibility.
    2.  **Overlay Mode**: "Draws" text onto "flat" (non-fillable) PDFs using computer vision coordinates (`x, y, w, h`).
*   **Auditability**: Records a cryptographic-style snapshot of exactly *how* the document was filled (Mapping Snapshot) for every single run.

### D. RAG Validation Service (`rag_service.py`)
Ensures data integrity before filling.
*   **Policy Retrieval**: Fetches bank policies (e.g., "KYC Rules") from the Knowledge Base relevant to the specific applicant.
*   **Rule Enforcement**: Validates data against these retrieved policies (e.g., "Age > 18", "Valid Tax ID").

---

## 3. Technical Stack & Architecture

### Backend (Local & Secure)
*   **Language**: Python 3.9+
*   **Framework**: Flask (REST API)
*   **AI Engine**: `sentence-transformers` (Model: `all-MiniLM-L6-v2`) running locally.
*   **Vector DB**: ChromaDB (Persistent local storage).
*   **PDF Processing**: `pypdf` (Forms), `reportlab` (Drawing).

### Frontend (Interactive & Responsive)
*   **Framework**: React (Vite).
*   **Key Interfaces**:
    *   **Intelligent Mapper**: A grid interface with "Confidence Badges", "Bulk Approve" buttons, and AI explanations.
    *   **Smart Form**: A dynamic form that groups fields by **Sections** (e.g., "PART 1: DETAILS") for easier manual entry.
*   **State**: Real-time optimistic UI updates for instant feedback.

---

## 4. Key Workflows

### Workflow 1: Onboarding a New Template
1.  **Upload**: User selects a PDF template.
2.  **Analysis**: System scans format (AcroForm vs Flat) and extracts fields.
3.  **Proposal**: AI generates `mapping.json` with proposed links to the Canonical Schema.
4.  **Review**: User enters "Intelligent Mapper" UI.
    *   *High Confidence*: User clicks "Auto-Approve".
    *   *Ambiguous*: User manually selects the correct field.
5.  **Learning**: Corrections are logged. Mapping is finalized.

### Workflow 2: Generating a Document
1.  **Selection**: User chooses "Account Opening Form".
2.  **Data Loading**: User selects "Client: John Doe" from CSV.
3.  **Normalization**: System maps CSV headers -> Canonical Schema -> PDF Fields.
4.  **Validation**: RAG Service checks constraints (Age, Citizenship).
5.  **Execution**: `UniversalDocumentFiller` writes the PDF.
6.  **Audit**: Run details are saved to `filled_metadata/run_history.jsonl`.

---

## 5. Security & Persistence
*   **Data Sovereignty**: Zero data leaves the local environment. No external API calls to OpenAI/Anthropic.
*   **Configuration**: Mappings are stored as JSON files, making them portable and version-controllable.
*   **Logs**: Comprehensive logs for debugging and compliance.
