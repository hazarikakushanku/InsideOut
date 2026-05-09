import os
import base64
import json
import uuid
import requests
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client, Client
from dotenv import load_dotenv
import google.generativeai as genai

from hazard_kb import HAZARD_KB, ALTERNATIVES, lookup

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", os.getenv("EMERGENT_LLM_KEY"))
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── E-code Additive Decoder ───────────────────────────────────────────────
ECODE_KB: Dict[str, Dict] = {
    "322": {"name": "Lecithin", "status": "safe", "plain": "Natural emulsifier from soy or sunflower. Generally safe.", "tags": []},
    "471": {"name": "Mono- and Diglycerides of Fatty Acids", "status": "caution", "plain": "Emulsifier derived from fats. May contain trans fats.", "tags": ["sensitive_skin"]},
    "472e": {"name": "Diacetyl Tartaric Acid Esters", "status": "caution", "plain": "Emulsifier used in baked goods. Generally safe but avoid in excess.", "tags": []},
    "500": {"name": "Sodium Carbonates", "status": "safe", "plain": "Raising agent (baking soda family). Safe in normal quantities.", "tags": []},
    "503": {"name": "Ammonium Carbonates", "status": "caution", "plain": "Raising agent. Can release ammonia; avoid for kids.", "tags": ["kids"]},
    "211": {"name": "Sodium Benzoate", "status": "risky", "plain": "Preservative. Can form benzene (carcinogen) with Vitamin C. Linked to hyperactivity in kids.", "tags": ["kids"]},
    "102": {"name": "Tartrazine (Yellow 5)", "status": "risky", "plain": "Artificial color. Linked to hyperactivity and allergic reactions.", "tags": ["kids", "sensitive_skin"]},
    "621": {"name": "Monosodium Glutamate (MSG)", "status": "caution", "plain": "Flavor enhancer. Can cause headaches in sensitive individuals.", "tags": []},
    "202": {"name": "Potassium Sorbate", "status": "safe", "plain": "Preservative. Generally recognized as safe.", "tags": []},
    "440": {"name": "Pectin", "status": "safe", "plain": "Natural gelling agent from fruit peels. Safe and beneficial.", "tags": []},
    "407": {"name": "Carrageenan", "status": "caution", "plain": "Thickener from seaweed. Some studies link it to gut inflammation.", "tags": []},
    "951": {"name": "Aspartame", "status": "caution", "plain": "Artificial sweetener. Controversial; avoid with PKU. Not suitable for diabetics in large amounts.", "tags": ["diabetes"]},
    "955": {"name": "Sucralose", "status": "caution", "plain": "Artificial sweetener. May alter gut microbiome with heavy use.", "tags": []},
}

# ─── Condition-Aware Flagging ───────────────────────────────────────────────
CONDITION_FLAGS: Dict[str, Dict] = {
    "diabetes": {
        "ingredients": ["sugar", "liquid glucose", "maltodextrin", "dextrose", "high fructose corn syrup", "corn syrup", "fructose", "glucose"],
        "ecodes": ["951"],
        "nutrition_rule": {"key": "sugars_100g", "threshold": 10, "message": "High sugar content (>{val}g per 100g) — not suitable for diabetics."},
        "label": "🩸 Diabetes Alert",
    },
    "hypertension": {
        "ingredients": ["salt", "sodium", "monosodium glutamate", "msg", "baking soda", "sodium bicarbonate"],
        "ecodes": ["621"],
        "nutrition_rule": {"key": "sodium_100g", "threshold": 400, "message": "High sodium (>{val}mg per 100g) — raises blood pressure."},
        "label": "💔 Hypertension Alert",
    },
    "gluten_intolerance": {
        "ingredients": ["wheat", "wheat flour", "refined wheat flour", "whole wheat flour", "barley", "rye", "malt", "malt extract", "wheat bran"],
        "ecodes": [],
        "nutrition_rule": None,
        "label": "🌾 Gluten Alert",
    },
    "nut_allergy": {
        "ingredients": ["peanut", "almond", "cashew", "walnut", "hazelnut", "pistachio", "mixed nuts", "tree nut"],
        "ecodes": [],
        "nutrition_rule": None,
        "label": "🥜 Nut Allergy Alert",
    },
    "lactose_intolerance": {
        "ingredients": ["milk", "milk solids", "lactose", "whey", "casein", "butter", "cream", "cheese"],
        "ecodes": [],
        "nutrition_rule": None,
        "label": "🥛 Lactose Alert",
    },
    "heart_disease": {
        "ingredients": ["palm oil", "hydrogenated oil", "partially hydrogenated", "trans fat", "lard", "shortening"],
        "ecodes": ["471"],
        "nutrition_rule": {"key": "saturated-fat_100g", "threshold": 5, "message": "High saturated fat (>{val}g per 100g) — increases cardiovascular risk."},
        "label": "❤️ Heart Health Alert",
    },
}

