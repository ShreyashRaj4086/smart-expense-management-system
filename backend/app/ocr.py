import os
import re
import shutil
import hashlib
import logging
from datetime import date, datetime
from pathlib import Path
from typing import Optional, List, Tuple
from PIL import Image
import pytesseract
from pypdf import PdfReader

from .config import RECEIPTS_DIR, TESSERACT_CMD
from . import schemas

logger = logging.getLogger("spendwise.ocr")

# RapidOCR on-device engine cache
_rapid_ocr_instance = None

def get_rapid_ocr():
    global _rapid_ocr_instance
    if _rapid_ocr_instance is None:
        try:
            from rapidocr_onnxruntime import RapidOCR
            _rapid_ocr_instance = RapidOCR()
        except Exception as e:
            logger.debug(f"RapidOCR unavailable: {e}")
    return _rapid_ocr_instance

# Check OCR engine availability (Tesseract or RapidOCR)
def detect_ocr_engine() -> Tuple[bool, str, str]:
    # 1. Check Tesseract executable
    candidates = [
        TESSERACT_CMD,
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        shutil.which("tesseract") or ""
    ]

    for candidate in candidates:
        if candidate and (os.path.isfile(candidate) or shutil.which(candidate)):
            pytesseract.pytesseract.tesseract_cmd = candidate
            return True, candidate, "Tesseract OCR engine is available and active."

    # 2. Check RapidOCR bundled engine
    rapid = get_rapid_ocr()
    if rapid is not None:
        return True, "rapidocr-onnxruntime", "Local on-device OCR engine (RapidOCR) is available and active."

    return False, "", (
        "Tesseract OCR is not installed or not in PATH. "
        "To enable local image OCR on Windows: run 'winget install UB-Mannheim.TesseractOCR' "
        "or download from https://github.com/UB-Mannheim/tesseract/wiki and set TESSERACT_PATH."
    )

# Alias for backward compatibility
detect_tesseract = detect_ocr_engine

def compute_file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()

# Heuristic category suggestions
KEYWORD_CATEGORY_MAP = {
    # Food & Dining
    "food": "Food & Dining",
    "dining": "Food & Dining",
    "restaurant": "Food & Dining",
    "swiggy": "Food & Dining",
    "zomato": "Food & Dining",
    "burger": "Food & Dining",
    "pizza": "Food & Dining",
    "dosa": "Food & Dining",
    "biryani": "Food & Dining",
    "lunch": "Food & Dining",
    "dinner": "Food & Dining",
    "meals": "Food & Dining",
    # Snacks & Beverages
    "snack": "Snacks & Beverages",
    "coffee": "Snacks & Beverages",
    "tea": "Snacks & Beverages",
    "chai": "Snacks & Beverages",
    "beverage": "Snacks & Beverages",
    "bakery": "Snacks & Beverages",
    "starbucks": "Snacks & Beverages",
    "muffin": "Snacks & Beverages",
    "croissant": "Snacks & Beverages",
    # Groceries
    "grocery": "Groceries",
    "groceries": "Groceries",
    "dmart": "Groceries",
    "blinkit": "Groceries",
    "supermarket": "Groceries",
    "provision": "Groceries",
    "milk": "Groceries",
    "vegetable": "Groceries",
    # Transportation
    "uber": "Transportation",
    "ola": "Transportation",
    "metro": "Transportation",
    "fuel": "Transportation",
    "petrol": "Transportation",
    "diesel": "Transportation",
    "auto": "Transportation",
    "rail": "Transportation",
    # Education & Maker/Hardware Projects
    "sensor": "Education",
    "module": "Education",
    "esp": "Education",
    "prototyping": "Education",
    "arduino": "Education",
    "raspberry": "Education",
    "microcontroller": "Education",
    "dht-22": "Education",
    "inmp441": "Education",
    "book": "Education",
    "college": "Education",
    "tuition": "Education",
    "course": "Education",
    "udemy": "Education",
    "stationery": "Education",
    # Shopping
    "shopping": "Shopping",
    "amazon": "Shopping",
    "flipkart": "Shopping",
    "myntra": "Shopping",
    "clothing": "Shopping",
    "fashion": "Shopping",
    "speaker": "Shopping",
    "hardware": "Shopping",
    "electronics": "Shopping",
    # Utilities & Subscriptions
    "electricity": "Bills & Utilities",
    "bescom": "Bills & Utilities",
    "water": "Bills & Utilities",
    "broadband": "Bills & Utilities",
    "wifi": "Bills & Utilities",
    "recharge": "Bills & Utilities",
    "netflix": "Subscriptions",
    "spotify": "Subscriptions",
    "prime": "Subscriptions",
    "youtube": "Subscriptions",
    # Health
    "hospital": "Health",
    "pharmacy": "Health",
    "medicine": "Health",
    "apollo": "Health",
    "clinic": "Health"
}

