import React, { useState } from "react";
import { Bartender, SaleLog } from "../types";
import { LucideIcon } from "./LucideIcon";

interface ShiftTabProps {
  bartender: Bartender;
  sales: SaleLog[];
  onToggleRegister: () => void;
  onLogout: () => void;
  isOpen: boolean;
}

export const ShiftTab: React.FC<ShiftTabProps> = ({
  bartender,
  sales,
  onToggleRegister,
  onLogout,
  isOpen,
}) => {
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const triggerAlert = (type: "success" | "error", message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 3000);
  };

  // Filter sales completed by this bartender
  const mySales = sales.filter((s) => s.bartenderId === bartender.id);
  const mySalesTotal = mySales.reduce((sum, s) => sum + s.totalAmount, 0);
  const myCashSalesTotal = mySales
    .filter((s) => !s.paymentMethod || s.paymentMethod === "cash")
    .reduce((sum, s) => sum + s.totalAmount, 0);
  const myCardSalesTotal = mySales
    .filter((s) => s.paymentMethod === "card")
    .reduce((sum, s) => sum + s.totalAmount, 0);
  const myCommissionTotal = mySales.reduce((sum, s) => sum + s.commissionPaid, 0);

  const isClockedIn = isOpen;

  const handleToggleShift = () => {
    onToggleRegister();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 font-mono">
      {/* Alert Banner */}
      {alert && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl border animate-fade-in ${
            alert.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/40 border-rose-500/30 text-rose-300"
          }`}
        >
          <LucideIcon
            name={alert.type === "success" ? "Check" : "AlertTriangle"}
            className="w-5 h-5 flex-shrink-0"
          />
          <span className="font-medium text-sm">{alert.message}</span>
        </div>
      )}

      {/* Main shift control card */}
      <div className="bg-tequila-card border border-tequila-border p-6 rounded-2xl space-y-6 relative overflow-hidden">
        {/* Glow behind */}
        <div className={`absolute top-0 right-0 w-48 h-48 rounded-full blur-[80px] pointer-events-none transition-all ${
          isClockedIn ? "bg-emerald-500/5" : "bg-rose-500/5"
        }`}></div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-tequila-border/50 pb-5">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg border transition-all ${
              isClockedIn 
                ? "bg-emerald-950/50 border-emerald-500 text-emerald-400 shadow shadow-emerald-500/10" 
                : "bg-zinc-900 border-zinc-700 text-zinc-500"
            }`}>
              {bartender.name.split(" ").map(n => n[0]).join("")}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-2">
                {bartender.name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${isClockedIn ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"}`}></span>
                <span className={`text-[10px] uppercase font-bold tracking-wider ${isClockedIn ? "text-emerald-400" : "text-zinc-500"}`}>
                  {isClockedIn ? "Aktivně na směně (Clocked In)" : "Mimo směnu (Clocked Out)"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleToggleShift}
              className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                isClockedIn
                  ? "bg-rose-950/20 border-rose-500/40 text-rose-400 hover:bg-rose-950/40"
                  : "bg-emerald-950/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/40"
              }`}
            >
              {isClockedIn ? "Ukončit Směnu" : "Zahájit Směnu"}
            </button>

            <button
              onClick={onLogout}
              className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 rounded-xl text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-all cursor-pointer"
            >
              Odhlásit se
            </button>
          </div>
        </div>

        {/* Dynamic Warning if clocked out */}
        {!isClockedIn && (
          <div className="bg-rose-950/15 border border-rose-500/20 p-4 rounded-xl text-rose-300 text-xs leading-relaxed space-y-1">
            <p className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-rose-400">
              <LucideIcon name="AlertTriangle" className="w-4 h-4 shrink-0" />
              Směna není aktivní
            </p>
            <p className="text-zinc-400">
              Chcete-li prodávat drinky v Pokladně POS pod svým jménem a připisovat si provize, klikněte na tlačítko <strong>Zahájit Směnu</strong>.
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-950/60 border border-tequila-border/30 p-4 rounded-xl space-y-1">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Sazba Provize</span>
            <span className="text-xl font-bold text-tequila-yellow">{bartender.commissionRate}%</span>
            <p className="text-[9px] text-zinc-600">Podíl z tvých vlastních tržeb.</p>
          </div>

          <div className="bg-zinc-950/60 border border-tequila-border/30 p-4 rounded-xl space-y-1">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Moje Dnešní Tržba</span>
            <span className="text-xl font-bold text-white">${mySalesTotal.toFixed(2)}</span>
            <p className="text-[9px] text-zinc-600">
              Hotově: <span className="text-tequila-yellow">${myCashSalesTotal.toFixed(2)}</span> | Kartou: <span className="text-emerald-400">${myCardSalesTotal.toFixed(2)}</span>
            </p>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-xl space-y-1 relative">
            <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider block flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Hotovost k odevzdání
            </span>
            <span className="text-xl font-bold text-emerald-300">${myCashSalesTotal.toFixed(2)}</span>
            <p className="text-[9px] text-emerald-500/80">Fyzické peníze z tržeb pro nadřízeného.</p>
          </div>

          <div className="bg-zinc-950/60 border border-tequila-border/30 p-4 rounded-xl space-y-1">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Nasbíraná Provize</span>
            <span className="text-xl font-bold text-emerald-400">${bartender.totalCommissionEarned.toFixed(2)}</span>
            <p className="text-[9px] text-zinc-600">Celková nevyplacená provize v kase.</p>
          </div>
        </div>
      </div>

      {/* History of sales for this bartender */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <LucideIcon name="History" className="w-4 h-4" />
          Moje dnešní prodeje ({mySales.length})
        </h3>

        {mySales.length === 0 ? (
          <div className="bg-tequila-card/40 border border-tequila-border/20 p-8 rounded-xl text-center">
            <p className="text-xs text-zinc-500 italic">Dnes jsi zatím neprovedl žádný prodej.</p>
          </div>
        ) : (
          <div className="bg-tequila-card border border-tequila-border rounded-xl overflow-hidden divide-y divide-tequila-border/30">
            {mySales.map((sale) => (
              <div key={sale.id} className="p-4 hover:bg-zinc-950/30 transition-colors space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-zinc-300">
                      Účtenka #{sale.id.slice(-6).toUpperCase()}
                    </span>
                    {(!sale.paymentMethod || sale.paymentMethod === "cash") ? (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-tequila-yellow/10 text-tequila-yellow border border-tequila-yellow/20">
                        Hotově
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-emerald-950/40 text-emerald-400 border border-emerald-500/20">
                        Kartou
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {new Date(sale.timestamp).toLocaleTimeString("cs-CZ")}
                  </span>
                </div>
                
                {/* Sale items list */}
                <div className="text-[11px] text-zinc-400 space-y-1">
                  {sale.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{item.quantity}x {item.name}</span>
                      <span className="font-mono text-zinc-500">${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-zinc-900 flex justify-between items-center text-xs">
                  <div>
                    {sale.isEmployeeDiscount ? (
                      <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider mr-2 bg-purple-950/60 border border-purple-500/30 px-1.5 py-0.5 rounded">
                        👤 Zaměstnanecká sleva {sale.discountPercentage}%
                      </span>
                    ) : sale.discountPercentage ? (
                      <span className="text-[9px] text-rose-450 font-bold uppercase tracking-wider mr-2">
                        Sleva {sale.discountPercentage}% (-${sale.discountAmount?.toFixed(2)})
                      </span>
                    ) : null}
                  </div>
                  <div className="flex gap-4">
                    <div className="text-right">
                      <span className="text-[8px] text-zinc-500 uppercase block font-bold">Celkem</span>
                      <span className="font-bold text-tequila-orange">${sale.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] text-zinc-500 uppercase block font-bold">Moje Provize</span>
                      <span className={`font-bold ${sale.isEmployeeDiscount ? "text-rose-400 line-through opacity-70" : "text-emerald-400"}`}>
                        +${sale.commissionPaid.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