# ─── Models ────────────────────────────────────────────────────────────────
class IngredientFinding(BaseModel):
    name: str; status: str; plain: str; citation: str; tags: List[str]

class CategoryBreakdown(BaseModel):
    category: str; score: int; status: str; headline: str; flagged: List[str]

class Alternative(BaseModel):
    name: str; reason: str; where: str

class ProfileAlert(BaseModel):
    condition: str; label: str; message: str; flagged_items: List[str]

class UserProfile(BaseModel):
    id: Optional[str] = None
    name: str
    conditions: List[str] = []
    allergies: List[str] = []
    created_at: Optional[str] = None

class ScanRecord(BaseModel):
    id: str; profile: str; product_name: str; product_category: str
    health_score: int; overall_status: str
    ingredients: List[IngredientFinding]
    categories: List[CategoryBreakdown]
    alternatives: List[Alternative]
    summary: str; raw_text: str; created_at: str
    barcode: Optional[str] = None
    nutrition: Optional[Dict[str, Any]] = None
    certifications: Optional[List[str]] = []
    additives: Optional[List[Dict]] = []
    profile_alerts: Optional[List[ProfileAlert]] = []
    user_profile_id: Optional[str] = None

class AnalyzeRequest(BaseModel):
    image_base64: str
    profile: str = "default"
    product_category: Optional[str] = "default"
    user_profile_id: Optional[str] = None

# ─── Helpers ───────────────────────────────────────────────────────────────
def decode_ecodes(ingredient_list: List[str]) -> List[Dict]:
    """Find E-code numbers in ingredients and decode them."""
    found = []
    for ing in ingredient_list:
        # Check all known ecodes
        for code, info in ECODE_KB.items():
            if code in ing.lower():
                found.append({"code": f"E{code}", **info})
    return found

def lookup_barcode(barcode: str) -> Optional[Dict]:
    """Fetch product info from Open Food Facts using barcode."""
    try:
        url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
        res = requests.get(url, timeout=5, headers={"User-Agent": "InsideOut/2.0"})
        data = res.json()
        if data.get("status") == 1:
            p = data["product"]
            nutrition_raw = p.get("nutriments", {})
            return {
                "product_name": p.get("product_name", ""),
                "brand": p.get("brands", ""),
                "ingredients_text": p.get("ingredients_text", ""),
                "certifications": p.get("labels_tags", []),
                "nutrition": {
                    "energy_kcal": nutrition_raw.get("energy-kcal_100g"),
                    "carbohydrates": nutrition_raw.get("carbohydrates_100g"),
                    "sugars": nutrition_raw.get("sugars_100g"),
                    "fat": nutrition_raw.get("fat_100g"),
                    "saturated_fat": nutrition_raw.get("saturated-fat_100g"),
                    "protein": nutrition_raw.get("proteins_100g"),
                    "fiber": nutrition_raw.get("fiber_100g"),
                    "sodium": nutrition_raw.get("sodium_100g"),
                    "salt": nutrition_raw.get("salt_100g"),
                },
                "nova_group": p.get("nova_group"),
                "nutriscore_grade": p.get("nutriscore_grade", "").upper(),
            }
    except Exception as e:
        print(f"Barcode lookup error: {e}")
    return None

