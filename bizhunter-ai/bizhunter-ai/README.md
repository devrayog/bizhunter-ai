# 🎯 BizHunter AI

> **License: MIT** — See LICENSE file

An autonomous AI agent that finds local businesses without websites, pitches them, builds their website, and closes the deal — with a human approving at key steps.

## 🤖 How It Works

BizHunter AI uses **3 specialized agents** powered by **Gemini** and **Elastic**:

1. **Hunter Agent** — Searches for local businesses without an online presence
2. **Pitcher Agent** — Generates personalized cold email pitches using Gemini AI
3. **Builder Agent** — Creates a full website when a business says yes

All business data, leads, pitches, and status tracking is stored in **Elasticsearch** for powerful search and analytics.

## 🏗 Tech Stack

- **AI Brain**: Google Gemini 1.5 Flash
- **Search & Storage**: Elastic Cloud (Elasticsearch)
- **Backend**: Python + FastAPI
- **Frontend**: Next.js + Tailwind CSS
- **Deployment**: Vercel (frontend) + Cloud Run (backend)

## 🚀 Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Fill in your API keys in .env
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Fill in your backend URL
npm run dev
```

## 🔑 Environment Variables

### Backend `.env`
```
GEMINI_API_KEY=your_gemini_api_key
ELASTIC_URL=your_elastic_endpoint
ELASTIC_API_KEY=your_elastic_api_key
SERPER_API_KEY=your_serper_api_key
```

### Frontend `.env.local`
```
NEXT_PUBLIC_API_URL=your_backend_url
```

## 🎯 Agent Pipeline

```
User inputs city + industry
        ↓
Hunter Agent → finds 10 businesses via web search
        ↓
Stores in Elasticsearch
        ↓
Pitcher Agent → Gemini writes personalized pitch
        ↓
Human approves pitch ✅
        ↓
Pitcher Agent → sends email
        ↓
Business replies → Human marks as interested
        ↓
Builder Agent → Gemini builds full website HTML
        ↓
Website delivered to client
```

## 📊 Elastic Integration

BizHunter uses Elasticsearch for:
- Storing and searching all discovered businesses
- Tracking lead status (discovered → pitched → interested → delivered)
- Full-text search across all pitches and follow-ups
- Analytics dashboard on conversion rates

## 🏆 Built for Google Cloud Rapid Agent Hackathon 2026
- Partner Track: **Elastic**
- Powered by: **Gemini 1.5 Flash**
- Built with: **Google Cloud Agent Builder concepts**
