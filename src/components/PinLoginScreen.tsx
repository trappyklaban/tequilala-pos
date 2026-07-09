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
      <div className="min-h-screen bg-tequila-dark text-gray-300 flex flex-col justify-center items-center p-4 select-none relative font-mono">
        {/* GLOWING AMBIENT BACKGROUNDS */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-tequila-orange/5 blur-[120px] pointer-events-none"></div>
        
        <div className="w-full max-w-xl bg-zinc-950/90 border border-tequila-border/50 rounded-2xl p-6 shadow-2xl relative z-10 space-y-6">
          
          {/* Header / Brand */}
          <div className="text-center space-y-2">
            <div className="inline-flex w-12 h-12 bg-tequila-orange/10 border border-tequila-orange/30 rounded-xl items-center justify-center text-tequila-orange text-2xl font-black italic shadow shadow-tequila-orange/10 mb-1">
              T
            </div>
            <h1 className="text-xl font-extrabold text-white uppercase tracking-wider">
              Tequi-la-la Terminal
            </h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
              Vyberte uživatele pro přihlášení
            </p>
          </div>

          {/* User Selection Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[380px] overflow-y-auto pr-1">
            {/* Bartenders Options */}
            {bartenders.map((b) => (
              <button
                key={b.id}
                onClick={() => handleSelectUser(b)}
                className="p-4 bg-zinc-900/60 hover:bg-tequila-yellow/10 border border-zinc-800 hover:border-tequila-yellow/50 rounded-xl flex items-center gap-4 transition-all text-left group cursor-pointer focus:outline-none"
              >
                <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 text-gray-300 flex items-center justify-center font-bold text-sm shadow group-hover:scale-105 transition-transform shrink-0">
                  {b.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block font-bold text-white uppercase tracking-tight text-sm truncate">
                    {b.name}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${b.role === "manager" ? "bg-purple-950/50 text-purple-400 border border-purple-900/30" : "bg-zinc-800 text-zinc-400"}`}>
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
    <div className="min-h-screen bg-tequila-dark text-gray-300 flex flex-col justify-center items-center p-4 select-none relative font-mono">
      {/* GLOWING AMBIENT BACKGROUNDS */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-tequila-orange/5 blur-[120px] pointer-events-none"></div>
      
      <div className="w-full max-w-md bg-zinc-950/90 border border-tequila-border/50 rounded-2xl p-6 shadow-2xl relative z-10 space-y-6">
        
        {/* Header / Brand with back button */}
        <div className="relative">
          <button
            onClick={handleBackToUsers}
            className="absolute left-0 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
          >
            <LucideIcon name="ChevronLeft" className="w-4 h-4" />
            Zpět
          </button>
          
          <div className="text-center space-y-1">
            <div className="inline-flex w-10 h-10 bg-tequila-orange/10 border border-tequila-orange/30 rounded-xl items-center justify-center text-tequila-orange text-lg font-black italic shadow shadow-tequila-orange/10 mb-1">
              T
            </div>
            <h1 className="text-md font-extrabold text-white uppercase tracking-wider">
              {selectedUser.name}
            </h1>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest">
              Zadejte přístupový PIN kód
            </p>
          </div>
        </div>

        {/* PIN Display Visualizer */}
        <div className="space-y-3">
          <div className="h-14 bg-zinc-900/50 border border-tequila-border/40 rounded-xl flex items-center justify-center relative overflow-hidden">
            <div className="flex gap-4">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                    pin.length > index
                      ? "bg-tequila-orange border-tequila-orange scale-110 shadow shadow-tequila-orange/50"
                      : "bg-transparent border-zinc-700"
                  }`}
                />
              ))}
              {pin.length > 4 && (
                <span className="text-tequila-orange text-xs font-bold font-mono pl-1">
                  (+{pin.length - 4})
                </span>
              )}
            </div>
          </div>

          {/* Feedback/Error message */}
          <div className="h-4 flex items-center justify-center">
            {error ? (
              <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1 uppercase animate-pulse">
                <LucideIcon name="AlertTriangle" className="w-3.5 h-3.5 shrink-0" />
                {error}
              </p>
            ) : pin.length > 0 ? (
              <p className="text-[9px] text-zinc-600 uppercase tracking-wider">
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
              className="h-14 bg-zinc-900 hover:bg-zinc-850 active:bg-zinc-800 border border-zinc-800 text-lg font-bold text-gray-200 rounded-xl flex items-center justify-center transition-all cursor-pointer hover:border-zinc-700 focus:outline-none"
            >
              {num}
            </button>
          ))}
          
          <button
            onClick={handleClear}
            className="h-14 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-850 text-xs font-bold text-rose-500 uppercase rounded-xl flex items-center justify-center transition-all cursor-pointer focus:outline-none"
          >
            Clear
          </button>
          
          <button
            onClick={() => handleKeyPress("0")}
            className="h-14 bg-zinc-900 hover:bg-zinc-850 active:bg-zinc-800 border border-zinc-800 text-lg font-bold text-gray-200 rounded-xl flex items-center justify-center transition-all cursor-pointer hover:border-zinc-700 focus:outline-none"
          >
            0
          </button>
          
          <button
            onClick={handleBackspace}
            className="h-14 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-850 text-gray-400 hover:text-white rounded-xl flex items-center justify-center transition-all cursor-pointer focus:outline-none"
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
            className="w-full py-3.5 bg-tequila-orange hover:bg-tequila-yellow disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-900 text-black font-extrabold uppercase text-xs tracking-wider rounded-xl transition-all shadow-md shadow-tequila-orange/10 flex items-center justify-center gap-2 cursor-pointer focus:outline-none"
          >
            <LucideIcon name="LogIn" className="w-4 h-4" />
            Vstoupit do Pokladny
          </button>
        </div>



      </div>
    </div>
  );
};
