import os
import json
import httpx
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai
from elasticsearch import Elasticsearch

load_dotenv()

app = FastAPI(title="BizHunter AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Init Gemini ---
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")

# --- Init Elastic ---
es = Elasticsearch(
    os.getenv("ELASTIC_URL"),
    api_key=os.getenv("ELASTIC_API_KEY"),
)

BUSINESSES_INDEX = "bizhunter_businesses"
PITCHES_INDEX = "bizhunter_pitches"

def ensure_indices():
    if not es.indices.exists(index=BUSINESSES_INDEX):
        es.indices.create(index=BUSINESSES_INDEX, body={
            "mappings": {
                "properties": {
                    "name": {"type": "text"},
                    "industry": {"type": "keyword"},
                    "city": {"type": "keyword"},
                    "phone": {"type": "text"},
                    "email": {"type": "keyword"},
                    "address": {"type": "text"},
                    "has_website": {"type": "boolean"},
                    "status": {"type": "keyword"},
                    "discovered_at": {"type": "date"},
                    "notes": {"type": "text"},
                }
            }
        })
    if not es.indices.exists(index=PITCHES_INDEX):
        es.indices.create(index=PITCHES_INDEX, body={
            "mappings": {
                "properties": {
                    "business_id": {"type": "keyword"},
                    "business_name": {"type": "text"},
                    "subject": {"type": "text"},
                    "body": {"type": "text"},
                    "status": {"type": "keyword"},
                    "created_at": {"type": "date"},
                    "approved": {"type": "boolean"},
                }
            }
        })

try:
    ensure_indices()
except Exception as e:
    print(f"Elastic index setup warning: {e}")

# ============================================================
# MODELS
# ============================================================

class HuntRequest(BaseModel):
    city: str
    industry: str
    count: int = 10

class Business(BaseModel):
    name: str
    industry: str
    city: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    notes: Optional[str] = ""

class PitchRequest(BaseModel):
    business_id: str

class ApproveRequest(BaseModel):
    pitch_id: str

class StatusUpdate(BaseModel):
    business_id: str
    status: str

class BuildRequest(BaseModel):
    business_id: str

# ============================================================
# HUNTER AGENT
# ============================================================

@app.post("/api/hunt")
async def hunt_businesses(req: HuntRequest):
    """Hunter Agent: Find local businesses without websites using Gemini."""
    
    prompt = f"""You are a business research agent. Generate a list of {req.count} realistic local businesses 
in {req.city} in the {req.industry} industry that likely do NOT have a professional website yet.
These should be small, local businesses like family shops, local services, etc.

For each business, provide realistic details. Return ONLY a valid JSON array with this exact structure:
[
  {{
    "name": "Business Name",
    "industry": "{req.industry}",
    "city": "{req.city}",
    "phone": "+91-XXXXXXXXXX",
    "email": "owner@gmail.com",
    "address": "Street address, {req.city}",
    "notes": "One sentence about this business and why they need a website"
  }}
]

Return ONLY the JSON array, no other text."""

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Clean up response
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()
        
        businesses = json.loads(text)
        
        # Store in Elasticsearch
        stored = []
        for biz in businesses:
            doc = {
                **biz,
                "has_website": False,
                "status": "discovered",
                "discovered_at": datetime.utcnow().isoformat(),
            }
            result = es.index(index=BUSINESSES_INDEX, document=doc)
            stored.append({"id": result["_id"], **doc})
        
        return {"success": True, "count": len(stored), "businesses": stored}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# PITCHER AGENT
# ============================================================

@app.post("/api/pitch/generate")
async def generate_pitch(req: PitchRequest):
    """Pitcher Agent: Generate a personalized cold email pitch using Gemini."""
    
    try:
        result = es.get(index=BUSINESSES_INDEX, id=req.business_id)
        biz = result["_source"]
    except Exception:
        raise HTTPException(status_code=404, detail="Business not found")
    
    prompt = f"""You are a professional web agency sales agent. Write a short, friendly, personalized cold email 
to convince the owner of "{biz['name']}", a {biz['industry']} business in {biz['city']}, to get a professional website.

Key info about them: {biz.get('notes', '')}

The email should:
- Be warm and personal, NOT salesy
- Mention their specific business type
- Explain 2-3 concrete benefits of having a website for their specific business
- Offer a FREE demo website to get them interested
- Be under 150 words
- End with a clear call to action

Return ONLY a JSON object with this structure:
{{
  "subject": "Email subject line here",
  "body": "Full email body here"
}}"""

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()
        
        pitch_data = json.loads(text)
        
        # Store pitch in Elasticsearch
        pitch_doc = {
            "business_id": req.business_id,
            "business_name": biz["name"],
            "subject": pitch_data["subject"],
            "body": pitch_data["body"],
            "status": "draft",
            "approved": False,
            "created_at": datetime.utcnow().isoformat(),
        }
        
        pitch_result = es.index(index=PITCHES_INDEX, document=pitch_doc)
        
        # Update business status
        es.update(index=BUSINESSES_INDEX, id=req.business_id, body={
            "doc": {"status": "pitched"}
        })
        
        return {
            "success": True,
            "pitch_id": pitch_result["_id"],
            "pitch": pitch_doc
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/pitch/approve")
async def approve_pitch(req: ApproveRequest):
    """Human approves a pitch — marks it as approved."""
    try:
        es.update(index=PITCHES_INDEX, id=req.pitch_id, body={
            "doc": {"approved": True, "status": "approved"}
        })
        return {"success": True, "message": "Pitch approved and ready to send"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# BUILDER AGENT
# ============================================================

@app.post("/api/build")
async def build_website(req: BuildRequest):
    """Builder Agent: Generate a complete website for the business using Gemini."""
    
    try:
        result = es.get(index=BUSINESSES_INDEX, id=req.business_id)
        biz = result["_source"]
    except Exception:
        raise HTTPException(status_code=404, detail="Business not found")
    
    prompt = f"""You are an expert web developer. Create a complete, beautiful, single-page HTML website for:

Business Name: {biz['name']}
Industry: {biz['industry']}
City: {biz['city']}
Phone: {biz.get('phone', 'Contact us')}
Email: {biz.get('email', '')}
Address: {biz.get('address', biz['city'])}
About: {biz.get('notes', '')}

Requirements:
- Single HTML file with embedded CSS and JS
- Modern, professional design with the business's color scheme
- Sections: Hero, About, Services, Contact
- Mobile responsive
- Include the phone number and address prominently
- Use a color scheme appropriate for {biz['industry']}
- Make it look like a real professional website
- Include a contact form (non-functional but realistic)

Return ONLY the complete HTML code, nothing else."""

    try:
        response = model.generate_content(prompt)
        html = response.text.strip()
        
        if html.startswith("```"):
            html = html.split("```")[1]
            if html.startswith("html"):
                html = html[4:]
        html = html.strip()
        
        # Update business status
        es.update(index=BUSINESSES_INDEX, id=req.business_id, body={
            "doc": {"status": "delivered"}
        })
        
        return {
            "success": True,
            "business_name": biz["name"],
            "html": html
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# DATA ENDPOINTS
# ============================================================

@app.get("/api/businesses")
async def get_businesses(status: Optional[str] = None, search: Optional[str] = None):
    """Get all businesses from Elasticsearch with optional filtering."""
    try:
        query = {"match_all": {}}
        
        if status and search:
            query = {
                "bool": {
                    "must": [
                        {"match": {"status": status}},
                        {"multi_match": {"query": search, "fields": ["name", "city", "industry", "notes"]}}
                    ]
                }
            }
        elif status:
            query = {"term": {"status": status}}
        elif search:
            query = {"multi_match": {"query": search, "fields": ["name", "city", "industry", "notes"]}}
        
        result = es.search(index=BUSINESSES_INDEX, body={"query": query, "size": 100, "sort": [{"discovered_at": "desc"}]})
        businesses = [{"id": hit["_id"], **hit["_source"]} for hit in result["hits"]["hits"]]
        return {"businesses": businesses, "total": result["hits"]["total"]["value"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/pitches")
async def get_pitches():
    """Get all pitches from Elasticsearch."""
    try:
        result = es.search(index=PITCHES_INDEX, body={"query": {"match_all": {}}, "size": 100, "sort": [{"created_at": "desc"}]})
        pitches = [{"id": hit["_id"], **hit["_source"]} for hit in result["hits"]["hits"]]
        return {"pitches": pitches}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stats")
async def get_stats():
    """Get pipeline statistics."""
    try:
        statuses = ["discovered", "pitched", "interested", "delivered"]
        counts = {}
        for s in statuses:
            r = es.count(index=BUSINESSES_INDEX, body={"query": {"term": {"status": s}}})
            counts[s] = r["count"]
        return {"stats": counts}
    except Exception as e:
        return {"stats": {"discovered": 0, "pitched": 0, "interested": 0, "delivered": 0}}


@app.put("/api/businesses/{business_id}/status")
async def update_status(business_id: str, req: StatusUpdate):
    """Update a business status."""
    try:
        es.update(index=BUSINESSES_INDEX, id=business_id, body={"doc": {"status": req.status}})
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    return {"message": "BizHunter AI API", "status": "running", "agents": ["Hunter", "Pitcher", "Builder"]}
