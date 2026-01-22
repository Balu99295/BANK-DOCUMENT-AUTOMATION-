# AI & Language Model Architecture

This document details the Artificial Intelligence, Language Model (LLM), and Machine Learning components currently active in the Bank Document Automation project.

---

## 1. Core Intelligence: The Embedding Model
The system uses **`all-MiniLM-L6-v2`**, a high-performance output transformer model, as its primary "Brain" for semantic understanding.

*   **Type**: Sentence-Transformer (BERT-based).
*   **Dimensions**: 384-dimensional vector space.
*   **Performance**: ~14,200 sentences/second on modern CPUs.
*   **Privacy**: Runs 100% locally. No data leaves the server.

### How It Works (The "Semantic Match")
When the system sees a field like `Mbl_No_01` in a PDF:
1.  **Tokenization**: Splits it into "Mbl", "No", "01".
2.  **Contextualization**: It looks at surrounding text (e.g., "Contact Details" section).
3.  **Vectorization**: Converts `Mbl No` into a vector `[0.12, -0.98, ... 0.45]`.
4.  **Nearest Neighbor Search**: It scans the `canonical_schema` (Standard Dictionary) for vectors close to this coordinate.
5.  **Result**: It finds "Mobile Number" (Distance: 0.2) is much closer than "Mother Name" (Distance: 0.9).

---

## 2. Advanced Mapping Engine (Agentic Logic)

The `mapping_engine.py` module implements an **Agentic Workflow** that goes beyond simple searching. It uses "Reasoning" logic to manage uncertainty.

### A. Confidence Scoring & Thresholds
The AI classifies its own certainty based on **Cosine Distance** (Similarity Inverse):
*   **🟢 High Confidence (Auto-Match)**: `Distance < 0.40`. 
    *   *Action*: Detailed as "Strong Match". System can Auto-Approve.
*   **🟡 Medium Confidence (Review Needed)**: `0.40 < Distance < 0.75`.
    *   *Action*: Marked as "Pending Review". User needs to confirm.
*   **🔴 Low Confidence (No Match)**: `Distance > 0.75`.
    *   *Action*: Suggests creating a new field.

### B. Ambiguity Detection (The "Disambiguation" Layer)
The engine retrieves the **Top 5 candidates**. It then checks for confusion:
*   **Logic**: If `Score(Candidate 1)` - `Score(Candidate 2)` < **0.05**.
*   **Diagnosis**: "The AI is confused." (e.g., distinguishing between "Current Address" and "Permanent Address" if the label is just "Address").
*   **Output**: The system flags this as **"Ambiguous"** in the UI and asks the human to decide.

---

## 3. Active Learning Loop (Correction Logging)
The system is designed to get smarter over time, even without retraining the core model immediately.

*   **The Feedback Loop**:
    1.  AI proposes: "Field `DoI` = `Date of Issue`".
    2.  Human corrects: "No, `DoI` = `Date of Incorporation`".
    3.  **Correction Logger**: The system records this override in `mappings/corrections.log`.
    
*   **Future Training**:
    *   These logs serve as a "Gold Standard" dataset.
    *   We can periodically fine-tune `MiniLM` on this dataset to permanently teach it that "DoI" means "Incorporation" in this specific bank's context.

---

## 4. RAG Implementation (Retrieval Augmented Generation)
We use RAG for validation logic, checking data against "Bank Policies".

*   **Knowledge Base**: Stores policy documents (txt/pdf) chunks in **ChromaDB**.
*   **Retrieval**: When validating an applicant (e.g., Age 17), the system queries: *"Minimum age requirements for account opening"*.
*   **Reasoning**: It retrieves the specific clause ("Must be 18+") and uses Python logic to enforce it.

---

## Summary of Active AI Components

| Component | Model / Technology | Function | Status |
| :--- | :--- | :--- | :--- |
| **Embeddings** | `all-MiniLM-L6-v2` | Semantic text understanding. | 🟢 Active |
| **Vector DB** | `ChromaDB` | Storing Schema & Knowledge. | 🟢 Active |
| **Disambiguation** | Custom Python Logic | Detecting confused/ambiguous matches. | 🟢 Active |
| **Learning** | JSONL Logging | capturing human corrections. | 🟢 Active (Data Collection) |
