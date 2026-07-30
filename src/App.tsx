import React, { useState, useEffect } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";
import {
  BusinessState,
  InventoryItem,
  Recipe,
  Bartender,
  SaleLog,
  PurchaseLog,
  PayoutLog,
  SaleItem,
  PurchaseItem,
  BarTab,
  ShiftLog,
} from "./types";
import {
  INITIAL_ITEMS,
  INITIAL_RECIPES,
  INITIAL_BARTENDERS,
} from "./data/initialData";
import { PosTab } from "./components/PosTab";
import { CraftingTab } from "./components/CraftingTab";
import { InventoryTab } from "./components/InventoryTab";
import { ManagementTab } from "./components/ManagementTab";
import { PinLoginScreen } from "./components/PinLoginScreen";
import { ShiftTab } from "./components/ShiftTab";
import { LucideIcon } from "./components/LucideIcon";

const LOCAL_STORAGE_KEY = "tequilala_bar_state";

export default function App() {
  const [state, setState] = useState<BusinessState>({
    items: [],
    recipes: [],
    bartenders: [],
    sales: [],
    purchases: [],
    payouts: [],
    registerBalance: 15000, // Starting register cash balance in $
    barTabs: [],
  });

  const [activeTab, setActiveTab] = useState<"pos" | "craft" | "inventory" | "management" | "shift">("pos");
  const [session, setSession] = useState<{ role: "manager" | "barman"; bartenderId?: string } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [shiftStartTime, setShiftStartTime] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [shiftSummary, setShiftSummary] = useState<{
    bartenderName: string;
    startTime: string;
    endTime: string;
    salesCount: number;
    salesTotal: number;
    commissionEarned: number;
    cashSalesTotal?: number;
    cardSalesTotal?: number;
  } | null>(null);
  
  // Register deposit/withdraw modal/popover states
  const [showRegModal, setShowRegModal] = useState(false);
  const [regAmount, setRegAmount] = useState<number | "">("");
  const [regType, setRegType] = useState<"deposit" | "withdraw">("deposit");

  // Load from local storage on mount AND subscribe to real-time Firestore updates
  useEffect(() => {
    // 1. Instantly load local cache for zero-latency initial render
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.items && parsed.recipes && parsed.bartenders) {
          const cleanedBartenders = (parsed.bartenders || []).map((b: any) => {
            if (b.id === "bart_majitel") {
              return { ...b, status: "active" as const };
            }
            return b;
          });
          setState({
            ...parsed,
            bartenders: cleanedBartenders,
            recipes: parsed.recipes,
            barTabs: parsed.barTabs || [],
          });
        }
      } catch (e) {
        console.error("Failed to load local state", e);
      }
    } else {
      // Fallback to default seeded state if no local cache exists
      setState({
        items: INITIAL_ITEMS,
        recipes: INITIAL_RECIPES,
        bartenders: INITIAL_BARTENDERS,
        sales: [],
        purchases: [],
        payouts: [],
        registerBalance: 10000,
        barTabs: [],
        shifts: [],
      });
    }

    // 2. Subscribe to Firebase Firestore for cloud state persistence
    const docRef = doc(db, "company", "state");
    const unsubscribe = onSnapshot(docRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as BusinessState;
        
        let needsSave = false;
        const cleanedBartenders = (data.bartenders || []).map((b) => {
          if (b.id === "bart_majitel" && b.status !== "active") {
            needsSave = true;
            return { ...b, status: "active" as const };
          }
          return b;
        });

        setState({
          items: data.items || [],
          recipes: data.recipes || [],
          bartenders: cleanedBartenders,
          sales: data.sales || [],
          purchases: data.purchases || [],
          payouts: data.payouts || [],
          registerBalance: data.registerBalance ?? 0,
          barTabs: data.barTabs || [],
          shifts: data.shifts || [],
        });

        const updatedData = {
          ...data,
          bartenders: cleanedBartenders,
        };

        // Keep local cache in sync
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedData));

        if (needsSave) {
          try {
            await setDoc(docRef, updatedData);
          } catch (err) {
            console.error("Failed to save self-healed state to Firestore:", err);
          }
        }
      } else {
        // Seeding database on very first launch (fresh start)
        const defaultState: BusinessState = {
          items: INITIAL_ITEMS.map((item) => ({ ...item, stock: 0 })),
          recipes: INITIAL_RECIPES,
          bartenders: INITIAL_BARTENDERS,
          sales: [],
          purchases: [],
          payouts: [],
          registerBalance: 0,
          barTabs: [],
          shifts: [],
        };
        try {
          await setDoc(docRef, defaultState);
        } catch (err) {
          console.error("Failed to seed initial Firestore state:", err);
          handleFirestoreError(err, OperationType.WRITE, "company/state");
        }
      }
    }, (error) => {
      console.error("Firestore state sync error:", error);
      handleFirestoreError(error, OperationType.GET, "company/state");
    });

    const savedSession = localStorage.getItem("tequilala_terminal_session");
    if (savedSession) {
      try {
        setSession(JSON.parse(savedSession));
      } catch (e) {
        console.error("Failed to load session", e);
      }
    }

    const savedRegisterOpen = localStorage.getItem("tequilala_register_open");
    if (savedRegisterOpen !== null) {
      setIsOpen(savedRegisterOpen === "true");
    } else {
      setIsOpen(false);
    }

    const savedShiftStart = localStorage.getItem("tequilala_shift_start_time");
    if (savedShiftStart) {
      setShiftStartTime(savedShiftStart);
    }

    return () => unsubscribe();
  }, []);

  // Save to local storage and Firestore on changes
  const saveState = async (newState: BusinessState) => {
    setState(newState);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
    try {
      await setDoc(doc(db, "company", "state"), newState);
    } catch (error) {
      console.error("Failed to save state to Firestore:", error);
      handleFirestoreError(error, OperationType.WRITE, "company/state");
    }
  };

  // Auto-close shifts if inactive for 6+ hours or exceeding 12 hours total duration
  useEffect(() => {
    const checkAutoClose = () => {
      if (!isOpen || !shiftStartTime || !session || !session.bartenderId) return;

      const now = new Date();
      const startTimeDate = new Date(shiftStartTime);
      const shiftSales = state.sales.filter(
        (s) => s.bartenderId === session.bartenderId && s.timestamp >= shiftStartTime
      );

      let lastActivityTime = startTimeDate.getTime();
      if (shiftSales.length > 0) {
        const timestamps = shiftSales.map((s) => new Date(s.timestamp).getTime());
        lastActivityTime = Math.max(...timestamps);
      }

      const inactivityMs = now.getTime() - lastActivityTime;
      const totalDurationMs = now.getTime() - startTimeDate.getTime();

      const INACTIVITY_LIMIT_MS = 6 * 60 * 60 * 1000; // 6 hours inactivity
      const DURATION_LIMIT_MS = 12 * 60 * 60 * 1000; // 12 hours total shift cap

      if (inactivityMs >= INACTIVITY_LIMIT_MS || totalDurationMs >= DURATION_LIMIT_MS) {
        let calculatedEndTimeMs = shiftSales.length > 0 ? lastActivityTime + 15 * 60 * 1000 : startTimeDate.getTime() + 30 * 60 * 1000;
        if (calculatedEndTimeMs > now.getTime()) {
          calculatedEndTimeMs = now.getTime();
        }
        const endTimeStr = new Date(calculatedEndTimeMs).toISOString();

        const bartenderId = session.bartenderId;
        const bartender = state.bartenders.find((b) => b.id === bartenderId);
        const bName = bartender?.name || (session.role === "manager" ? "Manažer" : "Barman");

        const salesCount = shiftSales.length;
        const salesTotal = shiftSales.reduce((sum, s) => sum + s.totalAmount, 0);
        const cashSalesTotal = shiftSales
          .filter((s) => !s.paymentMethod || s.paymentMethod === "cash")
          .reduce((sum, s) => sum + s.totalAmount, 0);
        const cardSalesTotal = shiftSales
          .filter((s) => s.paymentMethod === "card")
          .reduce((sum, s) => sum + s.totalAmount, 0);
        const commissionEarned = shiftSales.reduce((sum, s) => sum + s.commissionPaid, 0);

        const newShiftLog = {
          id: `shift_${Date.now()}`,
          bartenderId,
          bartenderName: bName,
          startTime: shiftStartTime,
          endTime: endTimeStr,
          salesCount,
          salesTotal,
          commissionEarned,
          cashSalesTotal,
          cardSalesTotal,
          autoClosed: true,
          sales: shiftSales,
        };

        const updatedBartenders = state.bartenders.map((b) => {
          if (b.id === bartenderId) {
            return { ...b, onShift: false };
          }
          return b;
        });

        saveState({
          ...state,
          bartenders: updatedBartenders,
          shifts: [...(state.shifts || []), newShiftLog],
        });

        localStorage.removeItem("tequilala_shift_start_time");
        setShiftStartTime(null);
        setIsOpen(false);
        localStorage.setItem("tequilala_register_open", "false");

        setShiftSummary({
          bartenderName: bName,
          startTime: shiftStartTime,
          endTime: endTimeStr,
          salesCount,
          salesTotal,
          commissionEarned,
          cashSalesTotal,
          cardSalesTotal,
        });
      }
    };

    checkAutoClose();
    const interval = setInterval(checkAutoClose, 60000);
    return () => clearInterval(interval);
  }, [isOpen, shiftStartTime, session, state.sales, state.bartenders, state.shifts]);

  const handleLoginSuccess = (role: "manager" | "barman", bartenderId?: string) => {
    const finalBartenderId = role === "manager" && !bartenderId ? "bart_majitel" : bartenderId;
    const newSession = { role, bartenderId: finalBartenderId };
    setSession(newSession);
    localStorage.setItem("tequilala_terminal_session", JSON.stringify(newSession));
    
    // stav pokladny nastaven automaticky jako zavřeno
    setIsOpen(false);
    localStorage.setItem("tequilala_register_open", "false");
    
    localStorage.removeItem("tequilala_shift_start_time");
    setShiftStartTime(null);
    
    if (finalBartenderId) {
      const updatedBartenders = state.bartenders.map((b) => {
        if (b.id === finalBartenderId) {
          return { ...b, onShift: false };
        }
        return b;
      });
      saveState({
        ...state,
        bartenders: updatedBartenders,
      });
    }

    setActiveTab("pos");
  };

  const handleToggleRegister = () => {
    if (!session || !session.bartenderId) return;

    if (!isOpen) {
      // Opening register
      setIsOpen(true);
      localStorage.setItem("tequilala_register_open", "true");
      
      const nowStr = new Date().toISOString();
      setShiftStartTime(nowStr);
      localStorage.setItem("tequilala_shift_start_time", nowStr);
      
      const updatedBartenders = state.bartenders.map((b) => {
        if (b.id === session.bartenderId) {
          return { ...b, onShift: true };
        }
        return b;
      });
      
      saveState({
        ...state,
        bartenders: updatedBartenders,
      });
    } else {
      // Closing register (Shift ends)
      const bartenderId = session.bartenderId;
      const bartender = state.bartenders.find((b) => b.id === bartenderId);
      const bName = bartender?.name || (session.role === "manager" ? "Manažer" : "Barman");

      const startTime = shiftStartTime || new Date().toISOString();
      const endTime = new Date().toISOString();

      const shiftSales = state.sales.filter(
        (s) => s.bartenderId === bartenderId && s.timestamp >= startTime
      );
      const salesCount = shiftSales.length;
      const salesTotal = shiftSales.reduce((sum, s) => sum + s.totalAmount, 0);
      const cashSalesTotal = shiftSales
        .filter((s) => !s.paymentMethod || s.paymentMethod === "cash")
        .reduce((sum, s) => sum + s.totalAmount, 0);
      const cardSalesTotal = shiftSales
        .filter((s) => s.paymentMethod === "card")
        .reduce((sum, s) => sum + s.totalAmount, 0);
      const commissionEarned = shiftSales.reduce((sum, s) => sum + s.commissionPaid, 0);

      const newShiftLog = {
        id: `shift_${Date.now()}`,
        bartenderId,
        bartenderName: bName,
        startTime,
        endTime,
        salesCount,
        salesTotal,
        commissionEarned,
        cashSalesTotal,
        cardSalesTotal,
        sales: shiftSales,
      };

      const updatedBartenders = state.bartenders.map((b) => {
        if (b.id === bartenderId) {
          return { ...b, onShift: false };
        }
        return b;
      });

      saveState({
        ...state,
        bartenders: updatedBartenders,
        shifts: [...(state.shifts || []), newShiftLog],
      });

      localStorage.removeItem("tequilala_shift_start_time");
      setShiftStartTime(null);

      setIsOpen(false);
      localStorage.setItem("tequilala_register_open", "false");

      setShiftSummary({
        bartenderName: bName,
        startTime,
        endTime,
        salesCount,
        salesTotal,
        commissionEarned,
        cashSalesTotal,
        cardSalesTotal,
      });
    }
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem("tequilala_terminal_session");
  };

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. SALE RESOLVER
  const handleCompleteSale = (
    cart: SaleItem[],
    bartenderId: string,
    discountPercentage: number = 0,
    completedTabId?: string,
    paymentMethod: "cash" | "card" = "cash"
  ): { success: boolean; error?: string } => {
    // Find active bartender
    const bartenderIndex = state.bartenders.findIndex((b) => b.id === bartenderId);
    if (bartenderIndex === -1) {
      return { success: false, error: "Barman nebyl nalezen." };
    }
    const bartender = state.bartenders[bartenderIndex];

    // Double check stocks
    const updatedItems = [...state.items];
    for (const cartItem of cart) {
      const dbItemIndex = updatedItems.findIndex((i) => i.id === cartItem.itemId);
      if (dbItemIndex === -1) {
        // Virtual custom items can pass through since they don't have catalog stock bounds
        if (cartItem.itemId.startsWith("custom_")) continue;
        return { success: false, error: `Položka ${cartItem.name} neexistuje.` };
      }
      const dbItem = updatedItems[dbItemIndex];
      // Virtual custom items don't decrement stock
      if (dbItem.stock < cartItem.quantity && dbItem.id !== "custom") {
        return {
          success: false,
          error: `Nedostatek skladových zásob pro "${cartItem.name}". Skladem: ${dbItem.stock} ks.`,
        };
      }
    }

    // Process stock deduction
    const processedItems = updatedItems.map((item) => {
      const cartMatch = cart.find((c) => c.itemId === item.id);
      if (cartMatch) {
        return {
          ...item,
          stock: Math.max(0, item.stock - cartMatch.quantity),
        };
      }
      return item;
    });

    // Calculate billing with discount
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = (subtotal * discountPercentage) / 100;
    const totalAmount = Math.max(0, subtotal - discountAmount);
    const commissionPaid = (totalAmount * bartender.commissionRate) / 100;

    // Record sale log
    const newSale: SaleLog = {
      id: `sale_${Date.now()}`,
      timestamp: new Date().toISOString(),
      items: cart,
      totalAmount,
      bartenderId,
      bartenderName: bartender.name,
      commissionPaid,
      discountPercentage,
      discountAmount,
      paymentMethod,
    };

    // Credit bartender commission
    const updatedBartenders = state.bartenders.map((b) => {
      if (b.id === bartenderId) {
        return {
          ...b,
          totalCommissionEarned: b.totalCommissionEarned + commissionPaid,
        };
      }
      return b;
    });

    const updatedTabs = completedTabId
      ? (state.barTabs || []).filter((t) => t.id !== completedTabId)
      : (state.barTabs || []);

    const nextState: BusinessState = {
      ...state,
      items: processedItems,
      bartenders: updatedBartenders,
      sales: [...state.sales, newSale],
      registerBalance: state.registerBalance + totalAmount,
      barTabs: updatedTabs,
    };

    saveState(nextState);
    return { success: true };
  };

  // 2. CRAFTING RESOLVER
  const handleCraftSuccess = (recipeId: string, quantity: number) => {
    const recipe = state.recipes.find((r) => r.id === recipeId);
    if (!recipe) return;

    const resultItem = state.items.find((i) => i.id === recipe.resultItemId);
    if (!resultItem) return;

    // Deduct raw ingredients, increment final goods
    const updatedItems = state.items.map((item) => {
      // Is this item required in the recipe?
      const ingredientMatch = recipe.ingredients.find((ing) => ing.itemId === item.id);
      if (ingredientMatch) {
        const totalDeduct = ingredientMatch.quantity * quantity;
        return {
          ...item,
          stock: Math.max(0, item.stock - totalDeduct),
        };
      }
      // Is this item the result of crafting?
      if (item.id === recipe.resultItemId) {
        return {
          ...item,
          stock: item.stock + (quantity * (recipe.yieldAmount ?? 20)),
        };
      }
      return item;
    });

    saveState({
      ...state,
      items: updatedItems,
    });
  };

  // 3. PURCHASE RESOLVER
  const handlePurchaseSupplies = (
    purchaseItems: PurchaseItem[],
    payFromRegister: boolean
  ): { success: boolean; error?: string } => {
    const totalCost = purchaseItems.reduce(
      (sum, item) => sum + item.pricePerUnit * item.quantity,
      0
    );

    if (payFromRegister && state.registerBalance < totalCost) {
      return { success: false, error: "V pokladně není dostatek financí." };
    }

    // Increment stocks of purchased items
    const updatedItems = state.items.map((item) => {
      const match = purchaseItems.find((p) => p.itemId === item.id);
      if (match) {
        return {
          ...item,
          stock: item.stock + match.quantity,
        };
      }
      return item;
    });

    // Log purchase
    const newPurchase: PurchaseLog = {
      id: `purch_${Date.now()}`,
      timestamp: new Date().toISOString(),
      items: purchaseItems,
      totalAmount: totalCost,
    };

    saveState({
      ...state,
      items: updatedItems,
      purchases: [...state.purchases, newPurchase],
      registerBalance: payFromRegister
        ? state.registerBalance - totalCost
        : state.registerBalance,
    });

    return { success: true };
  };

  // 4. MANUAL STOCK ADJUSTMENTS
  const handleUpdateStock = (itemId: string, newStock: number) => {
    const updated = state.items.map((item) => {
      if (item.id === itemId) {
        return { ...item, stock: newStock };
      }
      return item;
    });
    saveState({ ...state, items: updated });
  };

  const handleUpdateItem = (updatedItem: InventoryItem) => {
    const updated = state.items.map((item) => {
      if (item.id === updatedItem.id) {
        return updatedItem;
      }
      return item;
    });
    saveState({ ...state, items: updated });
  };

  // 5. REGISTER DEPOSIT/WITHDRAW ACTION
  const handleRegisterAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (regAmount === "" || regAmount <= 0) return;

    let newBalance = state.registerBalance;
    if (regType === "deposit") {
      newBalance += Number(regAmount);
    } else {
      if (state.registerBalance < Number(regAmount)) {
        alert("Nedostatek peněz v pokladně pro výběr!");
        return;
      }
      newBalance -= Number(regAmount);
    }

    saveState({ ...state, registerBalance: newBalance });
    setShowRegModal(false);
    setRegAmount("");
  };

  // 6. ADD NEW CATALOG ITEM
  const handleAddNewItem = (newItem: Omit<InventoryItem, "id">) => {
    const id = `${newItem.type}_${newItem.name
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")}_${Date.now().toString().slice(-4)}`;

    const created: InventoryItem = {
      id,
      ...newItem,
    };

    saveState({
      ...state,
      items: [...state.items, created],
    });
  };

  const handleDeleteItem = (id: string) => {
    const updatedItems = state.items.filter((item) => item.id !== id);
    // Also remove any recipes associated with this item
    const updatedRecipes = state.recipes.filter((recipe) => recipe.resultItemId !== id && recipe.ingredients.every(ing => ing.itemId !== id));
    saveState({
      ...state,
      items: updatedItems,
      recipes: updatedRecipes,
    });
  };

  const handleAddRecipe = (newRecipe: Omit<Recipe, "id">, newItemToCreate?: Omit<InventoryItem, "id">) => {
    let finalResultItemId = newRecipe.resultItemId;
    let updatedItems = [...state.items];

    if (newItemToCreate) {
      const generatedItemId = `drink_${newItemToCreate.name
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "")}_${Date.now().toString().slice(-4)}`;
      
      const createdItem: InventoryItem = {
        id: generatedItemId,
        ...newItemToCreate,
      };
      
      updatedItems.push(createdItem);
      finalResultItemId = generatedItemId;
    }

    const recipeId = `rec_${finalResultItemId}_${Date.now().toString().slice(-4)}`;
    const createdRecipe: Recipe = {
      id: recipeId,
      resultItemId: finalResultItemId,
      ingredients: newRecipe.ingredients,
      craftTimeSeconds: newRecipe.craftTimeSeconds,
      yieldAmount: newRecipe.yieldAmount,
    };

    saveState({
      ...state,
      items: updatedItems,
      recipes: [...state.recipes, createdRecipe],
    });
  };

  const handleDeleteRecipe = (id: string) => {
    const updated = state.recipes.filter((recipe) => recipe.id !== id);
    saveState({
      ...state,
      recipes: updated,
    });
  };

  const handleUpdateRecipe = (
    recipeId: string,
    updatedRecipe: Omit<Recipe, "id" | "resultItemId">,
    updatedItem?: Partial<Omit<InventoryItem, "id" | "type" | "stock">>
  ) => {
    const recipe = state.recipes.find((r) => r.id === recipeId);
    if (!recipe) return;

    const updatedRecipes = state.recipes.map((r) => {
      if (r.id === recipeId) {
        return {
          ...r,
          ingredients: updatedRecipe.ingredients,
          craftTimeSeconds: updatedRecipe.craftTimeSeconds,
          yieldAmount: updatedRecipe.yieldAmount,
        };
      }
      return r;
    });

    let updatedItems = [...state.items];
    if (updatedItem && recipe.resultItemId) {
      updatedItems = state.items.map((it) => {
        if (it.id === recipe.resultItemId) {
          return {
            ...it,
            ...updatedItem,
          };
        }
        return it;
      });
    }

    saveState({
      ...state,
      recipes: updatedRecipes,
      items: updatedItems,
    });
  };

  const handleDeleteShift = (shiftId: string) => {
    const shift = (state.shifts || []).find((s) => s.id === shiftId);
    if (!shift) return;

    // Find sales associated with this shift
    const shiftSales = shift.sales || state.sales.filter(
      (s) => s.bartenderId === shift.bartenderId && s.timestamp >= shift.startTime && s.timestamp <= shift.endTime
    );

    // Reverse item stock updates
    let updatedItems = [...state.items];
    for (const sale of shiftSales) {
      for (const cartItem of sale.items) {
        const itemIndex = updatedItems.findIndex((it) => it.id === cartItem.itemId);
        if (itemIndex !== -1) {
          updatedItems[itemIndex] = {
            ...updatedItems[itemIndex],
            stock: updatedItems[itemIndex].stock + cartItem.quantity,
          };
        }
      }
    }

    // Filter out the deleted sales from state.sales
    const shiftSaleIds = new Set(shiftSales.map((s) => s.id));
    const updatedSales = state.sales.filter((s) => !shiftSaleIds.has(s.id));

    // Deduct the sales total from the cash register
    const updatedRegisterBalance = Math.max(0, state.registerBalance - shift.salesTotal);

    // Adjust the bartender's totalCommissionEarned
    const updatedBartenders = state.bartenders.map((b) => {
      if (b.id === shift.bartenderId) {
        return {
          ...b,
          totalCommissionEarned: Math.max(0, b.totalCommissionEarned - shift.commissionEarned),
        };
      }
      return b;
    });

    // Remove the shift log
    const updatedShifts = (state.shifts || []).filter((s) => s.id !== shiftId);

    saveState({
      ...state,
      items: updatedItems,
      sales: updatedSales,
      registerBalance: updatedRegisterBalance,
      bartenders: updatedBartenders,
      shifts: updatedShifts,
    });
  };

  const handleUpdateShift = (shiftId: string, newStartTime: string, newEndTime: string) => {
    const shiftsList = state.shifts || [];
    const shiftIndex = shiftsList.findIndex((s) => s.id === shiftId);
    if (shiftIndex === -1) return;

    const currentShift = shiftsList[shiftIndex];

    // Find sales in the new time window for this bartender
    const shiftSales = state.sales.filter(
      (s) => s.bartenderId === currentShift.bartenderId && s.timestamp >= newStartTime && s.timestamp <= newEndTime
    );

    const salesCount = shiftSales.length;
    const salesTotal = shiftSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const cashSalesTotal = shiftSales
      .filter((s) => !s.paymentMethod || s.paymentMethod === "cash")
      .reduce((sum, s) => sum + s.totalAmount, 0);
    const cardSalesTotal = shiftSales
      .filter((s) => s.paymentMethod === "card")
      .reduce((sum, s) => sum + s.totalAmount, 0);
    const commissionEarned = shiftSales.reduce((sum, s) => sum + s.commissionPaid, 0);

    const updatedShift: ShiftLog = {
      ...currentShift,
      startTime: newStartTime,
      endTime: newEndTime,
      salesCount,
      salesTotal,
      cashSalesTotal,
      cardSalesTotal,
      commissionEarned,
      sales: shiftSales,
      autoClosed: false,
    };

    const updatedShifts = [...shiftsList];
    updatedShifts[shiftIndex] = updatedShift;

    saveState({
      ...state,
      shifts: updatedShifts,
    });
  };

  // 7. ADD EMPLOYEES & COMMISSION MANAGER
  const handleAddBartender = (name: string, rate: number, pin?: string, role: "manager" | "barman" = "barman") => {
    const id = `bart_${name
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")}`;

    // Generate a default PIN of 4 digits if not provided
    const finalPin = pin || Math.floor(1000 + Math.random() * 9000).toString();

    const created: Bartender = {
      id,
      name,
      commissionRate: rate,
      totalCommissionEarned: 0,
      status: "active",
      pin: finalPin,
      role,
    };

    saveState({
      ...state,
      bartenders: [...state.bartenders, created],
    });
  };

  const handleUpdateBartenderRole = (id: string, role: "manager" | "barman") => {
    const updated = state.bartenders.map((b) => {
      if (b.id === id) {
        return { ...b, role };
      }
      return b;
    });
    saveState({ ...state, bartenders: updated });
  };

  const handleUpdateBartenderStatus = (id: string, active: boolean) => {
    const updated = state.bartenders.map((b) => {
      if (b.id === id) {
        return { ...b, status: active ? ("active" as const) : ("inactive" as const) };
      }
      return b;
    });
    saveState({ ...state, bartenders: updated });
  };

  const handleUpdateBartenderPin = (id: string, pin: string) => {
    const updated = state.bartenders.map((b) => {
      if (b.id === id) {
        return { ...b, pin };
      }
      return b;
    });
    saveState({ ...state, bartenders: updated });
  };

  const handleUpdateBartenderCommission = (id: string, rate: number) => {
    const updated = state.bartenders.map((b) => {
      if (b.id === id) {
        return { ...b, commissionRate: rate };
      }
      return b;
    });
    saveState({ ...state, bartenders: updated });
  };

  const handleDeleteBartender = (id: string) => {
    const updated = state.bartenders.filter((b) => b.id !== id);
    saveState({ ...state, bartenders: updated });
  };

  const handlePayoutBartender = (id: string): { success: boolean; error?: string } => {
    const bartender = state.bartenders.find((b) => b.id === id);
    if (!bartender) return { success: false, error: "Barman nebyl nalezen." };

    const payoutAmount = bartender.totalCommissionEarned;
    if (state.registerBalance < payoutAmount) {
      return {
        success: false,
        error: `V pokladně není dostatek hotovosti k vyplacení $${payoutAmount.toFixed(
          2
        )}! Vložte hotovost nebo vyplaťte později.`,
      };
    }

    // Log payout
    const newPayout: PayoutLog = {
      id: `payout_${Date.now()}`,
      timestamp: new Date().toISOString(),
      bartenderId: id,
      bartenderName: bartender.name,
      amount: payoutAmount,
    };

    const updatedBartenders = state.bartenders.map((b) => {
      if (b.id === id) {
        return { ...b, totalCommissionEarned: 0 };
      }
      return b;
    });

    saveState({
      ...state,
      bartenders: updatedBartenders,
      payouts: [...state.payouts, newPayout],
      registerBalance: state.registerBalance - payoutAmount,
    });

    return { success: true };
  };

  // 8. DATABASE BACKUP EXPORT & IMPORT
  const handleExportBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `tequila-la-la_pos_backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportBackup = (jsonData: string): { success: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(jsonData);
      if (parsed.items && parsed.recipes && parsed.bartenders) {
        saveState(parsed);
        return { success: true };
      }
      return { success: false, error: "JSON kód neobsahuje platný databázový model Tequi-la-la." };
    } catch (e) {
      return { success: false, error: "Neplatný formát JSON. Zkopírujte kód přesně." };
    }
  };

  const handleResetDatabase = () => {
    const defaults: BusinessState = {
      items: INITIAL_ITEMS.map((item) => ({ ...item, stock: 0 })),
      recipes: state.recipes.length > 0 ? state.recipes : INITIAL_RECIPES,
      bartenders: state.bartenders.length > 0 ? state.bartenders : INITIAL_BARTENDERS,
      sales: [],
      purchases: [],
      payouts: [],
      registerBalance: 0,
      barTabs: [],
      shifts: [],
    };
    saveState(defaults);
  };

  // CALCULATE BUSINESS ASSETS NET WORTH
  const getInventoryValue = () => {
    return state.items.reduce((sum, item) => {
      // Calculate based on raw items purchase value or beers
      const unitValue = item.purchasePrice || item.sellPrice * 0.2; // fallback valuation
      return sum + item.stock * unitValue;
    }, 0);
  };

  // Redirect Barman to valid tabs if they are on an inaccessible one
  useEffect(() => {
    if (session && session.role === "barman" && activeTab !== "pos" && activeTab !== "shift") {
      setActiveTab("pos");
    }
  }, [session, activeTab]);

  const netWorth = state.registerBalance + getInventoryValue();

  if (!session) {
    return (
      <PinLoginScreen
        bartenders={state.bartenders}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  const currentBartender = session.role === "barman" && session.bartenderId
    ? state.bartenders.find(b => b.id === session.bartenderId)
    : undefined;

  return (
    <div className="min-h-screen bg-tequila-dark text-gray-300 selection:bg-tequila-orange/20 flex flex-col">
      {/* GLOWING HEADER / BAR BRANDING */}
      <header className="border-b border-tequila-border bg-zinc-950 sticky top-0 z-50 transition-all shrink-0">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo & Operational Status */}
          <div className="flex items-center gap-4.5">
            <div className="w-10 h-10 bg-tequila-orange rounded flex items-center justify-center text-black font-black text-xl italic select-none shadow-md shadow-tequila-orange/10 shrink-0">
              T
            </div>

            <div className="text-center md:text-left">
              <h1 className="text-lg font-extrabold text-white tracking-tighter uppercase select-none">
                Tequi-la-la <span className="text-tequila-orange">Management</span>
              </h1>
              <p className="text-[10px] uppercase font-mono tracking-widest text-zinc-500">
                Operational Control Terminal v4.2.0
              </p>
            </div>
          </div>

          {/* Quick Metrics & Live clock */}
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 text-xs">
            {/* Clock */}
            <div className="bg-zinc-900 border border-tequila-border px-3 py-1.5 rounded flex items-center gap-2 font-mono text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-tequila-orange animate-pulse"></span>
              <span>{currentTime.toLocaleTimeString("cs-CZ")} UTC</span>
            </div>

            {/* Session / Role Badge with Logout */}
            <div className="bg-zinc-900 border border-tequila-border px-3 py-1.5 rounded flex items-center gap-3">
              <div className="text-right">
                <span className="block text-[8px] text-zinc-500 uppercase tracking-wider font-mono font-bold">Přihlášen</span>
                <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                  {session.role === "manager" ? "Manažer" : currentBartender?.name || "Barman"}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="p-1 bg-zinc-950 hover:bg-zinc-850 hover:text-rose-500 rounded border border-tequila-border transition-colors cursor-pointer"
                title="Odhlásit se z terminálu"
              >
                <LucideIcon name="LogOut" className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Shift Open toggle */}
            <button
              onClick={handleToggleRegister}
              className={`px-3 py-1.5 rounded font-mono text-xs font-bold uppercase tracking-wide border transition-all cursor-pointer select-none ${
                isOpen
                  ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-400"
                  : "bg-rose-950/20 border-rose-500/20 text-rose-400"
              }`}
            >
              {isOpen ? "● Otevřeno" : "○ Zavřeno"}
            </button>

            {/* Cash register direct adjust */}
            <div
              onClick={() => {
                setRegType("deposit");
                setShowRegModal(true);
              }}
              className="bg-zinc-900 hover:bg-zinc-850 border border-tequila-border px-3.5 py-1.5 rounded flex items-center gap-2 cursor-pointer shadow-sm select-none hover:border-tequila-orange/40 transition-colors"
            >
              <div className="text-right">
                <span className="block text-[8px] text-zinc-500 uppercase tracking-wider font-mono font-bold">Kasa</span>
                <span className="font-mono text-xs font-bold text-tequila-yellow">
                  ${state.registerBalance.toFixed(2)}
                </span>
              </div>
              <LucideIcon name="Coins" className="w-3.5 h-3.5 text-tequila-yellow" />
            </div>

            {/* Company Net Worth */}
            <div className="bg-zinc-900 border border-tequila-border px-3.5 py-1.5 rounded flex items-center gap-2 shadow-sm">
              <div className="text-right">
                <span className="block text-[8px] text-zinc-500 uppercase tracking-wider font-mono font-bold">Celkové jmění</span>
                <span className="font-mono text-xs font-bold text-emerald-400">
                  ${netWorth.toFixed(2)}
                </span>
              </div>
              <LucideIcon name="TrendingUp" className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>
        </div>
      </header>

      {/* CASH ADJUSTMENT POP-UP MODAL */}
      {showRegModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-tequila-card border border-tequila-border p-6 rounded-2xl w-full max-w-sm shadow-2xl relative">
            <button
              onClick={() => setShowRegModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <LucideIcon name="X" className="w-5 h-5" />
            </button>

            <h3 className="text-base font-display font-bold text-white uppercase tracking-wider mb-4">
              Vklad / Výběr z Pokladny
            </h3>

            <form onSubmit={handleRegisterAdjustment} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRegType("deposit")}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold uppercase transition-all ${
                    regType === "deposit"
                      ? "bg-emerald-950/30 border-emerald-500 text-emerald-400"
                      : "bg-tequila-dark border-tequila-border text-gray-400"
                  }`}
                >
                  📥 Vložit hotovost
                </button>
                <button
                  type="button"
                  onClick={() => setRegType("withdraw")}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold uppercase transition-all ${
                    regType === "withdraw"
                      ? "bg-rose-950/30 border-rose-500 text-rose-400"
                      : "bg-tequila-dark border-tequila-border text-gray-400"
                  }`}
                >
                  📤 Vybrat hotovost
                </button>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Množství peněz ($)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={regAmount}
                  onChange={(e) => setRegAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Zadejte částku..."
                  className="w-full bg-tequila-dark border border-tequila-border p-2.5 rounded-xl text-sm font-mono focus:outline-none focus:border-tequila-orange text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-tequila-orange hover:bg-tequila-orange/90 text-white font-display font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
              >
                Potvrdit v kase
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CORE NAVIGATION BAR */}
      <nav className="max-w-7xl mx-auto px-4 md:px-6 mt-6 w-full">
        <div className="flex bg-tequila-card/80 border border-tequila-border p-1 rounded-2xl overflow-x-auto gap-1">
          {/* TAB 1: POS (Always visible) */}
          <button
            onClick={() => setActiveTab("pos")}
            className={`flex-1 min-w-[120px] py-3.5 rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "pos"
                ? "bg-tequila-orange text-white shadow-lg shadow-tequila-orange/15 font-extrabold"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <LucideIcon name="Coins" className="w-4 h-4" />
            Pokladna POS
          </button>

          {/* TAB 2: SHIFT (Visible to Bartender) */}
          {session.role === "barman" && (
            <button
              onClick={() => setActiveTab("shift")}
              className={`flex-1 min-w-[120px] py-3.5 rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === "shift"
                  ? "bg-tequila-orange text-white shadow-lg shadow-tequila-orange/15 font-extrabold"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <LucideIcon name="Clock" className="w-4 h-4" />
              Přihlášení na směnu
            </button>
          )}

          {/* TABS 3, 4, 5 (Visible to Manager Only) */}
          {session.role === "manager" && (
            <>
              <button
                onClick={() => setActiveTab("craft")}
                className={`flex-1 min-w-[120px] py-3.5 rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === "craft"
                    ? "bg-tequila-orange text-white shadow-lg shadow-tequila-orange/15 font-extrabold"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <LucideIcon name="ChefHat" className="w-4 h-4" />
                Výroba & Míchání
              </button>

              <button
                onClick={() => setActiveTab("inventory")}
                className={`flex-1 min-w-[120px] py-3.5 rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === "inventory"
                    ? "bg-tequila-orange text-white shadow-lg shadow-tequila-orange/15 font-extrabold"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <LucideIcon name="ShoppingBag" className="w-4 h-4" />
                Sklad & Nákup
              </button>

              <button
                onClick={() => setActiveTab("management")}
                className={`flex-1 min-w-[120px] py-3.5 rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === "management"
                    ? "bg-tequila-orange text-white shadow-lg shadow-tequila-orange/15 font-extrabold"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <LucideIcon name="Settings" className="w-4 h-4" />
                Manažer & Provize
              </button>
            </>
          )}
        </div>
      </nav>

      {/* CORE TAB WORKSPACE SCREEN */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-20 w-full">
        {activeTab === "pos" && (
          <PosTab
            items={state.items}
            bartenders={state.bartenders}
            onCompleteSale={handleCompleteSale}
            barTabs={state.barTabs || []}
            onSaveTabs={(updatedTabs) => saveState({ ...state, barTabs: updatedTabs })}
            forceBartenderId={session?.bartenderId}
            isOpen={isOpen}
            onToggleRegister={handleToggleRegister}
          />
        )}

        {activeTab === "shift" && session.role === "barman" && currentBartender && (
          <ShiftTab
            bartender={currentBartender}
            sales={state.sales}
            onToggleRegister={handleToggleRegister}
            onLogout={handleLogout}
            isOpen={isOpen}
          />
        )}

        {activeTab === "craft" && session.role === "manager" && (
          <CraftingTab
            items={state.items}
            recipes={state.recipes}
            onCraftSuccess={handleCraftSuccess}
          />
        )}

        {activeTab === "inventory" && session.role === "manager" && (
          <InventoryTab
            items={state.items}
            recipes={state.recipes}
            registerBalance={state.registerBalance}
            onPurchaseSupplies={handlePurchaseSupplies}
            onUpdateStock={handleUpdateStock}
            onUpdateItem={handleUpdateItem}
            onAddNewItem={handleAddNewItem}
            onDeleteItem={handleDeleteItem}
          />
        )}

        {activeTab === "management" && session.role === "manager" && (
          <ManagementTab
            bartenders={state.bartenders}
            sales={state.sales}
            purchases={state.purchases}
            payouts={state.payouts}
            shifts={state.shifts}
            registerBalance={state.registerBalance}
            items={state.items}
            recipes={state.recipes}
            onAddBartender={handleAddBartender}
            onUpdateBartenderStatus={handleUpdateBartenderStatus}
            onUpdateBartenderCommission={handleUpdateBartenderCommission}
            onUpdateBartenderPin={handleUpdateBartenderPin}
            onUpdateBartenderRole={handleUpdateBartenderRole}
            onDeleteBartender={handleDeleteBartender}
            onPayoutBartender={handlePayoutBartender}
            onImportBackup={handleImportBackup}
            onExportBackup={handleExportBackup}
            onResetDatabase={handleResetDatabase}
            onAddRecipe={handleAddRecipe}
            onDeleteRecipe={handleDeleteRecipe}
            onUpdateRecipe={handleUpdateRecipe}
            onDeleteShift={handleDeleteShift}
            onUpdateShift={handleUpdateShift}
          />
        )}
      </main>

      {/* Footer Status Bar */}
      <footer className="h-8 px-4 md:px-6 bg-zinc-950 border-t border-tequila-border flex items-center justify-between font-mono text-[10px] text-zinc-500 shrink-0 select-none">
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="uppercase text-[9px] tracking-wider text-zinc-400">Stock Database: SYNCED</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="uppercase text-[9px] tracking-wider">Clock:</span>
            <span className="text-zinc-300 font-bold">{currentTime.toLocaleTimeString("cs-CZ")}</span>
          </div>
        </div>
        <div className="flex gap-4">
          <span className="uppercase text-[9px] tracking-wider">Shift Total: <span className="text-tequila-orange font-bold font-mono">${state.sales.reduce((sum, s) => sum + s.totalAmount, 0).toFixed(2)}</span></span>
          <span className="uppercase text-[9px] tracking-wider">Commission: <span className="text-tequila-orange font-bold font-mono">${state.sales.reduce((sum, s) => sum + s.commissionPaid, 0).toFixed(2)}</span></span>
        </div>
      </footer>

      {/* SHIFT SUMMARY MODAL */}
      {shiftSummary && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-tequila-card border border-tequila-border p-6 rounded-2xl w-full max-w-sm shadow-2xl space-y-4">
            <div className="text-center">
              <span className="inline-block p-3 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 rounded-full mb-3">
                <LucideIcon name="ShieldCheck" className="w-8 h-8" />
              </span>
              <h3 className="text-base font-display font-bold text-white uppercase tracking-wider">
                🔐 Směna ukončena a zalogována!
              </h3>
            </div>

            <div className="bg-zinc-950/60 border border-tequila-border/30 rounded-xl p-4 space-y-2 font-mono text-xs text-gray-300">
              <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                <span className="text-zinc-500 font-bold uppercase text-[9px] tracking-wide">Pracovník:</span>
                <span className="font-bold text-white">{shiftSummary.bartenderName}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                <span className="text-zinc-500 font-bold uppercase text-[9px] tracking-wide">Začátek:</span>
                <span className="text-zinc-200">{new Date(shiftSummary.startTime).toLocaleTimeString("cs-CZ")}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                <span className="text-zinc-500 font-bold uppercase text-[9px] tracking-wide">Konec:</span>
                <span className="text-zinc-200">{new Date(shiftSummary.endTime).toLocaleTimeString("cs-CZ")}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                <span className="text-zinc-500 font-bold uppercase text-[9px] tracking-wide">Počet prodejů:</span>
                <span className="font-bold text-white">{shiftSummary.salesCount} ks</span>
              </div>
              <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                <span className="text-zinc-500 font-bold uppercase text-[9px] tracking-wide">Celková tržba:</span>
                <span className="font-bold text-tequila-orange">${shiftSummary.salesTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-900 pb-1.5 pl-3 text-[11px]">
                <span className="text-zinc-500 font-bold uppercase text-[8px] tracking-wide">→ Z toho Hotově:</span>
                <span className="font-bold text-tequila-yellow">${(shiftSummary.cashSalesTotal ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-900 pb-1.5 pl-3 text-[11px]">
                <span className="text-zinc-500 font-bold uppercase text-[8px] tracking-wide">→ Z toho Kartou:</span>
                <span className="font-bold text-emerald-400">${(shiftSummary.cardSalesTotal ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-900 pb-1.5 bg-emerald-950/10 p-2 rounded-lg">
                <span className="text-emerald-400 font-bold uppercase text-[9px] tracking-wide flex items-center gap-1">💵 Hotovost k odevzdání:</span>
                <span className="font-bold text-emerald-300 font-mono text-sm">${(shiftSummary.cashSalesTotal ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-zinc-500 font-bold uppercase text-[9px] tracking-wide">Získaná provize:</span>
                <span className="font-bold text-emerald-400">${shiftSummary.commissionEarned.toFixed(2)}</span>
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 text-center">
              Budete automaticky odhlášeni z terminálu.
            </p>

            <button
              onClick={() => {
                setShiftSummary(null);
                handleLogout();
              }}
              className="w-full py-2.5 bg-tequila-orange hover:bg-tequila-orange/90 hover:text-white text-white font-display font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow transition-all text-center block font-mono"
            >
              Rozumím a odhlásit se
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
