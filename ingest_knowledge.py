import os
import chromadb
from chromadb.utils import embedding_functions
from pypdf import PdfReader

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
KB_DIR = os.path.join(BASE_DIR, 'knowledge_base')
DB_DIR = os.path.join(BASE_DIR, 'chroma_db')

# Initialize ChromaDB (Persistent)
client = chromadb.PersistentClient(path=DB_DIR)

# Use a lightweight local embedding model (no API key needed)
# This downloads a small model (~80MB) on first run
ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")

collection = client.get_or_create_collection(name="bank_policies", embedding_function=ef)

def ingest_documents():
    if not os.path.exists(KB_DIR):
        os.makedirs(KB_DIR)
        print(f"Created {KB_DIR}. Please put PDF policies here.")
        return

    files = [f for f in os.listdir(KB_DIR) if f.endswith('.pdf')]
    if not files:
        print("No PDF files found in 'knowledge_base/'.")
        return

    print(f"Found {len(files)} documents. Processing...")

    for filename in files:
        filepath = os.path.join(KB_DIR, filename)
        print(f"Reading {filename}...")
        
        try:
            reader = PdfReader(filepath)
            text_chunks = []
            metadatas = []
            ids = []
            
            for i, page in enumerate(reader.pages):
                text = page.extract_text()
                if text:
                    # Simple chunking by page for now
                    chunk_id = f"{filename}_page_{i}"
                    text_chunks.append(text)
                    metadatas.append({"source": filename, "page": i})
                    ids.append(chunk_id)
            
            if text_chunks:
                collection.upsert(
                    documents=text_chunks,
                    metadatas=metadatas,
                    ids=ids
                )
                print(f"  -> Indexed {len(text_chunks)} pages from {filename}.")
                
        except Exception as e:
            print(f"Error processing {filename}: {e}")

    print("Ingestion Complete. Vector Database is ready.")

if __name__ == "__main__":
    ingest_documents()