def check_health_profile(findings: List[IngredientFinding], user_profile: Dict, nutrition: Dict, additives: List[Dict]) -> List[ProfileAlert]:
    """Generate personalized alerts for a user's health conditions."""
    alerts = []
    conditions = user_profile.get("conditions", [])
    allergies = user_profile.get("allergies", [])
    all_conditions = list(set(conditions + allergies))

    for cond in all_conditions:
        if cond not in CONDITION_FLAGS:
            continue
        rule = CONDITION_FLAGS[cond]
        flagged_items = []

        # Check ingredients
        ing_names_lower = [f.name.lower() for f in findings]
        for danger_ing in rule["ingredients"]:
            for ing_name in ing_names_lower:
                if danger_ing in ing_name:
                    flagged_items.append(ing_name.title())
                    break

        # Check ecodes
        additive_codes = [a.get("code", "").replace("E", "") for a in additives]
        for ecode in rule.get("ecodes", []):
            if ecode in additive_codes:
                flagged_items.append(f"E{ecode} ({ECODE_KB.get(ecode, {}).get('name', '')})")

        # Check nutrition thresholds
        nr = rule.get("nutrition_rule")
        if nr and nutrition:
            val = nutrition.get(nr["key"])
            if val is not None and float(val) > nr["threshold"]:
                msg = nr["message"].replace("{val}", str(nr["threshold"]))
                flagged_items.append(msg)

        if flagged_items:
            alerts.append(ProfileAlert(
                condition=cond,
                label=rule["label"],
                message=f"This product contains items that may not be suitable for {cond.replace('_', ' ')}.",
                flagged_items=flagged_items,
            ))

    return alerts

# ─── Routes ────────────────────────────────────────────────────────────────
@app.get("/api/")
async def root():
    return {"message": "InsideOut API", "version": "2.0", "kb_size": len(HAZARD_KB)}

@app.get("/api/profiles")
async def get_profiles():
    return ["default", "parent", "athlete", "sensitive_skin"]

@app.get("/api/kb")
async def get_kb():
    return HAZARD_KB

