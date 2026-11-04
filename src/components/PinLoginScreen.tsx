import React, { useState, useEffect } from "react";
import { Bartender } from "../types";
import { LucideIcon } from "./LucideIcon";

interface PinLoginScreenProps {
  bartenders: Bartender[];
  onLoginSuccess: (role: "manager" | "barman", bartenderId?: string) => void;
}

export const PinLoginScreen: React.FC<PinLoginScreenProps> = ({ bartenders, onLoginSuccess }) => {
  const [selectedUser, setSelectedUser] = useState<Bartender | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Handle keyboard input
  useEffect(() => {
    if (!selectedUser) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        if (pin.length < 8) {
          setPin((prev) => prev + e.key);
          setError(null);
        }
      } else if (e.key === "Backspace") {
        setPin((prev) => prev.slice(0, -1));
        setError(null);
      } else if (e.key === "Escape") {
        setPin("");
        setSelectedUser(null);
        setError(null);
      } else if (e.key === "Enter") {
        handleLogin(pin);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pin, selectedUser]);

  const handleKeyPress = (num: string) => {
    if (pin.length < 8) {
      setPin((prev) => prev + num);
      setError(null);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin("");
    setError(null);
  };

  const handleLogin = (enteredPin: string) => {
    if (!enteredPin || !selectedUser) return;

    if (enteredPin === selectedUser.pin) {
      if (selectedUser.status !== "active") {
        setError(`Uživatel ${selectedUser.name} je momentálně deaktivovaný manažerem!`);
        setPin("");
        return;
      }
      onLoginSuccess(selectedUser.role || "barman", selectedUser.id);
      setPin("");
      return;
    }

    // Incorrect PIN
    setError("Neplatný PIN kód. Zkuste to znovu.");
    setPin("");
  };

  // Auto submit when length is reached
  useEffect(() => {
    if (!selectedUser || !pin) return;

    if (selectedUser.pin && pin === selectedUser.pin) {
      handleLogin(pin);
    }
  }, [pin, selectedUser]);

  const handleSelectUser = (user: Bartender) => {
    setSelectedUser(user);
    setPin("");
    setError(null);
  };

  const handleBackToUsers = () => {
    setSelectedUser(null);
    setPin("");
    setError(null);
  };

  if (!selectedUser) {
    return (
      <div className="min-h-screen bg-[#0e0307] text-[#f4e7dc] flex flex-col justify-center items-center p-4 select-none relative font-mono">
        {/* GLOWING AMBIENT BACKGROUNDS */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-rose-950/20 blur-[140px] pointer-events-none"></div>
        
        <div className="w-full max-w-xl bg-[#18050c]/90 border border-rose-950/50 rounded-2xl p-6 md:p-8 shadow-2xl relative z-10 space-y-6">
          
          {/* Header / Brand */}
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <img
                src="/assets/aistudio/noxlogo_67a21471.png"
                alt="nox. Fleeca Tower"
                className="w-20 h-20 rounded-2xl object-contain shadow-xl border border-rose-950/60 shadow-rose-950/40"
              />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#f4e7dc] lowercase tracking-tight">
                nox<span className="text-rose-400">.</span>
              </h1>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-0.5">
                Fleeca Tower • Drinks & Dining • POS Terminal
              </p>
            </div>
            <p className="text-[11px] text-rose-300/70 uppercase tracking-wider font-semibold">
              Vyberte profil personálu pro přihlášení
            </p>
          </div>

          {/* User Selection Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[380px] overflow-y-auto pr-1">
            {bartenders.map((b) => (
              <button
                key={b.id}
                onClick={() => handleSelectUser(b)}
                className="p-4 bg-zinc-950/70 hover:bg-rose-950/30 border border-rose-950/40 hover:border-rose-800/60 rounded-xl flex items-center gap-3.5 transition-all text-left group cursor-pointer focus:outline-none"
              >
                <div className="w-11 h-11 rounded-full bg-zinc-900 border border-rose-900/40 text-rose-200 flex items-center justify-center font-bold text-sm shadow group-hover:scale-105 transition-transform shrink-0">
                  {b.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block font-bold text-zinc-100 uppercase tracking-tight text-xs truncate">
                    {b.name}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${b.role === "manager" ? "bg-purple-950/60 text-purple-300 border border-purple-900/40" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
                      {b.role === "manager" ? "👑 Manažer" : "🍸 Barman"}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${b.status !== "active" ? "bg-rose-500" : b.onShift ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"}`}></span>
                      <span className={`text-[9px] uppercase font-bold tracking-wider ${b.status !== "active" ? "text-rose-400" : b.onShift ? "text-emerald-400" : "text-zinc-500"}`}>
                        {b.status !== "active" ? "Deaktivován" : b.onShift ? "Na směně" : "Mimo směnu"}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e0307] text-[#f4e7dc] flex flex-col justify-center items-center p-4 select-none relative font-mono">
      {/* GLOWING AMBIENT BACKGROUNDS */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-rose-950/20 blur-[140px] pointer-events-none"></div>
      
      <div className="w-full max-w-md bg-[#18050c]/90 border border-rose-950/50 rounded-2xl p-6 md:p-8 shadow-2xl relative z-10 space-y-6">
        
        {/* Header / Brand with back button */}
        <div className="relative">
          <button
            onClick={handleBackToUsers}
            className="absolute left-0 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
          >
            <LucideIcon name="ChevronLeft" className="w-4 h-4" />
            Zpět
          </button>
          
          <div className="text-center space-y-1 pt-1">
            <div className="flex justify-center">
              <img
                src="/assets/aistudio/noxlogo_67a21471.png"
                alt="nox."
                className="w-12 h-12 rounded-xl object-contain shadow-md border border-rose-950/60 mb-1"
              />
            </div>
            <h1 className="text-base font-extrabold text-[#f4e7dc] uppercase tracking-wider">
              {selectedUser.name}
            </h1>
            <p className="text-[9px] text-zinc-400 uppercase tracking-widest">
              Zadejte přístupový PIN kód
            </p>
          </div>
        </div>

        {/* PIN Display Visualizer */}
        <div className="space-y-3">
          <div className="h-14 bg-zinc-950/80 border border-rose-950/50 rounded-xl flex items-center justify-center relative overflow-hidden">
            <div className="flex gap-4">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                    pin.length > index
                      ? "bg-rose-500 border-rose-400 scale-110 shadow shadow-rose-500/50"
                      : "bg-transparent border-zinc-700"
                  }`}
                />
              ))}
              {pin.length > 4 && (
                <span className="text-rose-400 text-xs font-bold font-mono pl-1">
                  (+{pin.length - 4})
                </span>
              )}
            </div>
          </div>

          {/* Feedback/Error message */}
          <div className="h-4 flex items-center justify-center">
            {error ? (
              <p className="text-[10px] text-rose-400 font-bold flex items-center gap-1 uppercase animate-pulse">
                <LucideIcon name="AlertTriangle" className="w-3.5 h-3.5 shrink-0" />
                {error}
              </p>
            ) : pin.length > 0 ? (
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider">
                Stiskněte ENTER nebo tlačítko pro odeslání
              </p>
            ) : null}
          </div>
        </div>

        {/* Numeric PIN Pad Grid */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              className="h-14 bg-zinc-900/80 hover:bg-rose-950/40 active:bg-rose-950/70 border border-zinc-800 text-lg font-bold text-gray-200 rounded-xl flex items-center justify-center transition-all cursor-pointer hover:border-rose-900/50 focus:outline-none"
            >
              {num}
            </button>
          ))}
          
          <button
            onClick={handleClear}
            className="h-14 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-rose-950 text-xs font-bold text-rose-400 uppercase rounded-xl flex items-center justify-center transition-all cursor-pointer focus:outline-none"
          >
            Clear
          </button>
          
          <button
            onClick={() => handleKeyPress("0")}
            className="h-14 bg-zinc-900/80 hover:bg-rose-950/40 active:bg-rose-950/70 border border-zinc-800 text-lg font-bold text-gray-200 rounded-xl flex items-center justify-center transition-all cursor-pointer hover:border-rose-900/50 focus:outline-none"
          >
            0
          </button>
          
          <button
            onClick={handleBackspace}
            className="h-14 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800 text-gray-400 hover:text-white rounded-xl flex items-center justify-center transition-all cursor-pointer focus:outline-none"
            title="Smazat zpět"
          >
            <LucideIcon name="Delete" className="w-5 h-5" />
          </button>
        </div>

        {/* Submit Button */}
        <div className="pt-2 max-w-[280px] mx-auto">
          <button
            onClick={() => handleLogin(pin)}
            disabled={!pin}
            className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-900 text-white font-extrabold uppercase text-xs tracking-wider rounded-xl transition-all shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 cursor-pointer focus:outline-none"
          >
            <LucideIcon name="LogIn" className="w-4 h-4" />
            Vstoupit do Pokladny nox.
          </button>
        </div>

      </div>
    </div>
  );
};
