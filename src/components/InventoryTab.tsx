import React, { useState } from "react";
import { InventoryItem, PurchaseItem, ItemCategory, Recipe } from "../types";
import { LucideIcon } from "./LucideIcon";
import { InventoryAiScannerModal } from "./InventoryAiScannerModal";

interface InventoryTabProps {
  items: InventoryItem[];
  recipes: Recipe[];
  registerBalance: number;
  onPurchaseSupplies: (
    purchaseItems: PurchaseItem[],
    payFromRegister: boolean
  ) => { success: boolean; error?: string };
  onUpdateStock: (itemId: string, newStock: number) => void;
  onBatchUpdateStock?: (updates: { itemId: string; newStock: number }[]) => void;
  onUpdateItem: (updatedItem: InventoryItem) => void;
  onAddNewItem: (item: Omit<InventoryItem, "id">) => void;
  onDeleteItem: (id: string) => void;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({
  items,
  recipes,
  registerBalance,
  onPurchaseSupplies,
  onUpdateStock,
  onBatchUpdateStock,
  onUpdateItem,
  onAddNewItem,
  onDeleteItem,
}) => {
  const [subTab, setSubTab] = useState<"stock" | "bulk" | "buy" | "add">("stock");
  const [showAiInventoryModal, setShowAiInventoryModal] = useState(false);
  
  // Stock tab search/filters
  const [searchStock, setSearchStock] = useState("");
  const [filterCategory, setFilterCategory] = useState<"all" | ItemCategory>("all");
  
  // Quick inline stock & price edit state
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Bulk Edit / Inventura State
  const [bulkDraft, setBulkDraft] = useState<{ [itemId: string]: number }>({});
  const [bulkSearch, setBulkSearch] = useState("");
  const [bulkFilterCategory, setBulkFilterCategory] = useState<"all" | ItemCategory>("all");

  // Buy tab cart state
  const [buyCart, setBuyCart] = useState<{ [itemId: string]: number }>({});
  const [payFromRegister, setPayFromRegister] = useState(true);
  const [searchBuy, setSearchBuy] = useState("");
  const [filterBuyCategory, setFilterBuyCategory] = useState<"all" | ItemCategory>("all");

  // Add Item Form State
  const [newItemName, setNewItemName] = useState("");
  const [newItemType, setNewItemType] = useState<"raw" | "crafted">("raw");
  const [newItemCategory, setNewItemCategory] = useState<ItemCategory>("alcohol");
  const [newItemStock, setNewItemStock] = useState<number>(0);
  const [newItemMinStock, setNewItemMinStock] = useState<number>(5);
  const [newItemPurchasePrice, setNewItemPurchasePrice] = useState<number>(0);
  const [newItemSellPrice, setNewItemSellPrice] = useState<number>(0);
  const [newItemIcon, setNewItemIcon] = useState("GlassWater");

  // Notification state
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const triggerAlert = (type: "success" | "error", message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  // 1. STOCK LOGIC
  const handleStartEdit = (item: InventoryItem) => {
    setEditingItem({ ...item });
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    if (!editingItem.name.trim()) {
      triggerAlert("error", "Zadejte platný název položky.");
      return;
    }
    onUpdateItem(editingItem);
    setEditingItem(null);
    triggerAlert("success", `Položka "${editingItem.name}" byla úspěšně upravena!`);
  };

  // 1B. BULK EDIT / INVENTURA LOGIC
  const initBulkDraft = () => {
    const draft: { [itemId: string]: number } = {};
    items.forEach((it) => {
      draft[it.id] = it.stock;
    });
    setBulkDraft(draft);
  };

  const getDraftStock = (itemId: string, fallbackStock: number) => {
    return bulkDraft[itemId] !== undefined ? bulkDraft[itemId] : fallbackStock;
  };

  const handleBulkChange = (itemId: string, newStock: number) => {
    setBulkDraft((prev) => ({
      ...prev,
      [itemId]: Math.max(0, newStock),
    }));
  };

  const handleBulkAdjust = (itemId: string, delta: number, currentStock: number) => {
    const curr = getDraftStock(itemId, currentStock);
    handleBulkChange(itemId, Math.max(0, curr + delta));
  };

  const handleBulkFillMin = (filteredList: InventoryItem[]) => {
    setBulkDraft((prev) => {
      const next = { ...prev };
      let filledCount = 0;
      filteredList.forEach((it) => {
        const curr = next[it.id] !== undefined ? next[it.id] : it.stock;
        if (curr < it.minStock) {
          next[it.id] = it.minStock;
          filledCount++;
        }
      });
      return next;
    });
    triggerAlert("success", "Položky pod minimálním stavem byly doplněny na minimum.");
  };

  const handleBulkAddAll = (filteredList: InventoryItem[], delta: number) => {
    setBulkDraft((prev) => {
      const next = { ...prev };
      filteredList.forEach((it) => {
        const curr = next[it.id] !== undefined ? next[it.id] : it.stock;
        next[it.id] = Math.max(0, curr + delta);
      });
      return next;
    });
    triggerAlert("success", `Upraveno o ${delta > 0 ? `+${delta}` : delta} ks u ${filteredList.length} zobrazených položek.`);
  };

  const handleBulkZeroAll = (filteredList: InventoryItem[]) => {
    setBulkDraft((prev) => {
      const next = { ...prev };
      filteredList.forEach((it) => {
        next[it.id] = 0;
      });
      return next;
    });
    triggerAlert("success", `Vynulováno ${filteredList.length} zobrazených položek.`);
  };

  const handleBulkResetToOriginal = () => {
    initBulkDraft();
    triggerAlert("success", "Hodnoty inventury byly vráceny na původní stav.");
  };

  const handleSaveBulk = () => {
    const updates: { itemId: string; newStock: number }[] = [];
    items.forEach((it) => {
      const draftVal = bulkDraft[it.id];
      if (draftVal !== undefined && draftVal !== it.stock) {
        updates.push({ itemId: it.id, newStock: Math.max(0, draftVal) });
      }
    });

    if (updates.length === 0) {
      triggerAlert("error", "Nebyly provedeny žádné změny v počtech.");
      return;
    }

    if (onBatchUpdateStock) {
      onBatchUpdateStock(updates);
    } else {
      updates.forEach((u) => onUpdateStock(u.itemId, u.newStock));
    }

    triggerAlert("success", `Hromadná inventura uložena! Úspěšně upraveno ${updates.length} položek.`);
    setSubTab("stock");
  };

  // 2. SUPPLY SHOP LOGIC
  // Raw items or items that can be purchased (purchasePrice > 0)
  const buyableItems = items.filter((item) => {
    const isBuyable = item.purchasePrice > 0;
    const matchesSearch = item.name.toLowerCase().includes(searchBuy.toLowerCase());
    const matchesCategory = filterBuyCategory === "all" || item.category === filterBuyCategory;
    return isBuyable && matchesSearch && matchesCategory;
  });

  const handleUpdateBuyQty = (itemId: string, qty: number) => {
    const newQty = Math.max(0, qty);
    if (newQty === 0) {
      const updated = { ...buyCart };
      delete updated[itemId];
      setBuyCart(updated);
    } else {
      setBuyCart({ ...buyCart, [itemId]: newQty });
    }
  };

  const getBuyCartTotal = () => {
    return Object.entries(buyCart).reduce((total, [itemId, qty]) => {
      const item = items.find((i) => i.id === itemId);
      return total + (item?.purchasePrice || 0) * (qty as number);
    }, 0);
  };

  const handleOrderSupplies = () => {
    const totalCost = getBuyCartTotal();
    if (totalCost === 0) {
      triggerAlert("error", "Košík nákupu surovin je prázdný!");
      return;
    }

    if (payFromRegister && registerBalance < totalCost) {
      triggerAlert(
        "error",
        `V pokladně není dostatek peněz! Chybí $${(totalCost - registerBalance).toFixed(2)}.`
      );
      return;
    }

    const orderItems: PurchaseItem[] = Object.entries(buyCart).map(([itemId, qty]) => {
      const item = items.find((i) => i.id === itemId)!;
      return {
        itemId,
        name: item.name,
        quantity: qty as number,
        pricePerUnit: item.purchasePrice,
      };
    });

    const result = onPurchaseSupplies(orderItems, payFromRegister);
    if (result.success) {
      triggerAlert(
        "success",
        `Suroviny byly doručeny na sklad! Uhrazeno $${totalCost.toFixed(2)} ${
          payFromRegister ? "z pokladny" : "z vlastní kapsy"
        }.`
      );
      setBuyCart({});
    } else {
      triggerAlert("error", result.error || "Při nákupu surovin došlo k chybě!");
    }
  };

  // 3. ADD ITEM LOGIC
  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) {
      triggerAlert("error", "Zadejte název položky.");
      return;
    }

    onAddNewItem({
      name: newItemName,
      type: newItemType,
      category: newItemCategory,
      stock: Number(newItemStock),
      minStock: Number(newItemMinStock),
      purchasePrice: Number(newItemPurchasePrice),
      sellPrice: Number(newItemSellPrice),
      iconName: newItemIcon,
    });

    // Reset Form
    setNewItemName("");
    setNewItemStock(0);
    setNewItemMinStock(5);
    setNewItemPurchasePrice(0);
    setNewItemSellPrice(0);
    setSubTab("stock");
    triggerAlert("success", `Položka "${newItemName}" byla úspěšně přidána!`);
  };