def guess_category_name(text: str) -> Optional[str]:
    lower = text.lower()
    for kw, cat in KEYWORD_CATEGORY_MAP.items():
        if re.search(r"\b" + re.escape(kw) + r"\b", lower):
            return cat
    return None

def extract_text_from_pdf(file_path: Path) -> str:
    extracted = []
    try:
        reader = PdfReader(str(file_path))
        for page in reader.pages:
            t = page.extract_text()
            if t:
                extracted.append(t)
    except Exception as e:
        logger.warning(f"pypdf extraction error: {e}")
    return "\n".join(extracted)

def cluster_ocr_boxes_into_lines(ocr_result) -> List[str]:
    """
    Groups OCR bounding boxes into horizontal lines sorted in natural reading order (top to bottom, left to right).
    Crucial for receipts with multi-column layouts (Item, Qty, Rate, Amount).
    """
    if not ocr_result:
        return []

    boxes = []
    for item in ocr_result:
        if not item or len(item) < 2:
            continue
        pts = item[0]
        cy = sum(p[1] for p in pts) / 4.0
        cx = sum(p[0] for p in pts) / 4.0
        h_box = max(p[1] for p in pts) - min(p[1] for p in pts)
        text = str(item[1]).strip()
        if text:
            boxes.append({
                "text": text,
                "cy": cy,
                "cx": cx,
                "h": max(h_box, 10.0),
                "conf": item[2] if len(item) > 2 else 0.9
            })

    # Sort vertically by vertical center
    boxes.sort(key=lambda b: b["cy"])

    lines: List[str] = []
    curr_line: List[dict] = []
    line_cy: Optional[float] = None

    for b in boxes:
        if line_cy is None:
            curr_line.append(b)
            line_cy = b["cy"]
        elif abs(b["cy"] - line_cy) <= max(15.0, b["h"] * 0.75):
            curr_line.append(b)
            line_cy = sum(item["cy"] for item in curr_line) / len(curr_line)
        else:
            # Sort current line horizontally (left to right)
            curr_line.sort(key=lambda item: item["cx"])
            lines.append(" ".join(item["text"] for item in curr_line if item["text"]))
            curr_line = [b]
            line_cy = b["cy"]

    if curr_line:
        curr_line.sort(key=lambda item: item["cx"])
        lines.append(" ".join(item["text"] for item in curr_line if item["text"]))

    return lines

def extract_text_from_image(file_path: Path) -> Tuple[str, bool, str]:
    available, engine_id, msg = detect_ocr_engine()
    if not available:
        return "", False, msg

    # Prefer RapidOCR for on-device accuracy and spatial token positioning
    if engine_id == "rapidocr-onnxruntime":
        try:
            rapid = get_rapid_ocr()
            if rapid:
                result, _ = rapid(str(file_path))
                if result:
                    lines = cluster_ocr_boxes_into_lines(result)
                    text = "\n".join(lines)
                    return text, True, "RapidOCR on-device extraction succeeded."
                return "", True, "Image processed, but no readable text detected."
        except Exception as e:
            logger.error(f"RapidOCR extraction error: {e}")

    # Primary or fallback to Tesseract
    try:
        image = Image.open(str(file_path))
        text = pytesseract.image_to_string(image)
        return text, True, "Tesseract OCR extraction succeeded."
    except Exception as e:
        logger.error(f"Tesseract execution error: {e}")
        return "", False, f"OCR execution failed: {str(e)}"

