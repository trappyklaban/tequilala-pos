import React, { useState, useEffect } from "react";
import { InventoryItem, ItemCategory } from "../types";
import { LucideIcon } from "./LucideIcon";

interface InventoryAiScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingItems: InventoryItem[];
  onApplyStockUpdates: (
    updates: { itemId: string; newStock: number }[],
    newItemsToCreate?: Omit<InventoryItem, "id">[]
  ) => void;
}

interface DetectedStockItem {
  name: string;
  quantity: number;
  unit: string;
  category: ItemCategory;
  estimatedPrice?: number;
  confidence: "high" | "medium" | "low";
  matchedItemId?: string; // ID of matching item in existingItems
  selected: boolean;
  isNew: boolean;
}

export const InventoryAiScannerModal: React.FC<InventoryAiScannerModalProps> = ({
  isOpen,
  onClose,
  existingItems,
  onApplyStockUpdates,
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>("image/png");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [detectedItems, setDetectedItems] = useState<DetectedStockItem[]>([]);
  const [applyMode, setApplyMode] = useState<"set_exact" | "add_to_stock">("set_exact");

  // Handle clipboard paste
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            readImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen]);

  if (!isOpen) return null;

  const readImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Vyberte platný obrázek (PNG, JPG, WebP).");
      return;
    }
    setError(null);
    setImageMime(file.type);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImagePreview(result);
      setDetectedItems([]);
      setSummary("");
    };
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readImageFile(file);
    }
  };

  const matchItemToExisting = (name: string): string | undefined => {
    const clean = name.toLowerCase().trim();
    // 1. Direct or partial match
    const found = existingItems.find(
      (it) => it.name.toLowerCase().includes(clean) || clean.includes(it.name.toLowerCase())
    );
    if (found) return found.id;

    // 2. Token match
    const words = clean.split(/\s+/).filter((w) => w.length > 2);
    for (const w of words) {
      const tokenMatch = existingItems.find((it) => it.name.toLowerCase().includes(w));
      if (tokenMatch) return tokenMatch.id;
    }
    return undefined;
  };

  const handleAnalyze = async () => {
    if (!imagePreview) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      const existingItemNames = existingItems.map((i) => i.name);
      const res = await fetch("/api/ai/inventory-from-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: imagePreview,
          mimeType: imageMime,
          existingItemNames,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Chyba serveru (${res.status})`);
      }

      const data = await res.json();
      setSummary(data.summary || "Analýza dokončena.");

      const processed: DetectedStockItem[] = (data.items || []).map((raw: any) => {
        const matchedId = matchItemToExisting(raw.name || "");
        let category: ItemCategory = "alcohol";
        if (raw.category === "soft") category = "soft";
        else if (raw.category === "garnish") category = "garnish";
        else if (raw.category === "food") category = "food";

        return {
          name: raw.name || "Neznámá položka",
          quantity: typeof raw.quantity === "number" ? Math.max(0, raw.quantity) : 0,
          unit: raw.unit || "ks",
          category,
          estimatedPrice: raw.estimatedPrice || 0,
          confidence: raw.confidence || "high",
          matchedItemId: matchedId,
          selected: true,
          isNew: !matchedId,
        };
      });

      setDetectedItems(processed);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Chyba při rozpoznávání stavu skladu.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = () => {
    const selectedRows = detectedItems.filter((i) => i.selected);
    if (selectedRows.length === 0) {
      setError("Vyberte alespoň jednu položku k aktualizaci.");
      return;
    }

    const updates: { itemId: string; newStock: number }[] = [];
    const newItemsToCreate: Omit<InventoryItem, "id">[] = [];

    for (const row of selectedRows) {
      if (row.matchedItemId) {
        const existing = existingItems.find((e) => e.id === row.matchedItemId);
        if (existing) {
          const finalStock =
            applyMode === "set_exact"
              ? row.quantity
              : existing.stock + row.quantity;
          updates.push({
            itemId: existing.id,
            newStock: Math.max(0, finalStock),
          });
        }
      } else {
        // Create new item in inventory
        newItemsToCreate.push({
          name: row.name,
          type: "raw",
          stock: row.quantity,
          minStock: 5,
          purchasePrice: row.estimatedPrice || 50,
          sellPrice: 0,
          iconName: "GlassWater",
          category: row.category,
        });
      }
    }

    onApplyStockUpdates(updates, newItemsToCreate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#18050c] border border-rose-950/80 rounded-2xl w-full max-w-4xl shadow-2xl relative my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-rose-950/60 bg-[#22040c] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-900/50 text-rose-300">
              <LucideIcon name="Scan" className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#f4e7dc] uppercase tracking-wider flex items-center gap-1.5 font-mono">
                AI Skenování Skladu ze Screenshotu
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-900/40 font-mono font-normal">
                  Gemini 3.8 Flash
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                Automatická inventura a naskladnění ze screenshotu FiveM inventáře, trezoru, skladu či faktury
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-rose-950/60 transition-colors cursor-pointer"
          >
            <LucideIcon name="X" className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-zinc-300">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 flex items-center gap-2">
              <LucideIcon name="AlertTriangle" className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {!imagePreview ? (
            <div
              className="border-2 border-dashed border-rose-950/80 hover:border-rose-800/80 rounded-2xl p-10 text-center bg-zinc-950/50 hover:bg-zinc-950/80 transition-all flex flex-col items-center justify-center space-y-3 cursor-pointer group"
              onClick={() => document.getElementById("inventory-ai-file-input")?.click()}
            >
              <input
                id="inventory-ai-file-input"
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-2xl bg-rose-950/40 border border-rose-900/40 flex items-center justify-center text-rose-300 group-hover:scale-105 transition-transform shadow-lg shadow-rose-950/20">
                <LucideIcon name="ScanLine" className="w-7 h-7 text-rose-400" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-sm text-[#f4e7dc]">
                  Nahrajte screenshot skladu nebo stiskněte <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[10px] text-zinc-200">Ctrl + V</kbd>
                </p>
                <p className="text-[11px] text-zinc-400 max-w-md mx-auto">
                  AI přečte názvy položek a čísla u ikon (např. 25x láhev rumu, 40x cola) a spáruje je se skladem baru nox.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image Preview & Action Controls Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-950/70 p-3 rounded-xl border border-rose-950/60">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg overflow-hidden border border-rose-900/40 shrink-0 bg-black flex items-center justify-center">
                    <img src={imagePreview} alt="Screenshot" className="object-cover w-full h-full" />
                  </div>
                  <div>
                    <span className="font-bold text-zinc-200 block text-xs">Vložený screenshot skladu</span>
                    <button
                      onClick={() => {
                        setImagePreview(null);
                        setDetectedItems([]);
                      }}
                      className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                    >
                      Změnit / nahrát jiný obrázek
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="py-2.5 px-4 rounded-xl font-bold uppercase tracking-wider text-xs bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white transition-all shadow-md shadow-rose-950/40 flex items-center gap-2 cursor-pointer"
                  >
                    {isAnalyzing ? (
                      <>
                        <LucideIcon name="Loader" className="w-4 h-4 animate-spin" />
                        AI provádí inventuru...
                      </>
                    ) : (
                      <>
                        <LucideIcon name="Sparkles" className="w-4 h-4" />
                        {detectedItems.length > 0 ? "Spustit analýzu znovu" : "Analyzovat stav skladu pomocí AI"}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Mode Toggle & Summary */}
              {detectedItems.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#22040c]/80 p-3.5 rounded-xl border border-rose-950/80">
                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase font-mono block">Režim zápisu do skladu:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setApplyMode("set_exact")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          applyMode === "set_exact"
                            ? "bg-rose-600 text-white shadow-sm"
                            : "bg-zinc-900 text-zinc-400 hover:text-white"
                        }`}
                      >
                        📋 Fyzická Inventura (Nastavit přesný stav)
                      </button>
                      <button
                        type="button"
                        onClick={() => setApplyMode("add_to_stock")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          applyMode === "add_to_stock"
                            ? "bg-rose-600 text-white shadow-sm"
                            : "bg-zinc-900 text-zinc-400 hover:text-white"
                        }`}
                      >
                        ➕ Naskladnění (Přičíst ke stávajícímu stavu)
                      </button>
                    </div>
                  </div>

                  {summary && (
                    <div className="text-[11px] text-rose-300 font-mono bg-zinc-950/60 p-2 rounded-lg border border-rose-950/60 max-w-sm">
                      {summary}
                    </div>
                  )}
                </div>
              )}

              {/* Detected Items Table */}
              {isAnalyzing ? (
                <div className="h-48 flex flex-col items-center justify-center space-y-3 text-center border border-rose-950/40 rounded-xl bg-zinc-950/40 p-6">
                  <div className="w-9 h-9 rounded-full border-2 border-rose-500 border-t-transparent animate-spin"></div>
                  <p className="font-bold text-sm text-[#f4e7dc]">Čtení skladových zásob ze screenshotu...</p>
                  <p className="text-[11px] text-zinc-500 max-w-xs">
                    Rozpoznávám láhve, balení, přepravky a jejich číselné hodnoty.
                  </p>
                </div>
              ) : detectedItems.length > 0 ? (
                <div className="border border-rose-950/70 rounded-xl overflow-hidden bg-zinc-950/90">
                  <div className="p-3 bg-[#22040c] border-b border-rose-950/60 flex items-center justify-between font-mono text-[10px] uppercase font-bold text-zinc-400">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={detectedItems.every((i) => i.selected)}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setDetectedItems(detectedItems.map((i) => ({ ...i, selected: val })));
                        }}
                        className="rounded accent-rose-500 cursor-pointer"
                      />
                      <span>Nalezené položky ({detectedItems.length})</span>
                    </div>
                    <span>Spárování se skladem nox.</span>
                  </div>

                  <div className="divide-y divide-rose-950/40 max-h-72 overflow-y-auto">
                    {detectedItems.map((row, idx) => {
                      const matchedItem = existingItems.find((e) => e.id === row.matchedItemId);

                      return (
                        <div
                          key={idx}
                          className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                            row.selected ? "bg-zinc-950 hover:bg-rose-950/15" : "opacity-50 bg-zinc-950/40"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={(e) => {
                                const next = [...detectedItems];
                                next[idx].selected = e.target.checked;
                                setDetectedItems(next);
                              }}
                              className="rounded accent-rose-500 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-zinc-100 text-xs block truncate">
                                {row.name}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                                <span className="text-zinc-500">
                                  Detekováno: <strong className="text-rose-300 font-mono">{row.quantity} {row.unit}</strong>
                                </span>
                                {matchedItem && (
                                  <span className="text-zinc-500">
                                    • Aktuálně v nox: <strong className="text-zinc-300 font-mono">{matchedItem.stock} ks</strong>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {/* Quantity Editor */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-zinc-500 uppercase font-bold">Počet:</span>
                              <input
                                type="number"
                                value={row.quantity}
                                onChange={(e) => {
                                  const next = [...detectedItems];
                                  next[idx].quantity = Math.max(0, Number(e.target.value) || 0);
                                  setDetectedItems(next);
                                }}
                                className="w-16 bg-[#18050c] border border-rose-950 rounded px-2 py-1 text-center font-mono font-bold text-zinc-100 text-xs focus:border-rose-500 focus:outline-none"
                              />
                            </div>

                            {/* Item Match Dropdown */}
                            <select
                              value={row.matchedItemId || "NEW"}
                              onChange={(e) => {
                                const val = e.target.value;
                                const next = [...detectedItems];
                                if (val === "NEW") {
                                  next[idx].matchedItemId = undefined;
                                  next[idx].isNew = true;
                                } else {
                                  next[idx].matchedItemId = val;
                                  next[idx].isNew = false;
                                }
                                setDetectedItems(next);
                              }}
                              className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none max-w-[200px]"
                            >
                              <option value="NEW">➕ Vytvořit novou položku</option>
                              <optgroup label="Skladové položky nox.">
                                {existingItems.map((e) => (
                                  <option key={e.id} value={e.id}>
                                    {e.name} ({e.stock} ks)
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {detectedItems.length > 0 && (
          <div className="px-5 py-3 border-t border-rose-950/60 bg-[#22040c] flex items-center justify-between shrink-0">
            <span className="text-[11px] text-zinc-400">
              Vybráno {detectedItems.filter((i) => i.selected).length} položek k aktualizaci
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Zrušit
              </button>
              <button
                onClick={handleApply}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-all shadow-md shadow-rose-950/50 flex items-center gap-1.5 cursor-pointer"
              >
                <LucideIcon name="Check" className="w-4 h-4" />
                Zapsat do skladu nox.
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
