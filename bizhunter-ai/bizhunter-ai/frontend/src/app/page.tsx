'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { Search, Zap, Mail, Globe, CheckCircle, Clock, TrendingUp, ChevronRight, X, Eye } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

type Business = {
  id: string
  name: string
  industry: string
  city: string
  phone: string
  email: string
  address: string
  status: string
  notes: string
  discovered_at: string
}

type Pitch = {
  id: string
  business_id: string
  business_name: string
  subject: string
  body: string
  status: string
  approved: boolean
  created_at: string
}

type Stats = {
  discovered: number
  pitched: number
  interested: number
  delivered: number
}

export default function Home() {
  const [tab, setTab] = useState<'hunt' | 'pipeline' | 'pitches'>('hunt')
  const [city, setCity] = useState('')
  const [industry, setIndustry] = useState('')
  const [loading, setLoading] = useState(false)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [pitches, setPitches] = useState<Pitch[]>([])
  const [stats, setStats] = useState<Stats>({ discovered: 0, pitched: 0, interested: 0, delivered: 0 })
  const [log, setLog] = useState<string[]>([])
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null)
  const [generatingPitch, setGeneratingPitch] = useState<string | null>(null)
  const [buildingWebsite, setBuildingWebsite] = useState<string | null>(null)
  const [builtHtml, setBuiltHtml] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const addLog = (msg: string) => setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 19)])

  const fetchData = async () => {
    try {
      const [bizRes, pitchRes, statsRes] = await Promise.all([
        axios.get(`${API}/api/businesses`),
        axios.get(`${API}/api/pitches`),
        axios.get(`${API}/api/stats`),
      ])
      setBusinesses(bizRes.data.businesses)
      setPitches(pitchRes.data.pitches)
      setStats(statsRes.data.stats)
    } catch (e) {}
  }

  useEffect(() => { fetchData() }, [])

  const hunt = async () => {
    if (!city || !industry) return
    setLoading(true)
    addLog(`🔍 Hunter Agent activated — scanning ${city} for ${industry} businesses...`)
    try {
      const res = await axios.post(`${API}/api/hunt`, { city, industry, count: 10 })
      addLog(`✅ Found ${res.data.count} businesses without websites — stored in Elasticsearch`)
      await fetchData()
      setTab('pipeline')
    } catch (e: any) {
      addLog(`❌ Error: ${e.message}`)
    }
    setLoading(false)
  }

  const generatePitch = async (biz: Business) => {
    setGeneratingPitch(biz.id)
    addLog(`✍️ Pitcher Agent generating email for ${biz.name}...`)
    try {
      const res = await axios.post(`${API}/api/pitch/generate`, { business_id: biz.id })
      addLog(`📧 Pitch ready for ${biz.name} — awaiting your approval`)
      await fetchData()
      setTab('pitches')
    } catch (e: any) {
      addLog(`❌ Pitch error: ${e.message}`)
    }
    setGeneratingPitch(null)
  }

  const approvePitch = async (pitch: Pitch) => {
    addLog(`✅ Pitch approved for ${pitch.business_name}`)
    try {
      await axios.post(`${API}/api/pitch/approve`, { pitch_id: pitch.id })
      addLog(`📤 Email marked as sent to ${pitch.business_name}`)
      await fetchData()
    } catch (e: any) {
      addLog(`❌ Approve error: ${e.message}`)
    }
  }

  const buildWebsite = async (biz: Business) => {
    setBuildingWebsite(biz.id)
    addLog(`🏗️ Builder Agent creating website for ${biz.name}...`)
    try {
      const res = await axios.post(`${API}/api/build`, { business_id: biz.id })
      setBuiltHtml(res.data.html)
      addLog(`🎉 Website built and delivered for ${biz.name}!`)
      await fetchData()
    } catch (e: any) {
      addLog(`❌ Build error: ${e.message}`)
    }
    setBuildingWebsite(null)
  }

  const markInterested = async (biz: Business) => {
    try {
      await axios.put(`${API}/api/businesses/${biz.id}/status`, { business_id: biz.id, status: 'interested' })
      addLog(`🙌 ${biz.name} marked as interested!`)
      await fetchData()
    } catch (e) {}
  }

  const filteredBiz = businesses.filter(b =>
    !searchQuery || b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.city.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const statusColor: Record<string, string> = {
    discovered: 'text-gray-400 border-gray-700',
    pitched: 'text-amber-400 border-amber-900',
    interested: 'text-blue-400 border-blue-900',
    delivered: 'text-[#BFFF00] border-[#BFFF00]/30',
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-gray-200">
      {/* Header */}
      <header className="border-b border-[#222] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#BFFF00] rounded flex items-center justify-center">
            <Zap size={16} className="text-black" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">BizHunter<span className="text-[#BFFF00]">AI</span></span>
        </div>
        <div className="flex items-center gap-6 text-xs text-gray-500">
          <span>powered by <span className="text-[#BFFF00]">Gemini</span> + <span className="text-[#BFFF00]">Elastic</span></span>
          <div className="w-2 h-2 rounded-full bg-[#BFFF00] pulse-acid"></div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)]">
        {/* Sidebar */}
        <aside className="w-56 border-r border-[#222] p-4 flex flex-col gap-2">
          {[
            { id: 'hunt', label: 'Hunter Agent', icon: Search },
            { id: 'pipeline', label: 'Pipeline', icon: TrendingUp },
            { id: 'pitches', label: 'Pitches', icon: Mail },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id as any)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all ${
                tab === id
                  ? 'bg-[#BFFF00]/10 text-[#BFFF00] border border-[#BFFF00]/30'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-[#151515]'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}

          {/* Stats */}
          <div className="mt-auto pt-4 border-t border-[#222] space-y-2">
            {[
              { label: 'Discovered', val: stats.discovered, color: 'text-gray-400' },
              { label: 'Pitched', val: stats.pitched, color: 'text-amber-400' },
              { label: 'Interested', val: stats.interested, color: 'text-blue-400' },
              { label: 'Delivered', val: stats.delivered, color: 'text-[#BFFF00]' },
            ].map(s => (
              <div key={s.label} className="flex justify-between text-xs">
                <span className="text-gray-600">{s.label}</span>
                <span className={`font-bold ${s.color}`}>{s.val}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto">
          <div className="flex h-full">
            <div className="flex-1 p-6 overflow-auto">

              {/* HUNT TAB */}
              {tab === 'hunt' && (
                <div className="max-w-xl">
                  <h1 className="font-display text-3xl font-bold mb-1">Hunter Agent</h1>
                  <p className="text-gray-500 text-sm mb-8">Gemini scans for local businesses without websites and stores them in Elasticsearch.</p>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">City / Location</label>
                      <input
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        placeholder="e.g. Mumbai, Delhi, Bangalore"
                        className="w-full bg-[#111] border border-[#333] rounded px-4 py-3 text-sm focus:border-[#BFFF00] focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">Industry</label>
                      <input
                        value={industry}
                        onChange={e => setIndustry(e.target.value)}
                        placeholder="e.g. Restaurant, Salon, Plumber, Gym"
                        className="w-full bg-[#111] border border-[#333] rounded px-4 py-3 text-sm focus:border-[#BFFF00] focus:outline-none transition-colors"
                      />
                    </div>
                    <button
                      onClick={hunt}
                      disabled={loading || !city || !industry}
                      className="w-full bg-[#BFFF00] text-black font-bold py-3 rounded text-sm hover:bg-[#d4ff33] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Hunting...</>
                      ) : (
                        <><Search size={15} /> Launch Hunter Agent</>
                      )}
                    </button>
                  </div>

                  <div className="mt-8 p-4 bg-[#111] border border-[#222] rounded">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">How it works</p>
                    {[
                      ['1', 'Hunter Agent uses Gemini to find local businesses'],
                      ['2', 'Businesses stored in Elasticsearch index'],
                      ['3', 'Pitcher Agent writes personalized emails'],
                      ['4', 'You approve → pitch sent'],
                      ['5', 'Builder Agent creates their website'],
                    ].map(([n, t]) => (
                      <div key={n} className="flex gap-3 text-sm mb-2">
                        <span className="text-[#BFFF00] font-mono">{n}.</span>
                        <span className="text-gray-400">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PIPELINE TAB */}
              {tab === 'pipeline' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h1 className="font-display text-3xl font-bold mb-1">Pipeline</h1>
                      <p className="text-gray-500 text-sm">{businesses.length} businesses tracked in Elasticsearch</p>
                    </div>
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search..."
                      className="bg-[#111] border border-[#333] rounded px-3 py-2 text-sm focus:border-[#BFFF00] focus:outline-none w-48"
                    />
                  </div>

                  <div className="space-y-2">
                    {filteredBiz.length === 0 && (
                      <div className="text-center py-16 text-gray-600">
                        <Search size={32} className="mx-auto mb-3 opacity-30" />
                        <p>No businesses yet. Launch the Hunter Agent first.</p>
                      </div>
                    )}
                    {filteredBiz.map(biz => (
                      <div key={biz.id} className={`flex items-center gap-4 p-4 bg-[#111] border rounded hover:border-[#333] transition-colors ${statusColor[biz.status] || 'border-[#222]'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-sm">{biz.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${statusColor[biz.status]}`}>{biz.status}</span>
                          </div>
                          <p className="text-xs text-gray-600">{biz.industry} · {biz.city}</p>
                          {biz.notes && <p className="text-xs text-gray-500 mt-1 truncate">{biz.notes}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {biz.status === 'discovered' && (
                            <button
                              onClick={() => generatePitch(biz)}
                              disabled={generatingPitch === biz.id}
                              className="text-xs px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded hover:bg-amber-500/20 transition-colors disabled:opacity-40"
                            >
                              {generatingPitch === biz.id ? 'Writing...' : '✍️ Pitch'}
                            </button>
                          )}
                          {biz.status === 'pitched' && (
                            <button
                              onClick={() => markInterested(biz)}
                              className="text-xs px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded hover:bg-blue-500/20 transition-colors"
                            >
                              👍 Interested
                            </button>
                          )}
                          {biz.status === 'interested' && (
                            <button
                              onClick={() => buildWebsite(biz)}
                              disabled={buildingWebsite === biz.id}
                              className="text-xs px-3 py-1.5 bg-[#BFFF00]/10 border border-[#BFFF00]/30 text-[#BFFF00] rounded hover:bg-[#BFFF00]/20 transition-colors disabled:opacity-40"
                            >
                              {buildingWebsite === biz.id ? '🏗️ Building...' : '🌐 Build Site'}
                            </button>
                          )}
                          {biz.status === 'delivered' && (
                            <span className="text-xs text-[#BFFF00]">✅ Delivered</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PITCHES TAB */}
              {tab === 'pitches' && (
                <div>
                  <h1 className="font-display text-3xl font-bold mb-1">Pitches</h1>
                  <p className="text-gray-500 text-sm mb-6">Review and approve AI-generated emails before sending.</p>

                  <div className="space-y-4">
                    {pitches.length === 0 && (
                      <div className="text-center py-16 text-gray-600">
                        <Mail size={32} className="mx-auto mb-3 opacity-30" />
                        <p>No pitches yet. Generate pitches from the Pipeline tab.</p>
                      </div>
                    )}
                    {pitches.map(pitch => (
                      <div key={pitch.id} className={`p-4 bg-[#111] border rounded ${pitch.approved ? 'border-[#BFFF00]/30' : 'border-[#333]'}`}>
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <p className="text-sm font-medium text-[#BFFF00]">{pitch.business_name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Subject: {pitch.subject}</p>
                          </div>
                          {pitch.approved ? (
                            <span className="text-xs text-[#BFFF00] flex items-center gap-1 shrink-0">
                              <CheckCircle size={12} /> Approved
                            </span>
                          ) : (
                            <button
                              onClick={() => approvePitch(pitch)}
                              className="text-xs px-3 py-1.5 bg-[#BFFF00] text-black font-bold rounded hover:bg-[#d4ff33] transition-colors shrink-0"
                            >
                              ✅ Approve & Send
                            </button>
                          )}
                        </div>
                        <div className="bg-[#0A0A0A] rounded p-3 text-xs text-gray-400 leading-relaxed whitespace-pre-wrap border border-[#1A1A1A]">
                          {pitch.body}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Log Panel */}
            <div className="w-64 border-l border-[#222] p-4 flex flex-col">
              <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Agent Log</p>
              <div className="flex-1 overflow-auto space-y-2">
                {log.length === 0 && <p className="text-xs text-gray-700">Waiting for agent activity...</p>}
                {log.map((entry, i) => (
                  <p key={i} className="text-xs text-gray-500 leading-relaxed">{entry}</p>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Website Preview Modal */}
      {builtHtml && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-[#222]">
            <span className="text-sm font-medium text-[#BFFF00]">🎉 Website Built by Builder Agent</span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const blob = new Blob([builtHtml], { type: 'text/html' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'website.html'
                  a.click()
                }}
                className="text-xs px-3 py-1.5 bg-[#BFFF00] text-black font-bold rounded"
              >
                ⬇️ Download
              </button>
              <button onClick={() => setBuiltHtml(null)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
          </div>
          <iframe srcDoc={builtHtml} className="flex-1 w-full bg-white" />
        </div>
      )}
    </div>
  )
}