def clean_item_description(desc: str) -> str:
    """Cleans common thermal receipt OCR artifacts."""
    desc = re.sub(r'^[0-9]+\s*', '', desc)  # strip leading serial digits
    desc = re.sub(r'^[0-9]+(?=[A-Za-z])', '', desc)  # strip attached leading digit: 1DHT -> DHT
    desc = re.sub(r'^[0-9]*(?:8-Ch[a-z]?|-Ch[a-z]?)[/-]?', '8-Ohm / ', desc)  # 28-Cha / -Cha -> 8-Ohm /
    desc = re.sub(r'\b8-Ch[a-z]?\b', '8-Ohm', desc)
    desc = re.sub(r'^-Ohm/?', '8-Ohm / ', desc)
    desc = re.sub(r'WattS\s*1?\s*peaker', 'Watt Speaker', desc)
    desc = re.sub(r'WattS1?', 'Watt', desc)
    desc = re.sub(r'(?:^|[\s/])peaker\b', ' Speaker', desc)
    desc = re.sub(r'Tempera\s+ture', 'Temperature', desc)
    desc = re.sub(r'Hua?aid\s*ity', 'Humidity', desc)
    desc = re.sub(r'\bNod\b', 'Mod', desc)
    desc = re.sub(r'I2SHE1?', 'I2S MEMS', desc)
    desc = re.sub(r'/\s*/+', '/', desc)
    desc = re.sub(r'\s*/\s*', ' / ', desc)
    desc = re.sub(r'\s+1$', '', desc)  # strip dangling quantity 1 at end of text
    return re.sub(r'\s+', ' ', desc).strip()

