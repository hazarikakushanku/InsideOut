import os
import base64
import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client, Client
from dotenv import load_dotenv
import google.generativeai as genai
import requests

from hazard_kb import HAZARD_KB, ALTERNATIVES, lookup

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", os.getenv("EMERGENT_LLM_KEY"))

genai.configure(api_key=GEMINI_API_KEY)
# We will use 'gemini-2.5-flash' or 'gemini-2.0-flash-exp'
model = genai.GenerativeModel('gemini-2.5-flash')

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MOCK_DB = []

class IngredientFinding(BaseModel):
    name: str
    status: str
    plain: str
    citation: str
    tags: List[str]

class CategoryBreakdown(BaseModel):
    category: str
    score: int
    status: str
    headline: str
    flagged: List[str]

class Alternative(BaseModel):
    name: str
    reason: str
    where: str

class ScanRecord(BaseModel):
    id: str
    profile: str
    product_name: str
    product_category: str
    health_score: int
    overall_status: str
    ingredients: List[IngredientFinding]
    categories: List[CategoryBreakdown]
    alternatives: List[Alternative]
    summary: str
    raw_text: str
    created_at: str

class AnalyzeRequest(BaseModel):
    image_base64: str
    profile: str = "default"
    product_category: Optional[str] = "default"

@app.get("/api/")
async def root():
    return {"message": "InsideOut API", "version": "1.0", "kb_size": len(HAZARD_KB)}

@app.get("/api/profiles")
async def get_profiles():
    return ["default", "parent", "athlete", "sensitive_skin"]

@app.get("/api/kb")
async def get_kb():
    return HAZARD_KB

