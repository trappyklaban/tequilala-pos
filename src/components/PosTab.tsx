import React, { useState } from "react";
import { InventoryItem, Bartender, SaleItem, BarTab } from "../types";
import { LucideIcon } from "./LucideIcon";

interface PosTabProps {
  items: InventoryItem[];
  bartenders: Bartender[];
  onCompleteSale: (
    cart: SaleItem[],
    bartenderId: string,
    discountPercentage: number,
    completedTabId?: string,
    paymentMethod?: "cash" | "card",
    isEmployeeDiscount?: boolean
  ) => { success: boolean; error?: string };
  barTabs: BarTab[];
  onSaveTabs: (tabs: BarTab[]) => void;
  forceBartenderId?: string;
  isOpen?: boolean;
  onToggleRegister?: () => void;
}

export const PosTab: React.FC<PosTabProps> = ({
  items,
  bartenders,
  onCompleteSale,
  barTabs,
  onSaveTabs,
  forceBartenderId,
  isOpen = true,
  onToggleRegister,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedBartenderId, setSelectedBartenderId] = useState<string>(
    forceBartenderId || bartenders.find(b => b.status === "active")?.id || ""
  );

  React.useEffect(() => {
    if (forceBartenderId) {
      setSelectedBartenderId(forceBartenderId);
    }
  }, [forceBartenderId]);
  
  // Cart state
  const [cart, setCart] = useState<{ item: InventoryItem; quantity: number }[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  
  // Bar Tabs & Discount state
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [deleteConfirmTabId, setDeleteConfirmTabId] = useState<string | null>(null);
  const [newTabName, setNewTabName] = useState("");
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [isEmployeeDiscount, setIsEmployeeDiscount] = useState<boolean>(false);

  // Notification state
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Filter sellable items (only crafted drinks, food, soft, other, hookah, tobacco or items with sellPrice > 0)
  const sellableItems = items.filter(
    (item) => (item.type === "crafted" || item.category === "food" || item.category === "soft" || item.category === "other" || item.category === "hookah" || item.category === "tobacco") && item.sellPrice > 0
  );

  const filteredItems = sellableItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesCategory = false;
    if (selectedCategory === "all") {
      matchesCategory = true;
    } else if (selectedCategory === "beer") {
      matchesCategory = item.category === "beer" || (item.category === "drink" && item.id.includes("beer"));
    } else if (selectedCategory === "shot") {
      matchesCategory = item.category === "shot" || item.id.includes("shot") || item.id.includes("b52");
    } else if (selectedCategory === "food") {
      matchesCategory = item.category === "food";
    } else if (selectedCategory === "soft") {
      matchesCategory = item.category === "soft";
    } else if (selectedCategory === "hookah") {
      matchesCategory = item.category === "hookah";
    } else if (selectedCategory === "tobacco") {
      matchesCategory = item.category === "tobacco";
    } else if (selectedCategory === "other") {
      matchesCategory = item.category === "other";
    } else if (selectedCategory === "mixed") {
      matchesCategory = 
        (item.category === "drink" || 
        (item.category !== "beer" && item.category !== "shot" && !item.id.includes("shot") && !item.id.includes("beer") && !item.id.includes("b52"))) &&
        item.category !== "food" &&
        item.category !== "soft" &&
        item.category !== "hookah" &&
        item.category !== "tobacco" &&
        item.category !== "other";
    }
    
    return matchesSearch && matchesCategory;
  });

  const activeBartender = bartenders.find((b) => b.id === selectedBartenderId);

  const handleAddToCart = (item: InventoryItem) => {
    if (!isOpen) {
      triggerAlert("error", "Nelze prodávat! Pokladna je zavřená.");
      return;
    }

    if (item.stock <= 0) {
      triggerAlert("error", `Surovina/Nápoj "${item.name}" je vyprodaný!`);
      return;
    }

    const existingIndex = cart.findIndex((cartItem) => cartItem.item.id === item.id);
    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty >= item.stock) {
        triggerAlert("error", `Nelze přidat více! Maximální skladová zásoba "${item.name}" je ${item.stock} ks.`);
        return;
      }
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += 1;
      setCart(updatedCart);
    } else {
      setCart([...cart, { item, quantity: 1 }]);
    }
  };

  const handleUpdateQuantity = (itemId: string, amount: number) => {
    const existingIndex = cart.findIndex((cartItem) => cartItem.item.id === itemId);
    if (existingIndex === -1) return;

    const updatedCart = [...cart];
    const newQty = updatedCart[existingIndex].quantity + amount;
    const maxStock = updatedCart[existingIndex].item.stock;

    if (newQty <= 0) {
      updatedCart.splice(existingIndex, 1);
    } else if (newQty > maxStock) {
      triggerAlert("error", `Nelze navýšit! Skladem je pouze ${maxStock} ks.`);
      return;
    } else {
      updatedCart[existingIndex].quantity = newQty;
    }
    setCart(updatedCart);
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart(cart.filter((c) => c.item.id !== itemId));
  };

  const triggerAlert = (type: "success" | "error", message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      triggerAlert("error", "Košík je prázdný!");
      return;
    }
    if (!selectedBartenderId) {
      triggerAlert("error", "Vyberte barmana, který provádí prodej!");
      return;
    }

    // Map cart items to the sale layout
    const saleItems: SaleItem[] = cart.map((c) => ({
      itemId: c.item.id,
      name: c.item.name,
      quantity: c.quantity,
      price: c.item.sellPrice,
    }));

    const result = onCompleteSale(
      saleItems,
      selectedBartenderId,
      discountPercentage,
      activeTabId || undefined,
      paymentMethod,
      isEmployeeDiscount
    );
    if (result.success) {
      triggerAlert(
        "success",
        isEmployeeDiscount
          ? `Účtenka byla zaplacena se zaměstnaneckou slevou 10% (${paymentMethod === "cash" ? "Hotově" : "Kartou"}) bez provize!`
          : `Účtenka byla úspěšně zaplacena (${paymentMethod === "cash" ? "Hotově" : "Kartou"}) a provize připsána!`
      );
      setCart([]);
      setDiscountPercentage(0);
      setIsEmployeeDiscount(false);
      setPaymentMethod("cash"); // reset payment method to cash after checkout
      
      // Clear active tab locally since it's already deleted atomically on the server/state
      if (activeTabId) {
        setActiveTabId(null);
      }
    } else {
      triggerAlert("error", result.error || "Při prodeji nastala chyba!");
    }
  };

  const getCartTotal = () => {
    return cart.reduce((total, c) => total + c.item.sellPrice * c.quantity, 0);
  };

  const getCommissionEstimate = () => {
    if (!activeBartender || isEmployeeDiscount) return 0;
    const total = getCartTotal();
    const discountAmount = (total * discountPercentage) / 100;
    const discountedTotal = Math.max(0, total - discountAmount);
    return (discountedTotal * activeBartender.commissionRate) / 100;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-1">
      {/* Alert Banner */}
      {alert && (
        <div
          className={`col-span-full flex items-center gap-3 p-4 rounded-xl border animate-fade-in ${
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

      {/* Main Grid: Item Selection (2 cols on large screen) */}
      <div className="lg:col-span-2 space-y-6">
        {/* Search, Filter & Bartender Panel */}
        <div className="bg-tequila-card/80 border border-tequila-border p-5 rounded-lg space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-sm font-mono font-bold text-tequila-orange uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-tequila-orange animate-pulse"></span>
              Point of Sale / Menu Výběr
            </h2>

            {/* Bartender Selector */}
            <div className="flex items-center gap-3 bg-zinc-950 border border-tequila-border px-3 py-1.5 rounded-md">
              <LucideIcon name="Users" className="w-4 h-4 text-tequila-yellow" />
              <div className="flex-1">
                <label className="block text-[9px] text-zinc-500 font-mono font-bold uppercase tracking-wider">
                  Obsluhující barman
                </label>
                <select
                  disabled={!!forceBartenderId}
                  value={selectedBartenderId}
                  onChange={(e) => setSelectedBartenderId(e.target.value)}
                  className="bg-transparent text-xs text-gray-200 font-mono font-semibold focus:outline-none cursor-pointer pr-1 disabled:cursor-not-allowed disabled:text-zinc-400"
                >
                  <option value="" disabled className="bg-tequila-card">
                    Vyberte barmana...
                  </option>
                  {bartenders
                    .filter((b) => b.status === "active" || b.id === selectedBartenderId)
                    .map((b) => (
                      <option key={b.id} value={b.id} className="bg-tequila-card">
                        {b.name} ({b.commissionRate}%) {b.status === "inactive" ? "(Neaktivní)" : ""}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Vyhledat drink..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-tequila-border px-4 py-2 pl-10 rounded-md text-xs font-mono focus:outline-none focus:border-tequila-orange transition-colors text-white placeholder-zinc-600"
              />
              <span className="absolute left-3.5 top-2.5 text-zinc-500 text-xs">🔍</span>
            </div>

            {/* Quick Filters */}
            <div className="flex gap-1 bg-zinc-950 border border-tequila-border p-1 rounded-md overflow-x-auto">
              {[
                { id: "all", label: "Vše" },
                { id: "shot", label: "Shoty" },
                { id: "mixed", label: "Míchané" },
                { id: "beer", label: "Piva" },
                { id: "food", label: "Jídlo" },
                { id: "soft", label: "Nealko" },
                { id: "hookah", label: "💨 Dýmky" },
                { id: "tobacco", label: "🚬 Tabák" },
                { id: "other", label: "Ostatní" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? "bg-tequila-orange text-black font-black"
                      : "text-zinc-500 hover:text-white hover:bg-zinc-900"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* BAR TABS / OTEVŘENÉ ÚČTY SECTION */}
          <div className="border-t border-tequila-border/30 pt-4 space-y-3 font-mono">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-[10px] font-bold text-tequila-yellow uppercase tracking-widest flex items-center gap-1.5">
                <LucideIcon name="CreditCard" className="w-3.5 h-3.5" />
                Otevřené barové účty (Tabs)
              </h3>
              
              {/* Form to open a new tab */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newTabName.trim()) return;
                  // Create a new bar tab
                  const newTab: BarTab = {
                    id: `tab_${Date.now()}`,
                    name: newTabName.trim(),
                    items: cart.map(c => ({
                      itemId: c.item.id,
                      name: c.item.name,
                      quantity: c.quantity,
                      price: c.item.sellPrice,
                    })),
                    createdAt: new Date().toISOString()
                  };
                  onSaveTabs([...barTabs, newTab]);
                  setActiveTabId(newTab.id);
                  setNewTabName("");
                  triggerAlert("success", `Účet "${newTab.name}" byl otevřen s aktuálním košíkem!`);
                }}
                className="flex gap-1.5 items-center w-full sm:w-auto"
              >
                <input
                  type="text"
                  placeholder="Název účtu / Stůl..."
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
                  className="bg-zinc-950 border border-tequila-border px-2.5 py-1 rounded text-[10px] text-white focus:outline-none focus:border-tequila-yellow w-full sm:w-40"
                />
                <button
                  type="submit"
                  disabled={!newTabName.trim()}
                  className="bg-tequila-yellow text-black hover:bg-tequila-orange disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800 disabled:cursor-not-allowed border border-transparent px-3 py-1 rounded text-[10px] font-bold uppercase whitespace-nowrap cursor-pointer transition-colors"
                >
                  Otevřít
                </button>
              </form>
            </div>

            {/* List of open tabs */}
            {barTabs.length === 0 ? (
              <p className="text-[10px] text-zinc-600 italic">Není otevřený žádný barový účet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {barTabs.map((tab) => {
                  const tabTotal = tab.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
                  const isCurrent = activeTabId === tab.id;
                  return (
                    <div
                      key={tab.id}
                      className={`flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded text-[10px] border transition-all ${
                        isCurrent
                          ? "bg-tequila-orange/15 border-tequila-orange text-tequila-orange font-bold shadow shadow-tequila-orange/10"
                          : "bg-zinc-950 border-tequila-border text-zinc-400 hover:text-white"
                      }`}
                    >
                      <button
                        onClick={() => {
                          // Load this tab into cart
                          setActiveTabId(tab.id);
                          // We need to map SaleItem back to Cart item layout
                          const loadedCart = tab.items.map(tabItem => {
                            const foundItem = items.find(i => i.id === tabItem.itemId);
                            const finalItem: InventoryItem = foundItem || {
                              id: tabItem.itemId,
                              name: tabItem.name,
                              type: "crafted",
                              stock: 999,
                              minStock: 0,
                              purchasePrice: 0,
                              sellPrice: tabItem.price,
                              iconName: tabItem.itemId.startsWith("custom_") ? "Sparkles" : "GlassWater",
                              category: "drink",
                            };
                            return { item: finalItem, quantity: tabItem.quantity };
                          });
                          setCart(loadedCart);
                          triggerAlert("success", `Načten účet: ${tab.name}`);
                        }}
                        className="font-bold text-left cursor-pointer uppercase tracking-wider"
                      >
                        {tab.name} (${tabTotal.toFixed(2)})
                      </button>
                      {deleteConfirmTabId === tab.id ? (
                        <div className="flex items-center gap-1 bg-rose-950/20 border border-rose-500/25 px-1 py-0.5 rounded">
                          <button
                            onClick={() => {
                              onSaveTabs(barTabs.filter(t => t.id !== tab.id));
                              if (activeTabId === tab.id) {
                                setActiveTabId(null);
                                setCart([]);
                              }
                              triggerAlert("success", `Účet "${tab.name}" byl smazán.`);
                              setDeleteConfirmTabId(null);
                            }}
                            className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider cursor-pointer"
                          >
                            Smazat
                          </button>
                          <button
                            onClick={() => setDeleteConfirmTabId(null)}
                            className="text-zinc-400 hover:text-white p-0.5 cursor-pointer"
                            title="Zrušit"
                          >
                            <LucideIcon name="X" className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmTabId(tab.id)}
                          className="text-zinc-500 hover:text-rose-500 p-0.5 rounded cursor-pointer transition-colors"
                          title="Zrušit účet"
                        >
                          <LucideIcon name="X" className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Closed Register Banner */}
        {!isOpen && (
          <div className="bg-rose-950/25 border border-rose-500/30 rounded-xl p-5 text-center space-y-3 font-mono animate-fade-in col-span-full mb-2">
            <LucideIcon name="Lock" className="w-8 h-8 mx-auto text-rose-500 animate-bounce" />
            <div>
              <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wider">Pokladna je zavřená!</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto leading-relaxed">
                Před zahájením prodeje a připisováním tržeb/provizí musíte nejprve otevřít pokladnu.
              </p>
            </div>
            {onToggleRegister && (
              <button
                onClick={onToggleRegister}
                className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs uppercase tracking-widest rounded-lg cursor-pointer shadow-lg shadow-rose-500/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                🔓 OTEVŘÍT POKLADNU & SMĚNU
              </button>
            )}
          </div>
        )}

        {/* Product Grid */}
        {filteredItems.length === 0 ? (
          <div className="bg-tequila-card/30 border border-tequila-border border-dashed rounded-lg p-12 text-center text-gray-500">
            <LucideIcon name="AlertTriangle" className="w-10 h-10 mx-auto text-gray-600 mb-3" />
            <p className="font-mono text-xs uppercase tracking-wide">Žádné drinky neodpovídají vyhledávání.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {filteredItems.map((item) => {
              const isLowStock = item.stock <= item.minStock && item.stock > 0;
              const isOut = item.stock === 0;

              return (
                <button
                  key={item.id}
                  disabled={isOut}
                  onClick={() => handleAddToCart(item)}
                  className={`group relative flex flex-col text-left bg-zinc-900 border p-3 rounded-lg transition-all duration-300 ${
                    isOut
                      ? "opacity-45 border-tequila-border cursor-not-allowed bg-zinc-950/20"
                      : "border-tequila-border hover:border-tequila-orange hover:bg-zinc-850/80 active:scale-[0.98] cursor-pointer"
                  }`}
                >
                  {/* Inner Icon Box */}
                  <div className={`h-11 bg-zinc-950 rounded mb-2 flex items-center justify-center transition-all ${
                    isOut ? "text-zinc-700" : "text-zinc-500 group-hover:text-tequila-orange group-hover:bg-tequila-orange/5"
                  }`}>
                    <LucideIcon name={item.iconName} className="w-5 h-5" />
                  </div>

                  {/* Name */}
                  <h3 className="text-[11px] font-bold text-gray-200 group-hover:text-white transition-colors line-clamp-1 uppercase tracking-tight">
                    {item.name}
                  </h3>

                  {/* Price and Stock Row */}
                  <div className="mt-2 flex items-center justify-between w-full">
                    <span className="font-mono text-xs font-bold text-tequila-orange group-hover:text-tequila-yellow transition-colors">
                      ${item.sellPrice.toFixed(2)}
                    </span>
                    <span
                      className={`text-[8px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                        isOut
                          ? "bg-zinc-950 text-zinc-600"
                          : isLowStock
                          ? "bg-rose-950/40 text-rose-400 border border-rose-500/10 animate-pulse"
                          : "bg-zinc-950 text-zinc-400"
                      }`}
                    >
                      {isOut ? "OUT" : `${Math.floor(item.stock)}ks`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sidebar: Bill / Receipt Cart (1 col) */}
      <div className="lg:col-span-1">
        <div className="bg-tequila-card border border-tequila-border rounded-lg flex flex-col h-full overflow-hidden sticky top-6">
          {/* Header */}
          <div className="bg-zinc-950 border-b border-tequila-border p-4 flex items-center justify-between">
            <h3 className="font-mono font-bold text-gray-200 uppercase tracking-wider text-xs flex items-center gap-2">
              <LucideIcon name="ShoppingBag" className="w-4 h-4 text-tequila-orange" />
              Aktuální Košík
            </h3>
            <span className="text-[10px] bg-tequila-orange/15 border border-tequila-orange/30 text-tequila-orange font-mono font-bold px-2 py-0.5 rounded">
              {cart.reduce((s, c) => s + c.quantity, 0)} položek
            </span>
          </div>

          {/* If there is an active tab, show a premium tab bar on top of the list */}
          {activeTabId && (
            <div className="bg-zinc-950/80 border-b border-tequila-border/50 p-3.5 space-y-2.5 font-mono">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-tequila-yellow uppercase tracking-wider font-extrabold flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-tequila-yellow"></span>
                  Aktivní Účet: {barTabs.find(t => t.id === activeTabId)?.name || "Neznámý"}
                </span>
                <button
                  onClick={() => {
                    setActiveTabId(null);
                    setCart([]);
                    triggerAlert("success", "Účet byl odhlášen (košík vyprázdněn)");
                  }}
                  className="text-zinc-500 hover:text-white underline text-[9px] cursor-pointer"
                >
                  Odhlásit účet
                </button>
              </div>
              
              <button
                onClick={() => {
                  // Update current tab with cart items
                  const updatedTabs = barTabs.map(tab => {
                    if (tab.id === activeTabId) {
                      return {
                        ...tab,
                        items: cart.map(c => ({
                          itemId: c.item.id,
                          name: c.item.name,
                          quantity: c.quantity,
                          price: c.item.sellPrice
                        }))
                      };
                    }
                    return tab;
                  });
                  onSaveTabs(updatedTabs);
                  triggerAlert("success", "Změny byly uloženy na účet!");
                  // Clear cart and active tab after saving
                  setActiveTabId(null);
                  setCart([]);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 bg-zinc-900 hover:bg-zinc-850 hover:text-white text-tequila-yellow border border-tequila-border rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                <LucideIcon name="Save" className="w-3.5 h-3.5" />
                Uložit změny na účet
              </button>
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 p-4 overflow-y-auto max-h-[380px] lg:max-h-[none] divide-y divide-tequila-border/40">
            {cart.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 space-y-2">
                <p className="text-xl">📥</p>
                <p className="text-xs font-mono uppercase tracking-wider">Košík je prázdný</p>
                <p className="text-[10px] text-zinc-600 font-mono">Kliknutím na nápoj v menu jej přidáte do objednávky.</p>
              </div>
            ) : (
              cart.map(({ item, quantity }) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between gap-2 font-mono">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-gray-200 truncate uppercase">{item.name}</h4>
                    <span className="text-[10px] text-tequila-orange font-bold">
                      ${item.sellPrice.toFixed(2)} <span className="text-zinc-600">/ ks</span>
                    </span>
                  </div>

                  {/* Quantity Actions */}
                  <div className="flex items-center gap-2 bg-zinc-950 px-2 py-1 rounded border border-tequila-border">
                    <button
                      onClick={() => handleUpdateQuantity(item.id, -1)}
                      className="text-zinc-500 hover:text-white p-0.5 active:scale-95 cursor-pointer"
                    >
                      <LucideIcon name="Minus" className="w-3 h-3" />
                    </button>
                    <span className="font-mono text-[11px] font-bold text-gray-300 min-w-[16px] text-center">
                      {quantity}
                    </span>
                    <button
                      onClick={() => handleUpdateQuantity(item.id, 1)}
                      className="text-zinc-500 hover:text-white p-0.5 active:scale-95 cursor-pointer"
                    >
                      <LucideIcon name="Plus" className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Delete Item */}
                  <button
                    onClick={() => handleRemoveFromCart(item.id)}
                    className="p-1 text-zinc-500 hover:text-rose-500 hover:bg-rose-950/20 rounded transition-colors cursor-pointer"
                  >
                    <LucideIcon name="Trash2" className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Pricing & Checkout Summary */}
          <div className="bg-zinc-950 border-t border-tequila-border p-4 space-y-4">
            {/* DISCOUNT CONTROL SECTION */}
            <div className="border-b border-tequila-border/40 pb-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-[9px] text-zinc-500 font-mono font-bold uppercase tracking-wider">
                  Sleva / Zaměstnanecká
                </label>
                {isEmployeeDiscount && (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-500/40 text-purple-300 flex items-center gap-1">
                    <LucideIcon name="UserCheck" className="w-3 h-3 text-purple-400" />
                    Zaměstnanecká (Bez provize)
                  </span>
                )}
              </div>

              {/* Employee Discount Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  if (isEmployeeDiscount) {
                    setIsEmployeeDiscount(false);
                    setDiscountPercentage(0);
                  } else {
                    setIsEmployeeDiscount(true);
                    setDiscountPercentage(10);
                  }
                }}
                className={`w-full py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border flex items-center justify-between gap-2 ${
                  isEmployeeDiscount
                    ? "bg-purple-950/60 border-purple-500/80 text-purple-200 shadow-sm"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded ${isEmployeeDiscount ? "bg-purple-500 text-black font-bold" : "bg-zinc-800 text-zinc-400"}`}>
                    <LucideIcon name="UserCheck" className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left">
                    <span className="block font-bold text-xs">Zaměstnanecká sleva (10%)</span>
                    <span className="block text-[9px] text-zinc-400 font-normal">Stornuje provizi barmana na 0 Kč</span>
                  </div>
                </div>
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isEmployeeDiscount ? "bg-purple-500 border-purple-400 text-black font-extrabold" : "border-zinc-700 bg-zinc-950"}`}>
                  {isEmployeeDiscount && <LucideIcon name="Check" className="w-3 h-3 stroke-[3]" />}
                </div>
              </button>

              {/* Standard Percentage Presets */}
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[0, 5, 10, 15, 20, 50].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        setDiscountPercentage(pct);
                        if (pct !== 10) {
                          setIsEmployeeDiscount(false);
                        }
                      }}
                      className={`flex-1 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer border ${
                        discountPercentage === pct && !isEmployeeDiscount
                          ? "bg-tequila-orange border-tequila-orange text-black font-extrabold"
                          : discountPercentage === pct && isEmployeeDiscount
                          ? "bg-purple-900/80 border-purple-500 text-purple-200 font-extrabold"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded">
                  <span className="text-[10px] text-zinc-500 font-mono uppercase font-bold shrink-0">Vlastní %:</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercentage === 0 ? "" : discountPercentage}
                    onChange={(e) => {
                      const val = e.target.value === "" ? 0 : Math.min(100, Math.max(0, Number(e.target.value)));
                      setDiscountPercentage(val);
                      if (val !== 10) setIsEmployeeDiscount(false);
                    }}
                    className="w-full bg-transparent text-xs text-white font-mono focus:outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* PAYMENT METHOD SECTION */}
            <div className="border-b border-tequila-border/40 pb-3 space-y-2">
              <label className="block text-[9px] text-zinc-500 font-mono font-bold uppercase tracking-wider">
                Způsob Platby
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash")}
                  className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border flex items-center justify-center gap-1.5 ${
                    paymentMethod === "cash"
                      ? "bg-tequila-yellow/20 border-tequila-yellow text-tequila-yellow font-extrabold"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850"
                  }`}
                >
                  <LucideIcon name="Coins" className="w-4 h-4" />
                  Hotově
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border flex items-center justify-center gap-1.5 ${
                    paymentMethod === "card"
                      ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-400 font-extrabold"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850"
                  }`}
                >
                  <LucideIcon name="CreditCard" className="w-4 h-4" />
                  Kartou / Fak.
                </button>
              </div>
            </div>

            {/* Calculations breakdown */}
            {(() => {
              const total = getCartTotal();
              const discountAmt = (total * discountPercentage) / 100;
              const grandTotal = Math.max(0, total - discountAmt);
              const commissionEstimate = getCommissionEstimate();

              return (
                <div className="space-y-1.5 text-[11px] font-mono">
                  <div className="flex justify-between text-zinc-500">
                    <span>Mezisoučet</span>
                    <span className="font-bold text-zinc-350">${total.toFixed(2)}</span>
                  </div>
                  
                  {discountPercentage > 0 && (
                    <div className="flex justify-between text-rose-450 font-bold">
                      <span>Sleva ({discountPercentage}%{isEmployeeDiscount ? " Zaměst." : ""})</span>
                      <span>-${discountAmt.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {activeBartender && (
                    <div className={`flex justify-between ${isEmployeeDiscount ? "text-rose-400" : "text-tequila-yellow"}`}>
                      <span>
                        Provize ({isEmployeeDiscount ? "0% - Zaměst. sleva" : `${activeBartender.commissionRate}%`})
                      </span>
                      <span className={`font-bold ${isEmployeeDiscount ? "line-through opacity-70" : ""}`}>
                        +${commissionEstimate.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-[10px] text-zinc-500 italic">
                    <span>Tok peněz:</span>
                    <span className={paymentMethod === "cash" ? "text-tequila-yellow" : "text-emerald-450"}>
                      {paymentMethod === "cash" ? "→ Připsat do Kasy (Hotovost)" : "→ Karta / Faktura (Banka)"}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-tequila-border/50 flex justify-between items-baseline text-gray-100">
                    <span className="font-bold uppercase tracking-wider text-xs text-zinc-400">Celkem</span>
                    <span className="font-mono text-xl font-bold text-tequila-orange">
                      ${grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Bartender notice info */}
            {activeBartender ? (
              <div className={`border p-3 rounded flex items-center gap-2.5 ${isEmployeeDiscount ? "bg-purple-950/30 border-purple-500/40 text-purple-200" : "bg-tequila-card border-tequila-border"}`}>
                <div className={`p-1 rounded shrink-0 ${isEmployeeDiscount ? "bg-purple-500/20 text-purple-300" : "bg-tequila-yellow/10 text-tequila-yellow"}`}>
                  <LucideIcon name={isEmployeeDiscount ? "UserCheck" : "Coins"} className="w-3.5 h-3.5" />
                </div>
                <div className="text-[10px] leading-snug font-mono">
                  <p className="text-zinc-500 uppercase tracking-tight">Provize pro barmana:</p>
                  {isEmployeeDiscount ? (
                    <p className="font-bold text-purple-300">
                      {activeBartender.name}: <span className="text-rose-400 font-bold">$0.00 (Zaměstnanecká sleva – bez provize)</span>
                    </p>
                  ) : (
                    <p className="font-bold text-gray-300">
                      {activeBartender.name} obdrží{" "}
                      <span className="text-tequila-yellow font-bold">
                        ${getCommissionEstimate().toFixed(2)}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-rose-950/20 border border-rose-500/20 p-3 rounded text-[10px] font-mono text-rose-400 uppercase tracking-wide">
                ⚠️ Není vybrán aktivní barman!
              </div>
            )}

            {/* Pay buttons */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || !selectedBartenderId || !isOpen}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded font-mono font-bold text-xs uppercase tracking-widest shadow transition-all cursor-pointer ${
                cart.length === 0 || !selectedBartenderId || !isOpen
                  ? "bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed shadow-none"
                  : "bg-tequila-orange hover:bg-tequila-yellow text-black font-black"
              }`}
            >
              <LucideIcon name={isOpen ? "DollarSign" : "Lock"} className="w-4 h-4" />
              {isOpen ? "ZAPLATIT ÚČTENKU" : "POKLADNA JE ZAVŘENÁ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
