import React, { useState } from "react";
import { InventoryItem, PurchaseItem, ItemCategory, Recipe } from "../types";
import { LucideIcon } from "./LucideIcon";

interface InventoryTabProps {
  items: InventoryItem[];
  recipes: Recipe[];
  registerBalance: number;
  onPurchaseSupplies: (
    purchaseItems: PurchaseItem[],
    payFromRegister: boolean
  ) => { success: boolean; error?: string };
  onUpdateStock: (itemId: string, newStock: number) => void;
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
  onUpdateItem,
  onAddNewItem,
  onDeleteItem,
}) => {
  const [subTab, setSubTab] = useState<"stock" | "buy" | "add">("stock");
  
  // Stock tab search/filters
  const [searchStock, setSearchStock] = useState("");
  const [filterCategory, setFilterCategory] = useState<"all" | ItemCategory>("all");
  
  // Quick inline stock & price edit state
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Buy tab cart state
  const [buyCart, setBuyCart] = useState<{ [itemId: string]: number }>({});
  const [payFromRegister, setPayFromRegister] = useState(true);

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

  // 2. SUPPLY SHOP LOGIC
  // Raw items or items that can be purchased (purchasePrice > 0)
  const buyableItems = items.filter((item) => item.purchasePrice > 0);

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
        <div className="flex bg-zinc-950 p-1 rounded border border-tequila-border self-start sm:self-auto">
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
        </div>
      </div>

      {/* SUB TAB 1: CURRENT STOCK LEVELS */}
      {subTab === "stock" && (
        <div className="space-y-4">
          {/* Stock Search and Quick Categorization */}
          <div className="bg-tequila-card/85 border border-tequila-border p-4 rounded-lg flex flex-col md:flex-row gap-3">
            <input
              type="text"
              placeholder="Vyhledat ve skladě..."
              value={searchStock}
              onChange={(e) => setSearchStock(e.target.value)}
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
                            <div className={`p-2 rounded border ${
                              isOut 
                                ? "bg-zinc-950 border-zinc-900 text-zinc-700" 
                                : "bg-zinc-950 border-tequila-border text-tequila-yellow"
                            }`}>
                              <LucideIcon name={item.iconName} className="w-4 h-4" />
                            </div>
                            {isEditingThisItem ? (
                              <div className="flex-1 min-w-[120px]">
                                <input
                                  type="text"
                                  value={editingItem.name}
                                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                  className="w-full bg-zinc-950 border border-tequila-orange px-2 py-1 rounded text-xs text-white focus:outline-none"
                                />
                                <span className="text-[8px] text-zinc-600 font-mono block mt-0.5">UID: {item.id}</span>
                              </div>
                            ) : (
                              <div>
                                <span className="font-bold text-xs text-gray-100 block uppercase">{item.name}</span>
                                <span className="text-[8px] text-zinc-600 font-mono">UID: {item.id}</span>
                              </div>
                            )}
                          </td>

                          {/* Category */}
                          <td className="p-4">
                            <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">
                              {item.category === "alcohol" && "🥃 Alkohol"}
                              {item.category === "soft" && "🥤 Nealko"}
                              {item.category === "garnish" && "🍋 Garnish"}
                              {item.category === "drink" && "🍹 Drink"}
                              {item.category === "shot" && "🥃 Shot"}
                              {item.category === "beer" && "🍺 Pivo"}
                              {item.category === "food" && "🍔 Jídlo"}
                              {item.category === "other" && "📦 Ostatní"}
                            </span>
                          </td>

                          {/* Type */}
                          <td className="p-4">
                            <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded ${
                              item.type === "raw" 
                                ? "bg-blue-950/35 text-blue-400 border border-blue-500/10" 
                                : "bg-purple-950/35 text-purple-400 border border-purple-500/10"
                            }`}>
                              {item.type === "raw" ? "Surovina" : "Míchaný"}
                            </span>
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
                              <div className="space-y-1 max-w-[130px]">
                                <div className="flex items-center justify-between text-[10px] font-bold">
                                  <span className={isOut ? "text-rose-400" : isLow ? "text-amber-400" : "text-emerald-400"}>
                                    {item.stock < 1 ? item.stock.toFixed(2) : Math.floor(item.stock)} ks
                                  </span>
                                  <span className="text-zinc-600 text-[9px]">min: {item.minStock}</span>
                                </div>
                                {/* Small capacity bar */}
                                <div className="h-1.5 bg-zinc-950 rounded overflow-hidden">
                                  <div
                                    className={`h-full ${
                                      isOut ? "bg-rose-600" : isLow ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                                    }`}
                                    style={{
                                      width: `${Math.min(100, (item.stock / (item.minStock * 4)) * 100)}%`,
                                    }}
                                  ></div>
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Prices & Costs column */}
                          <td className="p-4">
                            {isEditingThisItem ? (
                              editingItem.type === "raw" ? (
                                <div className="flex items-center gap-1.5 font-mono text-[10px]">
                                  <span className="text-zinc-500 font-bold uppercase text-[8px] tracking-wide w-12">Nákup / ks:</span>
                                  <input
                                    type="number"
                                    value={editingItem.purchasePrice}
                                    onChange={(e) => setEditingItem({ ...editingItem, purchasePrice: Number(e.target.value) })}
                                    className="w-18 bg-zinc-950 border border-tequila-orange px-1.5 py-0.5 rounded text-[10px] text-white focus:outline-none text-right"
                                  />
                                </div>
                              ) : (
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
                              )
                            ) : item.type === "raw" ? (
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
                                      <span className="font-bold text-emerald-400" title={`Cena celkové suroviny děleno ${yieldAmt}`}>
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

      {/* SUB TAB 2: BUY/ORDER INGREDIENTS */}
      {subTab === "buy" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Catalog */}
          <div className="lg:col-span-2 space-y-4 font-mono">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Dostupné suroviny od dodavatele
            </h3>

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
                  className="w-full bg-zinc-950 border border-tequila-border px-3.5 py-2 rounded-md text-xs text-gray-300 focus:outline-none focus:border-tequila-orange"
                >
                  <option value="raw" className="bg-zinc-950">Surovina (Ingredience)</option>
                  <option value="crafted" className="bg-zinc-950">Prodejní položka / Jídlo / Drink</option>
                </select>
              </div>

               {/* Category */}
              <div>
                <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Kategorie</label>
                <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-tequila-border px-3.5 py-2 rounded-md text-xs text-gray-300 focus:outline-none focus:border-tequila-orange"
                >
                  <option value="alcohol" className="bg-zinc-950">🥃 Alkohol</option>
                  <option value="soft" className="bg-zinc-950">🥤 Nealko</option>
                  <option value="garnish" className="bg-zinc-950">🍋 Ozdoba / Citrus</option>
                  <option value="drink" className="bg-zinc-950">🍹 Míchaný drink</option>
                  <option value="shot" className="bg-zinc-950">🥃 Shot (Panák)</option>
                  <option value="beer" className="bg-zinc-950">🍺 Pivo</option>
                  <option value="food" className="bg-zinc-950">🍔 Jídlo</option>
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
                  disabled={newItemType === "raw"}
                  className={`w-full bg-zinc-950 border border-tequila-border px-3.5 py-2 rounded-md text-xs focus:outline-none focus:border-tequila-orange font-mono text-white ${
                    newItemType === "raw" ? "opacity-30 cursor-not-allowed" : ""
                  }`}
                  value={newItemType === "raw" ? 0 : newItemSellPrice}
                  onChange={(e) => setNewItemSellPrice(Number(e.target.value))}
                />
                <p className="text-[9px] text-zinc-600 mt-0.5">Účtováno zákazníkovi.</p>
              </div>

              {/* Icon selector */}
              <div className="md:col-span-2">
                <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Výběr ikony</label>
                <div className="grid grid-cols-6 gap-2">
                  {[
                    { id: "Wine", label: "Víno" },
                    { id: "Beer", label: "Pivo" },
                    { id: "CupSoda", label: "Limo" },
                    { id: "Flame", label: "Ostrý" },
                    { id: "Citrus", label: "Citrus" },
                    { id: "ChefHat", label: "Jídlo" },
                    { id: "Sparkles", label: "Speciál" },
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
    </div>
  );
};
