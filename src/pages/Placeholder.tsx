import { ArrowLeft, Clock } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export function Placeholder() {
  const location = useLocation();
  const pageName = location.pathname.substring(1).split('/')[0] || 'Page';

  return (
    <div className="flex-1 flex flex-col p-6 md:p-10 overflow-hidden w-full bg-[#111111] items-center justify-center relative">
        <Link to="/" className="absolute top-10 left-10 text-muted flex items-center gap-2 hover:text-accent transition uppercase tracking-widest text-[10px] font-bold">
          <ArrowLeft className="w-4 h-4" /> Go Back
        </Link>
        <div className="flex flex-col items-center">
            <Clock className="w-16 h-16 text-muted mb-6" />
            <h1 className="text-[48px] md:text-[80px] font-[800] leading-[0.8] tracking-[-4px] uppercase break-words text-text mb-4 text-center">
              {pageName}
            </h1>
            <p className="text-muted font-serif italic text-xl border-t border-line pt-4 px-10">
               Under Construction. The void is still mapping this area.
            </p>
        </div>
    </div>
  );
}