# ─── User Health Profiles ──────────────────────────────────────────────────
@app.post("/api/user-profiles", response_model=UserProfile)
async def create_user_profile(profile: UserProfile):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")
    doc = {
        "name": profile.name,
        "conditions": profile.conditions,
        "allergies": profile.allergies,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = supabase.table("user_profiles").insert(doc).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create profile")
    return UserProfile(**res.data[0])

@app.get("/api/user-profiles", response_model=List[UserProfile])
async def list_user_profiles():
    if not supabase:
        return []
    res = supabase.table("user_profiles").select("*").order("created_at", desc=False).execute()
    return res.data

@app.get("/api/user-profiles/{id}", response_model=UserProfile)
async def get_user_profile(id: str):
    if not supabase:
        raise HTTPException(status_code=404, detail="Database not configured")
    res = supabase.table("user_profiles").select("*").eq("id", id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return UserProfile(**res.data[0])

@app.delete("/api/user-profiles/{id}")
async def delete_user_profile(id: str):
    if not supabase:
        raise HTTPException(status_code=404, detail="Database not configured")
    supabase.table("user_profiles").delete().eq("id", id).execute()
    return {"ok": True}

# ─── Barcode Lookup ────────────────────────────────────────────────────────
@app.get("/api/barcode/{code}")
async def get_barcode(code: str):
    data = lookup_barcode(code)
    if not data:
        raise HTTPException(status_code=404, detail="Product not found in Open Food Facts")
    return data

# ─── Main Analyze ──────────────────────────────────────────────────────────
@app.post("/api/analyze", response_model=ScanRecord)
async def analyze(req: AnalyzeRequest):
    b64_data = req.image_base64
    if "," in b64_data:
        b64_data = b64_data.split(",", 1)[1]
    image_bytes = base64.b64decode(b64_data)

    # Stage 2: OCR via Gemini Vision — now also extracts barcode
    prompt = """
    Analyze this product image carefully. Extract ALL visible information.
    Return STRICT JSON only:
    {
      "product_name": "string",
      "product_category": "one of: food, snack, soda, cosmetic, sweetener, default",
      "barcode": "barcode number if visible, else null",
      "raw_text": "all text found on the label",
      "ingredients": ["ingredient1", "ingredient2"],
      "certifications": ["FSSAI", "Organic", "Vegan", etc - only if clearly visible]
    }
    """
    try:
        response = model.generate_content([prompt, {"mime_type": "image/jpeg", "data": image_bytes}])
        text = response.text.strip()
        for prefix in ["```json", "```"]:
            if text.startswith(prefix): text = text[len(prefix):]
        if text.endswith("```"): text = text[:-3]
        parsed = json.loads(text.strip())
    except Exception as e:
        print(f"Gemini parsing error: {e}")
        parsed = {"product_name": "Unknown Product", "product_category": req.product_category or "default",
                  "raw_text": "Failed to parse.", "ingredients": [], "barcode": None, "certifications": []}

    prod_cat = parsed.get("product_category", "default")
    if prod_cat not in ALTERNATIVES:
        prod_cat = "default"

    barcode = parsed.get("barcode")
    barcode_data = None
    nutrition = {}
    off_certifications = []

    # Try barcode lookup for richer data
    if barcode:
        barcode_data = lookup_barcode(barcode)
        if barcode_data:
            nutrition = barcode_data.get("nutrition", {})
            off_certifications = barcode_data.get("certifications", [])
            # Merge ingredients from barcode if image ingredients are sparse
            if len(parsed.get("ingredients", [])) < 2 and barcode_data.get("ingredients_text"):
                ing_text = barcode_data["ingredients_text"]
                extra_ings = [i.strip() for i in ing_text.replace(";", ",").split(",") if i.strip()]
                parsed["ingredients"] = list(set(parsed.get("ingredients", []) + extra_ings[:20]))

    ingredients_list = parsed.get("ingredients", [])
    
    # Decode E-codes from raw text
    raw_text = parsed.get("raw_text", "")
    additives = decode_ecodes(ingredients_list + [raw_text])

    # Stage 3: Cross-reference ingredients
    findings: List[IngredientFinding] = []
    risky_count = 0
    caution_count = 0

    for ing in ingredients_list:
        ing_lower = ing.lower()
        db_match = None
        if supabase:
            try:
                res = supabase.table("ingredients").select("*").eq("name", ing_lower).execute()
                if res.data:
                    db_match = res.data[0]
            except Exception as e:
                print("Supabase select error:", e)

        if db_match:
            status = db_match.get("status", "safe")
            if status == "risky": risky_count += 1
            elif status == "caution": caution_count += 1
            findings.append(IngredientFinding(name=ing, status=status, plain=db_match.get("plain", ""),
                citation=db_match.get("citation", "Database Cache"), tags=db_match.get("tags", [])))
            continue

        kb_match = lookup(ing)
        if kb_match:
            status = kb_match["status"]
            if status == "risky": risky_count += 1
            elif status == "caution": caution_count += 1
            db_doc = {"name": ing_lower, "status": status, "plain": kb_match["plain"], "citation": kb_match["citation"], "tags": kb_match["tags"]}
            if supabase:
                try: supabase.table("ingredients").upsert(db_doc).execute()
                except Exception as e: print("Supabase upsert error:", e)
            findings.append(IngredientFinding(name=ing, status=status, plain=kb_match["plain"], citation=kb_match["citation"], tags=kb_match["tags"]))
            continue

        # Tier 2: OpenFoodFacts
        t2_success = False
        try:
            url = f"https://world.openfoodfacts.org/cgi/search.pl?search_terms={ing}&search_simple=1&action=process&json=1"
            res = requests.get(url, timeout=3)
            data = res.json()
            if data.get("products") and len(data["products"]) > 0:
                ecoscore = data["products"][0].get("ecoscore_grade", "unknown")
                t2_status = "risky" if ecoscore in ["e", "d"] else ("safe" if ecoscore in ["a", "b"] else "caution")
                if t2_status == "risky": risky_count += 1
                elif t2_status == "caution": caution_count += 1
                db_doc = {"name": ing_lower, "status": t2_status, "plain": "Analyzed via Multi-Platform Scraper.", "citation": "OpenFoodFacts (Tier 2)", "tags": ["tier2"]}
                if supabase:
                    try: supabase.table("ingredients").upsert(db_doc).execute()
                    except Exception as e: print("Supabase upsert error:", e)
                findings.append(IngredientFinding(name=ing, status=t2_status, plain=db_doc["plain"], citation=db_doc["citation"], tags=db_doc["tags"]))
                t2_success = True
        except Exception:
            pass
        if t2_success:
            continue

        # Tier 3: Gemini AI fallback
        try:
            t3_prompt = f"Analyze the food ingredient '{ing}' for health risks. Return STRICT JSON: {{\"status\": \"safe|caution|risky\", \"reason\": \"brief explanation\"}}"
            t3_response = model.generate_content(t3_prompt)
            t3_text = t3_response.text.strip()
            for prefix in ["```json", "```"]:
                if t3_text.startswith(prefix): t3_text = t3_text[len(prefix):]
            if t3_text.endswith("```"): t3_text = t3_text[:-3]
            t3_parsed = json.loads(t3_text.strip())
            t3_status = t3_parsed.get("status", "caution")
            if t3_status == "risky": risky_count += 1
            elif t3_status == "caution": caution_count += 1
            db_doc = {"name": ing_lower, "status": t3_status, "plain": t3_parsed.get("reason", "Analyzed via AI."), "citation": "Gemini AI (Tier 3)", "tags": ["tier3"]}
            if supabase:
                try: supabase.table("ingredients").upsert(db_doc).execute()
                except Exception as e: print("Supabase upsert error:", e)
            findings.append(IngredientFinding(name=ing, status=t3_status, plain=db_doc["plain"], citation=db_doc["citation"], tags=db_doc["tags"]))
            continue
        except Exception:
            pass

        # Default fallback
        db_doc = {"name": ing_lower, "status": "safe", "plain": "No known hazards found.", "citation": "Unlisted", "tags": []}
        if supabase:
            try: supabase.table("ingredients").upsert(db_doc).execute()
            except Exception as e: print("Supabase upsert error:", e)
        findings.append(IngredientFinding(name=ing, status="safe", plain=db_doc["plain"], citation=db_doc["citation"], tags=db_doc["tags"]))

    # Health score
    health_score = max(5, min(100, 100 - (18 * risky_count) - (7 * caution_count)))
    overall_status = "safe" if health_score >= 75 else ("caution" if health_score >= 45 else "risky")

    # Category breakdowns
    profile_map = {"parent": "kids", "athlete": "fitness", "sensitive_skin": "sensitive_skin"}
    categories: List[CategoryBreakdown] = []
    for cat in ["kids", "fitness", "sensitive_skin"]:
        cat_risky = 0; cat_caution = 0; flagged = []
        for f in findings:
            if cat in f.tags:
                if f.status == "risky": cat_risky += 1; flagged.append(f.name)
                elif f.status == "caution": cat_caution += 1; flagged.append(f.name)
        cat_score = max(5, min(100, 100 - (20 * cat_risky) - (8 * cat_caution)))
        if req.profile in profile_map and profile_map[req.profile] == cat: cat_score = max(5, cat_score - 5)
        cat_status = "safe" if cat_score >= 75 else ("caution" if cat_score >= 45 else "risky")
        hl = "Looks good" if cat_status == "safe" else ("Use with caution" if cat_status == "caution" else "High risk detected")
        categories.append(CategoryBreakdown(category=cat, score=cat_score, status=cat_status, headline=hl, flagged=flagged[:5]))

    alts = [Alternative(**a) for a in ALTERNATIVES.get(prod_cat, ALTERNATIVES["default"])] if overall_status == "risky" else []
    summary = f"{risky_count} high-risk, {caution_count} caution-level ingredients detected."

    # Health profile personalized alerts
    profile_alerts: List[ProfileAlert] = []
    user_profile_data = None
    if req.user_profile_id and supabase:
        try:
            up_res = supabase.table("user_profiles").select("*").eq("id", req.user_profile_id).execute()
            if up_res.data:
                user_profile_data = up_res.data[0]
                profile_alerts = check_health_profile(findings, user_profile_data, nutrition, additives)
        except Exception as e:
            print(f"User profile fetch error: {e}")

    # Clean certifications
    all_certs = list(set(parsed.get("certifications", []) + off_certifications))
    clean_certs = [c.replace("en:", "").replace("-", " ").title() for c in all_certs if c]

    scan_record = ScanRecord(
        id=str(uuid.uuid4()), profile=req.profile,
        product_name=parsed.get("product_name", "Unknown Product"),
        product_category=prod_cat, health_score=health_score, overall_status=overall_status,
        ingredients=findings, categories=categories, alternatives=alts,
        summary=summary, raw_text=parsed.get("raw_text", ""),
        created_at=datetime.now(timezone.utc).isoformat(),
        barcode=barcode, nutrition=nutrition, certifications=clean_certs,
        additives=additives, profile_alerts=profile_alerts,
        user_profile_id=req.user_profile_id,
    )

    scan_dict = scan_record.model_dump()
    if supabase:
        try: supabase.table("scans").insert(scan_dict).execute()
        except Exception as e: print("Supabase insert error:", e)

    return scan_record

@app.get("/api/scans", response_model=List[ScanRecord])
async def list_scans(limit: int = 20):
    if not supabase: return []
    res = supabase.table("scans").select("*").order("created_at", desc=True).limit(limit).execute()
    return res.data

@app.get("/api/scans/{id}", response_model=ScanRecord)
async def get_scan(id: str):
    if not supabase: raise HTTPException(status_code=404, detail="Supabase not configured")
    res = supabase.table("scans").select("*").eq("id", id).execute()
    if not res.data: raise HTTPException(status_code=404, detail="Scan not found")
    return res.data[0]

@app.delete("/api/scans/{id}")
async def delete_scan(id: str):
    if not supabase: raise HTTPException(status_code=404, detail="Supabase not configured")
    res = supabase.table("scans").delete().eq("id", id).execute()
    if not res.data: raise HTTPException(status_code=404, detail="Scan not found")
    return {"ok": True}

@app.delete("/api/scans")
async def delete_all_scans():
    """Delete all scan history."""
    if not supabase: raise HTTPException(status_code=404, detail="Supabase not configured")
    supabase.table("scans").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    return {"ok": True, "message": "All scans deleted"}

class BarcodeAnalyzeRequest(BaseModel):
    barcode: str
    profile: str = "default"
    user_profile_id: Optional[str] = None
    product_data: Optional[Dict[str, Any]] = None

@app.post("/api/analyze-barcode", response_model=ScanRecord)
async def analyze_barcode(req: BarcodeAnalyzeRequest):
    """Analyze a product using barcode data from Open Food Facts."""
    product_data = req.product_data or lookup_barcode(req.barcode)
    if not product_data:
        raise HTTPException(status_code=404, detail="Product not found")

    prod_cat = "food"
    nutrition = product_data.get("nutrition", {})
    off_certifications = product_data.get("certifications", [])
    ing_text = product_data.get("ingredients_text", "")
    ingredients_list = [i.strip() for i in ing_text.replace(";", ",").split(",") if i.strip()][:25]
    additives = decode_ecodes(ingredients_list + [ing_text])

    findings: List[IngredientFinding] = []
    risky_count = 0; caution_count = 0

    for ing in ingredients_list:
        ing_lower = ing.lower()
        db_match = None
        if supabase:
            try:
                res = supabase.table("ingredients").select("*").eq("name", ing_lower).execute()
                if res.data: db_match = res.data[0]
            except: pass

        if db_match:
            status = db_match.get("status", "safe")
            if status == "risky": risky_count += 1
            elif status == "caution": caution_count += 1
            findings.append(IngredientFinding(name=ing, status=status, plain=db_match.get("plain", ""), citation="Database Cache", tags=db_match.get("tags", [])))
            continue

        kb_match = lookup(ing)
        if kb_match:
            status = kb_match["status"]
            if status == "risky": risky_count += 1
            elif status == "caution": caution_count += 1
            db_doc = {"name": ing_lower, "status": status, "plain": kb_match["plain"], "citation": kb_match["citation"], "tags": kb_match["tags"]}
            if supabase:
                try: supabase.table("ingredients").upsert(db_doc).execute()
                except: pass
            findings.append(IngredientFinding(name=ing, status=status, plain=kb_match["plain"], citation=kb_match["citation"], tags=kb_match["tags"]))
            continue

        # AI fallback
        try:
            t3_prompt = f"Analyze the food ingredient '{ing}' for health risks. Return STRICT JSON: {{\"status\": \"safe|caution|risky\", \"reason\": \"brief explanation\"}}"
            t3_response = model.generate_content(t3_prompt)
            t3_text = t3_response.text.strip()
            for prefix in ["```json", "```"]:
                if t3_text.startswith(prefix): t3_text = t3_text[len(prefix):]
            if t3_text.endswith("```"): t3_text = t3_text[:-3]
            t3_parsed = json.loads(t3_text.strip())
            t3_status = t3_parsed.get("status", "caution")
            if t3_status == "risky": risky_count += 1
            elif t3_status == "caution": caution_count += 1
            db_doc = {"name": ing_lower, "status": t3_status, "plain": t3_parsed.get("reason", ""), "citation": "Gemini AI", "tags": ["tier3"]}
            if supabase:
                try: supabase.table("ingredients").upsert(db_doc).execute()
                except: pass
            findings.append(IngredientFinding(name=ing, status=t3_status, plain=db_doc["plain"], citation=db_doc["citation"], tags=db_doc["tags"]))
        except:
            findings.append(IngredientFinding(name=ing, status="safe", plain="No hazard data found.", citation="Unlisted", tags=[]))

    health_score = max(5, min(100, 100 - (18 * risky_count) - (7 * caution_count)))
    overall_status = "safe" if health_score >= 75 else ("caution" if health_score >= 45 else "risky")

    categories: List[CategoryBreakdown] = []
    for cat in ["kids", "fitness", "sensitive_skin"]:
        cat_risky = 0; cat_caution = 0; flagged = []
        for f in findings:
            if cat in f.tags:
                if f.status == "risky": cat_risky += 1; flagged.append(f.name)
                elif f.status == "caution": cat_caution += 1; flagged.append(f.name)
        cat_score = max(5, min(100, 100 - (20 * cat_risky) - (8 * cat_caution)))
        cat_status = "safe" if cat_score >= 75 else ("caution" if cat_score >= 45 else "risky")
        hl = "Looks good" if cat_status == "safe" else ("Use with caution" if cat_status == "caution" else "High risk detected")
        categories.append(CategoryBreakdown(category=cat, score=cat_score, status=cat_status, headline=hl, flagged=flagged[:5]))

    alts = [Alternative(**a) for a in ALTERNATIVES.get(prod_cat, ALTERNATIVES["default"])] if overall_status == "risky" else []
    clean_certs = [c.replace("en:", "").replace("-", " ").title() for c in off_certifications if c]

    profile_alerts: List[ProfileAlert] = []
    if req.user_profile_id and supabase:
        try:
            up_res = supabase.table("user_profiles").select("*").eq("id", req.user_profile_id).execute()
            if up_res.data:
                profile_alerts = check_health_profile(findings, up_res.data[0], nutrition, additives)
        except Exception as e:
            print(f"Profile fetch error: {e}")

    scan_record = ScanRecord(
        id=str(uuid.uuid4()), profile=req.profile,
        product_name=product_data.get("product_name", "Unknown Product"),
        product_category=prod_cat, health_score=health_score, overall_status=overall_status,
        ingredients=findings, categories=categories, alternatives=alts,
        summary=f"{risky_count} high-risk, {caution_count} caution-level ingredients detected.",
        raw_text=ing_text, created_at=datetime.now(timezone.utc).isoformat(),
        barcode=req.barcode, nutrition=nutrition, certifications=clean_certs,
        additives=additives, profile_alerts=profile_alerts, user_profile_id=req.user_profile_id,
    )
    scan_dict = scan_record.model_dump()
    if supabase:
        try: supabase.table("scans").insert(scan_dict).execute()
        except Exception as e: print("Supabase insert error:", e)
    return scan_record
