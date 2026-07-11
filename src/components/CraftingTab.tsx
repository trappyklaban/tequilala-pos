import React, { useState } from "react";
import { InventoryItem, Recipe } from "../types";
import { LucideIcon } from "./LucideIcon";

interface CraftingTabProps {
  items: InventoryItem[];
  recipes: Recipe[];
  onCraftSuccess: (recipeId: string, quantity: number) => void;
}

export const CraftingTab: React.FC<CraftingTabProps> = ({ items, recipes, onCraftSuccess }) => {
  const [craftQuantity, setCraftQuantity] = useState<number>(1);

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
      alert(
        `Chybí ingredience pro namíchání ${craftQuantity}x ${resultItem.name}!\n` +
        missing.map((m) => `- ${m.item.name}: chybí ${Number((m.required - m.available).toFixed(2))} (Skladem: ${Number(m.available.toFixed(2))})`).join("\n")
      );
      return;
    }

    // Finalize craft in parent state instantly
    onCraftSuccess(recipe.id, craftQuantity);
    setCraftQuantity(1); // Reset qty
  };

  return (
    <div className="space-y-6">
      {/* Intro and controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-tequila-card border border-tequila-border p-5 rounded-lg">
        <div>
          <h2 className="text-sm font-mono font-bold text-tequila-yellow uppercase tracking-wider flex items-center gap-2">
            <LucideIcon name="ChefHat" className="w-4 h-4 text-tequila-yellow" />
            Výrobní barový systém (Míchání)
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Z receptury se vyrobí specifikovaný počet kusů nápoje na jednu várku. Spotřebujte naskladněné suroviny k výrobě.
          </p>
        </div>

        {/* Quantity selector for upcoming craft */}
        <div className="flex items-center gap-3 bg-zinc-950 border border-tequila-border p-2 rounded-md self-start md:self-auto font-mono text-xs">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider pl-1">
            Počet várek k míchání:
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCraftQuantity(Math.max(1, craftQuantity - 1))}
              className="w-7 h-7 bg-zinc-900 hover:bg-zinc-850 text-gray-300 rounded flex items-center justify-center font-bold active:scale-95 disabled:opacity-40 cursor-pointer"
            >
              -
            </button>
            <span className="font-bold text-white w-6 text-center">
              {craftQuantity}
            </span>
            <button
              onClick={() => setCraftQuantity(craftQuantity + 1)}
              className="w-7 h-7 bg-zinc-900 hover:bg-zinc-850 text-gray-300 rounded flex items-center justify-center font-bold active:scale-95 disabled:opacity-40 cursor-pointer"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Recipes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recipes.map((recipe) => {
          const resultItem = getItem(recipe.resultItemId);
          if (!resultItem) return null;

          const { hasEnough } = checkIngredientsStock(recipe, craftQuantity);

          return (
            <div
              key={recipe.id}
              className={`bg-tequila-card border rounded-lg p-5 flex flex-col justify-between transition-all duration-300 ${
                !hasEnough
                  ? "border-tequila-border/60"
                  : "border-tequila-border hover:border-tequila-yellow hover:bg-zinc-950/40"
              }`}
            >
              <div>
                {/* Recipe Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded bg-zinc-950 text-tequila-yellow border border-tequila-border">
                      <LucideIcon name={resultItem.iconName} className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-mono font-bold text-gray-100 text-sm uppercase">
                        {resultItem.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[9px] font-mono bg-zinc-950 px-2 py-0.5 text-zinc-500 rounded border border-zinc-800">
                          Cena: ${resultItem.sellPrice}
                        </span>
                        <span className="text-[9px] font-mono bg-tequila-orange/10 px-2 py-0.5 text-tequila-orange rounded font-bold border border-tequila-orange/15">
                          Skladem: {Math.floor(resultItem.stock)} ks
                        </span>
                        <span className="text-[9px] font-mono bg-emerald-950/20 px-2 py-0.5 text-emerald-400 rounded font-bold border border-emerald-500/10" title={`Cena za ingredience na 1 várku (${recipe.yieldAmount ?? 20} ks)`}>
                          Výroba várky ({recipe.yieldAmount ?? 20} ks): ${(recipe.ingredients.reduce((sum, ing) => {
                            const ingItem = getItem(ing.itemId);
                            return sum + (ingItem ? ingItem.purchasePrice * ing.quantity : 0);
                          }, 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recipe Ingredients List */}
                <div className="space-y-2 bg-zinc-950 border border-tequila-border/50 rounded p-3 mb-4 font-mono">
                  <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Receptura a ingredience:
                  </span>
                  <div className="divide-y divide-tequila-border/30">
                    {recipe.ingredients.map((ing) => {
                      const ingItem = getItem(ing.itemId);
                      if (!ingItem) return null;

                      const requiredQty = ing.quantity * craftQuantity;
                      const hasSufficient = ingItem.stock >= requiredQty;

                      // Display logic: format quantities cleanly
                      const displayQty = requiredQty % 1 === 0 ? `${requiredQty} ks` : `${requiredQty.toFixed(1)} ks`;

                      const availableDisplay = ingItem.stock % 1 === 0 ? `${ingItem.stock} ks` : `${ingItem.stock.toFixed(1)} ks`;

                      return (
                        <div
                          key={ing.itemId}
                          className="py-1 flex justify-between items-center text-[11px]"
                        >
                          <span className="text-zinc-400 flex items-center gap-1.5">
                            <LucideIcon name={ingItem.iconName} className="w-3 h-3 text-zinc-600" />
                            {ingItem.name}
                          </span>
                          <div className="text-right flex items-center gap-3">
                            <span className="font-bold text-gray-200">
                              {displayQty}
                            </span>
                            <span className="text-[9px] text-zinc-500">
                              Skladem:{" "}
                              <span
                                className={`font-bold ${
                                  hasSufficient ? "text-emerald-500" : "text-rose-500"
                                }`}
                              >
                                {availableDisplay}
                              </span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action mix button */}
              <button
                onClick={() => handleStartCraft(recipe)}
                className={`w-full py-2.5 rounded font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  !hasEnough
                    ? "bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed"
                    : "bg-tequila-yellow text-black hover:bg-tequila-orange"
                }`}
              >
                <LucideIcon name="Hammer" className="w-4 h-4" />
                Vyrobit {craftQuantity}x várku ({craftQuantity * (recipe.yieldAmount ?? 20)} ks)
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
