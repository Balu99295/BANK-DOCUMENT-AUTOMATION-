# Bank Document Automation - Project Approach

This document outlines the architectural approach, design philosophy, and operational workflows of the Bank Document Automation System currently in production.

---

## 1. Executive Summary
The system is designed to automate the filling of complex banking documents (both digital Forms and scanned "Flat" PDFs) using Artificial Intelligence. It solves the **"N-to-N Mapping Problem"** (linking any data source to any document template) by introducing a **Canonical Schema** and an **Agentic AI Mapper**.

## 2. Core Philosophy: The Canonical Schema
Instead of hard-coding mappings between a CSV column (e.g., "DOB") and a PDF field (e.g., "Date_Birth_01"), the system uses a **Central Intermediary**:

*   **Data Sources** map to -> **Canonical Schema** (Standard Banking Dictionary).
*   **PDF Templates** map to -> **Canonical Schema**.

This allows **Universal Interoperability**. Once a template is mapped to the schema, it can accept data from *any* source that also conforms to the schema.

---

## 3. End-to-End Workflow

### Phase 1: Intelligent Onboarding (The "Mapping Engine")
When a new PDF Template is introduced:
1.  **Scanning**:
    *   **AcroForms**: The system extracts internal field names (`/T`), tooltips (`/TU`), and export values (for checkboxes).
    *   **Flat PDFs**: It uses **Heuristic Spatial Analysis** (`find_nearby_label`) to "read" text near empty boxes.
2.  **Semantic Analysis**:
    *   The `mapping_engine` generates a context-rich query for each field: *"Label: Parent Name. Section: Guardian Details."*
    *   It converts this query into a **Vector Embedding** using `all-MiniLM-L6-v2`.
3.  **AI Mapping Proposal**:
    *   It searches the **ChromaDB Vector Store** (Standard Schema) for the closest match.
    *   It calculates a **Confidence Score**:
        *   **High (> 0.60)**: Auto-match candidate.
        *   **Medium**: Ambiguous match (requires disambiguation).
4.  **Human Verification (Active Learning)**:
    *   The user reviews mappings in the **Intelligent Mapper UI**.
    *   Features: **Confidence Badges**, **Bulk Approval**.
    *   **Correction Logging**: If a user corrects the AI, the system logs this event to `corrections.log` to retrain the model later.

### Phase 2: Data Validation (RAG Service)
Before generation, the system validates the data:
1.  **Retrieval**: It queries the **Policy Knowledge Base** (e.g., *"Account opening age limit"*).
2.  **Enforcement**: It applies retrieved rules (e.g., "Must be 18+") to the dataset.
3.  **Enrichment**: It automatically calculates derived fields (e.g., `FATCA Status` based on `Nationality`).

### Phase 3: Deterministic Execution (The "Universal Filler")
The system uses a **Dual-Mode Engine** to generate the final file:
1.  **Mode A: AcroForm Filling** (for digital forms)
    *   Uses `pypdf` to inject data into form fields.
    *   **Feature**: Handles Checkbox `/ExportValues` (e.g., mapping `True` -> `/Yes`).
    *   **Compliance**: Sets `/NeedAppearances = True` to ensure data is visible in all viewers.
2.  **Mode B: Overlay Filling** (for flat/scanned PDFs)
    *   Uses `reportlab` to "draw" text on top of the PDF canvas.
    *   Uses coordinate geometry (`x, y`) derived during the scanning phase to place text precisely.

---

## 4. Technical Architecture

### Backend (Python/Flask)
*   **API Layer**: Flask REST API for frontend communication.
*   **Vector DB**: **ChromaDB** running locally for Schema and Policy storage.
*   **PDF Libraries**: `pypdf` (reading/form-filling), `reportlab` (canvas drawing).

### Frontend (React/Vite)
*   **State Management**: Real-time handling of "Dirty" states in mapping rows.
*   **Styles**: Modern CSS/Tailwind-like utility classes for a "FinTech" aesthetic.
*   **Visual Feedback**: Loaders, Confidence Badges, and Section Headers in forms.

### Security & Audit
*   **Local Execution**: The LLM and Vector DB run entirely on-premise (no cloud API calls), ensuring **Data Sovereignty**.
*   **Audit Trails**: Every generation run is logged with a "Snapshot" of the mapping used, ensuring complete reproducibility for compliance audits.

---

## 5. Current Capabilities (Summary)
*   ✅ **Auto-Detection** of Sections and Headers.
*   ✅ **Ambiguity Detection** when AI is unsure between two similar fields.
*   ✅ **Bulk Actions** for high-confidence mapping approval.
*   ✅ **Universal Support** for both Fillable and Non-Fillable PDFs.
