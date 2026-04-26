import { useState } from "react";
import { Shield, X, Key } from "lucide-react";

interface AppLockModalProps {
  mode: "setup" | "verify";
  onSuccess: (pin?: string) => void;
  onCancel: () => void;
  expectedPin?: string | null;
  title?: string;
}

export function AppLockModal({ mode, onSuccess, onCancel, expectedPin, title }: AppLockModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "setup") {
      if (pin.length !== 4) {
        setError("PIN must be exactly 4 digits.");
        return;
      }
      onSuccess(pin);
    } else {
      if (pin === expectedPin) {
        onSuccess(pin);
      } else {
        setError("Authentication failed. Invalid PIN.");
        setPin("");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-bg/90 backdrop-blur-md">
      <div className="bg-[#111] border border-accent w-full max-w-sm flex flex-col shadow-2xl relative">
        <div className="flex justify-between items-center bg-[#151515] px-6 py-4 border-b border-line shrink-0">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-accent" />
              <span className="font-bold text-text uppercase tracking-widest text-sm">
                {title || (mode === "setup" ? "Set Master PIN" : "System Locked")}
              </span>
            </div>
            <button onClick={onCancel} className="text-muted hover:text-accent transition">
              <X className="w-5 h-5" />
            </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 md:p-8 flex flex-col items-center">
           <Key className="w-12 h-12 text-muted mb-6" />
           <p className="text-muted text-xs text-center font-serif italic mb-6 leading-relaxed">
             {mode === "setup" 
               ? "Establish a 4-digit numeric code to encrypt critical system actions." 
               : "Enter your 4-digit Master PIN to authorize this action."}
           </p>
           <input 
             type="password"
             maxLength={4}
             pattern="\d*"
             inputMode="numeric"
             autoFocus
             value={pin}
             onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
             className="w-full text-center bg-[#0C0C0C] border border-line focus:border-accent text-[40px] tracking-[0.5em] py-4 text-text outline-none font-mono transition-colors"
             placeholder="••••"
           />
           {error && <div className="text-[#00BFFF] text-[10px] mt-4 uppercase tracking-widest font-bold">{error}</div>}
           <button type="submit" className="w-full mt-8 bg-accent text-black font-black uppercase tracking-[2px] py-3 hover:opacity-80 transition text-xs">
             {mode === "setup" ? "Secure System" : "Authorize"}
           </button>
        </form>
      </div>
    </div>
  );
}
