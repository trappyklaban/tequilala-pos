import React, { useState } from "react";
import { InventoryItem, Recipe } from "../types";
import { LucideIcon } from "./LucideIcon";
import { RecipeAiScannerModal } from "./RecipeAiScannerModal";

interface CraftingTabProps {
  items: InventoryItem[];
  recipes: Recipe[];
  onCraftSuccess: (recipeId: string, quantity: number) => void;
  onAddRecipe?: (
    recipe: Omit<Recipe, "id">,
    newItemToCreate?: Omit<InventoryItem, "id">,
    newRawItems?: Omit<InventoryItem, "id">[]
  ) => void;
}

export const CraftingTab: React.FC<CraftingTabProps> = ({
  items,
  recipes,
  onCraftSuccess,
  onAddRecipe,
}) => {
  const [craftQuantity, setCraftQuantity] = useState<number>(1);
  const [showAiModal, setShowAiModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Map item ID to actual item helper
  const getItem = (id: string): InventoryItem | undefined => {
    return items.find((item) => item.id === id);
  };

  // Check if we have enough ingredients for a recipe and a specific quantity
  const checkIngredientsStock = (recipe: Recipe, qty: number) => {
    const missing: { item: InventoryItem; required: number; available: number }[] = [];

    for (const ing of recipe.ingredients) {
      const item = getItem(ing.itemId);
      if (!item) continue;
      const totalRequired = ing.quantity * qty;
      if (item.stock < totalRequired) {
        missing.push({
          item,
          required: totalRequired,
          available: item.stock,
        });
      }
    }

    return {
      hasEnough: missing.length === 0,
      missing,
    };
  };

  const handleStartCraft = (recipe: Recipe) => {
    const resultItem = getItem(recipe.resultItemId);
    if (!resultItem) return;

    const { hasEnough, missing } = checkIngredientsStock(recipe, craftQuantity);
    if (!hasEnough) {
      showToast(
        `Chybí ingredience pro ${craftQuantity}x ${resultItem.name}! ` +
          missing.map((m) => `${m.item.name}: chybí ${Number((m.required - m.available).toFixed(1))}`).join(", "),
        "error"
      );
      return;
    }

    onCraftSuccess(recipe.id, craftQuantity);
    showToast(`Namícháno ${craftQuantity}x várka (${resultItem.name}) do zásob baru nox.!`, "success");
    setCraftQuantity(1);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-12 right-6 z-50 p-4 rounded-xl shadow-2xl border text-xs font-bold font-mono animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === "error"
              ? "bg-rose-950/95 border-rose-500/50 text-rose-200"
              : "bg-[#22040c]/95 border-emerald-500/50 text-emerald-300"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Intro and controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#18050c] border border-rose-950/70 p-5 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-mono font-bold text-[#f4e7dc] uppercase tracking-wider flex items-center gap-2">
              <LucideIcon name="ChefHat" className="w-4 h-4 text-rose-400" />
              Výrobní barový systém nox. (Míchání & Příprava)
            </h2>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-900/50 text-rose-300 font-mono">
              Fleeca Tower
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl">
            Z receptury se vyrobí specifikovaný počet porcí na várku. Spotřebujte naskladněné ingredience z baru k výrobě hotových nápojů a pokrmů.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto font-mono text-xs">
          {onAddRecipe && (
            <button
              onClick={() => setShowAiModal(true)}
              className="py-2 px-3.5 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 hover:border-rose-500 text-rose-200 font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-rose-950/30"
              title="Vložit screenshot receptury na drink a nechat AI extrahovat ingredience"
            >
              <LucideIcon name="Sparkles" className="w-3.5 h-3.5 text-rose-400" />
              AI Recept ze Screenshotu
            </button>
          )}

          {/* Quantity selector for upcoming craft */}
          <div className="flex items-center gap-2 bg-zinc-950 border border-rose-950/70 p-1.5 rounded-xl">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider pl-1.5">
              Počet várek:
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCraftQuantity(Math.max(1, craftQuantity - 1))}
                className="w-7 h-7 bg-zinc-900 hover:bg-zinc-800 text-gray-300 rounded-lg flex items-center justify-center font-bold active:scale-95 cursor-pointer"
              >
                -
              </button>
              <span className="font-bold text-[#f4e7dc] w-7 text-center font-mono">
                {craftQuantity}
              </span>
              <button
                onClick={() => setCraftQuantity(craftQuantity + 1)}
                className="w-7 h-7 bg-zinc-900 hover:bg-zinc-800 text-gray-300 rounded-lg flex items-center justify-center font-bold active:scale-95 cursor-pointer"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recipes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recipes.map((recipe) => {
          const resultItem = getItem(recipe.resultItemId);
          if (!resultItem) return null;

          const { hasEnough, missing } = checkIngredientsStock(recipe, craftQuantity);

          return (
            <div
              key={recipe.id}
              className={`bg-[#18050c] border rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-md ${
                !hasEnough
                  ? "border-rose-950/50 bg-[#140409]"
                  : "border-rose-950/80 hover:border-rose-800/80 hover:bg-[#1f050f]"
              }`}
            >
              <div>
                {/* Recipe Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-zinc-950 text-rose-300 border border-rose-950 shadow-inner">
                      <LucideIcon name={resultItem.iconName} className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                      <h3 className="font-mono font-bold text-gray-100 text-sm uppercase">
                        {resultItem.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[9px] font-mono bg-zinc-950 px-2 py-0.5 text-zinc-400 rounded-md border border-zinc-800">
                          Prodej: ${resultItem.sellPrice}
                        </span>
                        <span className="text-[9px] font-mono bg-rose-950/50 px-2 py-0.5 text-rose-300 rounded-md font-bold border border-rose-900/40">
                          Skladem: {Math.floor(resultItem.stock)} ks
                        </span>
                        <span
                          className="text-[9px] font-mono bg-emerald-950/30 px-2 py-0.5 text-emerald-400 rounded-md font-bold border border-emerald-500/20"
                          title={`Náklady na ingredience pro 1 várku (${recipe.yieldAmount ?? 20} ks)`}
                        >
                          Náklad várky ({recipe.yieldAmount ?? 20} ks): $
                          {recipe.ingredients
                            .reduce((sum, ing) => {
                              const ingItem = getItem(ing.itemId);
                              return sum + (ingItem ? ingItem.purchasePrice * ing.quantity : 0);
                            }, 0)
                            .toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recipe Ingredients List */}
                <div className="space-y-2 bg-zinc-950/80 border border-rose-950/60 rounded-xl p-3 mb-4 font-mono">
                  <span className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                    Receptura a potřebné suroviny:
                  </span>
                  <div className="divide-y divide-rose-950/40">
                    {recipe.ingredients.map((ing) => {
                      const ingItem = getItem(ing.itemId);
                      if (!ingItem) return null;

                      const requiredQty = ing.quantity * craftQuantity;
                      const hasSufficient = ingItem.stock >= requiredQty;
                      const displayQty =
                        requiredQty % 1 === 0 ? `${requiredQty} ks` : `${requiredQty.toFixed(1)} ks`;

                      return (
                        <div
                          key={ing.itemId}
                          className="py-1.5 flex justify-between items-center text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                hasSufficient ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            ></span>
                            <span className="text-gray-300 truncate">{ingItem.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] shrink-0 font-mono">
                            <span className="text-zinc-500">
                              potřeba: <strong className="text-zinc-300">{displayQty}</strong>
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold ${
                                hasSufficient
                                  ? "bg-zinc-900 text-zinc-400"
                                  : "bg-rose-950 text-rose-400 border border-rose-900/40"
                              }`}
                            >
                              skladem: {Math.floor(ingItem.stock)} ks
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Craft Action Button */}
              <div>
                {!hasEnough && missing.length > 0 && (
                  <p className="text-[10px] text-rose-400 font-mono mb-2 truncate">
                    ⚠️ Chybí suroviny: {missing.map((m) => m.item.name).join(", ")}
                  </p>
                )}

                <button
                  onClick={() => handleStartCraft(recipe)}
                  disabled={!hasEnough}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    hasEnough
                      ? "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/40 active:scale-[0.99]"
                      : "bg-zinc-900/80 text-zinc-600 border border-zinc-800/80 cursor-not-allowed"
                  }`}
                >
                  <LucideIcon name="Flame" className="w-4 h-4" />
                  Namíchat várku ({craftQuantity}x = {craftQuantity * (recipe.yieldAmount ?? 20)} ks)
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Recipe Scanner Modal */}
      {showAiModal && onAddRecipe && (
        <RecipeAiScannerModal
          isOpen={showAiModal}
          onClose={() => setShowAiModal(false)}
          existingItems={items}
          onRecipeDetectedAndApproved={(rec, crafted, newRaws) => {
            onAddRecipe(rec, crafted, newRaws);
            showToast(`Recept "${crafted.name}" byl úspěšně vytvořen pomocí AI!`, "success");
          }}
        />
      )}
    </div>
  );
};
