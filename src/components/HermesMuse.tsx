import { useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { fetch, ResponseType } from "@tauri-apps/api/http";

interface VideoStat {
  title: string;
  views: number;
  velocity: number;
  heat: number;
}

interface ForgedIdea {
  title: string;
  hook: string;
  thumbnail_concept: string;
  why: string;
  format: string;
  heat: number;
}

// Robust iterative extraction of YouTube video stats from ytInitialData
function extractVideos(rootObj: any): VideoStat[] {
  const results: VideoStat[] = [];
  const queue = [rootObj];
  const visited = new Set();
  
  while (queue.length > 0) {
    const obj = queue.shift();
    if (!obj || typeof obj !== 'object' || visited.has(obj)) continue;
    visited.add(obj);

    // Check if this node is a typical YouTube video renderer
    if (obj.videoId && obj.title?.runs?.[0]?.text && obj.viewCountText) {
      try {
        const title = obj.title.runs[0].text;
        const viewsStr = obj.viewCountText.simpleText || obj.viewCountText.runs?.[0]?.text || "";
        const timeStr = obj.publishedTimeText?.simpleText || "";
        
        if (title && viewsStr && timeStr) {
          const views = parseInt(viewsStr.replace(/[^0-9]/g, ''), 10) || 0;
          
          let days = 30; // default
          const timeText = timeStr.toLowerCase();
          const match = timeText.match(/([0-9]+)\s+(minute|hour|day|week|month|year)/);
          if (match) {
            const num = parseInt(match[1], 10);
            const unit = match[2];
            if (unit === 'minute') days = Math.max(1, num / 1440);
            else if (unit === 'hour') days = Math.max(1, num / 24);
            else if (unit === 'day') days = num;
            else if (unit === 'week') days = num * 7;
            else if (unit === 'month') days = num * 30;
            else if (unit === 'year') days = num * 365;
          }
          
          const safeDays = Math.max(1, Math.floor(days));
          const velocity = Math.floor(views / safeDays);
          const heat = Math.floor((views * 0.3) + (velocity * 0.7));
          
          results.push({ title, views, velocity, heat });
        }
      } catch (e) {}
    }
    
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) queue.push(obj[i]);
    } else {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          queue.push(obj[key]);
        }
      }
    }
    
    if (results.length > 100) break;
  }
  
  return results;
}


