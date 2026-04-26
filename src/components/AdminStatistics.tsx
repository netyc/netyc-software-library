import { useState, useEffect, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { db } from "../lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import { Activity, ShieldAlert } from "lucide-react";

export function AdminStatistics() {
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [waveData, setWaveData] = useState<{name: string, value: number}[]>(Array.from({ length: 30 }, (_, i) => ({ name: `Node ${i}`, value: 50 })));
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const q = query(collection(db, "repositories"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      const uniqueData = Array.from(new Map(data.map((r: any) => [r.id, r])).values());
      setRepos(uniqueData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const animate = (time: number) => {
      setWaveData(Array.from({ length: 30 }, (_, i) => {
         const x = i;
         // Generate continuous wave for security level (0-100)
         const val = 60 + 20 * Math.sin(x * 0.4 + time / 400) + 15 * Math.sin(x * 0.7 - time / 250);
         return { name: `Node ${x}`, value: Math.max(0, Math.min(100, val)) };
      }));
      requestRef.current = requestAnimationFrame(animate);
    }
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, []);

  if (loading) return null;

  // Language Distribution
  const langCount = repos.reduce((acc, repo) => {
    const lang = repo.language || 'text';
    acc[lang] = (acc[lang] || 0) + 1;
    return acc;
  }, {});
  
  const languageData = Object.keys(langCount).map(lang => ({
    name: lang,
    value: langCount[lang]
  })).sort((a, b) => b.value - a.value).slice(0, 5);

  const colors = ['#00BFFF', '#FF00FF', '#39FF14', '#FFD700', '#FF4500'];

  return (
    <section className="space-y-6 mt-10 p-6 border-2 border-[#00BFFF] relative bg-[#151515]">
      {/* Absolute top badge for SuperAdmin */}
      <div className="absolute -top-3 right-6 bg-[#00BFFF] text-black px-4 py-1 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
        <Activity className="w-4 h-4" /> SUPERADMIN MODULE
      </div>

      <h2 className="text-[11px] uppercase text-[#00BFFF] tracking-[2px] border-b border-[#00BFFF]/50 pb-[10px] flex items-center gap-3">
        System Analytics
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Language Vectors Graph */}
        <div className="bg-bg border border-line p-4 overflow-hidden relative">
           <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-6">Language Vector Matrix</h3>
           <div className="h-[200px] w-full flex items-center justify-center">
              <style>
                {`
                  @keyframes spin3d {
                    from { transform: rotateX(-15deg) rotateY(0deg); }
                    to { transform: rotateX(-15deg) rotateY(360deg); }
                  }
                  .graph-3d-container {
                    width: 100%;
                    height: 100%;
                    transform-style: preserve-3d;
                    animation: spin3d 12s linear infinite;
                  }
                `}
              </style>
              <div className="relative w-48 h-32" style={{ perspective: '800px' }}>
                 <div className="graph-3d-container absolute inset-0">
                    {/* 3D Grid Lines */}
                    <div className="absolute inset-0 border border-line/30 rounded-full" style={{ transform: 'rotateX(90deg) translateZ(-40px) scale(1.5)' }} />
                    <div className="absolute inset-0 border border-line/30 rounded-full" style={{ transform: 'rotateX(90deg) translateZ(0px) scale(1.5)' }} />
                    <div className="absolute inset-0 border border-line/30 rounded-full" style={{ transform: 'rotateX(90deg) translateZ(40px) scale(1.5)' }} />

                    {languageData.map((lang, index) => {
                       const angle = (360 / languageData.length) * index;
                       const color = colors[index % colors.length];
                       const maxCount = Math.max(...languageData.map(l => l.value));
                       const amplitude = Math.max(10, (lang.value / Math.max(1, maxCount)) * 40);
                       const frequency = 1 + (index * 0.5);
                       
                       let d = `M 0,64 `;
                       for(let i=0; i<=150; i+=5) {
                          const x = i;
                          let y = 64;
                          if (index % 3 === 0) {
                             y = 64 - (Math.sin(x * 0.05 * frequency) * amplitude);
                          } else if (index % 3 === 1) {
                             y = 64 - (Math.cos(x * 0.05 * frequency) * amplitude);
                          } else {
                             y = 64 - (Math.max(-amplitude, Math.min(amplitude, Math.tan(x * 0.05 * frequency) * amplitude/3)));
                          }
                          d += `L ${x},${y} `;
                       }

                       return (
                          <div 
                            key={lang.name}
                            className="absolute top-0 left-1/2 -ml-[75px] w-[150px] h-[128px] opacity-90 flex items-center justify-center pointer-events-none"
                            style={{ 
                              transform: `rotateY(${angle}deg) translateZ(30px)`,
                              transformOrigin: 'center center',
                            }}
                          >
                             <svg width="150" height="128" viewBox="0 0 150 128" className="overflow-visible">
                               <path d={d} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
                               <line x1="0" y1="64" x2="150" y2="64" stroke={`${color}40`} strokeWidth="1" strokeDasharray="4 4" />
                             </svg>
                             <div 
                               className="absolute -bottom-6 w-max left-1/2 -translate-x-1/2 text-[9px] uppercase font-bold tracking-widest px-1 bg-black/80 backdrop-blur-sm border border-line"
                               style={{ color, transform: `rotateY(${-angle}deg)` }}
                             >
                               {lang.name} ({lang.value})
                             </div>
                          </div>
                       )
                    })}
                 </div>
              </div>
           </div>
        </div>

        {/* Global Security Load Graph */}
        <div className="bg-bg border border-line p-4">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#39FF14] flex items-center gap-2">
                 <ShieldAlert className="w-4 h-4" /> Archive Security Status
              </h3>
              <span className="text-[9px] uppercase font-mono tracking-widest text-[#39FF14] animate-pulse">Live Tracking</span>
           </div>
           <div className="h-[200px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={waveData}>
                  <defs>
                    <linearGradient id="colorSecurity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#39FF14" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#39FF14" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <YAxis hide={true} domain={[0, 100]} />
                  <Tooltip contentStyle={{backgroundColor: '#0C0C0C', borderColor: '#39FF14', fontSize: '10px', color: '#39FF14'}} itemStyle={{color: '#39FF14'}} labelStyle={{display: 'none'}} formatter={(val) => [`${Math.round(Number(val))}%`, 'Security Integrity']} />
                  <Area isAnimationActive={false} type="monotone" dataKey="value" stroke="#39FF14" strokeWidth={2} fillOpacity={1} fill="url(#colorSecurity)" activeDot={{r: 4, strokeWidth: 0, fill: '#39FF14' }} />
               </AreaChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>
      
      <div className="flex gap-10 mt-6 pt-6 border-t border-[#00BFFF]/20">
         <div>
            <p className="text-[10px] text-muted uppercase tracking-widest mb-1">Total System Archives</p>
            <p className="text-4xl font-serif">{repos.length}</p>
         </div>
         <div>
            <p className="text-[10px] text-muted uppercase tracking-widest mb-1">Cumulative Stars</p>
            <p className="text-4xl font-serif text-[#00BFFF]">
               {repos.reduce((acc, r) => acc + (r.stars || 0), 0)}
            </p>
         </div>
      </div>
    </section>
  );
}
