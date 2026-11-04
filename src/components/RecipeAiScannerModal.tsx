import React, { useState, useEffect } from "react";
import { InventoryItem, Recipe, ItemCategory } from "../types";
import { LucideIcon } from "./LucideIcon";

interface RecipeAiScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingItems: InventoryItem[];
  onRecipeDetectedAndApproved: (
    recipe: Omit<Recipe, "id">,
    newCraftedItem: Omit<InventoryItem, "id">,
    newRawItemsToCreate?: Omit<InventoryItem, "id">[]
  ) => void;
}

interface DetectedIngredient {
  rawName: string;
  amountStr: string;
  quantity: number;
  unit: string;
  matchedItemId?: string;
  createNew?: boolean;
  newPurchasePrice?: number;
}

interface DetectedRecipeData {
  name: string;
  category: ItemCategory;
  sellPrice: number;
  description: string;
  preparationNotes: string;
  yieldAmount: number;
  ingredients: DetectedIngredient[];
}

export const RecipeAiScannerModal: React.FC<RecipeAiScannerModalProps> = ({
  isOpen,
  onClose,
  existingItems,
  onRecipeDetectedAndApproved,
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>("image/png");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedData, setDetectedData] = useState<DetectedRecipeData | null>(null);

  // Paste support from clipboard
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
      setDetectedData(null);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readImageFile(file);
    }
  };

  const rawItems = existingItems.filter((i) => i.type === "raw");

  const matchIngredientToExisting = (rawName: string): string | undefined => {
    const clean = rawName.toLowerCase().trim();
    const exact = rawItems.find((i) => i.name.toLowerCase().includes(clean) || clean.includes(i.name.toLowerCase()));
    if (exact) return exact.id;

    // Word tokens matching
    const tokens = clean.split(/\s+/).filter((t) => t.length > 2);
    for (const t of tokens) {
      const found = rawItems.find((i) => i.name.toLowerCase().includes(t));
      if (found) return found.id;
    }
    return undefined;
  };

  const handleAnalyze = async () => {
    if (!imagePreview) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/recipe-from-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: imagePreview,
          mimeType: imageMime,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Chyba serveru (${res.status})`);
      }

      const data = await res.json();

      // Process ingredients and match with existing raw supplies
      const processedIngredients: DetectedIngredient[] = (data.ingredients || []).map((ing: any) => {
        const matchedId = matchIngredientToExisting(ing.rawName || "");
        return {
          rawName: ing.rawName || "Surovina",
          amountStr: ing.amountStr || "1 dávka",
          quantity: typeof ing.quantity === "number" && ing.quantity > 0 ? ing.quantity : 1.0,
          unit: ing.unit || "dávka",
          matchedItemId: matchedId,
          createNew: !matchedId,
          newPurchasePrice: 50,
        };
      });

      let category: ItemCategory = "drink";
      if (data.category === "food") category = "food";
      else if (data.category === "shot") category = "drink";
      else if (data.category === "soft") category = "soft";

      setDetectedData({
        name: data.name || "Nový Recept nox.",
        category,
        sellPrice: typeof data.sellPrice === "number" ? data.sellPrice : 300,
        description: data.description || "",
        preparationNotes: data.preparationNotes || "",
        yieldAmount: typeof data.yieldAmount === "number" && data.yieldAmount > 0 ? data.yieldAmount : 20,
        ingredients: processedIngredients,
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Nepodařilo se rozpoznat recept z obrázku. Zkontrolujte formát.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = () => {
    if (!detectedData) return;
    if (!detectedData.name.trim()) {
      setError("Název receptu nemůže být prázdný.");
      return;
    }

    const newRawItemsToCreate: Omit<InventoryItem, "id">[] = [];
    const finalIngredients: { itemId: string; quantity: number }[] = [];

    // Map ingredients
    for (const ing of detectedData.ingredients) {
      if (ing.matchedItemId) {
        finalIngredients.push({
          itemId: ing.matchedItemId,
          quantity: ing.quantity || 1.0,
        });
      } else {
        // Will create new raw item
        const tempId = `raw_custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        newRawItemsToCreate.push({
          name: ing.rawName,
          type: "raw",
          stock: 15,
          minStock: 4,
          purchasePrice: ing.newPurchasePrice || 50,
          sellPrice: 0,
          iconName: "GlassWater",
          category: "alcohol",
        });
        finalIngredients.push({
          itemId: tempId,
          quantity: ing.quantity || 1.0,
        });
      }
    }

    const craftedItem: Omit<InventoryItem, "id"> = {
      name: detectedData.name,
      type: "crafted",
      stock: 0,
      minStock: 4,
      purchasePrice: 0,
      sellPrice: detectedData.sellPrice,
      iconName: detectedData.category === "food" ? "ChefHat" : "Wine",
      category: detectedData.category,
    };

    const recipe: Omit<Recipe, "id"> = {
      resultItemId: "", // Will be assigned by parent
      yieldAmount: detectedData.yieldAmount,
      ingredients: finalIngredients,
      craftTimeSeconds: 6,
    };

    onRecipeDetectedAndApproved(recipe, craftedItem, newRawItemsToCreate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#18050c] border border-rose-950/80 rounded-2xl w-full max-w-3xl shadow-2xl relative my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-rose-950/60 bg-[#22040c] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-900/50 text-rose-300">
              <LucideIcon name="Sparkles" className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#f4e7dc] uppercase tracking-wider flex items-center gap-1.5 font-mono">
                AI Detekce Receptury ze Screenshotu
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-900/40 font-mono font-normal">
                  Gemini 3.8 Flash
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                Vložte screenshot receptu, barmanské karty nebo menu (Ctrl+V nebo nahráním)
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
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-zinc-300">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 flex items-center gap-2">
              <LucideIcon name="AlertTriangle" className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload Area / Dropzone */}
          {!imagePreview ? (
            <div
              className="border-2 border-dashed border-rose-950/80 hover:border-rose-800/80 rounded-2xl p-8 text-center bg-zinc-950/50 hover:bg-zinc-950/80 transition-all flex flex-col items-center justify-center space-y-3 cursor-pointer group"
              onClick={() => document.getElementById("recipe-ai-file-input")?.click()}
            >
              <input
                id="recipe-ai-file-input"
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-2xl bg-rose-950/40 border border-rose-900/40 flex items-center justify-center text-rose-300 group-hover:scale-105 transition-transform shadow-lg shadow-rose-950/20">
                <LucideIcon name="Camera" className="w-7 h-7 text-rose-400" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-sm text-[#f4e7dc]">
                  Klikněte pro nahrání screenshotu nebo stiskněte <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[10px] text-zinc-200">Ctrl + V</kbd>
                </p>
                <p className="text-[11px] text-zinc-400 max-w-md mx-auto">
                  Podporuje screenshoty z FiveM / GTA baru, receptury koktejlů, fotky papírových barmanských karet nebo nápojových lístků.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Image Preview Side */}
              <div className="md:col-span-5 space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-rose-950/70 bg-zinc-950 shadow-md max-h-72 flex items-center justify-center">
                  <img
                    src={imagePreview}
                    alt="Screenshot receptu"
                    className="object-contain max-h-72 w-full"
                  />
                  <button
                    onClick={() => {
                      setImagePreview(null);
                      setDetectedData(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black rounded-lg text-zinc-300 hover:text-white border border-white/10"
                    title="Změnit obrázek"
                  >
                    <LucideIcon name="X" className="w-4 h-4" />
                  </button>
                </div>

                {!detectedData && (
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="w-full py-3 px-4 rounded-xl font-bold uppercase tracking-wider text-xs bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white transition-all shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isAnalyzing ? (
                      <>
                        <LucideIcon name="Loader" className="w-4 h-4 animate-spin" />
                        AI analyzuje screenshot...
                      </>
                    ) : (
                      <>
                        <LucideIcon name="Sparkles" className="w-4 h-4" />
                        Rozpoznat recept pomocí AI
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Detected Results Form Side */}
              <div className="md:col-span-7">
                {isAnalyzing ? (
                  <div className="h-64 flex flex-col items-center justify-center space-y-3 text-center border border-rose-950/40 rounded-xl bg-zinc-950/40 p-6">
                    <div className="w-10 h-10 rounded-full border-2 border-rose-500 border-t-transparent animate-spin"></div>
                    <p className="font-bold text-sm text-[#f4e7dc]">Gemini čte ingredience a postup z obrázku...</p>
                    <p className="text-[11px] text-zinc-500 max-w-xs">
                      Detekuji název drinku, cenové relace a jednotlivé dávky surovin.
                    </p>
                  </div>
                ) : detectedData ? (
                  <div className="space-y-3.5 bg-zinc-950/80 border border-rose-950/60 p-4 rounded-xl">
                    <div className="flex items-center justify-between pb-2 border-b border-rose-950/60">
                      <span className="font-bold uppercase tracking-wider text-rose-300 text-[11px] flex items-center gap-1.5">
                        <LucideIcon name="CheckCircle" className="w-4 h-4 text-emerald-400" />
                        Rozpoznaná data receptu
                      </span>
                      <button
                        onClick={handleAnalyze}
                        className="text-[10px] text-zinc-400 hover:text-rose-300 underline cursor-pointer"
                      >
                        Analyzovat znovu
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-[9px] uppercase font-bold text-zinc-400 mb-1">
                          Název drinku / receptury
                        </label>
                        <input
                          type="text"
                          value={detectedData.name}
                          onChange={(e) => setDetectedData({ ...detectedData, name: e.target.value })}
                          className="w-full bg-[#18050c] border border-rose-950 rounded-lg px-3 py-1.5 text-zinc-100 font-bold focus:border-rose-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] uppercase font-bold text-zinc-400 mb-1">
                          Prodejní cena ($)
                        </label>
                        <input
                          type="number"
                          value={detectedData.sellPrice}
                          onChange={(e) =>
                            setDetectedData({ ...detectedData, sellPrice: Number(e.target.value) || 0 })
                          }
                          className="w-full bg-[#18050c] border border-rose-950 rounded-lg px-3 py-1.5 text-zinc-100 font-mono font-bold focus:border-rose-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] uppercase font-bold text-zinc-400 mb-1">
                          Výroba z 1 várky (kusů)
                        </label>
                        <input
                          type="number"
                          value={detectedData.yieldAmount}
                          onChange={(e) =>
                            setDetectedData({ ...detectedData, yieldAmount: Number(e.target.value) || 1 })
                          }
                          className="w-full bg-[#18050c] border border-rose-950 rounded-lg px-3 py-1.5 text-zinc-100 font-mono font-bold focus:border-rose-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {detectedData.description && (
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-zinc-400 mb-1">
                          Popis & Profil
                        </label>
                        <p className="text-[11px] text-zinc-300 bg-[#18050c] p-2 rounded-lg border border-rose-950/50 italic">
                          {detectedData.description}
                        </p>
                      </div>
                    )}

                    {/* Ingredients table */}
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-rose-300 mb-1.5">
                        Potřebné suroviny ({detectedData.ingredients.length}):
                      </label>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {detectedData.ingredients.map((ing, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-[#18050c] border border-rose-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-zinc-200 block truncate">
                                {ing.rawName}
                              </span>
                              <span className="text-[10px] text-zinc-500">
                                Dávka: {ing.amountStr} ({ing.quantity} ks z láhve/balení na várku)
                              </span>
                            </div>

                            <div className="shrink-0 flex items-center gap-2">
                              <select
                                value={ing.matchedItemId || "NEW"}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const next = [...detectedData.ingredients];
                                  if (val === "NEW") {
                                    next[idx].matchedItemId = undefined;
                                    next[idx].createNew = true;
                                  } else {
                                    next[idx].matchedItemId = val;
                                    next[idx].createNew = false;
                                  }
                                  setDetectedData({ ...detectedData, ingredients: next });
                                }}
                                className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1 focus:outline-none"
                              >
                                <option value="NEW">➕ Vytvořit novou surovinu</option>
                                <optgroup label="Sklad baru nox.">
                                  {rawItems.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.name} (Skladem: {r.stock})
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center space-y-2 text-center border border-dashed border-rose-950/40 rounded-xl bg-zinc-950/30 p-6 text-zinc-500">
                    <LucideIcon name="Sparkles" className="w-8 h-8 text-rose-500/40" />
                    <p className="text-xs">Klikněte na tlačítko "Rozpoznat recept pomocí AI" vlevo.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {detectedData && (
          <div className="px-5 py-3 border-t border-rose-950/60 bg-[#22040c] flex items-center justify-between shrink-0">
            <span className="text-[11px] text-zinc-400">
              Připraveno k uložení do nabídky nápojů nox.
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
                Vytvořit recept v baru nox.
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