@app.post("/api/analyze", response_model=ScanRecord)
async def analyze(req: AnalyzeRequest):
    # Stage 1: Preprocessing
    b64_data = req.image_base64
    if "," in b64_data:
        b64_data = b64_data.split(",", 1)[1]
    
    image_bytes = base64.b64decode(b64_data)
    
    # Stage 2: OCR via Gemini Vision
    prompt = """
    Extract product information and ingredients from this image.
    Return STRICT JSON only, matching this structure:
    {
      "product_name": "string",
      "product_category": "one of: food, snack, soda, cosmetic, sweetener, default",
      "raw_text": "string of all text found",
      "ingredients": ["ingredient1", "ingredient2"]
    }
    """
    
    try:
        response = model.generate_content([
            prompt,
            {"mime_type": "image/jpeg", "data": image_bytes}
        ])
        
        # Clean response to get JSON
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        parsed = json.loads(text)
    except Exception as e:
        print(f"Gemini parsing error: {e}")
        # Fallback if Gemini fails
        parsed = {
            "product_name": "Unknown Product",
            "product_category": req.product_category or "default",
            "raw_text": "Failed to parse text from image.",
            "ingredients": []
        }

    prod_cat = parsed.get("product_category", "default")
    if prod_cat not in ALTERNATIVES:
        prod_cat = "default"
    
    # Stage 3: Cross-reference
    ingredients_list = parsed.get("ingredients", [])
    findings: List[IngredientFinding] = []
    
    risky_count = 0
    caution_count = 0
    
    for ing in ingredients_list:
        ing_lower = ing.lower()
        
        # Check Database First
        db_match = None
        if supabase:
            try:
                res = supabase.table("ingredients").select("*").eq("name", ing_lower).execute()
                if res.data and len(res.data) > 0:
                    db_match = res.data[0]
            except Exception as e:
                print("Supabase select error:", e)

        if db_match:
            status = db_match.get("status", "safe")
            if status == "risky": risky_count += 1
            elif status == "caution": caution_count += 1
            
            findings.append(IngredientFinding(
                name=ing,
                status=status,
                plain=db_match.get("plain", ""),
                citation=db_match.get("citation", "Database Cache"),
                tags=db_match.get("tags", [])
            ))
            continue
        
        # Check Local KB
        kb_match = lookup(ing)
        if kb_match:
            status = kb_match["status"]
            if status == "risky": risky_count += 1
            elif status == "caution": caution_count += 1
            
            # Cache in DB
            db_doc = {"name": ing_lower, "status": status, "plain": kb_match["plain"], "citation": kb_match["citation"], "tags": kb_match["tags"]}
            if supabase:
                try:
                    supabase.table("ingredients").upsert(db_doc).execute()
                except Exception as e:
                    print("Supabase upsert error:", e)
            
            findings.append(IngredientFinding(
                name=ing, status=status, plain=kb_match["plain"], citation=kb_match["citation"], tags=kb_match["tags"]
            ))
            continue

        # Tier 2: OpenFoodFacts / Scraper Fallback
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
                    try:
                        supabase.table("ingredients").upsert(db_doc).execute()
                    except Exception as e:
                        print("Supabase upsert error:", e)
                
                findings.append(IngredientFinding(
                    name=ing, status=t2_status, plain=db_doc["plain"], citation=db_doc["citation"], tags=db_doc["tags"]
                ))
                t2_success = True
        except Exception:
            pass

        if t2_success:
            continue

        # Tier 3: Deep Web Crawl / LLM Fallback
        prompt = f"Analyze the ingredient '{ing}' for health risks. Return STRICT JSON: {{\"status\": \"safe|caution|risky\", \"reason\": \"brief explanation\"}}"
        try:
            t3_response = model.generate_content(prompt)
            t3_text = t3_response.text.strip()
            if t3_text.startswith("```json"): t3_text = t3_text[7:]
            if t3_text.startswith("```"): t3_text = t3_text[3:]
            if t3_text.endswith("```"): t3_text = t3_text[:-3]
            t3_parsed = json.loads(t3_text.strip())
            
            t3_status = t3_parsed.get("status", "caution")
            if t3_status == "risky": risky_count += 1
            elif t3_status == "caution": caution_count += 1
            
            db_doc = {"name": ing_lower, "status": t3_status, "plain": t3_parsed.get("reason", "Analyzed via AI fallback."), "citation": "Google Fallback (Tier 3)", "tags": ["tier3"]}
            if supabase:
                try:
                    supabase.table("ingredients").upsert(db_doc).execute()
                except Exception as e:
                    print("Supabase upsert error:", e)
            
            findings.append(IngredientFinding(
                name=ing, status=t3_status, plain=db_doc["plain"], citation=db_doc["citation"], tags=db_doc["tags"]
            ))
            continue
        except Exception:
            pass

        # No data found - cache as safe to prevent repeated failures
        db_doc = {"name": ing_lower, "status": "safe", "plain": "No known hazards in database or fallback tiers.", "citation": "Unlisted", "tags": []}
        if supabase:
            try:
                supabase.table("ingredients").upsert(db_doc).execute()
            except Exception as e:
                print("Supabase upsert error:", e)
        
        findings.append(IngredientFinding(
            name=ing,
            status="safe",
            plain=db_doc["plain"],
            citation=db_doc["citation"],
            tags=db_doc["tags"]
        ))
            
    health_score = 100 - (18 * risky_count) - (7 * caution_count)
    if health_score < 5:
        health_score = 5
    if health_score > 100:
        health_score = 100
        
    if health_score >= 75:
        overall_status = "safe"
    elif health_score >= 45:
        overall_status = "caution"
    else:
        overall_status = "risky"
        
    profile_map = {
        "parent": "kids",
        "athlete": "fitness",
        "sensitive_skin": "sensitive_skin"
    }
    
    categories: List[CategoryBreakdown] = []
    target_categories = ["kids", "fitness", "sensitive_skin"]
    
    for cat in target_categories:
        cat_risky = 0
        cat_caution = 0
        flagged = []
        for f in findings:
            if cat in f.tags:
                if f.status == "risky":
                    cat_risky += 1
                    flagged.append(f.name)
                elif f.status == "caution":
                    cat_caution += 1
                    flagged.append(f.name)
        
        cat_score = 100 - (20 * cat_risky) - (8 * cat_caution)
        if req.profile in profile_map and profile_map[req.profile] == cat:
            cat_score -= 5
            
        if cat_score < 5: cat_score = 5
        if cat_score > 100: cat_score = 100
        
        if cat_score >= 75:
            cat_status = "safe"
            hl = "Looks good"
        elif cat_score >= 45:
            cat_status = "caution"
            hl = "Use with caution"
        else:
            cat_status = "risky"
            hl = "High risk detected"
            
        categories.append(CategoryBreakdown(
            category=cat,
            score=cat_score,
            status=cat_status,
            headline=hl,
            flagged=flagged[:5]
        ))
        
    alts = []
    if overall_status == "risky":
        alts = [Alternative(**a) for a in ALTERNATIVES.get(prod_cat, ALTERNATIVES["default"])]
        
    summary = f"{risky_count} high-risk ingredients detected. {caution_count} caution-level ingredients."
    
    scan_record = ScanRecord(
        id=str(uuid.uuid4()),
        profile=req.profile,
        product_name=parsed.get("product_name", "Unknown Product"),
        product_category=prod_cat,
        health_score=health_score,
        overall_status=overall_status,
        ingredients=findings,
        categories=categories,
        alternatives=alts,
        summary=summary,
        raw_text=parsed.get("raw_text", ""),
        created_at=datetime.now(timezone.utc).isoformat()
    )
    
    scan_dict = scan_record.model_dump()
    # Save to Supabase
    if supabase:
        try:
            supabase.table("scans").insert(scan_dict).execute()
        except Exception as e:
            print("Supabase insert error:", e)
    
    return scan_record

@app.get("/api/scans", response_model=List[ScanRecord])
async def list_scans(limit: int = 20):
    if not supabase:
        return []
    res = supabase.table("scans").select("*").order("created_at", desc=True).limit(limit).execute()
    return res.data

@app.get("/api/scans/{id}", response_model=ScanRecord)
async def get_scan(id: str):
    if not supabase:
        raise HTTPException(status_code=404, detail="Supabase not configured")
    res = supabase.table("scans").select("*").eq("id", id).execute()
    if not res.data or len(res.data) == 0:
        raise HTTPException(status_code=404, detail="Scan not found")
    return res.data[0]

@app.delete("/api/scans/{id}")
async def delete_scan(id: str):
    if not supabase:
        raise HTTPException(status_code=404, detail="Supabase not configured")
    res = supabase.table("scans").delete().eq("id", id).execute()
    if not res.data or len(res.data) == 0:
        raise HTTPException(status_code=404, detail="Scan not found")
    return {"ok": True}
