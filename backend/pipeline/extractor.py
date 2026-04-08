import pdfplumber
import io
import re
from pathlib import Path


def clean_text(text: str) -> str:
    """Remove common noise from extracted text (slide headers, footers, metadata)."""

    # Remove course codes like "CSE543", "CS101", "ECE 440", etc.
    text = re.sub(r'\b[A-Z]{2,5}\s?\d{3,4}[A-Z]?\b', '', text)

    # Remove slide/page numbers like "7", "Slide 12", "Page 3"
    text = re.sub(r'(?i)\b(?:slide|page)\s*\d+\b', '', text)
    # Standalone numbers on their own line (slide numbers)
    text = re.sub(r'^\s*\d{1,3}\s*$', '', text, flags=re.MULTILINE)

    # Remove professor/author name patterns at end of lines
    # e.g. "Stephen S", "Dr. Smith", "Prof. Jones", "- John D"
    text = re.sub(r'(?:^|\n)\s*[-–—]?\s*(?:Dr\.?|Prof\.?|Professor)?\s*[A-Z][a-z]+\s+[A-Z]\.?\s*$',
                  '', text, flags=re.MULTILINE)

    # Remove common footer patterns like "© 2024", "All rights reserved"
    text = re.sub(r'©\s*\d{4}.*', '', text)
    text = re.sub(r'(?i)all\s+rights\s+reserved.*', '', text)

    # Remove "Yau" standalone references (common professor name in slides)
    text = re.sub(r'\bYau\b', '', text)

    # Clean up leftover artifacts
    text = re.sub(r'[■□▪▫●○◆◇►▶]', '', text)  # Remove bullet symbols that came from PDF
    text = re.sub(r'\s{3,}', '  ', text)  # Collapse excessive whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)  # Collapse excessive newlines
    text = re.sub(r'^\s+$', '', text, flags=re.MULTILINE)  # Remove blank lines with spaces

    return text.strip()


def extract_text(file_bytes: bytes, filename: str) -> str:
    suffix = Path(filename).suffix.lower()

    if suffix == ".pdf":
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
            raw = "\n\n".join(pages).strip()
            return clean_text(raw)

    elif suffix in (".txt", ".md"):
        raw = file_bytes.decode("utf-8", errors="ignore").strip()
        return clean_text(raw)

    else:
        raise ValueError(f"Unsupported file type: {suffix}. Please upload PDF, TXT, or MD files.")