  return (
    <div className="space-y-6">
      {/* Tab Header Alert */}
      {alert && (
        <div
          className={`flex items-center gap-3 p-3 rounded border font-mono text-xs animate-fade-in ${
            alert.type === "success"
              ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-400"
              : "bg-rose-950/20 border-rose-500/20 text-rose-400"
          }`}
        >
          <LucideIcon
            name={alert.type === "success" ? "Check" : "AlertTriangle"}
            className="w-4 h-4 flex-shrink-0"
          />
          <span className="font-bold uppercase tracking-wider">{alert.message}</span>
        </div>
      )}

      {/* Internal Navigation & Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-tequila-card border border-tequila-border p-5 rounded-lg">
        <div className="space-y-1">
          <h2 className="text-sm font-mono font-bold text-tequila-orange uppercase tracking-wider flex items-center gap-2">
            <LucideIcon name="ShoppingBag" className="w-4 h-4 text-tequila-orange" />
            Sklad & Nákupní Centrum
          </h2>
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span className="uppercase text-zinc-500 bg-zinc-950 border border-zinc-900 px-2.5 py-1 rounded">
              Pokladna podniku: <span className="text-tequila-yellow font-bold">${registerBalance.toFixed(2)}</span>
            </span>
          </div>
        </div>

        {/* Sub Navigation */}
        <div className="flex flex-wrap bg-zinc-950 p-1 rounded border border-tequila-border self-start sm:self-auto gap-1">
          <button
            onClick={() => setSubTab("stock")}
            className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === "stock"
                ? "bg-tequila-orange text-black font-black"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            <LucideIcon name="BarChart3" className="w-3.5 h-3.5" />
            Zásoby
          </button>
          <button
            onClick={() => {
              initBulkDraft();
              setSubTab("bulk");
            }}
            className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === "bulk"
                ? "bg-tequila-orange text-black font-black"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            <LucideIcon name="SlidersHorizontal" className="w-3.5 h-3.5" />
            Hromadná úprava
          </button>
          <button
            onClick={() => setSubTab("buy")}
            className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === "buy"
                ? "bg-tequila-orange text-black font-black"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            <LucideIcon name="Coins" className="w-3.5 h-3.5" />
            Nákup
          </button>
          <button
            onClick={() => setSubTab("add")}
            className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === "add"
                ? "bg-tequila-orange text-black font-black"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            <LucideIcon name="Plus" className="w-3.5 h-3.5" />
            Nová Položka
          </button>

          <button
            onClick={() => setShowAiInventoryModal(true)}
            className="px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 transition-all shadow-md shadow-rose-950/40 cursor-pointer ml-1"
            title="Detekovat stav zásob a sklad ze screenshotu pomocí Gemini AI"
          >
            <LucideIcon name="Sparkles" className="w-3.5 h-3.5 text-rose-200" />
            AI Skenovat Sklad
          </button>
        </div>
      </div>

      {/* SUB TAB 1: CURRENT STOCK LEVELS */}
      {subTab === "stock" && (
        <div className="space-y-4">
          {/* Stock Search and Quick Categorization */}
          <div className="bg-tequila-card/85 border border-tequila-border p-4 rounded-lg flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <input
              type="text"
              placeholder="Vyhledat ve skladě..."
              value={searchStock}
              onChange={(e) => setSearchStock(e.target.value)}
              className="flex-1 bg-zinc-950 border border-tequila-border px-3.5 py-2 rounded-md text-xs font-mono focus:outline-none focus:border-tequila-orange text-white placeholder-zinc-700"
            />

            <button
              onClick={() => {
                initBulkDraft();
                setSubTab("bulk");
              }}
              className="px-3.5 py-2 bg-zinc-950 border border-tequila-orange/40 hover:border-tequila-orange hover:bg-tequila-orange hover:text-black text-tequila-orange rounded-md text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shadow-sm"
              title="Přejít do režimu hromadné úpravy počtů"
            >
              <LucideIcon name="SlidersHorizontal" className="w-3.5 h-3.5" />
              ⚡ Hromadná úprava počtů
            </button>
            
            <div className="flex gap-1 overflow-x-auto">
              {[
                { id: "all", label: "Vše" },
                { id: "alcohol", label: "🥃 Alkohol" },
                { id: "soft", label: "🥤 Nealko" },
                { id: "garnish", label: "🍋 Ozdoby" },
                { id: "drink", label: "🍹 Míchané" },
                { id: "shot", label: "🥃 Shoty" },
                { id: "beer", label: "🍺 Piva" },
                { id: "food", label: "🍔 Jídlo" },
                { id: "hookah", label: "💨 Dýmky" },
                { id: "tobacco", label: "🚬 Tabák" },
                { id: "other", label: "📦 Ostatní" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFilterCategory(cat.id as any)}
                  className={`px-3 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                    filterCategory === cat.id
                      ? "bg-tequila-orange text-black font-black"
                      : "bg-zinc-950 border border-zinc-900 text-zinc-500 hover:text-white"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Skladová tabulka */}
          <div className="bg-tequila-card border border-tequila-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-950 text-[9px] uppercase font-mono font-bold tracking-wider text-zinc-500 border-b border-tequila-border">
                    <th className="p-4">Položka</th>
                    <th className="p-4">Kategorie</th>
                    <th className="p-4">Typ</th>
                    <th className="p-4">Skladový stav</th>
                    <th className="p-4">Ceny & Náklady</th>
                    <th className="p-4 text-right">Akce</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-tequila-border/40">
                  {items
                    .filter((item) => {
                      const matchesSearch = item.name.toLowerCase().includes(searchStock.toLowerCase());
                      const matchesCategory = filterCategory === "all" || item.category === filterCategory;
                      return matchesSearch && matchesCategory;
                    })
                    .map((item) => {
                      const isLow = item.stock <= item.minStock && item.stock > 0;
                      const isOut = item.stock === 0;

                      const isEditingThisItem = editingItem && editingItem.id === item.id;

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-zinc-950/20 transition-colors font-mono ${
                            isOut ? "bg-rose-950/5" : isLow ? "bg-amber-950/5" : ""
                          }`}
                        >
                          {/* Item info */}
                          <td className="p-4 flex items-center gap-3">
                            {isEditingThisItem ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={editingItem.iconName}
                                  onChange={(e) => setEditingItem({ ...editingItem, iconName: e.target.value })}
                                  className="p-1.5 rounded bg-zinc-950 border border-tequila-orange text-tequila-yellow text-xs focus:outline-none cursor-pointer"
                                  title="Změnit ikonu položky"
                                >
                                  <option value="Wind">💨 Dýmka</option>
                                  <option value="Cigarette">🚬 Tabák</option>
                                  <option value="GlassWater">🥃 Panák</option>
                                  <option value="Wine">🍷 Víno</option>
                                  <option value="Beer">🍺 Pivo</option>
                                  <option value="CupSoda">🥤 Nealko</option>
                                  <option value="Flame">🔥 Uhlíky/Ostré</option>
                                  <option value="Citrus">🍋 Citrus/Příchuť</option>
                                  <option value="ChefHat">🍔 Jídlo</option>
                                  <option value="Sparkles">✨ Speciál</option>
                                  <option value="Package">📦 Balení</option>
                                </select>
                                <div className="flex-1 min-w-[130px]">
                                  <input
                                    type="text"
                                    value={editingItem.name}
                                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                    className="w-full bg-zinc-950 border border-tequila-orange px-2 py-1 rounded text-xs text-white focus:outline-none font-bold"
                                  />
                                  <span className="text-[8px] text-zinc-600 font-mono block mt-0.5">UID: {item.id}</span>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className={`p-2 rounded border ${
                                  isOut 
                                    ? "bg-zinc-950 border-zinc-900 text-zinc-700" 
                                    : "bg-zinc-950 border-tequila-border text-tequila-yellow"
                                }`}>
                                  <LucideIcon name={item.iconName} className="w-4 h-4" />
                                </div>
                                <div>
                                  <span className="font-bold text-xs text-gray-100 block uppercase">{item.name}</span>
                                  <span className="text-[8px] text-zinc-600 font-mono">UID: {item.id}</span>
                                </div>
                              </>
                            )}
                          </td>

                          {/* Category */}
                          <td className="p-4">
                            {isEditingThisItem ? (
                              <select
                                value={editingItem.category}
                                onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value as ItemCategory })}
                                className="bg-zinc-950 border border-tequila-orange px-2 py-1.5 rounded text-[10px] text-white focus:outline-none font-mono cursor-pointer"
                              >
                                <option value="hookah">💨 Dýmky</option>
                                <option value="tobacco">🚬 Tabák</option>
                                <option value="alcohol">🥃 Alkohol</option>
                                <option value="soft">🥤 Nealko</option>
                                <option value="garnish">🍋 Garnish</option>
                                <option value="drink">🍹 Míchaný</option>
                                <option value="shot">🥃 Shot</option>
                                <option value="beer">🍺 Pivo</option>
                                <option value="food">🍔 Jídlo</option>
                                <option value="other">📦 Ostatní</option>
                              </select>
                            ) : (
                              <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">
                                {item.category === "alcohol" && "🥃 Alkohol"}
                                {item.category === "soft" && "🥤 Nealko"}
                                {item.category === "garnish" && "🍋 Garnish"}
                                {item.category === "drink" && "🍹 Drink"}
                                {item.category === "shot" && "🥃 Shot"}
                                {item.category === "beer" && "🍺 Pivo"}
                                {item.category === "food" && "🍔 Jídlo"}
                                {item.category === "hookah" && "💨 Dýmka"}
                                {item.category === "tobacco" && "🚬 Tabák"}
                                {item.category === "other" && "📦 Ostatní"}
                              </span>
                            )}
                          </td>

                          {/* Type */}
                          <td className="p-4">
                            {isEditingThisItem ? (
                              <select
                                value={editingItem.type}
                                onChange={(e) => setEditingItem({ ...editingItem, type: e.target.value as "raw" | "crafted" })}
                                className="bg-zinc-950 border border-tequila-orange px-2 py-1.5 rounded text-[10px] text-white focus:outline-none font-mono cursor-pointer"
                              >
                                <option value="raw">Surovina</option>
                                <option value="crafted">Míchaný / Prodejní</option>
                              </select>
                            ) : (
                              <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded ${
                                item.type === "raw" 
                                  ? "bg-blue-950/35 text-blue-400 border border-blue-500/10" 
                                  : "bg-purple-950/35 text-purple-400 border border-purple-500/10"
                              }`}>
                                {item.type === "raw" ? "Surovina" : "Míchaný"}
                              </span>
                            )}
                          </td>

                          {/* Stock status with capacity indicator */}
                          <td className="p-4">
                            {isEditingThisItem ? (
                              <div className="flex flex-col gap-1.5 text-[10px] max-w-[130px]">
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] text-zinc-500 font-bold uppercase w-8">Stav:</span>
                                  <input
                                    type="number"
                                    value={editingItem.stock}
                                    onChange={(e) => setEditingItem({ ...editingItem, stock: Number(e.target.value) })}
                                    className="w-16 bg-zinc-950 border border-tequila-orange px-1.5 py-0.5 rounded text-[10px] text-white font-mono focus:outline-none text-right"
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] text-zinc-500 font-bold uppercase w-8">Min:</span>
                                  <input
                                    type="number"
                                    value={editingItem.minStock}
                                    onChange={(e) => setEditingItem({ ...editingItem, minStock: Number(e.target.value) })}
                                    className="w-16 bg-zinc-950 border border-zinc-800 px-1.5 py-0.5 rounded text-[10px] text-white font-mono focus:outline-none text-right focus:border-tequila-orange"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1.5 min-w-[140px] max-w-[160px]">
                                <div className="flex items-center justify-between text-[10px] font-bold gap-2">
                                  <span className={isOut ? "text-rose-400" : isLow ? "text-amber-400" : "text-emerald-400"}>
                                    {item.stock < 1 ? item.stock.toFixed(2) : Math.floor(item.stock)} ks
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => onUpdateStock(item.id, Math.max(0, item.stock - 1))}
                                      className="w-5 h-5 bg-zinc-950 hover:bg-zinc-850 hover:border-tequila-orange hover:text-white text-zinc-400 border border-zinc-800 rounded flex items-center justify-center font-bold text-xs active:scale-95 transition-all cursor-pointer select-none"
                                      title="Odebrat 1 ks"
                                    >
                                      -
                                    </button>
                                    <button
                                      onClick={() => onUpdateStock(item.id, item.stock + 1)}
                                      className="w-5 h-5 bg-zinc-950 hover:bg-zinc-850 hover:border-tequila-orange hover:text-white text-zinc-400 border border-zinc-800 rounded flex items-center justify-center font-bold text-xs active:scale-95 transition-all cursor-pointer select-none"
                                      title="Přidat 1 ks"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-[8px] text-zinc-500">
                                  <span>min: {item.minStock} ks</span>
                                </div>
                                {/* Small capacity bar */}
                                <div className="h-1.5 bg-zinc-950 rounded overflow-hidden">
                                  <div
                                    className={`h-full ${
                                      isOut ? "bg-rose-600" : isLow ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                                    }`}
                                    style={{
                                      width: `${Math.min(100, (item.stock / (item.minStock * 4 || 20)) * 100)}%`,
                                    }}
                                  ></div>
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Prices & Costs column */}
                          <td className="p-4">
                            {isEditingThisItem ? (
                              <div className="flex flex-col gap-1 text-[10px]">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-zinc-500 font-bold uppercase text-[8px] tracking-wide w-12">Prodej:</span>
                                  <input
                                    type="number"
                                    value={editingItem.sellPrice}
                                    onChange={(e) => setEditingItem({ ...editingItem, sellPrice: Number(e.target.value) })}
                                    className="w-18 bg-zinc-950 border border-tequila-orange px-1.5 py-0.5 rounded text-[10px] text-white focus:outline-none text-right"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-zinc-500 font-bold uppercase text-[8px] tracking-wide w-12">Nákup:</span>
                                  <input
                                    type="number"
                                    value={editingItem.purchasePrice}
                                    onChange={(e) => setEditingItem({ ...editingItem, purchasePrice: Number(e.target.value) })}
                                    className="w-18 bg-zinc-950 border border-zinc-850 px-1.5 py-0.5 rounded text-[10px] text-zinc-300 focus:outline-none text-right focus:border-tequila-orange"
                                  />
                                </div>
                              </div>
                            ) : item.type === "raw" && item.sellPrice <= 0 ? (
                              <div className="space-y-0.5 text-[10px] text-zinc-400">
                                <div className="flex items-center gap-1">
                                  <span className="text-zinc-500 font-bold uppercase text-[8px] tracking-wide">Nákup / ks:</span>
                                  <span className="font-bold text-gray-200">${item.purchasePrice.toFixed(2)}</span>
                                </div>
                              </div>
                            ) : (
                              (() => {
                                const recipe = recipes.find((r) => r.resultItemId === item.id);
                                let costPerDrink = 0;
                                const yieldAmt = recipe?.yieldAmount ?? 20;
                                if (recipe) {
                                  const prodCostBatch = recipe.ingredients.reduce((sum, ing) => {
                                    const ingItem = items.find((it) => it.id === ing.itemId);
                                    return sum + (ingItem ? ingItem.purchasePrice * ing.quantity : 0);
                                  }, 0);
                                  costPerDrink = prodCostBatch / yieldAmt;
                                } else {
                                  costPerDrink = item.purchasePrice;
                                }
                                const profit = item.sellPrice - costPerDrink;
                                return (
                                  <div className="space-y-0.5 text-[10px]">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-zinc-500 font-bold uppercase text-[8px] tracking-wide">Náklad 1ks:</span>
                                      <span className="font-bold text-emerald-400" title={recipe ? `Cena celkové suroviny děleno ${yieldAmt}` : "Nákupní cena"}>
                                        ${costPerDrink.toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-zinc-500 font-bold uppercase text-[8px] tracking-wide">Prodej 1ks:</span>
                                      <span className="font-bold text-tequila-yellow">${item.sellPrice.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 pt-0.5 border-t border-zinc-900/40">
                                      <span className="text-zinc-500 font-bold uppercase text-[8px] tracking-wide">Zisk 1ks:</span>
                                      <span className={`font-bold ${profit >= 0 ? "text-emerald-300" : "text-rose-400"}`}>
                                        ${profit.toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })()
                            )}
                          </td>

                          {/* Quick Edit Action */}
                          <td className="p-4 text-right">
                            {isEditingThisItem ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={handleSaveEdit}
                                  className="p-1.5 bg-emerald-600 text-black rounded-lg hover:bg-emerald-500 cursor-pointer"
                                  title="Uložit změny"
                                >
                                  <LucideIcon name="Check" className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingItem(null)}
                                  className="p-1.5 bg-zinc-900 text-zinc-400 rounded-lg hover:bg-zinc-800 cursor-pointer"
                                  title="Zrušit"
                                >
                                  <LucideIcon name="X" className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5 ml-auto">
                                <button
                                  onClick={() => handleStartEdit(item)}
                                  className="px-2.5 py-1 bg-zinc-950 border border-zinc-900 hover:border-tequila-orange text-zinc-500 hover:text-white rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <LucideIcon name="Edit" className="w-3.5 h-3.5" />
                                  Edit
                                </button>
                                
                                {deleteConfirmId === item.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        onDeleteItem(item.id);
                                        triggerAlert("success", `Položka "${item.name}" byla odstraněna.`);
                                        setDeleteConfirmId(null);
                                      }}
                                      className="px-2 py-1 bg-rose-950/60 hover:bg-rose-600 border border-rose-500 text-rose-300 hover:text-white rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                      title="Klikněte pro potvrzení smazání"
                                    >
                                      Smazat?
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirmId(null)}
                                      className="p-1 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded cursor-pointer"
                                      title="Zrušit"
                                    >
                                      <LucideIcon name="X" className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setDeleteConfirmId(item.id);
                                      setTimeout(() => {
                                        setDeleteConfirmId(prev => prev === item.id ? null : prev);
                                      }, 4000);
                                    }}
                                    className="p-1.5 bg-zinc-950 border border-zinc-900 hover:border-rose-500 text-zinc-500 hover:text-rose-500 rounded cursor-pointer transition-colors"
                                    title="Smazat ze skladu"
                                  >
                                    <LucideIcon name="Trash2" className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 1B: BULK INVENTORY EDITING (INVENTURA) */}
      {subTab === "bulk" && (() => {
        const filteredBulkItems = items.filter((item) => {
          const matchesSearch = item.name.toLowerCase().includes(bulkSearch.toLowerCase());
          const matchesCategory = bulkFilterCategory === "all" || item.category === bulkFilterCategory;
          return matchesSearch && matchesCategory;
        });

        const changedItemsList = items.filter((it) => {
          const draftVal = bulkDraft[it.id];
          return draftVal !== undefined && draftVal !== it.stock;
        });

        const totalStockDelta = changedItemsList.reduce((sum, it) => {
          const draftVal = bulkDraft[it.id] ?? it.stock;
          return sum + (draftVal - it.stock);
        }, 0);

        return (
          <div className="space-y-4">
            {/* Bulk Toolbar & Helper Panel */}
            <div className="bg-tequila-card border border-tequila-border p-4 rounded-lg space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-tequila-border/50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded bg-tequila-orange/10 border border-tequila-orange/30 text-tequila-orange">
                    <LucideIcon name="SlidersHorizontal" className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                      Hromadná úprava počtů (Inventura skladu)
                    </h3>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      Rychlé nastavení, inventurní přepočet nebo hromadné navyšování položek baru.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto">
                  <div className={`px-3 py-1.5 rounded text-xs font-mono font-bold border ${
                    changedItemsList.length > 0
                      ? "bg-amber-950/40 border-amber-500/30 text-amber-400"
                      : "bg-zinc-950 border-zinc-850 text-zinc-500"
                  }`}>
                    Upraveno: <span className="text-white font-black">{changedItemsList.length}</span> položek
                    {changedItemsList.length > 0 && (
                      <span className={`ml-2 ${totalStockDelta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        ({totalStockDelta >= 0 ? `+${totalStockDelta}` : totalStockDelta} ks)
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleSaveBulk}
                    disabled={changedItemsList.length === 0}
                    className={`px-4 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
                      changedItemsList.length > 0
                        ? "bg-emerald-600 hover:bg-emerald-500 text-black font-black"
                        : "bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed"
                    }`}
                  >
                    <LucideIcon name="Check" className="w-4 h-4" />
                    Uložit změny
                  </button>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Vyhledat v inventuře..."
                  value={bulkSearch}
                  onChange={(e) => setBulkSearch(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-tequila-border px-3.5 py-2 rounded-md text-xs font-mono focus:outline-none focus:border-tequila-orange text-white placeholder-zinc-700"
                />

                <div className="flex gap-1 overflow-x-auto">
                  {[
                    { id: "all", label: "Vše" },
                    { id: "alcohol", label: "Alkohol" },
                    { id: "soft", label: "Nealko" },
                    { id: "garnish", label: "Ozdoby" },
                    { id: "drink", label: "Míchané" },
                    { id: "shot", label: "Shoty" },
                    { id: "beer", label: "Piva" },
                    { id: "food", label: "Jídlo" },
                    { id: "hookah", label: "Dýmky" },
                    { id: "tobacco", label: "Tabák" },
                    { id: "other", label: "Ostatní" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setBulkFilterCategory(cat.id as any)}
                      className={`px-3 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                        bulkFilterCategory === cat.id
                          ? "bg-tequila-orange text-black font-black"
                          : "bg-zinc-950 border border-zinc-900 text-zinc-500 hover:text-white"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fast Bulk Actions for visible items */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-900 font-mono text-[10px]">
                <span className="text-zinc-500 font-bold uppercase mr-1">Rychlé akce (zobrazeno {filteredBulkItems.length} položek):</span>
                
                <button
                  onClick={() => handleBulkFillMin(filteredBulkItems)}
                  className="px-2.5 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 text-amber-400 rounded font-bold transition-all flex items-center gap-1 cursor-pointer"
                  title="Doplní všechny položky pod minimálním stavem na jejich minimální zásobu"
                >
                  <LucideIcon name="Zap" className="w-3 h-3 text-amber-400" />
                  Doplnit pod minimem
                </button>

                <button
                  onClick={() => handleBulkAddAll(filteredBulkItems, 10)}
                  className="px-2.5 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 text-emerald-400 rounded font-bold transition-all cursor-pointer"
                >
                  +10 ks všem
                </button>

                <button
                  onClick={() => handleBulkAddAll(filteredBulkItems, 5)}
                  className="px-2.5 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 text-emerald-400 rounded font-bold transition-all cursor-pointer"
                >
                  +5 ks všem
                </button>

                <button
                  onClick={() => handleBulkAddAll(filteredBulkItems, 1)}
                  className="px-2.5 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 text-emerald-400 rounded font-bold transition-all cursor-pointer"
                >
                  +1 ks všem
                </button>

                <button
                  onClick={() => handleBulkAddAll(filteredBulkItems, -5)}
                  className="px-2.5 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-rose-500/50 text-rose-400 rounded font-bold transition-all cursor-pointer"
                >
                  -5 ks všem
                </button>

                <button
                  onClick={() => handleBulkZeroAll(filteredBulkItems)}
                  className="px-2.5 py-1 bg-zinc-950 hover:bg-rose-950/30 border border-zinc-800 hover:border-rose-500/40 text-zinc-400 hover:text-rose-400 rounded font-bold transition-all cursor-pointer"
                  title="Vynuluje zásoby pro všechny zobrazené položky"
                >
                  Vynulovat (0 ks)
                </button>

                <button
                  onClick={handleBulkResetToOriginal}
                  className="px-2.5 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white rounded font-bold transition-all ml-auto cursor-pointer"
                  title="Vrátit všechny koncepty změn zpět na aktuální stav skladu"
                >
                  Obnovit původní
                </button>
              </div>
            </div>

            {/* Bulk Inventory Table */}
            <div className="bg-tequila-card border border-tequila-border rounded-lg overflow-hidden font-mono">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-950 text-[9px] uppercase font-bold tracking-wider text-zinc-500 border-b border-tequila-border">
                      <th className="p-3.5">Položka</th>
                      <th className="p-3.5">Kategorie</th>
                      <th className="p-3.5">Původní stav</th>
                      <th className="p-3.5 text-center min-w-[280px]">Nový stav (Úprava)</th>
                      <th className="p-3.5 text-center">Rozdíl</th>
                      <th className="p-3.5 text-right">Výsledek</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tequila-border/40 text-xs">
                    {filteredBulkItems.map((item) => {
                      const draftVal = getDraftStock(item.id, item.stock);
                      const delta = draftVal - item.stock;
                      const isModified = draftVal !== item.stock;
                      const isOut = draftVal === 0;
                      const isLow = draftVal <= item.minStock && draftVal > 0;

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-zinc-950/30 transition-colors ${
                            isModified
                              ? "bg-amber-950/10"
                              : isOut
                              ? "bg-rose-950/5"
                              : isLow
                              ? "bg-amber-950/5"
                              : ""
                          }`}
                        >
                          {/* Item info */}
                          <td className="p-3.5 flex items-center gap-3">
                            <div className={`p-2 rounded border ${
                              isOut 
                                ? "bg-zinc-950 border-zinc-900 text-zinc-700" 
                                : "bg-zinc-950 border-tequila-border text-tequila-yellow"
                            }`}>
                              <LucideIcon name={item.iconName} className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-bold text-xs text-gray-100 block uppercase">{item.name}</span>
                              <span className="text-[8px] text-zinc-600 font-mono">UID: {item.id}</span>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="p-3.5">
                            <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">
                              {item.category === "alcohol" && "🥃 Alkohol"}
                              {item.category === "soft" && "🥤 Nealko"}
                              {item.category === "garnish" && "🍋 Garnish"}
                              {item.category === "drink" && "🍹 Drink"}
                              {item.category === "shot" && "🥃 Shot"}
                              {item.category === "beer" && "🍺 Pivo"}
                              {item.category === "food" && "🍔 Jídlo"}
                              {item.category === "hookah" && "💨 Dýmka"}
                              {item.category === "tobacco" && "🚬 Tabák"}
                              {item.category === "other" && "📦 Ostatní"}
                            </span>
                          </td>

                          {/* Original Stock */}
                          <td className="p-3.5 font-bold">
                            <span className="text-zinc-400">{item.stock < 1 ? item.stock.toFixed(2) : Math.floor(item.stock)} ks</span>
                            <span className="text-[9px] text-zinc-600 block font-normal">min: {item.minStock} ks</span>
                          </td>

                          {/* Quick Adjust & Input Controls */}
                          <td className="p-3.5">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleBulkAdjust(item.id, -10, item.stock)}
                                className="px-1.5 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white rounded text-[10px] font-bold transition-all cursor-pointer"
                                title="-10 ks"
                              >
                                -10
                              </button>
                              <button
                                onClick={() => handleBulkAdjust(item.id, -5, item.stock)}
                                className="px-1.5 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white rounded text-[10px] font-bold transition-all cursor-pointer"
                                title="-5 ks"
                              >
                                -5
                              </button>
                              <button
                                onClick={() => handleBulkAdjust(item.id, -1, item.stock)}
                                className="w-6 h-6 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white rounded text-xs font-bold transition-all flex items-center justify-center cursor-pointer"
                                title="-1 ks"
                              >
                                -
                              </button>

                              <input
                                type="number"
                                min="0"
                                value={draftVal}
                                onChange={(e) => handleBulkChange(item.id, Math.max(0, Number(e.target.value)))}
                                className={`w-18 px-2 py-1 bg-zinc-950 border rounded text-xs font-mono font-bold text-center focus:outline-none transition-colors ${
                                  isModified
                                    ? "border-tequila-orange text-tequila-yellow bg-amber-950/20"
                                    : "border-zinc-800 text-white focus:border-tequila-orange"
                                }`}
                              />

                              <button
                                onClick={() => handleBulkAdjust(item.id, 1, item.stock)}
                                className="w-6 h-6 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white rounded text-xs font-bold transition-all flex items-center justify-center cursor-pointer"
                                title="+1 ks"
                              >
                                +
                              </button>
                              <button
                                onClick={() => handleBulkAdjust(item.id, 5, item.stock)}
                                className="px-1.5 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white rounded text-[10px] font-bold transition-all cursor-pointer"
                                title="+5 ks"
                              >
                                +5
                              </button>
                              <button
                                onClick={() => handleBulkAdjust(item.id, 10, item.stock)}
                                className="px-1.5 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white rounded text-[10px] font-bold transition-all cursor-pointer"
                                title="+10 ks"
                              >
                                +10
                              </button>

                              <button
                                onClick={() => handleBulkChange(item.id, item.minStock)}
                                className="px-2 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 text-amber-400 rounded text-[9px] font-bold uppercase transition-all ml-1 cursor-pointer"
                                title={`Nastavit přesně na minimální stav (${item.minStock} ks)`}
                              >
                                Min ({item.minStock})
                              </button>
                            </div>
                          </td>

                          {/* Delta */}
                          <td className="p-3.5 text-center">
                            {delta > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 font-bold text-[11px]">
                                +{delta} ks
                              </span>
                            ) : delta < 0 ? (
                              <span className="px-2 py-0.5 rounded bg-rose-950/40 border border-rose-500/20 text-rose-400 font-bold text-[11px]">
                                {delta} ks
                              </span>
                            ) : (
                              <span className="text-zinc-600 text-[11px]">Beze změny</span>
                            )}
                          </td>

                          {/* Result status */}
                          <td className="p-3.5 text-right">
                            {isOut ? (
                              <span className="px-2 py-0.5 rounded bg-rose-950/40 text-rose-400 border border-rose-500/20 text-[9px] font-bold uppercase">
                                Vyprodáno
                              </span>
                            ) : isLow ? (
                              <span className="px-2 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-500/20 text-[9px] font-bold uppercase">
                                Nízký stav
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold uppercase">
                                V pořádku
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Save & Summary Bar */}
            <div className="bg-tequila-card border border-tequila-border p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-4 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-3 font-mono text-xs">
                <span className="text-zinc-400">
                  Připraveno k uložení: <strong className="text-white">{changedItemsList.length}</strong> položek
                </span>
                {changedItemsList.length > 0 && (
                  <span className={`font-bold ${totalStockDelta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    Celkový posun zásob: {totalStockDelta >= 0 ? `+${totalStockDelta}` : totalStockDelta} ks
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 font-mono w-full sm:w-auto">
                <button
                  onClick={() => setSubTab("stock")}
                  className="flex-1 sm:flex-none px-4 py-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Zrušit & Zpět
                </button>
                <button
                  onClick={handleSaveBulk}
                  disabled={changedItemsList.length === 0}
                  className={`flex-1 sm:flex-none px-6 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
                    changedItemsList.length > 0
                      ? "bg-emerald-600 hover:bg-emerald-500 text-black font-black"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed"
                  }`}
                >
                  <LucideIcon name="Check" className="w-4 h-4" />
                  Uložit inventuru
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SUB TAB 2: BUY/ORDER INGREDIENTS */}
      {subTab === "buy" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Catalog */}
          <div className="lg:col-span-2 space-y-4 font-mono">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Dostupné suroviny od dodavatele
              </h3>
              <input
                type="text"
                placeholder="Hledat suroviny..."
                value={searchBuy}
                onChange={(e) => setSearchBuy(e.target.value)}
                className="bg-zinc-950 border border-tequila-border px-3 py-1.5 rounded-md text-xs font-mono focus:outline-none focus:border-tequila-orange text-white placeholder-zinc-700 w-full sm:w-56"
              />
            </div>

            {/* Category filter bar for Buy tab */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {[
                { id: "all", label: "Vše" },
                { id: "hookah", label: "💨 Dýmky" },
                { id: "tobacco", label: "🚬 Tabák" },
                { id: "alcohol", label: "🥃 Alkohol" },
                { id: "soft", label: "🥤 Nealko" },
                { id: "garnish", label: "🍋 Ozdoby" },
                { id: "beer", label: "🍺 Pivo" },
                { id: "food", label: "🍔 Jídlo" },
                { id: "other", label: "📦 Ostatní" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFilterBuyCategory(cat.id as any)}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                    filterBuyCategory === cat.id
                      ? "bg-tequila-orange text-black font-black"
                      : "bg-zinc-950 border border-zinc-900 text-zinc-500 hover:text-white"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {buyableItems.map((item) => {
                const currentQty = buyCart[item.id] || 0;

                return (
                  <div
                    key={item.id}
                    className="bg-tequila-card border border-tequila-border p-4 rounded-lg flex items-center justify-between gap-4 hover:border-tequila-orange transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded bg-zinc-950 text-tequila-orange border border-zinc-900">
                        <LucideIcon name={item.iconName} className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-gray-100 uppercase">{item.name}</h4>
                        <div className="flex items-center gap-2 mt-1 text-[10px]">
                          <span className="font-bold text-tequila-yellow">
                            ${item.purchasePrice} / ks
                          </span>
                          <span className="text-zinc-650">
                            Stav: {Math.floor(item.stock)}ks
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quantity selectors */}
                    <div className="flex items-center gap-1 bg-zinc-950 border border-tequila-border p-1 rounded">
                      <button
                        onClick={() => handleUpdateBuyQty(item.id, currentQty - 1)}
                        className="w-6 h-6 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded flex items-center justify-center font-bold active:scale-90 cursor-pointer text-xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={currentQty || ""}
                        onChange={(e) =>
                          handleUpdateBuyQty(item.id, e.target.value === "" ? 0 : Number(e.target.value))
                        }
                        placeholder="0"
                        className="w-9 bg-transparent text-center font-mono text-xs font-bold text-white focus:outline-none"
                      />
                      <button
                        onClick={() => handleUpdateBuyQty(item.id, currentQty + 1)}
                        className="w-6 h-6 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded flex items-center justify-center font-bold active:scale-90 cursor-pointer text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cart & Billing info (Right Column) */}
          <div className="lg:col-span-1">
            <div className="bg-tequila-card border border-tequila-border rounded-lg p-5 space-y-5 sticky top-6">
              <h3 className="font-mono font-bold text-gray-100 uppercase tracking-wider text-xs flex items-center gap-2 border-b border-tequila-border/40 pb-3">
                <LucideIcon name="ShoppingBag" className="w-4 h-4 text-tequila-orange" />
                Nákupní Košík Surovin
              </h3>

              {/* Items Summary list */}
              <div className="divide-y divide-tequila-border/30 max-h-[250px] overflow-y-auto pr-1 font-mono">
                {Object.keys(buyCart).length === 0 ? (
                  <p className="text-[10px] uppercase text-zinc-500 text-center py-8">
                    Košík je prázdný.
                  </p>
                ) : (
                  Object.entries(buyCart).map(([itemId, qty]) => {
                    const item = items.find((i) => i.id === itemId)!;
                    const quantity = qty as number;
                    return (
                      <div key={itemId} className="py-2 flex justify-between text-xs">
                        <div>
                          <p className="font-bold text-gray-200 uppercase">{item.name}</p>
                          <p className="text-[10px] text-zinc-500">
                            {quantity} ks x ${item.purchasePrice}
                          </p>
                        </div>
                        <span className="font-bold text-gray-300">
                          ${(quantity * item.purchasePrice).toFixed(2)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Funding Options */}
              <div className="space-y-3 pt-3 border-t border-tequila-border/40 font-mono">
                <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                  Metoda úhrady dodávky
                </span>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPayFromRegister(true)}
                    className={`p-3 rounded border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      payFromRegister
                        ? "bg-tequila-orange/10 border-tequila-orange text-tequila-orange"
                        : "bg-zinc-950 border-tequila-border text-zinc-500 hover:text-white"
                    }`}
                  >
                    <span className="font-bold text-[10px] uppercase">Z Pokladny</span>
                    <span className="text-[9px] mt-1 text-zinc-400">${registerBalance.toFixed(0)}</span>
                  </button>

                  <button
                    onClick={() => setPayFromRegister(false)}
                    className={`p-3 rounded border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      !payFromRegister
                        ? "bg-tequila-orange/10 border-tequila-orange text-tequila-orange"
                        : "bg-zinc-950 border-tequila-border text-zinc-500 hover:text-white"
                    }`}
                  >
                    <span className="font-bold text-[10px] uppercase">Vlastní hotovost</span>
                    <span className="text-[9px] text-zinc-600 mt-1">Osobní</span>
                  </button>
                </div>
              </div>

              {/* Checkout cost and payment button */}
              <div className="pt-3 border-t border-tequila-border/40 space-y-4 font-mono">
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-[10px] text-zinc-500 uppercase tracking-wider">Cena celkem</span>
                  <span className="text-xl font-bold text-tequila-orange">
                    ${getBuyCartTotal().toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={handleOrderSupplies}
                  disabled={Object.keys(buyCart).length === 0}
                  className={`w-full py-3.5 rounded font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    Object.keys(buyCart).length === 0
                      ? "bg-zinc-900 text-zinc-650 border border-zinc-800 cursor-not-allowed"
                      : "bg-tequila-orange hover:bg-tequila-yellow text-black"
                  }`}
                >
                  <LucideIcon name="ShoppingBag" className="w-4 h-4" />
                  CONFIRM DELIVERY
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 3: ADD NEW CUSTOM INGREDIENT/DRINK */}
      {subTab === "add" && (
        <div className="bg-tequila-card border border-tequila-border p-6 rounded-lg max-w-xl mx-auto font-mono">
          <div className="border-b border-tequila-border/40 pb-4 mb-5">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
              Registrace Nové Položky Skladu
            </h3>
            <p className="text-[10px] text-zinc-500 mt-1 uppercase">
              Zavedení nové ingredience či hotového produktu do barové databáze.
            </p>
          </div>

          <form onSubmit={handleCreateItem} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Name */}
              <div className="md:col-span-2">
                <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Název položky</label>
                <input
                  type="text"
                  required
                  placeholder="Např. Tequila Silver 1L, Čerstvá Limeta..."
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full bg-zinc-950 border border-tequila-border px-3.5 py-2 rounded-md text-xs text-gray-100 focus:outline-none focus:border-tequila-orange placeholder-zinc-700"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Typ položky</label>
                <select
                  value={newItemType}
                  onChange={(e) => setNewItemType(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-tequila-border px-3.5 py-2 rounded-md text-xs text-gray-300 focus:outline-none focus:border-tequila-orange cursor-pointer"
                >
                  <option value="raw" className="bg-zinc-950">Surovina (Ingredience / Zboží k prodeji)</option>
                  <option value="crafted" className="bg-zinc-950">Prodejní položka / Jídlo / Drink</option>
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Kategorie</label>
                <select
                  value={newItemCategory}
                  onChange={(e) => {
                    const newCat = e.target.value as ItemCategory;
                    setNewItemCategory(newCat);
                    if (newCat === "hookah") setNewItemIcon("Wind");
                    else if (newCat === "tobacco") setNewItemIcon("Cigarette");
                    else if (newCat === "alcohol" || newCat === "shot") setNewItemIcon("GlassWater");
                    else if (newCat === "drink") setNewItemIcon("Wine");
                    else if (newCat === "beer") setNewItemIcon("Beer");
                    else if (newCat === "soft") setNewItemIcon("CupSoda");
                    else if (newCat === "garnish") setNewItemIcon("Citrus");
                    else if (newCat === "food") setNewItemIcon("ChefHat");
                    else if (newCat === "other") setNewItemIcon("Package");
                  }}
                  className="w-full bg-zinc-950 border border-tequila-border px-3.5 py-2 rounded-md text-xs text-gray-300 focus:outline-none focus:border-tequila-orange cursor-pointer"
                >
                  <option value="hookah" className="bg-zinc-950">💨 Dýmky (Vodní dýmky, uhlíky, příchutě)</option>
                  <option value="tobacco" className="bg-zinc-950">🚬 Tabák (Cigarety, Doutníky...)</option>
                  <option value="alcohol" className="bg-zinc-950">🥃 Alkohol (Láhve, Tvrdý)</option>
                  <option value="soft" className="bg-zinc-950">🥤 Nealko (Coly, Džusy, RedBully)</option>
                  <option value="garnish" className="bg-zinc-950">🍋 Ozdoba / Citrus / Sirupy</option>
                  <option value="drink" className="bg-zinc-950">🍹 Míchaný drink</option>
                  <option value="shot" className="bg-zinc-950">🥃 Shot (Panák)</option>
                  <option value="beer" className="bg-zinc-950">🍺 Pivo</option>
                  <option value="food" className="bg-zinc-950">🍔 Jídlo / Pochutiny</option>
                  <option value="other" className="bg-zinc-950">📦 Ostatní</option>
                </select>
              </div>

              {/* Starting stock */}
              <div>
                <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Počáteční sklad</label>
                <input
                  type="number"
                  min="0"
                  value={newItemStock}
                  onChange={(e) => setNewItemStock(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-tequila-border px-3.5 py-2 rounded-md text-xs focus:outline-none focus:border-tequila-orange font-mono text-white"
                />
              </div>

              {/* Alert min stock */}
              <div>
                <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Minimální stav alertu</label>
                <input
                  type="number"
                  min="0"
                  value={newItemMinStock}
                  onChange={(e) => setNewItemMinStock(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-tequila-border px-3.5 py-2 rounded-md text-xs focus:outline-none focus:border-tequila-orange font-mono text-white"
                />
              </div>

              {/* Purchase price */}
              <div>
                <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">
                  Pořizovací nákupní cena ($)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newItemPurchasePrice}
                  onChange={(e) => setNewItemPurchasePrice(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-tequila-border px-3.5 py-2 rounded-md text-xs focus:outline-none focus:border-tequila-orange font-mono text-white"
                />
                <p className="text-[9px] text-zinc-600 mt-0.5">Suroviny nakupované u dodavatele.</p>
              </div>

              {/* Sell price */}
              <div>
                <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">
                  Prodejní cena na baru ($)
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full bg-zinc-950 border border-tequila-border px-3.5 py-2 rounded-md text-xs focus:outline-none focus:border-tequila-orange font-mono text-white"
                  value={newItemSellPrice}
                  onChange={(e) => setNewItemSellPrice(Number(e.target.value))}
                />
                <p className="text-[9px] text-zinc-600 mt-0.5">Účtováno zákazníkovi (u dýmek, cigaret, jídel, nápojů...).</p>
              </div>

              {/* Icon selector */}
              <div className="md:col-span-2">
                <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Výběr ikony</label>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 gap-2">
                  {[
                    { id: "Wind", label: "Dýmka" },
                    { id: "Cigarette", label: "Tabák" },
                    { id: "GlassWater", label: "Panák" },
                    { id: "Wine", label: "Víno" },
                    { id: "Beer", label: "Pivo" },
                    { id: "CupSoda", label: "Limo" },
                    { id: "Flame", label: "Uhlíky" },
                    { id: "Citrus", label: "Citrus" },
                    { id: "ChefHat", label: "Jídlo" },
                    { id: "Package", label: "Balení" },
                  ].map((ic) => (
                    <button
                      type="button"
                      key={ic.id}
                      onClick={() => setNewItemIcon(ic.id)}
                      className={`p-2 border rounded flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                        newItemIcon === ic.id
                          ? "bg-tequila-orange/15 border-tequila-orange text-tequila-orange font-bold"
                          : "bg-zinc-950 border-tequila-border text-zinc-500 hover:text-white"
                      }`}
                    >
                      <LucideIcon name={ic.id} className="w-4 h-4" />
                      <span className="text-[8px] tracking-tight">{ic.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-3.5 bg-tequila-orange hover:bg-tequila-yellow text-black font-mono font-bold text-xs uppercase tracking-widest rounded transition-all cursor-pointer"
            >
              COMMIT RECORD TO REGISTER
            </button>
          </form>
        </div>
      )}

      {/* AI INVENTORY SCANNER MODAL */}
      {showAiInventoryModal && (
        <InventoryAiScannerModal
          isOpen={showAiInventoryModal}
          onClose={() => setShowAiInventoryModal(false)}
          existingItems={items}
          onApplyStockUpdates={(updates, newItems) => {
            if (onBatchUpdateStock && updates.length > 0) {
              onBatchUpdateStock(updates);
            } else {
              updates.forEach((u) => onUpdateStock(u.itemId, u.newStock));
            }
            if (newItems && newItems.length > 0) {
              newItems.forEach((ni) => onAddNewItem(ni));
            }
            triggerAlert(
              "success",
              `AI úspěšně aktualizovala sklad (${updates.length} aktualizací${
                newItems && newItems.length > 0 ? `, ${newItems.length} nových položek` : ""
              })!`
            );
          }}
        />
      )}
    </div>
  );
};