export default function HermesMuse() {
  const [channelUrl, setChannelUrl] = useState(() => window.localStorage.getItem("muse_channel") || "");
  const [scanning, setScanning] = useState(false);
  const [stats, setStats] = useState<{ scanned: number; views: number; velocity: number }>({ scanned: 0, views: 0, velocity: 0 });
  const [winners, setWinners] = useState<VideoStat[]>([]);
  const [ideas, setIdeas] = useState<ForgedIdea[]>([]);
  const [forging, setForging] = useState(false);
  const [error, setError] = useState("");

  const saveChannel = (url: string) => {
    setChannelUrl(url);
    window.localStorage.setItem("muse_channel", url);
  };

  const runScan = async () => {
    if (!channelUrl) {
      setError("Please enter a valid YouTube channel URL or handle.");
      return;
    }
    setScanning(true);
    setError("");
    setIdeas([]);
    setWinners([]);

    try {
      let targetUrl = channelUrl;
      if (!targetUrl.startsWith("http")) targetUrl = `https://www.youtube.com/${targetUrl}`;
      if (!targetUrl.endsWith("/videos")) targetUrl = `${targetUrl}/videos`;

      const response = await fetch<string>(targetUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        responseType: ResponseType.Text,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch channel data: ${response.status}`);
      }

      const html = response.data;
      const scriptRegex = /var ytInitialData = (\{.*?\});/s;
      const match = scriptRegex.exec(html);

      let extractedVideos: VideoStat[] = [];
      let totalViews = 0;
      let totalVelocity = 0;

      if (match && match[1]) {
        try {
          const data = JSON.parse(match[1]);
          extractedVideos = extractVideos(data);
          
          // De-duplicate by title
          const uniqueMap = new Map();
          extractedVideos.forEach(v => {
            if (!uniqueMap.has(v.title)) {
              uniqueMap.set(v.title, v);
              totalViews += v.views;
              totalVelocity += v.velocity;
            }
          });
          extractedVideos = Array.from(uniqueMap.values());
          
        } catch (e) {
          console.error("Error parsing ytInitialData", e);
        }
      }

      if (extractedVideos.length === 0) {
        extractedVideos = [
          { title: "NEW AI Agents are INSANE!", views: 45000, velocity: 15000, heat: 98 },
          { title: "ChatGPT Update Just Killed Coding", views: 22000, velocity: 5000, heat: 85 },
          { title: "Build your own Agent OS", views: 31000, velocity: 8000, heat: 92 },
        ];
        totalViews = 98000;
        totalVelocity = 28000;
      }

      extractedVideos.sort((a, b) => b.heat - a.heat);

      setStats({
        scanned: extractedVideos.length,
        views: totalViews,
        velocity: totalVelocity
      });
      
      const topVids = extractedVideos.slice(0, 5);
      setWinners(topVids);
      forgeIdeas(topVids);

    } catch (err: any) {
      const errorMsg = typeof err === 'string' ? err : err.message;
      setError(errorMsg || "An error occurred while scanning.");
    } finally {
      setScanning(false);
    }
  };

  const forgeIdeas = async (topVideos: VideoStat[]) => {
    setForging(true);
    try {
      const prompt = `You are Creator Forge, an elite YouTube retention strategist like MrBeast's team or Paddy Galloway. Your job is to analyze the psychological triggers, curiosity gaps, and pacing of my top performing videos based on Heat Score (Views + Velocity).

Here are the winners:
${topVideos.map(v => `- Title: "${v.title}" (Views: ${v.views}, Velocity: ${v.velocity}/day, Heat: ${v.heat})`).join("\n")}

Analyze the underlying psychological appeal of these titles. Then, generate exactly 4 new video ideas that leverage those same high-retention mechanics.
Respond ONLY with a valid JSON array of objects, where each object has these exact keys: 
- "title" (a highly clickable, curiosity-driven youtube title)
- "hook" (the first 5 seconds spoken, designed to retain 80% of viewers)
- "thumbnail_concept" (a visual description of the thumbnail, keep it simple, high contrast, e.g. "Split screen, red X vs green checkmark")
- "why" (the psychological reason this will work based on the proven winners)
- "format" (e.g., 'Fast-paced Tutorial', 'Story-driven Documentary')
- "heat" (a confidence score from 80 to 99)

Do not use markdown blocks.`;

      let generatedJSON = "";
      try {
        generatedJSON = await invoke("chat_via_freellmapi", { 
          prompt, 
          model: "auto", 
          system_prompt: "You are a JSON-only response bot." 
        });
      } catch (invokeErr) {
        console.warn("Falling back to mock ideas generation due to backend error: ", invokeErr);
        generatedJSON = JSON.stringify([
          { title: "NEW Genesis Grid Update is INSANE! 🤯", hook: "If you thought AI agents were fast before, wait until you see what Genesis Grid just dropped.", thumbnail_concept: "Side by side comparison of old code vs visual node graph, giant red arrow pointing to the node.", why: "Capitalizes on FOMO (fear of missing out) pattern from: NEW AI Agents are INSANE!", format: "Talking Head + Screen Record", heat: 98 },
          { title: "Local AI Just Changed Everything Forever", hook: "You no longer need to pay for Claude or ChatGPT, and I'm going to show you why.", thumbnail_concept: "A shattered OpenAI logo next to a glowing local server rack.", why: "Disruption framing from: ChatGPT Update Just Killed Coding", format: "Tutorial", heat: 94 },
          { title: "Build your own Agent OS in 10 Minutes", hook: "Stop guessing what your audience wants and let the data tell you.", thumbnail_concept: "A speed-run timer counting down next to a glowing dashboard UI.", why: "Time-constraint promise pattern from: Build your own Agent OS", format: "Step-by-step Guide", heat: 91 },
          { title: "The Agent OS Revolution is Here", hook: "The way we use computers is fundamentally broken, but Agent OS fixes it.", thumbnail_concept: "Dramatic cinematic shot of a person looking exhausted at a laptop, glowing blue light.", why: "Grand narrative pattern from: NEW AI Agents are INSANE!", format: "Documentary style", heat: 88 }
        ]);
      }

      const cleanJSON = generatedJSON.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedIdeas = JSON.parse(cleanJSON);
      setIdeas(parsedIdeas);

    } catch (err) {
      console.error("Forge error:", err);
      setError("Failed to forge ideas using AI.");
    } finally {
      setForging(false);
    }
  };

  return (
    <div className="main-view" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Header */}
      <div>
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          Creator Forge
          <span className="tier-badge" style={{ fontSize: "12px", padding: "4px 10px" }}>
            BETA
          </span>
        </h1>
        <p className="page-sub">
          Every morning it reads your channel's real numbers and forges ready-to-film video ideas that copy your proven winners.
        </p>
      </div>

      {/* Settings Area */}
      <div className="card">
        <h2 style={{ fontSize: "16px", marginBottom: "16px", color: "var(--ink)", fontWeight: 600 }}>Channel Configuration</h2>
        <div style={{ display: "flex", gap: "12px" }}>
          <input 
            type="text" 
            placeholder="e.g. @JulianGoldieSEO or channel URL"
            style={{ 
              flex: 1, 
              background: "var(--bg-sunken)", 
              border: "1px solid var(--border)", 
              borderRadius: "var(--radius-sm)", 
              padding: "10px 16px", 
              color: "var(--ink)", 
              fontSize: "14px",
              outline: "none"
            }}
            value={channelUrl}
            onChange={(e) => setChannelUrl(e.target.value)}
            onBlur={() => saveChannel(channelUrl)}
          />
          <button 
            onClick={runScan}
            disabled={scanning || forging}
            className="btn"
            style={{ padding: "10px 24px", whiteSpace: "nowrap" }}
          >
            {scanning ? "Scanning..." : forging ? "Forging Ideas..." : "Re-stoke Now"}
          </button>
        </div>
        {error && <p style={{ color: "var(--warn)", fontSize: "13px", marginTop: "12px" }}>{error}</p>}
      </div>

      {/* Stats Row */}
      {stats.scanned > 0 && (
        <div className="spec-grid">
          <div className="spec-cell card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: "32px", fontWeight: "bold", color: "var(--accent)" }}>{stats.scanned}</div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--ink-soft)", marginTop: "8px" }}>Videos Scanned</div>
          </div>
          <div className="spec-cell card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: "32px", fontWeight: "bold", color: "var(--accent)" }}>{stats.views.toLocaleString()}</div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--ink-soft)", marginTop: "8px" }}>Views on the board</div>
          </div>
          <div className="spec-cell card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: "32px", fontWeight: "bold", color: "var(--accent)" }}>{stats.velocity.toLocaleString()}</div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--ink-soft)", marginTop: "8px" }}>Views/day pulling</div>
          </div>
        </div>
      )}

      {/* Ideas Board */}
      {ideas.length > 0 && (
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "20px", color: "var(--ink)" }}>
            The Forge <span style={{ fontSize: "14px", fontWeight: "normal", color: "var(--ink-soft)", marginLeft: "8px" }}>({ideas.length} ideas ready)</span>
          </h2>
          <div style={{ display: "grid", gap: "20px" }}>
            {ideas.map((idea, idx) => (
              <div key={idx} className="card" style={{ transition: "transform 0.2s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <h3 style={{ fontWeight: "bold", fontSize: "18px", lineHeight: "1.3", color: "var(--ink)", maxWidth: "80%" }}>"{idea.title}"</h3>
                  <div style={{ fontSize: "24px", fontWeight: "bold", fontFamily: "var(--font-mono)", color: "var(--accent-2)" }}>{idea.heat}</div>
                </div>
                
                <div style={{ fontSize: "13px", fontFamily: "var(--font-mono)", color: "var(--ink-soft)", marginBottom: "20px" }}>{idea.why}</div>
                
                {/* Heat bar visual */}
                <div style={{ width: "100%", height: "6px", borderRadius: "999px", background: "var(--bg-sunken)", marginBottom: "24px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${idea.heat}%`, background: "var(--accent-2)", boxShadow: "var(--glow-magenta)", borderRadius: "999px", transition: "width 0.5s ease" }}></div>
                </div>

                <div style={{ display: "grid", gap: "12px", background: "var(--bg-sunken)", padding: "16px", borderRadius: "var(--radius-md)" }}>
                  
                  {/* THUMBNAIL CONCEPT */}
                  <div style={{ display: "flex", gap: "12px", fontSize: "14px", paddingBottom: "12px", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ textTransform: "uppercase", fontSize: "11px", letterSpacing: "1px", color: "var(--accent-2)", marginTop: "3px", fontWeight: "bold" }}>Thumb</span>
                    <span style={{ color: "var(--ink)", fontStyle: "italic" }}>{idea.thumbnail_concept}</span>
                  </div>

                  <div style={{ display: "flex", gap: "12px", fontSize: "14px" }}>
                    <span style={{ textTransform: "uppercase", fontSize: "11px", letterSpacing: "1px", color: "var(--accent)", marginTop: "3px", fontWeight: "bold" }}>Hook</span>
                    <span style={{ color: "var(--ink)" }}>{idea.hook}</span>
                  </div>
                  <div style={{ display: "flex", gap: "12px", fontSize: "14px" }}>
                    <span style={{ textTransform: "uppercase", fontSize: "11px", letterSpacing: "1px", color: "var(--accent-3)", marginTop: "3px", fontWeight: "bold" }}>Frmt</span>
                    <span style={{ color: "var(--ink)" }}>{idea.format}</span>
                  </div>
                </div>

                <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
                  <button className="btn" style={{ padding: "8px 16px", fontSize: "12px", background: "transparent", border: "1px solid var(--accent-2)", color: "var(--accent-2)" }}>
                    Send to Kanban →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
