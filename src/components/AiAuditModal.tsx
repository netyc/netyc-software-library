import { useState, useEffect, useRef } from "react";
import { Bot, X, Volume2, Loader2, Sparkles } from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import Markdown from "react-markdown";

interface AiAuditModalProps {
  repo: any;
  onClose: () => void;
}

export function AiAuditModal({ repo, onClose }: AiAuditModalProps) {
  const [summary, setSummary] = useState<string>("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(true);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const runAudit = async () => {
      try {
        const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || (process.env.GEMINI_API_KEY as string);
        if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
        const ai = new GoogleGenAI({ apiKey });
        
        // Find readme content if available
        let corpus = repo.description || "No description available.";
        if (repo.files) {
           const readme = repo.files.find((f: any) => f.name.toLowerCase() === 'readme.md');
           if (readme && readme.content) {
              corpus += "\n\n" + readme.content;
           } else {
              const fileNames = repo.files.slice(0, 50).map((f: any) => f.name).join(", ");
              corpus += `\n\nThis archive contains files like: ${fileNames}`;
           }
        }

        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: `You are an AI archivist. The user wants to know what this repository (${repo.name}) is about BEFORE exploring it. 
          Provide a highly concise, witty, and cyber-themed summary in roughly 2-3 short paragraphs in Indonesian language.
          Data available: ${corpus.substring(0, 5000)}`,
        });

        const text = response.text || "Failed to analyze archive.";
        setSummary(text);
        
        // Try auto-play audio (browsers might block it)
        setTimeout(() => readAloud(text), 100);
      } catch (err) {
        console.error(err);
        setSummary("Gagal terhubung ke AI Matrix. Kunci akses mungkin terputus.");
      } finally {
        setIsGenerating(false);
      }
    };

    runAudit();

    return () => {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readAloud = (text: string) => {
    try {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      const cleanText = text.replace(/[*_#`~]+/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'id-ID';
      utterance.rate = 1.0;
      utterance.pitch = 0.9;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (e) => {
         console.warn("SpeechSynthesis error:", e);
         setIsSpeaking(false);
      };
      
      utteranceRef.current = utterance; // prevent GC
      window.speechSynthesis.speak(utterance);
    } catch(e) {
      console.error(e);
      setIsSpeaking(false);
    }
  };

  const handleToggleAudio = () => {
     if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
     } else {
        if (summary) readAloud(summary);
     }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-10 bg-black/90 backdrop-blur-md">
      <div className="bg-[#0C0C0C] border border-[#00BFFF] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(0,191,255,0.15)] relative overflow-hidden">
        
        {/* Animated Cyber Header line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#00BFFF] animate-pulse" />

        <div className="flex justify-between items-center bg-[#151515] px-6 py-4 border-b border-[#00BFFF]/30 shrink-0">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-[#00BFFF]" />
              <span className="font-bold text-[#00BFFF] uppercase tracking-widest text-sm">Ai Intelligence Audit</span>
            </div>
            <button 
              onClick={() => {
                window.speechSynthesis.cancel();
                onClose();
              }}
              className="p-2 -mr-2 bg-transparent hover:bg-black transition text-muted hover:text-[#00BFFF] border border-transparent hover:border-[#00BFFF]/50"
            >
              <X className="w-5 h-5" />
            </button>
        </div>

        <div className="p-6 md:p-8 relative min-h-[300px] flex flex-col">
           <div className="mb-6 flex justify-between items-end border-b border-line pb-4">
              <div>
                 <p className="text-[10px] text-muted uppercase tracking-widest mb-1">Target Archive</p>
                 <h2 className="text-2xl font-black uppercase text-text">{repo.name}</h2>
              </div>
              <button 
                 disabled={isGenerating}
                 onClick={handleToggleAudio}
                 className={`flex items-center gap-2 px-4 py-2 border text-[10px] uppercase font-bold tracking-widest transition-all ${
                   isSpeaking ? 'bg-[#00BFFF] text-black border-[#00BFFF]' : 'border-line text-muted hover:text-text hover:border-accent'
                 }`}
              >
                 <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-pulse' : ''}`} />
                 {isSpeaking ? 'Muting...' : 'Replay Audio'}
              </button>
           </div>

           <div className="flex-grow overflow-auto text-sm md:text-base font-serif leading-relaxed text-text">
             {isGenerating ? (
                <div className="flex flex-col items-center justify-center h-full text-[#00BFFF]">
                   <Bot className="w-16 h-16 mb-4 animate-bounce" />
                   <div className="flex items-center gap-3 font-mono text-xs tracking-widest uppercase">
                     <Loader2 className="w-4 h-4 animate-spin" /> Scanning Matrix...
                   </div>
                </div>
             ) : (
                <div className="markdown-body !bg-transparent !text-text !font-serif p-4 border-l-2 border-[#00BFFF] bg-[#151515]">
                   <Markdown>{summary}</Markdown>
                </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