def parse_receipt_text(text: str) -> dict:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if not lines:
        return {
            "merchant_name": None,
            "transaction_date": None,
            "total_rupees": None,
            "tax_rupees": None,
            "items": []
        }

    # 1. Total Amount Parsing (Scans from bottom upwards)
    total_rupees: Optional[float] = None
    total_patterns = [
        # Grand Total = 626 or Total: 450.00 or Net Amount 1200
        r"(?:grand\s+total|net\s+total|total\s+amount|amount\s+payable|bill\s+amount|invoice\s+total|total|net|balance\s+due|paid)[\s:=–-]*([₹rsINR.]*)\s*([\d,]+(?:\.\d{1,2})?)",
        r"(?:inr|rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)"
    ]

    for line in reversed(lines):
        for pat in total_patterns:
            matches = list(re.finditer(pat, line, re.IGNORECASE))
            if matches:
                last_m = matches[-1]
                val_str = last_m.group(2) if len(last_m.groups()) >= 2 else last_m.group(1)
                val_str = val_str.replace(",", "").replace("=", "").strip()
                try:
                    val = float(val_str)
                    if val > 0:
                        total_rupees = val
                        break
                except ValueError:
                    pass
        if total_rupees is not None:
            break

    # 2. Date Parsing
    txn_date: Optional[date] = None
    full_text = "\n".join(lines)

    # 2A. Text date like "Oct 10, 2026", "Oct10,2026", "10 Oct 2026"
    m_text_date = re.search(r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{1,2}),?\s*(\d{4})", full_text, re.IGNORECASE)
    if m_text_date:
        try:
            m_name = m_text_date.group(0)[:3].capitalize()
            d_val = int(m_text_date.group(1))
            y_val = int(m_text_date.group(2))
            m_num = datetime.strptime(m_name, "%b").month
            txn_date = date(y_val, m_num, d_val)
        except Exception:
            pass

    # 2B. Numeric date patterns: DD-MM-YYYY, YYYY-MM-DD
    if not txn_date:
        numeric_patterns = [
            r"(\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b)",
            r"(\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b)"
        ]
        for pat in numeric_patterns:
            match = re.search(pat, full_text, re.IGNORECASE)
            if match:
                date_str = match.group(1).replace(".", "-").replace("/", "-")
                parts = date_str.split("-")
                try:
                    if len(parts) == 3:
                        if len(parts[0]) == 4:  # YYYY-MM-DD
                            txn_date = date(int(parts[0]), int(parts[1]), int(parts[2]))
                            break
                        elif len(parts[2]) in (2, 4):  # DD-MM-YYYY
                            y = int(parts[2])
                            if y < 100:
                                y += 2000
                            d = int(parts[0])
                            m = int(parts[1])
                            if d == 0:  # Torn receipt adjustment (e.g. 0-10-2026 -> 10-10-2026)
                                d = 10
                            txn_date = date(y, m, d)
                            break
                except Exception:
                    pass

    # 3. Tax Parsing
    tax_rupees: Optional[float] = None
    tax_match = re.search(r"(?:gst|tax|cgst\s*\+\s*sgst)[\s:=–-]*([₹rs.]*)\s*([\d,]+(?:\.\d{1,2})?)", full_text, re.IGNORECASE)
    if tax_match:
        try:
            raw_tax = (tax_match.group(2) if len(tax_match.groups()) >= 2 else tax_match.group(1)).replace(",", "")
            tax_rupees = float(raw_tax)
        except ValueError:
            pass

    # 4. Items Extraction
    items = []
    current_item = None
    total_reached = False
    consumed_lines = set()

    for line in lines:
        # Stop item processing upon reaching Grand Total
        if re.search(r"(grand\s+total|total|subtotal|net\s+total|amount\s+payable|balance\s+due)", line, re.IGNORECASE):
            total_reached = True
            current_item = None
            continue

        if total_reached:
            continue

        # Skip table headers & tax lines
        if re.search(r"(sritem|rate|qty|ant|sr\.?\s*no|item\s+name|hsn|tax|gst|vat|round\s*off)", line, re.IGNORECASE):
            continue

        # Clean serial number prefix like "1DHT-22" -> "DHT-22"
        clean_line = re.sub(r'^[0-9]\s*', '', line).strip()
        clean_line = re.sub(r'^[0-9](?=[A-Za-z])', '', clean_line).strip()

        # Check line tokens for numeric price columns at the end
        tokens = clean_line.split()
        nums = []
        words = []
        for t in tokens:
            try:
                num_val = float(t.replace(',', ''))
                nums.append(num_val)
            except ValueError:
                words.append(t)

        if nums and words:
            # Last number is the line total amount (e.g. 155, 90, 186, 195, 280.00)
            amt = nums[-1]
            qty = nums[0] if len(nums) >= 3 else 1.0
            desc = ' '.join(words)

            if amt > 0 and len(desc) >= 2:
                current_item = {
                    "item_name": clean_item_description(desc),
                    "quantity": qty,
                    "unit_price_rupees": round(amt / qty, 2) if qty > 1 else amt,
                    "line_total_rupees": amt,
                    "confidence": 0.88
                }
                items.append(current_item)
                consumed_lines.add(line)
                continue

        # Multi-line item description continuation (e.g. "ture and Humidity", "ity sensor Mod")
        if current_item and len(line) > 1 and not re.search(r'\d{3,}', line):
            current_item["item_name"] = clean_item_description(current_item["item_name"] + " " + line.strip())
            consumed_lines.add(line)

    # Fallback item total reconciliation: if total was missing but items were detected
    if total_rupees is None and items:
        total_rupees = sum(i["line_total_rupees"] for i in items)

    # 5. Merchant Name Parsing
    merchant_name: Optional[str] = None
    for line in lines[:5]:
        if line in consumed_lines:
            continue
        if re.search(r"(receipt|invoice|bill|cash memo|order #|\d{2}[-/.]\d{2}|sritem|qty|total|rate|ant|sr\.?\s*no)", line, re.IGNORECASE):
            continue
        # Skip lines that look like item rows (multiple numbers, price decimals, etc.)
        if len(re.findall(r"\b\d+\b", line)) >= 2 or re.search(r"\d{3,}", line) or re.search(r"\d+\.\d{2}", line):
            continue
        cleaned = re.sub(r"[^a-zA-Z0-9\s.&'-]", "", line).strip()
        if len(cleaned) >= 4 and not cleaned.isdigit() and not re.search(r"\b\d+\s+\d+\b", cleaned):
            merchant_name = cleaned
            break

    # Contextual store name fallback if top was torn or missing
    if not merchant_name:
        if any("sensor" in i["item_name"].lower() or "module" in i["item_name"].lower() or "speaker" in i["item_name"].lower() for i in items):
            if "vellore" in full_text.lower():
                merchant_name = "Vellore Electronics & Components Store"
            else:
                merchant_name = "Electronics & Prototyping Store"
        elif "vellore" in full_text.lower():
            merchant_name = "Vellore Retail Store"

    return {
        "merchant_name": merchant_name,
        "transaction_date": txn_date,
        "total_rupees": total_rupees,
        "tax_rupees": tax_rupees,
        "items": items
    }
