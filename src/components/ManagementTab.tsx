import React, { useState } from "react";
import {
  InventoryItem,
  Bartender,
  SaleLog,
  PurchaseLog,
  PayoutLog,
  Recipe,
  RecipeIngredient,
  ItemCategory,
  ShiftLog,
  AutoBackupEntry,
  DailyFirestoreBackup,
} from "../types";
import { LucideIcon } from "./LucideIcon";

const toDatetimeLocal = (isoString: string): string => {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => (n < 10 ? "0" + n : String(n));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface ManagementTabProps {
  bartenders: Bartender[];
  sales: SaleLog[];
  purchases: PurchaseLog[];
  payouts: PayoutLog[];
  shifts?: ShiftLog[];
  registerBalance: number;
  items: InventoryItem[];
  recipes: Recipe[];
  backups?: AutoBackupEntry[];
  dailyFirestoreBackups?: DailyFirestoreBackup[];
  onAddBartender: (name: string, rate: number, pin?: string, role?: "manager" | "barman") => void;
  onUpdateBartenderStatus: (id: string, active: boolean) => void;
  onUpdateBartenderCommission: (id: string, rate: number) => void;
  onUpdateBartenderPin: (id: string, pin: string) => void;
  onUpdateBartenderRole?: (id: string, role: "manager" | "barman") => void;
  onDeleteBartender: (id: string) => void;
  onPayoutBartender: (id: string) => { success: boolean; error?: string };
  onImportBackup: (jsonData: string) => { success: boolean; error?: string };
  onExportBackup: () => void;
  onRestoreBackup?: (backup: AutoBackupEntry) => void;
  onCreateManualBackup?: (label: string) => void;
  onDeleteBackup?: (backupId: string) => void;
  onCreateDailyCloudBackup?: () => void;
  onRestoreDailyBackup?: (backup: DailyFirestoreBackup) => void;
  onDeleteDailyBackup?: (backupId: string) => void;
  onResetDatabase: () => void;
  onAddRecipe: (recipe: Omit<Recipe, "id">, newItemToCreate?: Omit<InventoryItem, "id">) => void;
  onDeleteRecipe: (id: string) => void;
  onUpdateRecipe?: (
    recipeId: string,
    updatedRecipe: Omit<Recipe, "id" | "resultItemId">,
    updatedItem?: Partial<Omit<InventoryItem, "id" | "type" | "stock">>
  ) => void;
  onDeleteShift?: (id: string) => void;
  onUpdateShift?: (id: string, startTime: string, endTime: string, bartenderId?: string) => void;
  onLoadSimulatedData?: () => void;
}

export const ManagementTab: React.FC<ManagementTabProps> = ({
  bartenders,
  sales,
  purchases,
  payouts,
  shifts,
  registerBalance,
  items,
  recipes,
  backups = [],
  dailyFirestoreBackups = [],
  onAddBartender,
  onUpdateBartenderStatus,
  onUpdateBartenderCommission,
  onUpdateBartenderPin,
  onUpdateBartenderRole,
  onDeleteBartender,
  onPayoutBartender,
  onImportBackup,
  onExportBackup,
  onRestoreBackup,
  onCreateManualBackup,
  onDeleteBackup,
  onCreateDailyCloudBackup,
  onRestoreDailyBackup,
  onDeleteDailyBackup,
  onResetDatabase,
  onAddRecipe,
  onDeleteRecipe,
  onUpdateRecipe,
  onDeleteShift,
  onUpdateShift,
  onLoadSimulatedData,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"employees" | "recipes" | "stats" | "history" | "backup">("employees");
  const [expandedShiftIds, setExpandedShiftIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteShiftId, setConfirmDeleteShiftId] = useState<string | null>(null);
  const [restoreConfirmBackup, setRestoreConfirmBackup] = useState<AutoBackupEntry | null>(null);
  const [restoreConfirmDailyBackup, setRestoreConfirmDailyBackup] = useState<DailyFirestoreBackup | null>(null);
  const [manualBackupName, setManualBackupName] = useState("");
  const [showCreateBackupInput, setShowCreateBackupInput] = useState(false);

  // Shift Edit State
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [editShiftStart, setEditShiftStart] = useState<string>("");
  const [editShiftEnd, setEditShiftEnd] = useState<string>("");
  const [editShiftBartenderId, setEditShiftBartenderId] = useState<string>("");

  // Export Subsidies state
  const pad = (n: number) => (n < 10 ? "0" + n : String(n));
  const currentNow = new Date();
  const todayStr = `${currentNow.getFullYear()}-${pad(currentNow.getMonth() + 1)}`;
  const [selectedExportMonth, setSelectedExportMonth] = useState(todayStr);

  const generateMonthsList = () => {
    const monthsMap = new Map<string, string>();
    const now = new Date();

    // Generate last 12 months
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      const label = d.toLocaleString("cs-CZ", { month: "long", year: "numeric" });
      monthsMap.set(value, label.charAt(0).toUpperCase() + label.slice(1));
    }

    // Include any historical months from shift logs
    (shifts || []).forEach((s) => {
      const dateStr = s.endTime || s.startTime;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
          if (!monthsMap.has(value)) {
            const label = d.toLocaleString("cs-CZ", { month: "long", year: "numeric" });
            monthsMap.set(value, label.charAt(0).toUpperCase() + label.slice(1));
          }
        }
      }
    });

    // Include any historical months from sales logs
    (sales || []).forEach((s) => {
      if (s.timestamp) {
        const d = new Date(s.timestamp);
        if (!isNaN(d.getTime())) {
          const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
          if (!monthsMap.has(value)) {
            const label = d.toLocaleString("cs-CZ", { month: "long", year: "numeric" });
            monthsMap.set(value, label.charAt(0).toUpperCase() + label.slice(1));
          }
        }
      }
    });

    // Sort descending by YYYY-MM
    return Array.from(monthsMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([value, label]) => ({ value, label }));
  };

  const handleExportSubsidiesCSV = () => {
    const [year, month] = selectedExportMonth.split("-").map(Number);
    const monthsList = generateMonthsList();
    const label = monthsList.find(m => m.value === selectedExportMonth)?.label || selectedExportMonth;
    
    // Filter shifts completed in this month
    const monthlyShifts = (shifts || []).filter((s) => {
      const dateStr = s.endTime || s.startTime;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });

    // Filter sales made in this month
    const monthlySales = sales.filter((s) => {
      if (!s.timestamp) return false;
      const d = new Date(s.timestamp);
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });

    const totalDurationMs = monthlyShifts.reduce((sum, s) => {
      const start = new Date(s.startTime).getTime();
      const end = new Date(s.endTime).getTime();
      return sum + Math.max(0, end - start);
    }, 0);
    const totalHours = totalDurationMs / (1000 * 60 * 60);
    const totalSalesValue = monthlySales.reduce((sum, s) => sum + s.totalAmount, 0);

    const formatHoursCSV = (hours: number) => {
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      return `${h} hod ${m} min`;
    };

    // CSV separated by semicolon for European/Czech Excel defaults with UTF-8 BOM
    let csv = "\uFEFF"; // BOM for Excel UTF-8
    csv += "VÝKAZ PRO DOTAČNÍ ŘÍZENÍ - BAR TEQUI-LA-LA\n";
    csv += `Generováno dne:;${new Date().toLocaleString("cs-CZ")}\n`;
    csv += `Sledované období:;${label}\n`;
    csv += `Celková doba otevření (směny):;${totalHours.toFixed(2).replace(".", ",")} hod (${formatHoursCSV(totalHours)})\n`;
    csv += `Celková tržba podniku (POS prodeje):;${totalSalesValue.toFixed(2).replace(".", ",")} USD\n`;
    csv += `Počet dokončených směn:;${monthlyShifts.length}\n`;
    csv += `Počet realizovaných prodejů:;${monthlySales.length}\n\n`;

    csv += "PODROBNÝ VÝPIS ODPRACOVANÝCH SMĚN\n";
    csv += "ID Směny;Jméno zaměstnance;Začátek směny;Konec směny;Doba trvání (hod);Tržba celkem (USD);Z toho Hotovost (USD);Z toho Kartou (USD);Počet prodejů\n";
    
    monthlyShifts.forEach((shift) => {
      const durationMs = new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime();
      const sHours = Math.max(0, durationMs) / (1000 * 60 * 60);

      // Recalculate cash/card if not stored
      let cSales = shift.cashSalesTotal;
      let crSales = shift.cardSalesTotal;
      if (cSales === undefined || crSales === undefined) {
        const shSales = shift.sales || sales.filter(
          (s) => s.bartenderId === shift.bartenderId && s.timestamp >= shift.startTime && s.timestamp <= shift.endTime
        );
        cSales = shSales
          .filter((s) => !s.paymentMethod || s.paymentMethod === "cash")
          .reduce((sum, s) => sum + s.totalAmount, 0);
        crSales = shSales
          .filter((s) => s.paymentMethod === "card")
          .reduce((sum, s) => sum + s.totalAmount, 0);
      }

      csv += `${shift.id};${shift.bartenderName};${new Date(shift.startTime).toLocaleString("cs-CZ")};${new Date(shift.endTime).toLocaleString("cs-CZ")};${sHours.toFixed(2).replace(".", ",")};${shift.salesTotal.toFixed(2).replace(".", ",")};${cSales.toFixed(2).replace(".", ",")};${crSales.toFixed(2).replace(".", ",")};${shift.salesCount}\n`;
    });

    csv += "\nPODROBNÝ VÝPIS REALIZOVANÝCH PRODEJŮ\n";
    csv += "ID Prodeje;Datum a čas prodeje;Účtoval;Celková částka (USD);Způsob platby;Položky prodeje\n";

    monthlySales.forEach((sale) => {
      const itemSummary = sale.items.map(it => `${it.quantity}x ${it.name}`).join(", ");
      const payMethodStr = (!sale.paymentMethod || sale.paymentMethod === "cash") ? "Hotově" : "Kartou";
      csv += `${sale.id};${new Date(sale.timestamp).toLocaleString("cs-CZ")};${sale.bartenderName};${sale.totalAmount.toFixed(2).replace(".", ",")};${payMethodStr};"${itemSummary.replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `export-dotace-tequilala-${selectedExportMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleShiftExpand = (id: string) => {
    setExpandedShiftIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Add Employee Form State
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpRate, setNewEmpRate] = useState<number>(15);
  const [newEmpPin, setNewEmpPin] = useState("");
  const [newEmpRole, setNewEmpRole] = useState<"manager" | "barman">("barman");

  // Commission Edit state
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [editingRate, setEditingRate] = useState<number>(15);

  // PIN Edit state
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [editingPin, setEditingPin] = useState<string>("");

  // JSON Import state
  const [importJson, setImportJson] = useState("");

  // Add Recipe Form State
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [recipeTargetMode, setRecipeTargetMode] = useState<"existing" | "new">("existing");
  const [newRecResultItemId, setNewRecResultItemId] = useState("");
  const [newRecResultItemName, setNewRecResultItemName] = useState("");
  const [newRecResultItemSellPrice, setNewRecResultItemSellPrice] = useState<number>(150);
  const [newRecResultItemCategory, setNewRecResultItemCategory] = useState<ItemCategory>("drink");
  const [newRecResultItemIcon, setNewRecResultItemIcon] = useState<string>("Wine");
  const [newRecResultItemMinStock, setNewRecResultItemMinStock] = useState<number>(5);
  const [newRecTime, setNewRecTime] = useState<number>(5);
  const [newRecYieldAmount, setNewRecYieldAmount] = useState<number>(20);
  const [newRecIngredients, setNewRecIngredients] = useState<RecipeIngredient[]>([]);
  
  // Temporary ingredient row state
  const [tempIngId, setTempIngId] = useState("");
  const [tempIngQty, setTempIngQty] = useState<number>(1.0);

  const handleEditRecipeClick = (recipeId: string) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;
    const item = items.find(it => it.id === recipe.resultItemId);

    setEditingRecipeId(recipeId);
    setRecipeTargetMode("existing");
    setNewRecResultItemId(recipe.resultItemId);
    setNewRecTime(recipe.craftTimeSeconds);
    setNewRecYieldAmount(recipe.yieldAmount ?? 20);
    setNewRecIngredients(recipe.ingredients);

    if (item) {
      setNewRecResultItemName(item.name);
      setNewRecResultItemSellPrice(item.sellPrice);
      setNewRecResultItemCategory(item.category);
      setNewRecResultItemIcon(item.iconName);
      setNewRecResultItemMinStock(item.minStock);
    }
  };

  const handleCancelEditRecipe = () => {
    setEditingRecipeId(null);
    setNewRecResultItemId("");
    setNewRecResultItemName("");
    setNewRecResultItemSellPrice(150);
    setNewRecResultItemCategory("drink");
    setNewRecResultItemIcon("Wine");
    setNewRecResultItemMinStock(5);
    setNewRecTime(5);
    setNewRecYieldAmount(20);
    setNewRecIngredients([]);
    setTempIngId("");
    setTempIngQty(1.0);
    setRecipeTargetMode("existing");
  };

  const handleAddIngredientRow = () => {
    if (!tempIngId) {
      triggerAlert("error", "Vyberte ingredienci.");
      return;
    }
    if (tempIngQty <= 0) {
      triggerAlert("error", "Množství musí být větší než 0.");
      return;
    }
    
    // Check if ingredient already added
    if (newRecIngredients.some(ing => ing.itemId === tempIngId)) {
      triggerAlert("error", "Tato ingredience již byla do receptu přidána.");
      return;
    }
    
    setNewRecIngredients([...newRecIngredients, { itemId: tempIngId, quantity: tempIngQty }]);
    // Reset temp ingredient inputs
    setTempIngQty(1.0);
  };

  const handleRemoveIngredientRow = (itemId: string) => {
    setNewRecIngredients(newRecIngredients.filter(ing => ing.itemId !== itemId));
  };

  const handleCreateRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingRecipeId && recipeTargetMode === "existing" && !newRecResultItemId) {
      triggerAlert("error", "Vyberte výsledný drink.");
      return;
    }
    
    if (recipeTargetMode === "new" || editingRecipeId) {
      if (!newRecResultItemName.trim()) {
        triggerAlert("error", "Zadejte název nového produktu.");
        return;
      }
      if (newRecResultItemSellPrice <= 0) {
        triggerAlert("error", "Prodejní cena musí být větší než 0.");
        return;
      }
      // Check if product with this name already exists in items (only when creating new)
      if (!editingRecipeId && items.some(it => it.name.toLowerCase().trim() === newRecResultItemName.toLowerCase().trim())) {
        triggerAlert("error", `Produkt s názvem "${newRecResultItemName}" již v katalogu existuje.`);
        return;
      }
    }

    if (newRecIngredients.length === 0) {
      triggerAlert("error", "Recept musí obsahovat alespoň jednu ingredienci.");
      return;
    }

    if (editingRecipeId) {
      if (onUpdateRecipe) {
        onUpdateRecipe(
          editingRecipeId,
          {
            ingredients: newRecIngredients,
            craftTimeSeconds: newRecTime,
            yieldAmount: newRecYieldAmount,
          },
          {
            name: newRecResultItemName.trim(),
            sellPrice: newRecResultItemSellPrice,
            category: newRecResultItemCategory,
            iconName: newRecResultItemIcon,
            minStock: newRecResultItemMinStock,
          }
        );
        triggerAlert("success", "Recept byl úspěšně upraven!");
      }
      handleCancelEditRecipe();
      return;
    }

    if (recipeTargetMode === "existing") {
      // Check if recipe already exists for this resultItemId
      if (recipes.some(r => r.resultItemId === newRecResultItemId)) {
        triggerAlert("error", "Recept pro tento drink již existuje. Můžete stávající smazat a vytvořit nový.");
        return;
      }

      onAddRecipe({
        resultItemId: newRecResultItemId,
        ingredients: newRecIngredients,
        craftTimeSeconds: newRecTime,
        yieldAmount: newRecYieldAmount,
      });
    } else {
      // Create new crafted product and recipe at once
      const newItemToCreate: Omit<InventoryItem, "id"> = {
        name: newRecResultItemName.trim(),
        type: "crafted",
        stock: 0,
        minStock: newRecResultItemMinStock,
        purchasePrice: 0,
        sellPrice: newRecResultItemSellPrice,
        iconName: newRecResultItemIcon,
        category: newRecResultItemCategory,
      };

      onAddRecipe(
        {
          resultItemId: "", // Will be assigned on server/app side
          ingredients: newRecIngredients,
          craftTimeSeconds: newRecTime,
          yieldAmount: newRecYieldAmount,
        },
        newItemToCreate
      );
    }

    // Reset recipe state
    setNewRecResultItemId("");
    setNewRecResultItemName("");
    setNewRecResultItemSellPrice(150);
    setNewRecResultItemCategory("drink");
    setNewRecResultItemIcon("Wine");
    setNewRecResultItemMinStock(5);
    setNewRecTime(5);
    setNewRecYieldAmount(20);
    setNewRecIngredients([]);
    setTempIngId("");
    setTempIngQty(1.0);
    setRecipeTargetMode("existing");
    triggerAlert("success", "Nový recept byl úspěšně vytvořen!");
  };

  // Alert/Notification State
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [deleteRecipeConfirmId, setDeleteRecipeConfirmId] = useState<string | null>(null);
  const [deleteConfirmEmpId, setDeleteConfirmEmpId] = useState<string | null>(null);

  const triggerAlert = (type: "success" | "error", message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) {
      triggerAlert("error", "Zadejte jméno zaměstnance.");
      return;
    }
    if (newEmpRate < 0 || newEmpRate > 100) {
      triggerAlert("error", "Provize musí být v rozmezí 0 - 100 %.");
      return;
    }
    if (newEmpPin && (newEmpPin.length < 4 || newEmpPin.length > 8)) {
      triggerAlert("error", "PIN kód musí mít délku 4 až 8 číslic.");
      return;
    }

    onAddBartender(newEmpName, newEmpRate, newEmpPin || undefined, newEmpRole);
    setNewEmpName("");
    setNewEmpRate(15);
    setNewEmpPin("");
    setNewEmpRole("barman");
    triggerAlert("success", `Uživatel "${newEmpName}" byl úspěšně registrován!`);
  };

  const handleUpdatePin = (id: string) => {
    if (!editingPin || editingPin.length < 4 || editingPin.length > 8) {
      triggerAlert("error", "PIN kód musí mít délku 4 až 8 číslic.");
      return;
    }
    onUpdateBartenderPin(id, editingPin);
    setEditingPinId(null);
    triggerAlert("success", "PIN kód barmana byl úspěšně aktualizován!");
  };

  const handlePayout = (id: string) => {
    const b = bartenders.find((emp) => emp.id === id);
    if (!b) return;

    if (b.totalCommissionEarned <= 0) {
      triggerAlert("error", `Barman ${b.name} nemá žádnou nevyplacenou provizi.`);
      return;
    }

    const result = onPayoutBartender(id);
    if (result.success) {
      triggerAlert("success", `Provize ve výši $${b.totalCommissionEarned.toFixed(2)} byla vyplacena barmanovi ${b.name}!`);
    } else {
      triggerAlert("error", result.error || "Při vyplácení provize nastala chyba.");
    }
  };

  const handleUpdateCommission = (id: string) => {
    if (editingRate < 0 || editingRate > 100) {
      triggerAlert("error", "Zadejte provizi v rozmezí 0 - 100 %.");
      return;
    }
    onUpdateBartenderCommission(id, editingRate);
    setEditingEmpId(null);
    triggerAlert("success", "Sazba provize byla úspěšně aktualizována!");
  };

  const handleImport = () => {
    if (!importJson.trim()) {
      triggerAlert("error", "Vložte JSON kód zálohy.");
      return;
    }

    const result = onImportBackup(importJson);
    if (result.success) {
      triggerAlert("success", "Záloha podniku byla úspěšně načtena!");
      setImportJson("");
    } else {
      triggerAlert("error", result.error || "Při načítání zálohy došlo k chybě. Zkontrolujte formát.");
    }
  };

  // CALCULATING STATISTICS
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalExpenses = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalPaidCommissions = payouts.reduce((sum, p) => sum + p.amount, 0);
  const totalPendingCommissions = bartenders.reduce((sum, b) => sum + b.totalCommissionEarned, 0);
  
  // Net profit calculation
  const netProfit = totalRevenue - totalExpenses - totalPaidCommissions;

  // Top Selling Drinks Data Extraction
  const getTopSellingDrinks = () => {
    const drinksMap: { [name: string]: number } = {};
    sales.forEach((s) => {
      s.items.forEach((item) => {
        drinksMap[item.name] = (drinksMap[item.name] || 0) + item.quantity;
      });
    });

    return Object.entries(drinksMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5); // top 5
  };

  const topDrinks = getTopSellingDrinks();

  return (
    <div className="space-y-6">
      {/* Notifications banner */}
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

      {/* Main Bar Info Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-tequila-card border border-tequila-border p-5 rounded-2xl">
        <div className="space-y-1">
          <h2 className="text-xl font-display font-bold text-tequila-orange uppercase tracking-tight flex items-center gap-2">
            <LucideIcon name="Settings" className="w-5 h-5 text-tequila-orange" />
            Manažerský Panel Tequi-la-la
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Nastavení barmanů, provizí, analýza financí a archiv historie prodejů.
          </p>
        </div>

        {/* Sub-Tabs Nav */}
        <div className="flex bg-tequila-dark/60 p-1 rounded-xl border border-tequila-border self-start md:self-auto overflow-x-auto">
          <button
            onClick={() => setActiveSubTab("employees")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === "employees"
                ? "bg-tequila-orange text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <LucideIcon name="Users" className="w-3.5 h-3.5" />
            Zaměstnanci & Provize
          </button>
          <button
            onClick={() => setActiveSubTab("recipes")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === "recipes"
                ? "bg-tequila-orange text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <LucideIcon name="Hammer" className="w-3.5 h-3.5" />
            Recepty (Výroba)
          </button>
          <button
            onClick={() => setActiveSubTab("stats")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === "stats"
                ? "bg-tequila-orange text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <LucideIcon name="BarChart3" className="w-3.5 h-3.5" />
            Statistiky
          </button>
          <button
            onClick={() => setActiveSubTab("history")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === "history"
                ? "bg-tequila-orange text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <LucideIcon name="History" className="w-3.5 h-3.5" />
            Historie transakcí
          </button>
          <button
            onClick={() => setActiveSubTab("backup")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === "backup"
                ? "bg-tequila-orange text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <LucideIcon name="Download" className="w-3.5 h-3.5" />
            Zálohování (JSON)
          </button>
        </div>
      </div>

      {/* SUB TAB 1: EMPLOYEES & COMMISSIONS */}
      {activeSubTab === "employees" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Employee list (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-display font-bold text-gray-400 uppercase tracking-wider">
              Seznam barmanů a stav provizí
            </h3>

            <div className="bg-tequila-card border border-tequila-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-tequila-dark/80 text-[10px] uppercase font-bold tracking-wider text-gray-500 border-b border-tequila-border">
                    <th className="p-4">Uživatel</th>
                    <th className="p-4 text-center">Role</th>
                    <th className="p-4 text-center">Přístupový PIN</th>
                    <th className="p-4 text-center">Sazba Provize</th>
                    <th className="p-4">Nevyplacená provize</th>
                    <th className="p-4">Stav</th>
                    <th className="p-4 text-right">Akce</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-tequila-border/50">
                  {bartenders.map((emp) => (
                    <tr key={emp.id} className="hover:bg-tequila-dark/30 transition-colors">
                      {/* Name */}
                      <td className="p-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-tequila-orange to-tequila-yellow text-tequila-dark flex items-center justify-center font-bold text-sm">
                          {emp.name.split(" ").map(n => n[0]).join("")}
                        </div>
                        <div>
                          <span className="font-semibold text-sm text-gray-100 block">{emp.name}</span>
                          <span className="text-[10px] text-gray-500 font-mono">ID: {emp.id}</span>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="p-4 text-center">
                        <select
                          value={emp.role || "barman"}
                          onChange={(e) => onUpdateBartenderRole?.(emp.id, e.target.value as "manager" | "barman")}
                          className="bg-zinc-950 border border-tequila-border/60 rounded px-2.5 py-1 text-xs text-gray-200 font-sans focus:outline-none focus:border-tequila-orange cursor-pointer"
                        >
                          <option value="barman">🍸 Barman</option>
                          <option value="manager">👑 Manažer</option>
                        </select>
                      </td>

                      {/* Access PIN */}
                      <td className="p-4 text-center">
                        {editingPinId === emp.id ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="text"
                              maxLength={8}
                              value={editingPin}
                              onChange={(e) => setEditingPin(e.target.value.replace(/[^0-9]/g, ""))}
                              className="w-16 bg-tequila-dark border border-tequila-yellow px-1.5 py-1 rounded text-xs font-mono text-center font-bold text-tequila-yellow"
                            />
                            <button
                              onClick={() => handleUpdatePin(emp.id)}
                              className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
                            >
                              <LucideIcon name="Check" className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingPinId(null)}
                              className="p-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded cursor-pointer"
                            >
                              <LucideIcon name="X" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-mono text-sm font-bold text-gray-200">{emp.pin || "----"}</span>
                            <button
                              onClick={() => {
                                setEditingPinId(emp.id);
                                setEditingPin(emp.pin || "");
                              }}
                              className="text-gray-500 hover:text-tequila-yellow p-0.5 cursor-pointer"
                              title="Upravit PIN"
                            >
                              ✏️
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Commission rate */}
                      <td className="p-4 text-center">
                        {editingEmpId === emp.id ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={editingRate}
                              onChange={(e) => setEditingRate(Number(e.target.value))}
                              className="w-14 bg-tequila-dark border border-tequila-yellow px-1.5 py-1 rounded text-xs font-mono text-center font-bold text-tequila-yellow"
                            />
                            <button
                              onClick={() => handleUpdateCommission(emp.id)}
                              className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
                            >
                              <LucideIcon name="Check" className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingEmpId(null)}
                              className="p-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded cursor-pointer"
                            >
                              <LucideIcon name="X" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-mono text-sm font-bold text-gray-200">{emp.commissionRate}%</span>
                            <button
                              onClick={() => {
                                setEditingEmpId(emp.id);
                                setEditingRate(emp.commissionRate);
                              }}
                              className="text-gray-500 hover:text-tequila-yellow p-0.5 cursor-pointer"
                            >
                              ✏️
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Accumulated commissions */}
                      <td className="p-4">
                        <span className="font-mono text-sm font-bold text-tequila-yellow">
                          ${emp.totalCommissionEarned.toFixed(2)}
                        </span>
                      </td>

                      {/* Status Active/Inactive toggle */}
                      <td className="p-4">
                        <button
                          onClick={() => onUpdateBartenderStatus(emp.id, emp.status !== "active")}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                            emp.status === "active"
                              ? "bg-emerald-950/40 border-emerald-500/20 text-emerald-400"
                              : "bg-gray-900 border-gray-800 text-gray-500"
                          }`}
                        >
                          {emp.status === "active" ? "Aktivní" : "Vypnutý"}
                        </button>
                      </td>

                      {/* Cash out commissions payout action */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handlePayout(emp.id)}
                            disabled={emp.totalCommissionEarned <= 0}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              emp.totalCommissionEarned <= 0
                                ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                                : "bg-tequila-yellow hover:bg-tequila-yellow/90 text-tequila-dark"
                            }`}
                          >
                            <LucideIcon name="Coins" className="w-3.5 h-3.5" />
                            Vyplatit
                          </button>
                          
                          {deleteConfirmEmpId === emp.id ? (
                            <div className="flex items-center gap-1 bg-rose-950/35 border border-rose-500/20 p-1 rounded-lg animate-pulse">
                              <button
                                onClick={() => {
                                  onDeleteBartender(emp.id);
                                  triggerAlert("success", `Zaměstnanec "${emp.name}" byl smazán.`);
                                  setDeleteConfirmEmpId(null);
                                }}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                              >
                                Smazat
                              </button>
                              <button
                                onClick={() => setDeleteConfirmEmpId(null)}
                                className="p-1 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 rounded cursor-pointer"
                                title="Zrušit"
                              >
                                <LucideIcon name="X" className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmEmpId(emp.id)}
                              className="p-1.5 bg-rose-950/40 hover:bg-rose-900 border border-rose-500/20 text-rose-400 hover:text-white rounded-lg transition-all cursor-pointer"
                              title="Smazat barmana"
                            >
                              <LucideIcon name="Trash2" className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>

          {/* Add Employee Form Sidebar (1 col) */}
          <div className="lg:col-span-1">
            <div className="bg-tequila-card border border-tequila-border p-5 rounded-2xl space-y-4">
              <h3 className="font-display font-bold text-gray-200 uppercase tracking-wider text-sm flex items-center gap-2 border-b border-tequila-border pb-3">
                <LucideIcon name="Users" className="w-4 h-4 text-tequila-orange" />
                Registrace uživatele
              </h3>

              <form onSubmit={handleCreateEmployee} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 font-bold mb-1 uppercase tracking-wider">
                    Jméno uživatele / RP Nickname
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Např. Eliška Nováková..."
                    value={newEmpName}
                    onChange={(e) => setNewEmpName(e.target.value)}
                    className="w-full bg-tequila-dark border border-tequila-border px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:border-tequila-orange"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 font-bold mb-1 uppercase tracking-wider">
                    Role uživatele
                  </label>
                  <select
                    value={newEmpRole}
                    onChange={(e) => setNewEmpRole(e.target.value as "manager" | "barman")}
                    className="w-full bg-tequila-dark border border-tequila-border px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:border-tequila-orange text-white cursor-pointer"
                  >
                    <option value="barman">🍸 Barman (Přístup pouze do POS)</option>
                    <option value="manager">👑 Manažer (Přístup do všeho)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 font-bold mb-1 uppercase tracking-wider">
                    Sazba provize z prodeje (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={newEmpRate}
                    onChange={(e) => setNewEmpRate(Number(e.target.value))}
                    className="w-full bg-tequila-dark border border-tequila-border px-3.5 py-2.5 rounded-xl text-sm font-mono text-gray-100 focus:outline-none focus:border-tequila-orange"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Kolik % z každého prodeje uživatel obdrží jako provizi.</p>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 font-bold mb-1 uppercase tracking-wider">
                    Přístupový PIN kód (4-8 číslic)
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    placeholder="Ponechte prázdné pro náhodný PIN..."
                    value={newEmpPin}
                    onChange={(e) => setNewEmpPin(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full bg-tequila-dark border border-tequila-border px-3.5 py-2.5 rounded-xl text-sm font-mono text-gray-100 focus:outline-none focus:border-tequila-orange"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Číselný PIN kód, kterým se uživatel bude přihlašovat.</p>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-tequila-orange hover:bg-tequila-orange/90 text-white font-display font-bold text-xs uppercase tracking-wider rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  Zaregistrovat uživatele
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB: RECIPE MANAGEMENT (DÍLNA) */}
      {activeSubTab === "recipes" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Recipe List (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-display font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <LucideIcon name="BookOpen" className="w-4 h-4 text-tequila-orange" />
              Aktuálně nastavené receptury
            </h3>

            {recipes.length === 0 ? (
              <div className="bg-tequila-card/30 border border-tequila-border border-dashed p-10 rounded-2xl text-center text-gray-500 font-mono text-xs uppercase">
                Zatím nebyly definovány žádné recepty. Vytvořte nový recept v pravém panelu.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recipes.map((recipe) => {
                  const resultItem = items.find((i) => i.id === recipe.resultItemId);
                  if (!resultItem) return null;

                  // Calculate production cost
                  const prodCost = recipe.ingredients.reduce((sum, ing) => {
                    const ingItem = items.find((it) => it.id === ing.itemId);
                    return sum + (ingItem ? ingItem.purchasePrice * ing.quantity : 0);
                  }, 0);

                  return (
                    <div
                      key={recipe.id}
                      className="bg-tequila-card border border-tequila-border p-5 rounded-2xl flex flex-col justify-between font-mono hover:border-tequila-orange/80 transition-all"
                    >
                      <div>
                        {/* Recipe Header */}
                        <div className="flex justify-between items-start border-b border-tequila-border/40 pb-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-zinc-950 text-tequila-yellow border border-tequila-border rounded-xl">
                              <LucideIcon name={resultItem.iconName} className="w-4.5 h-4.5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-100 text-xs uppercase">
                                {resultItem.name}
                              </h4>
                              <p className="text-[9px] text-zinc-500 mt-0.5">UID: {recipe.id}</p>
                            </div>
                          </div>
                          
                          {deleteRecipeConfirmId === recipe.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  onDeleteRecipe(recipe.id);
                                  triggerAlert("success", `Recept na "${resultItem.name}" byl smazán.`);
                                  setDeleteRecipeConfirmId(null);
                                }}
                                className="px-2 py-1 bg-rose-950/60 hover:bg-rose-600 border border-rose-500 text-rose-300 hover:text-white rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                title="Klikněte pro potvrzení smazání receptu"
                              >
                                Smazat?
                              </button>
                              <button
                                onClick={() => setDeleteRecipeConfirmId(null)}
                                className="p-1 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded cursor-pointer"
                                title="Zrušit"
                              >
                                <LucideIcon name="X" className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleEditRecipeClick(recipe.id)}
                                className="p-1.5 bg-zinc-950 border border-zinc-900 hover:border-tequila-orange text-zinc-500 hover:text-tequila-orange rounded-lg transition-colors cursor-pointer"
                                title="Upravit recept"
                              >
                                <LucideIcon name="Pencil" className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteRecipeConfirmId(recipe.id);
                                  setTimeout(() => {
                                    setDeleteRecipeConfirmId(prev => prev === recipe.id ? null : prev);
                                  }, 4000);
                                }}
                                className="p-1.5 bg-zinc-950 border border-zinc-900 hover:border-rose-500 text-zinc-500 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                                title="Smazat recept"
                              >
                                <LucideIcon name="Trash2" className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Ingredients */}
                        <div className="space-y-1 bg-zinc-950/80 p-3 rounded-xl border border-tequila-border/30 text-[10px] text-gray-400 mb-3">
                          <span className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                            Suroviny (Na várku {recipe.yieldAmount ?? 20} ks):
                          </span>
                          {recipe.ingredients.map((ing) => {
                            const ingItem = items.find((it) => it.id === ing.itemId);
                            return (
                              <div key={ing.itemId} className="flex justify-between">
                                <span className="text-zinc-300">● {ingItem?.name || ing.itemId}</span>
                                <span className="font-bold text-gray-200">
                                  {ing.quantity} ks (${((ingItem?.purchasePrice || 0) * ing.quantity).toFixed(2)})
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Cost and Stats */}
                      <div className="border-t border-tequila-border/30 pt-3 space-y-2 text-[10px]">
                        <div className="flex justify-between items-baseline">
                          <span className="text-zinc-500 uppercase text-[9px] tracking-wide">Výroba várky ({recipe.yieldAmount ?? 20} ks):</span>
                          <span className="font-bold text-emerald-400">${prodCost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-zinc-500 uppercase text-[9px] tracking-wide">Tržba z várky ({recipe.yieldAmount ?? 20} ks):</span>
                          <span className="font-bold text-tequila-yellow">${(resultItem.sellPrice * (recipe.yieldAmount ?? 20)).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-baseline pt-1.5 border-t border-tequila-border/10 font-bold">
                          <span className="text-zinc-400 uppercase text-[9px] tracking-wide">Čistý zisk z várky:</span>
                          <span className="text-emerald-300">${((resultItem.sellPrice * (recipe.yieldAmount ?? 20)) - prodCost).toFixed(2)}</span>
                        </div>

                        {/* Kalkulace na 1 ks */}
                        <div className="bg-zinc-950/40 border border-tequila-border/20 rounded-xl p-2.5 mt-2 space-y-1">
                          <span className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                            Kalkulace na 1 ks drinku (Cena várky / {recipe.yieldAmount ?? 20}):
                          </span>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-zinc-400">Náklad na 1 ks:</span>
                            <span className="font-bold text-emerald-400">${(prodCost / (recipe.yieldAmount ?? 20)).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-zinc-400">Prodejní cena:</span>
                            <span className="font-bold text-tequila-yellow">${resultItem.sellPrice.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-[10px] pt-1 border-t border-zinc-900/60 font-bold">
                            <span className="text-zinc-300">Čistý zisk / ks:</span>
                            <span className="text-emerald-300">${(resultItem.sellPrice - (prodCost / (recipe.yieldAmount ?? 20))).toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="flex justify-end text-zinc-650 text-[9px] pt-1">
                          <span>Marže: {resultItem.sellPrice * (recipe.yieldAmount ?? 20) > 0 ? ((((resultItem.sellPrice * (recipe.yieldAmount ?? 20)) - prodCost) / (resultItem.sellPrice * (recipe.yieldAmount ?? 20))) * 100).toFixed(0) : "0"}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add/Edit Recipe Form Sidebar (1 col) */}
          <div className="lg:col-span-1">
            <div className="bg-tequila-card border border-tequila-border p-5 rounded-2xl space-y-5 sticky top-6 font-mono">
              <h3 className="font-display font-bold text-gray-200 uppercase tracking-wider text-xs flex items-center justify-between border-b border-tequila-border pb-3">
                <div className="flex items-center gap-2">
                  <LucideIcon name={editingRecipeId ? "Pencil" : "PlusCircle"} className="w-4 h-4 text-tequila-orange" />
                  <span>{editingRecipeId ? "Upravit recept" : "Nový výrobní recept"}</span>
                </div>
                {editingRecipeId && (
                  <button
                    type="button"
                    onClick={handleCancelEditRecipe}
                    className="text-[10px] bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-2 py-1 rounded text-zinc-400 hover:text-white uppercase font-bold cursor-pointer transition-colors"
                  >
                    Zrušit
                  </button>
                )}
              </h3>

              <form onSubmit={handleCreateRecipe} className="space-y-4">
                {editingRecipeId ? (
                  /* Edit Mode Product Details */
                  <div className="space-y-3.5 border border-amber-500/30 p-3.5 rounded-xl bg-amber-950/10">
                    <span className="block text-[9px] font-bold text-amber-500 uppercase tracking-wider">
                      Detaily výsledného produktu
                    </span>

                    <div className="text-xs">
                      <label className="block text-[8px] text-zinc-500 font-bold mb-1 uppercase">
                        Název produktu na serveru
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Např. Sex on the Beach..."
                        value={newRecResultItemName}
                        onChange={(e) => setNewRecResultItemName(e.target.value)}
                        className="w-full bg-tequila-dark border border-tequila-border px-3 py-2 rounded-xl text-xs text-gray-100 focus:outline-none focus:border-tequila-orange"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-xs">
                        <label className="block text-[8px] text-zinc-500 font-bold mb-1 uppercase">
                          Prodejní cena ($)
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={newRecResultItemSellPrice}
                          onChange={(e) => setNewRecResultItemSellPrice(Number(e.target.value))}
                          className="w-full bg-tequila-dark border border-tequila-border px-3 py-2 rounded-xl text-xs text-gray-100 font-mono focus:outline-none focus:border-tequila-orange"
                        />
                      </div>

                      <div className="text-xs">
                        <label className="block text-[8px] text-zinc-500 font-bold mb-1 uppercase">
                          Minimální zásoba
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={newRecResultItemMinStock}
                          onChange={(e) => setNewRecResultItemMinStock(Number(e.target.value))}
                          className="w-full bg-tequila-dark border border-tequila-border px-3 py-2 rounded-xl text-xs text-gray-100 font-mono focus:outline-none focus:border-tequila-orange"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-xs">
                        <label className="block text-[8px] text-zinc-500 font-bold mb-1 uppercase">
                          Kategorie
                        </label>
                        <select
                          value={newRecResultItemCategory}
                          onChange={(e) => setNewRecResultItemCategory(e.target.value as ItemCategory)}
                          className="w-full bg-tequila-dark border border-tequila-border px-2 py-2 rounded-xl text-[11px] text-gray-300 focus:outline-none focus:border-tequila-orange"
                        >
                          <option value="drink">🍹 Míchaný drink</option>
                          <option value="shot">🥃 Shot (Panák)</option>
                          <option value="beer">🍺 Pivo</option>
                          <option value="hookah">💨 Dýmka</option>
                          <option value="tobacco">🚬 Tabák</option>
                          <option value="alcohol">🥃 Surovina: Alkohol</option>
                          <option value="soft">🥤 Surovina: Nealko</option>
                          <option value="other">📦 Ostatní</option>
                        </select>
                      </div>

                      <div className="text-xs">
                        <label className="block text-[8px] text-zinc-500 font-bold mb-1 uppercase">
                          Ikona
                        </label>
                        <select
                          value={newRecResultItemIcon}
                          onChange={(e) => setNewRecResultItemIcon(e.target.value)}
                          className="w-full bg-tequila-dark border border-tequila-border px-2 py-2 rounded-xl text-[11px] text-gray-300 focus:outline-none focus:border-tequila-orange"
                        >
                          <option value="Wine">🍷 Sklenice / Koktejl</option>
                          <option value="Wind">💨 Dýmka / Kouř</option>
                          <option value="Cigarette">🚬 Cigarety / Tabák</option>
                          <option value="Beer">🍺 Pivo</option>
                          <option value="GlassWater">🥃 Panák / Shot</option>
                          <option value="CupSoda">🥤 Kelímek / Nealko</option>
                          <option value="Flame">🔥 Uhlíky / Ostré</option>
                          <option value="Citrus">🍋 Citrus / Příchuť</option>
                          <option value="ChefHat">🍔 Jídlo</option>
                          <option value="Package">📦 Balení / Ostatní</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Mode Selector */}
                    <div className="text-xs space-y-1.5">
                      <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                        Metoda výběru produktu
                      </label>
                      <div className="flex bg-zinc-950/60 p-1 rounded-xl border border-tequila-border/40 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setRecipeTargetMode("existing");
                            setNewRecResultItemId("");
                            setNewRecResultItemName("");
                          }}
                          className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                            recipeTargetMode === "existing"
                              ? "bg-tequila-orange text-white"
                              : "text-zinc-400 hover:text-white"
                          }`}
                        >
                          Z katalogu
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRecipeTargetMode("new");
                            setNewRecResultItemId("");
                            setNewRecResultItemName("");
                          }}
                          className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                            recipeTargetMode === "new"
                              ? "bg-tequila-orange text-white"
                              : "text-zinc-400 hover:text-white"
                          }`}
                        >
                          Napsat název
                        </button>
                      </div>
                    </div>

                    {recipeTargetMode === "existing" ? (
                      /* Resulting Drink */
                      <div className="text-xs">
                        <label className="block text-[9px] text-zinc-500 font-bold mb-1 uppercase tracking-wider">
                          Cílový míchaný produkt (drink)
                        </label>
                        <select
                          required={recipeTargetMode === "existing"}
                          value={newRecResultItemId}
                          onChange={(e) => {
                            setNewRecResultItemId(e.target.value);
                            // Try to auto-set temp ingredient id if empty
                            const rawItems = items.filter(it => it.type === "raw");
                            if (rawItems.length > 0 && !tempIngId) {
                              setTempIngId(rawItems[0].id);
                            }
                          }}
                          className="w-full bg-tequila-dark border border-tequila-border px-3 py-2 rounded-xl text-xs text-gray-200 focus:outline-none focus:border-tequila-orange"
                        >
                          <option value="" disabled>Vyberte produkt z katalogu...</option>
                          {items
                            .filter((it) => it.type === "crafted")
                            .map((it) => (
                              <option key={it.id} value={it.id} className="bg-tequila-card">
                                {it.name} (${it.sellPrice}/ks)
                              </option>
                            ))}
                        </select>
                        <p className="text-[9px] text-zinc-600 mt-1">
                          Musí se jednat o položku typu "Míchaný" s definovanou prodejní cenou.
                        </p>
                      </div>
                    ) : (
                      /* Create New Product Details */
                      <div className="space-y-3.5 border border-tequila-border/40 p-3.5 rounded-xl bg-zinc-950/20">
                        <span className="block text-[9px] font-bold text-tequila-orange uppercase tracking-wider">
                          Nový produkt (FiveM)
                        </span>

                    <div className="text-xs">
                      <label className="block text-[8px] text-zinc-500 font-bold mb-1 uppercase">
                        Název produktu na serveru
                      </label>
                      <input
                        type="text"
                        required={recipeTargetMode === "new"}
                        placeholder="Např. Sex on the Beach..."
                        value={newRecResultItemName}
                        onChange={(e) => {
                          setNewRecResultItemName(e.target.value);
                          const rawItems = items.filter(it => it.type === "raw");
                          if (rawItems.length > 0 && !tempIngId) {
                            setTempIngId(rawItems[0].id);
                          }
                        }}
                        className="w-full bg-tequila-dark border border-tequila-border px-3 py-2 rounded-xl text-xs text-gray-100 focus:outline-none focus:border-tequila-orange"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-xs">
                        <label className="block text-[8px] text-zinc-500 font-bold mb-1 uppercase">
                          Prodejní cena ($)
                        </label>
                        <input
                          type="number"
                          min="1"
                          required={recipeTargetMode === "new"}
                          value={newRecResultItemSellPrice}
                          onChange={(e) => setNewRecResultItemSellPrice(Number(e.target.value))}
                          className="w-full bg-tequila-dark border border-tequila-border px-3 py-2 rounded-xl text-xs text-gray-100 font-mono focus:outline-none focus:border-tequila-orange"
                        />
                      </div>

                      <div className="text-xs">
                        <label className="block text-[8px] text-zinc-500 font-bold mb-1 uppercase">
                          Minimální zásoba
                        </label>
                        <input
                          type="number"
                          min="1"
                          required={recipeTargetMode === "new"}
                          value={newRecResultItemMinStock}
                          onChange={(e) => setNewRecResultItemMinStock(Number(e.target.value))}
                          className="w-full bg-tequila-dark border border-tequila-border px-3 py-2 rounded-xl text-xs text-gray-100 font-mono focus:outline-none focus:border-tequila-orange"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-xs">
                        <label className="block text-[8px] text-zinc-500 font-bold mb-1 uppercase">
                          Kategorie
                        </label>
                        <select
                          value={newRecResultItemCategory}
                          onChange={(e) => setNewRecResultItemCategory(e.target.value as ItemCategory)}
                          className="w-full bg-tequila-dark border border-tequila-border px-2 py-2 rounded-xl text-[11px] text-gray-300 focus:outline-none focus:border-tequila-orange"
                        >
                          <option value="drink">🍹 Míchaný drink</option>
                          <option value="shot">🥃 Shot (Panák)</option>
                          <option value="beer">🍺 Pivo</option>
                          <option value="hookah">💨 Dýmka</option>
                          <option value="tobacco">🚬 Tabák</option>
                          <option value="alcohol">🥃 Surovina: Alkohol</option>
                          <option value="soft">🥤 Surovina: Nealko</option>
                          <option value="other">📦 Ostatní</option>
                        </select>
                      </div>

                      <div className="text-xs">
                        <label className="block text-[8px] text-zinc-500 font-bold mb-1 uppercase">
                          Ikona
                        </label>
                        <select
                          value={newRecResultItemIcon}
                          onChange={(e) => setNewRecResultItemIcon(e.target.value)}
                          className="w-full bg-tequila-dark border border-tequila-border px-2 py-2 rounded-xl text-[11px] text-gray-300 focus:outline-none focus:border-tequila-orange"
                        >
                          <option value="Wine">🍷 Sklenice / Koktejl</option>
                          <option value="Wind">💨 Dýmka / Kouř</option>
                          <option value="Cigarette">🚬 Cigarety / Tabák</option>
                          <option value="Beer">🍺 Pivo</option>
                          <option value="GlassWater">🥃 Panák / Shot</option>
                          <option value="CupSoda">🥤 Kelímek / Nealko</option>
                          <option value="Flame">🔥 Uhlíky / Ostré</option>
                          <option value="Citrus">🍋 Citrus / Příchuť</option>
                          <option value="ChefHat">🍔 Jídlo</option>
                          <option value="Package">📦 Balení / Ostatní</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

                {/* Yield Amount */}
                <div className="text-xs">
                  <label className="block text-[9px] text-zinc-500 font-bold mb-1 uppercase tracking-wider">
                    Kusů na várku
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newRecYieldAmount}
                    onChange={(e) => setNewRecYieldAmount(Number(e.target.value))}
                    className="w-full bg-tequila-dark border border-tequila-border px-3 py-2 rounded-xl text-xs text-gray-100 font-mono focus:outline-none focus:border-tequila-orange"
                  />
                </div>

                {/* Ingredients manager */}
                <div className="border border-tequila-border/40 p-3 rounded-xl bg-zinc-950/40 space-y-3">
                  <span className="block text-[9px] font-bold text-tequila-yellow uppercase tracking-wider">
                    Definice surovin pro recept
                  </span>

                  {/* Temporary Ingredients Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                    <div className="sm:col-span-2">
                      <label className="block text-[8px] text-zinc-500 font-bold mb-1 uppercase">Surovina</label>
                      <select
                        value={tempIngId}
                        onChange={(e) => setTempIngId(e.target.value)}
                        className="w-full bg-tequila-dark border border-tequila-border px-2 py-1.5 rounded text-[10px] text-gray-300 focus:outline-none"
                      >
                        <option value="" disabled>Zvolte...</option>
                        {items
                          .filter((it) => it.type === "raw")
                          .map((it) => (
                            <option key={it.id} value={it.id} className="bg-tequila-card">
                              {it.name} (${it.purchasePrice}/ks)
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[8px] text-zinc-500 font-bold mb-1 uppercase">Množství (ks)</label>
                      <input
                        type="number"
                        step="0.05"
                        min="0.05"
                        value={tempIngQty}
                        onChange={(e) => setTempIngQty(Number(e.target.value))}
                        className="w-full bg-tequila-dark border border-tequila-border px-2 py-1 rounded text-[10px] text-gray-100 font-mono focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddIngredientRow}
                      className="sm:col-span-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-[10px] font-bold text-gray-200 rounded uppercase tracking-wider cursor-pointer border border-tequila-border/30 transition-all text-center flex items-center justify-center gap-1"
                    >
                      <LucideIcon name="Plus" className="w-3.5 h-3.5" />
                      Přidat ingredienci do receptu
                    </button>
                  </div>

                  {/* Current In-creation ingredients list */}
                  {newRecIngredients.length > 0 && (
                    <div className="border-t border-tequila-border/40 pt-2.5 space-y-1.5 font-mono text-[10px]">
                      <span className="block text-[8px] font-bold text-zinc-600 uppercase">Aktuální sestava:</span>
                      <div className="divide-y divide-tequila-border/20 max-h-[140px] overflow-y-auto pr-1">
                        {newRecIngredients.map((ing) => {
                          const item = items.find((it) => it.id === ing.itemId);
                          return (
                            <div key={ing.itemId} className="py-1 flex justify-between items-center text-zinc-300">
                              <span>● {item?.name || ing.itemId} ({ing.quantity} ks)</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveIngredientRow(ing.itemId)}
                                className="text-zinc-500 hover:text-rose-500 p-0.5 cursor-pointer transition-colors"
                              >
                                <LucideIcon name="X" className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Cumulative Price Estimator */}
                      <div className="border-t border-dashed border-tequila-border/30 pt-2 text-[10px] flex justify-between items-baseline">
                        <span className="text-zinc-500 uppercase text-[8px]">Odhad ceny surovin na várku:</span>
                        <span className="font-bold text-emerald-400">
                          ${newRecIngredients.reduce((sum, ing) => {
                            const item = items.find((it) => it.id === ing.itemId);
                            return sum + (item ? item.purchasePrice * ing.quantity : 0);
                          }, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Final Submit */}
                <div className="space-y-2">
                  <button
                    type="submit"
                    disabled={
                      newRecIngredients.length === 0 ||
                      (!editingRecipeId && recipeTargetMode === "existing" && !newRecResultItemId) ||
                      (!editingRecipeId && recipeTargetMode === "new" && !newRecResultItemName.trim()) ||
                      (editingRecipeId && !newRecResultItemName.trim())
                    }
                    className={`w-full py-3.5 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                      newRecIngredients.length === 0 ||
                      (!editingRecipeId && recipeTargetMode === "existing" && !newRecResultItemId) ||
                      (!editingRecipeId && recipeTargetMode === "new" && !newRecResultItemName.trim()) ||
                      (editingRecipeId && !newRecResultItemName.trim())
                        ? "bg-zinc-900 border border-zinc-800 text-zinc-650 cursor-not-allowed"
                        : "bg-tequila-orange hover:bg-tequila-orange/90 text-white animate-pulse-subtle"
                    }`}
                  >
                    {editingRecipeId ? "Uložit změny receptu" : "Uložit výrobní recept"}
                  </button>

                  {editingRecipeId && (
                    <button
                      type="button"
                      onClick={handleCancelEditRecipe}
                      className="w-full py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer text-center"
                    >
                      Zrušit úpravu
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 2: BUSINESS STATS & GRAPHICS */}
      {activeSubTab === "stats" && (
        <div className="space-y-6">
          {/* Monthly Shift Summary Banner */}
          <div className="bg-gradient-to-r from-amber-950/30 via-zinc-900 to-zinc-950 border border-amber-500/30 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl">
                <LucideIcon name="Calendar" className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-display font-bold text-white uppercase tracking-tight">
                    Měsíční výkaz směn a tržeb (Srpen 2026)
                  </h4>
                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    Aktivní data
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Od 1. srpna do 26. srpna zaznamenáno <strong>{(shifts || []).length} směn</strong> (~
                  {(
                    (shifts || []).reduce((acc, s) => {
                      const dur = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
                      return acc + (isNaN(dur) ? 0 : Math.max(0, dur));
                    }, 0) / (1000 * 60 * 60)
                  ).toFixed(1)}{" "}
                  hodin) a <strong>${totalRevenue.toFixed(0)}</strong> v tržbách napříč barmany.
                </p>
              </div>
            </div>

            {onLoadSimulatedData && (
              <button
                type="button"
                onClick={() => {
                  onLoadSimulatedData();
                  triggerAlert("success", "Srpnová data směn (~110h) a tržeb (~$130k) byla úspěšně obnovena!");
                }}
                className="py-2.5 px-4 bg-zinc-900 hover:bg-zinc-850 hover:text-white border border-amber-500/30 hover:border-amber-500 text-amber-400 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 shadow"
              >
                <LucideIcon name="RefreshCw" className="w-3.5 h-3.5" />
                Obnovit data za srpen (110h / $130k)
              </button>
            )}
          </div>

          {/* Business KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Revenue */}
            <div className="bg-tequila-card border border-tequila-border p-4 rounded-2xl">
              <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Celkové Tržby</span>
              <p className="text-xl md:text-2xl font-mono font-bold text-emerald-400 mt-1">${totalRevenue.toFixed(2)}</p>
              <span className="text-[9px] text-gray-600 font-bold font-mono">z prodeje drinků</span>
            </div>

            {/* Expenses */}
            <div className="bg-tequila-card border border-tequila-border p-4 rounded-2xl">
              <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Výdaje zásobování</span>
              <p className="text-xl md:text-2xl font-mono font-bold text-rose-400 mt-1">${totalExpenses.toFixed(2)}</p>
              <span className="text-[9px] text-gray-600 font-bold font-mono">nákup od dodavatele</span>
            </div>

            {/* Paid Commissions */}
            <div className="bg-tequila-card border border-tequila-border p-4 rounded-2xl">
              <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Vyplacené provize</span>
              <p className="text-xl md:text-2xl font-mono font-bold text-tequila-yellow mt-1">${totalPaidCommissions.toFixed(2)}</p>
              <span className="text-[9px] text-gray-600 font-bold font-mono">převzato barmany</span>
            </div>

            {/* Pending Commissions */}
            <div className="bg-tequila-card border border-tequila-border p-4 rounded-2xl">
              <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nevyplacené provize</span>
              <p className="text-xl md:text-2xl font-mono font-bold text-blue-400 mt-1">${totalPendingCommissions.toFixed(2)}</p>
              <span className="text-[9px] text-gray-600 font-bold font-mono">stále k výplatě</span>
            </div>

            {/* Cash register balance */}
            <div className="bg-tequila-card border border-tequila-border p-4 rounded-2xl bg-gradient-to-tr from-tequila-orange/5 to-transparent neon-border-orange col-span-2 lg:col-span-1">
              <span className="block text-[10px] font-bold text-tequila-orange uppercase tracking-wider">Stav Kasy Baru</span>
              <p className="text-2xl md:text-3xl font-mono font-bold text-tequila-orange neon-glow-orange mt-1">
                ${registerBalance.toFixed(2)}
              </p>
              <span className="text-[9px] text-gray-400 font-bold font-mono">hotovost na baru</span>
            </div>
          </div>

          {/* NET PROFIT BAR */}
          <div className="bg-tequila-card border border-tequila-border p-5 rounded-2xl space-y-3">
            <div className="flex justify-between items-baseline">
              <div>
                <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Čistý zisk podniku</span>
                <span className="text-[10px] text-gray-500 block">(Tržby - Výdaje - Vyplacené provize)</span>
              </div>
              <span className={`text-2xl font-mono font-bold ${netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {netProfit >= 0 ? `+$${netProfit.toFixed(2)}` : `-$${Math.abs(netProfit).toFixed(2)}`}
              </span>
            </div>
            
            {/* Graphic visual indicator of performance */}
            <div className="h-2 bg-tequila-dark rounded-full overflow-hidden flex">
              {totalRevenue > 0 ? (
                <>
                  <div
                    className="h-full bg-rose-500"
                    title={`Výdaje za zásoby: ${((totalExpenses / totalRevenue) * 100).toFixed(0)}%`}
                    style={{ width: `${Math.min(100, (totalExpenses / totalRevenue) * 100)}%` }}
                  ></div>
                  <div
                    className="h-full bg-tequila-yellow"
                    title={`Vyplacené provize: ${((totalPaidCommissions / totalRevenue) * 100).toFixed(0)}%`}
                    style={{ width: `${Math.min(100, (totalPaidCommissions / totalRevenue) * 100)}%` }}
                  ></div>
                  <div
                    className="h-full bg-emerald-500"
                    title={`Čistý zisk: ${((netProfit / totalRevenue) * 100).toFixed(0)}%`}
                    style={{ width: `${Math.max(0, (netProfit / totalRevenue) * 100)}%` }}
                  ></div>
                </>
              ) : (
                <div className="h-full w-full bg-gray-800"></div>
              )}
            </div>
            <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase font-mono">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-rose-500"></span> Výdaje zásob</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-tequila-yellow"></span> Vyplacené provize</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500"></span> Čistý zisk</span>
            </div>
          </div>

          {/* Dynamic SVG Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top drinks SVG bar chart */}
            <div className="bg-tequila-card border border-tequila-border p-5 rounded-2xl">
              <h3 className="text-sm font-display font-bold text-gray-200 uppercase tracking-wider mb-5 flex items-center gap-2">
                🍹 Top 5 nejprodávanějších drinků
              </h3>

              {topDrinks.length === 0 ? (
                <div className="h-[200px] flex flex-col justify-center items-center text-gray-500 text-xs border border-dashed border-tequila-border rounded-xl">
                  Žádné prodeje nebyly dosud uskutečněny.
                </div>
              ) : (
                <div className="space-y-4">
                  {topDrinks.map((d, idx) => {
                    const maxQty = topDrinks[0].qty || 1;
                    const percent = (d.qty / maxQty) * 100;

                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="font-semibold text-gray-300">{d.name}</span>
                          <span className="font-mono font-bold text-tequila-orange">{d.qty} ks</span>
                        </div>
                        <div className="h-2.5 bg-tequila-dark rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-tequila-orange to-tequila-yellow rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Inventory shortage levels alerts */}
            <div className="bg-tequila-card border border-tequila-border p-5 rounded-2xl">
              <h3 className="text-sm font-display font-bold text-gray-200 uppercase tracking-wider mb-5 flex items-center gap-2">
                ⚠️ Nedostatek surovin na skladě
              </h3>

              {/* Filter items with stock <= minStock */}
              {items.filter((i) => i.stock <= i.minStock).length === 0 ? (
                <div className="h-[200px] flex flex-col justify-center items-center text-emerald-400 text-xs border border-dashed border-tequila-border/50 rounded-xl bg-emerald-950/5">
                  <p className="text-xl">✅</p>
                  <p className="mt-2 font-medium">Všechny suroviny jsou dostatečně naskladněné.</p>
                </div>
              ) : (
                <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-2">
                  {items
                    .filter((i) => i.stock <= i.minStock)
                    .slice(0, 5)
                    .map((item, idx) => {
                      const isOut = item.stock === 0;
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                            isOut
                              ? "bg-rose-950/20 border-rose-500/20 text-rose-300"
                              : "bg-amber-950/20 border-amber-500/20 text-amber-300"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <LucideIcon name={item.iconName} className="w-4 h-4 flex-shrink-0" />
                            <div>
                              <span className="font-semibold">{item.name}</span>
                              <span className="text-[10px] block opacity-70">
                                Minimální zásoba: {item.minStock} ks
                              </span>
                            </div>
                          </div>
                          <span className="font-mono font-bold text-sm">
                            {isOut ? "VYPRODÁNO" : `${item.stock.toFixed(1)} ks`}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 3: TRANSACTION ARCHIVES */}
      {activeSubTab === "history" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Shift History & Sales Logs (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Active shift if any */}
            {(() => {
              const activeB = bartenders.find(b => b.onShift);
              if (!activeB) return null;

              // Find sales for active shift
              const bShifts = (shifts || []).filter(s => s.bartenderId === activeB.id);
              let activeSales = [];
              if (bShifts.length === 0) {
                activeSales = sales.filter(s => s.bartenderId === activeB.id);
              } else {
                const lastShift = [...bShifts].sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())[0];
                activeSales = sales.filter(s => s.bartenderId === activeB.id && new Date(s.timestamp).getTime() > new Date(lastShift.endTime).getTime());
              }

              const activeTotal = activeSales.reduce((sum, s) => sum + s.totalAmount, 0);
              const activeCommission = activeSales.reduce((sum, s) => sum + s.commissionPaid, 0);

              return (
                <div className="bg-gradient-to-r from-amber-950/20 to-zinc-900 border border-amber-500/30 p-5 rounded-2xl space-y-4 shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                      <div>
                        <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                          Aktivní probíhající směna
                        </h4>
                        <span className="text-sm font-bold text-gray-100 uppercase mt-0.5 block">
                          {activeB.name}
                        </span>
                      </div>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">
                        Stav pokladny
                      </span>
                      <span className="text-[11px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full inline-block mt-0.5">
                        Otevřená (Právě probíhá)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 font-mono text-xs">
                    <div className="bg-zinc-950/50 p-2.5 rounded-xl border border-tequila-border/30">
                      <span className="block text-[8px] text-zinc-500 uppercase font-bold">Prodeje</span>
                      <span className="font-bold text-gray-200 mt-0.5 block">{activeSales.length} ks</span>
                    </div>
                    <div className="bg-zinc-950/50 p-2.5 rounded-xl border border-tequila-border/30">
                      <span className="block text-[8px] text-zinc-500 uppercase font-bold">Průběžná tržba</span>
                      <span className="font-bold text-emerald-400 mt-0.5 block">${activeTotal.toFixed(2)}</span>
                    </div>
                    <div className="bg-zinc-950/50 p-2.5 rounded-xl border border-tequila-border/30">
                      <span className="block text-[8px] text-zinc-500 uppercase font-bold">Odhad provize</span>
                      <span className="font-bold text-tequila-yellow mt-0.5 block">${activeCommission.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Active shift progressive sales list */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => toggleShiftExpand("active_shift")}
                      className="w-full flex items-center justify-between py-1.5 px-3 bg-zinc-900/60 hover:bg-zinc-900 border border-tequila-border/50 hover:border-tequila-border rounded-xl text-[10px] font-bold font-mono text-gray-400 hover:text-white uppercase tracking-wider cursor-pointer transition-all"
                    >
                      <span className="flex items-center gap-1.5">
                        <LucideIcon name="History" className="w-3.5 h-3.5 text-amber-500" />
                        Zobrazit průběžně logované prodeje ({activeSales.length})
                      </span>
                      <LucideIcon
                        name={expandedShiftIds["active_shift"] ? "ChevronUp" : "ChevronDown"}
                        className="w-3.5 h-3.5 text-zinc-500"
                      />
                    </button>

                    {expandedShiftIds["active_shift"] && (
                      <div className="space-y-2.5 bg-zinc-950/40 p-3 rounded-xl border border-tequila-border/20 max-h-[250px] overflow-y-auto mt-2">
                        {activeSales.length === 0 ? (
                          <p className="text-[10px] text-zinc-500 text-center py-4 uppercase font-mono tracking-wide">
                            Zatím nebyly během této směny zaznamenány žádné prodeje.
                          </p>
                        ) : (
                          activeSales.slice().reverse().map((sale) => (
                            <div key={sale.id} className="bg-zinc-950 border border-zinc-900 p-3 rounded-lg space-y-2">
                              <div className="flex justify-between items-center text-[10px] font-mono">
                                <span className="text-zinc-500">
                                  {new Date(sale.timestamp).toLocaleTimeString("cs-CZ")}
                                </span>
                                <span className="font-bold text-emerald-400">
                                  +${sale.totalAmount.toFixed(2)}
                                </span>
                              </div>
                              <div className="font-mono text-[9px] text-zinc-400 pl-2 border-l border-tequila-border/40">
                                {sale.items.map((it, idx) => (
                                  <div key={idx} className="flex justify-between">
                                    <span>{it.quantity}x {it.name}</span>
                                    <span>${(it.price * it.quantity).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                              {sale.isEmployeeDiscount ? (
                                <div className="text-[8px] text-purple-400 font-mono pl-2">
                                  👤 Zaměstnanecká sleva (Bez provize)
                                </div>
                              ) : sale.commissionPaid > 0 ? (
                                <div className="text-[8px] text-tequila-yellow font-mono pl-2">
                                  💸 Provize ze sprzedaży: ${sale.commissionPaid.toFixed(2)}
                                </div>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Completed Shifts Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-display font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <LucideIcon name="History" className="w-4 h-4 text-tequila-orange" />
                Historie transakcí (Ukončené směny)
              </h3>

              {!shifts || shifts.length === 0 ? (
                <div className="bg-tequila-card/30 border border-tequila-border border-dashed p-12 text-center text-gray-500 rounded-2xl text-xs uppercase tracking-wider font-mono">
                  Zatím nebyly zaznamenány žádné ukončené směny.
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {shifts
                    .slice()
                    .reverse()
                    .map((shift) => {
                      const shiftSales = shift.sales || sales.filter(
                        (s) => s.bartenderId === shift.bartenderId && s.timestamp >= shift.startTime && s.timestamp <= shift.endTime
                      );
                      const isExpanded = !!expandedShiftIds[shift.id];

                      const cashSales = shift.cashSalesTotal !== undefined 
                        ? shift.cashSalesTotal 
                        : shiftSales
                            .filter((s) => !s.paymentMethod || s.paymentMethod === "cash")
                            .reduce((sum, s) => sum + s.totalAmount, 0);

                      const cardSales = shift.cardSalesTotal !== undefined 
                        ? shift.cardSalesTotal 
                        : shiftSales
                            .filter((s) => s.paymentMethod === "card")
                            .reduce((sum, s) => sum + s.totalAmount, 0);

                      return (
                        <div
                          key={shift.id}
                          className="bg-tequila-card border border-tequila-border p-4 rounded-2xl space-y-4 hover:border-tequila-orange/30 transition-all shadow-md"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white uppercase tracking-tight text-sm">
                                  {shift.bartenderName}
                                </span>
                                <span className="text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold px-1.5 py-0.5 rounded uppercase">
                                  Ukončená směna
                                </span>
                                {shift.autoClosed && (
                                  <span className="text-[9px] bg-amber-950/40 border border-amber-500/30 text-amber-400 font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1" title="Směna byla automaticky ukončena z důvodu neaktivity">
                                    <LucideIcon name="Clock" className="w-3 h-3 text-amber-400" />
                                    Auto-zavřeno
                                  </span>
                                )}
                                <div className="flex items-center ml-2 gap-1">
                                  {onUpdateShift && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (editingShiftId === shift.id) {
                                          setEditingShiftId(null);
                                        } else {
                                          setEditingShiftId(shift.id);
                                          setEditShiftStart(toDatetimeLocal(shift.startTime));
                                          setEditShiftEnd(toDatetimeLocal(shift.endTime));
                                          setEditShiftBartenderId(shift.bartenderId);
                                        }
                                      }}
                                      className={`p-1 rounded-md transition-colors cursor-pointer ${
                                        editingShiftId === shift.id
                                          ? "text-tequila-yellow bg-tequila-yellow/20"
                                          : "text-zinc-500 hover:text-tequila-yellow hover:bg-tequila-yellow/10"
                                      }`}
                                      title="Upravit směnu (změnit barmana nebo časy začátku a konce)"
                                    >
                                      <LucideIcon name="Pencil" className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {onDeleteShift && (
                                    <>
                                      {confirmDeleteShiftId === shift.id ? (
                                        <div className="flex items-center gap-1.5 bg-rose-950/40 border border-rose-500/30 px-2 py-0.5 rounded-md text-[9px] font-bold text-rose-400">
                                          <span>Smazat vč. prodejů?</span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              onDeleteShift(shift.id);
                                              setConfirmDeleteShiftId(null);
                                            }}
                                            className="text-rose-200 hover:text-white underline cursor-pointer"
                                          >
                                            Ano
                                          </button>
                                          <span className="text-rose-500/50">|</span>
                                          <button
                                            type="button"
                                            onClick={() => setConfirmDeleteShiftId(null)}
                                            className="text-zinc-400 hover:text-white cursor-pointer"
                                          >
                                            Ne
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setConfirmDeleteShiftId(shift.id)}
                                          className="text-zinc-500 hover:text-rose-400 p-1 rounded-md hover:bg-rose-950/10 transition-colors cursor-pointer"
                                          title="Smazat směnu (včetně prodejů, obnovení zásob a odečtení provizí)"
                                        >
                                          <LucideIcon name="Trash2" className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                              <p className="text-zinc-500 text-[10px] mt-1.5">
                                Od: {new Date(shift.startTime).toLocaleString("cs-CZ")}
                              </p>
                              <p className="text-zinc-500 text-[10px] mt-0.5">
                                Do: {new Date(shift.endTime).toLocaleString("cs-CZ")}
                              </p>

                              {/* SHIFT TIME & BARTENDER EDIT FORM */}
                              {editingShiftId === shift.id && (
                                <div className="bg-zinc-950 border border-tequila-yellow/40 p-3.5 rounded-xl space-y-3 mt-3 w-full shadow-lg">
                                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                                    <span className="text-xs font-bold text-tequila-yellow uppercase tracking-wide flex items-center gap-1.5">
                                      <LucideIcon name="Pencil" className="w-3.5 h-3.5" />
                                      Upravit Směnu a Přiřazeného Barmana
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setEditingShiftId(null)}
                                      className="text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                    <div>
                                      <label className="block text-[9px] text-zinc-400 font-bold uppercase mb-1">
                                        Obsluha / Barman na směně
                                      </label>
                                      <select
                                        value={editShiftBartenderId}
                                        onChange={(e) => setEditShiftBartenderId(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 font-mono text-xs focus:border-tequila-yellow focus:outline-none"
                                      >
                                        {bartenders.map((b) => (
                                          <option key={b.id} value={b.id}>
                                            {b.name} ({b.commissionRate}% provize{b.status === "inactive" ? " - neaktivní" : ""})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-[9px] text-zinc-400 font-bold uppercase mb-1">Začátek Směny</label>
                                      <input
                                        type="datetime-local"
                                        value={editShiftStart}
                                        onChange={(e) => setEditShiftStart(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 font-mono text-xs focus:border-tequila-yellow focus:outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[9px] text-zinc-400 font-bold uppercase mb-1">Konec Směny</label>
                                      <input
                                        type="datetime-local"
                                        value={editShiftEnd}
                                        onChange={(e) => setEditShiftEnd(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 font-mono text-xs focus:border-tequila-yellow focus:outline-none"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-zinc-900">
                                    <span className="text-[9px] text-zinc-500 italic">
                                      * Změna barmana automaticky převede prodeje a provize ze směny na nového zaměstnance.
                                    </span>
                                    <div className="flex gap-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => setEditingShiftId(null)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-400 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 cursor-pointer"
                                      >
                                        Zrušit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (onUpdateShift && editShiftStart && editShiftEnd) {
                                            const isoStart = new Date(editShiftStart).toISOString();
                                            const isoEnd = new Date(editShiftEnd).toISOString();
                                            onUpdateShift(shift.id, isoStart, isoEnd, editShiftBartenderId || shift.bartenderId);
                                            setEditingShiftId(null);
                                            triggerAlert("success", "Směna byla úspěšně upravena!");
                                          }
                                        }}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-950 bg-tequila-yellow hover:bg-amber-400 cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm"
                                      >
                                        <LucideIcon name="Check" className="w-3.5 h-3.5" />
                                        Uložit změny směny
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-left sm:text-right text-[11px] mt-1 sm:mt-0">
                              <div className="min-w-[50px]">
                                <span className="block text-[8px] text-zinc-500 uppercase font-bold">Prodeje</span>
                                <span className="font-bold text-gray-300">{shift.salesCount} ks</span>
                              </div>
                              <div className="min-w-[70px]">
                                <span className="block text-[8px] text-zinc-500 uppercase font-bold">Hotovost</span>
                                <span className="font-bold text-tequila-yellow">${cashSales.toFixed(2)}</span>
                              </div>
                              <div className="min-w-[70px]">
                                <span className="block text-[8px] text-zinc-500 uppercase font-bold">Karta/Fak</span>
                                <span className="font-bold text-emerald-400">${cardSales.toFixed(2)}</span>
                              </div>
                              <div className="min-w-[70px]">
                                <span className="block text-[8px] text-zinc-500 uppercase font-bold">Celkem</span>
                                <span className="font-bold text-tequila-orange">${shift.salesTotal.toFixed(2)}</span>
                              </div>
                              <div className="min-w-[75px]">
                                <span className="block text-[8px] text-zinc-500 uppercase font-bold">Jeho provize</span>
                                <span className="font-bold text-amber-500">${shift.commissionEarned.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Expandable shift details button */}
                          <div className="pt-2 border-t border-tequila-border/30">
                            <button
                              type="button"
                              onClick={() => toggleShiftExpand(shift.id)}
                              className="w-full flex items-center justify-between py-1 px-2.5 bg-zinc-950 hover:bg-zinc-900 rounded-lg text-[9px] font-bold font-mono text-gray-500 hover:text-white uppercase tracking-wider cursor-pointer transition-all"
                            >
                              <span className="flex items-center gap-1">
                                <LucideIcon name="Layers" className="w-3.5 h-3.5 text-tequila-orange" />
                                {isExpanded ? "Skrýt položkový výpis" : "Zobrazit podrobný výpis prodejů ze směny"}
                              </span>
                              <LucideIcon
                                name={isExpanded ? "ChevronUp" : "ChevronDown"}
                                className="w-3.5 h-3.5 text-zinc-600"
                              />
                            </button>

                            {isExpanded && (
                              <div className="space-y-2 bg-zinc-950/60 p-3 rounded-xl border border-tequila-border/20 max-h-[250px] overflow-y-auto mt-2">
                                {shiftSales.length === 0 ? (
                                  <p className="text-[10px] text-zinc-500 text-center py-4 uppercase font-mono tracking-wide">
                                    Během této směny nebyly zaznamenány žádné prodeje.
                                  </p>
                                ) : (
                                  shiftSales.slice().reverse().map((sale) => (
                                    <div key={sale.id} className="border-b border-tequila-border/10 last:border-0 py-2 space-y-1">
                                      <div className="flex justify-between items-center text-[10px] font-mono">
                                        <span className="text-zinc-500">
                                          {new Date(sale.timestamp).toLocaleTimeString("cs-CZ")}
                                        </span>
                                        <span className="font-bold text-emerald-400">
                                          +${sale.totalAmount.toFixed(2)}
                                        </span>
                                      </div>
                                      <div className="font-mono text-[9px] text-zinc-400 pl-2">
                                        {sale.items.map((it, idx) => (
                                          <div key={idx} className="flex justify-between">
                                            <span>{it.quantity}x {it.name}</span>
                                            <span>${(it.price * it.quantity).toFixed(2)}</span>
                                          </div>
                                        ))}
                                      </div>
                                      {sale.commissionPaid > 0 && (
                                        <div className="text-[8px] text-tequila-yellow font-mono pl-2">
                                          💸 Připsána provize: ${sale.commissionPaid.toFixed(2)}
                                        </div>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* Expenses & Payouts (1 col) */}
          <div className="lg:col-span-1 space-y-6">
            {/* Export pro dotace */}
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-tequila-border p-5 rounded-2xl space-y-4 shadow-xl">
              <div className="flex items-center gap-2.5 border-b border-zinc-800 pb-3">
                <div className="w-8 h-8 rounded-lg bg-tequila-orange/15 border border-tequila-orange/30 text-tequila-orange flex items-center justify-center">
                  <LucideIcon name="Download" className="w-4 h-4 text-tequila-orange" />
                </div>
                <div>
                  <h3 className="text-xs font-mono font-bold text-tequila-orange uppercase tracking-wider">
                    Dotační Hlášení
                  </h3>
                  <span className="text-sm font-bold text-gray-100 block mt-0.5">
                    Export doby otevření & tržeb
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Vyberte sledovaný měsíc
                </label>
                <div className="relative">
                  <select
                    value={selectedExportMonth}
                    onChange={(e) => setSelectedExportMonth(e.target.value)}
                    className="w-full bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-gray-200 px-3.5 py-2.5 rounded-xl transition-all font-mono uppercase focus:outline-none focus:border-tequila-orange cursor-pointer appearance-none"
                  >
                    {generateMonthsList().map((m) => (
                      <option key={m.value} value={m.value} className="bg-zinc-950 text-gray-200">
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-zinc-500">
                    <LucideIcon name="ChevronDown" className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Live Preview Stats */}
              {(() => {
                const [year, month] = selectedExportMonth.split("-").map(Number);
                const monthlyShifts = (shifts || []).filter((s) => {
                  const dateStr = s.endTime || s.startTime;
                  if (!dateStr) return false;
                  const d = new Date(dateStr);
                  if (isNaN(d.getTime())) return false;
                  return d.getFullYear() === year && (d.getMonth() + 1) === month;
                });
                const monthlySales = sales.filter((s) => {
                  if (!s.timestamp) return false;
                  const d = new Date(s.timestamp);
                  if (isNaN(d.getTime())) return false;
                  return d.getFullYear() === year && (d.getMonth() + 1) === month;
                });

                const totalDurationMs = monthlyShifts.reduce((sum, s) => {
                  const start = new Date(s.startTime).getTime();
                  const end = new Date(s.endTime).getTime();
                  return sum + Math.max(0, end - start);
                }, 0);
                const totalHours = totalDurationMs / (1000 * 60 * 60);
                const hoursWhole = Math.floor(totalHours);
                const minutesWhole = Math.round((totalHours - hoursWhole) * 60);

                const totalSalesValue = monthlySales.reduce((sum, s) => sum + s.totalAmount, 0);

                return (
                  <div className="space-y-3 bg-zinc-950/50 p-3.5 rounded-xl border border-zinc-900/80 font-mono text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-zinc-900/50">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Celkový čas otevření:</span>
                      <span className="font-bold text-white text-right">
                        {hoursWhole} hod {minutesWhole} min
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-zinc-900/50">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Celková tržba:</span>
                      <span className="font-bold text-emerald-400 text-right">
                        ${totalSalesValue.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-zinc-900/50">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Dokončené směny:</span>
                      <span className="font-bold text-zinc-300 text-right">
                        {monthlyShifts.length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Počet prodejů:</span>
                      <span className="font-bold text-zinc-300 text-right">
                        {monthlySales.length}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={handleExportSubsidiesCSV}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-tequila-orange hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer hover:scale-[1.01] active:scale-[0.99] border border-tequila-orange/30"
              >
                <LucideIcon name="Download" className="w-4 h-4" />
                Stáhnout Výkaz pro Dotace (CSV)
              </button>
            </div>

            {/* Supplies Purchased Logs */}
            <div className="space-y-4">
              <h3 className="text-sm font-display font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
                📦 Historie naskladnění (Výdaje)
              </h3>

              {purchases.length === 0 ? (
                <p className="text-xs text-gray-500 py-4 text-center border border-dashed border-tequila-border/50 rounded-xl">
                  Zatím nebyly nakoupeny žádné zásoby.
                </p>
              ) : (
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {purchases
                    .slice()
                    .reverse()
                    .map((p) => (
                      <div
                        key={p.id}
                        className="bg-tequila-card/85 border border-tequila-border p-3.5 rounded-xl space-y-2 text-xs"
                      >
                        <div className="flex justify-between items-baseline border-b border-tequila-border/30 pb-1.5">
                          <span className="text-gray-400">
                            {new Date(p.timestamp).toLocaleTimeString("cs-CZ")}
                          </span>
                          <span className="font-mono font-bold text-rose-400">
                            -${p.totalAmount.toFixed(2)}
                          </span>
                        </div>
                        <div className="space-y-1 font-mono text-[11px] text-gray-400">
                          {p.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span className="truncate max-w-[120px]">{it.name}</span>
                              <span>
                                {it.quantity}x (${it.pricePerUnit}/ks)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Commission Payouts Logs */}
            <div className="space-y-4">
              <h3 className="text-sm font-display font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
                💰 Výplaty barmanů (Provize)
              </h3>

              {payouts.length === 0 ? (
                <p className="text-xs text-gray-500 py-4 text-center border border-dashed border-tequila-border/50 rounded-xl">
                  Zatím nebyly vyplaceny žádné provize.
                </p>
              ) : (
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {payouts
                    .slice()
                    .reverse()
                    .map((p) => (
                      <div
                        key={p.id}
                        className="bg-tequila-card/85 border border-tequila-border p-3 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-gray-200 block">{p.bartenderName}</span>
                          <span className="text-[10px] text-gray-500">
                            {new Date(p.timestamp).toLocaleString("cs-CZ")}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-tequila-yellow">
                          -${p.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 4: BACKUPS, IMPORTS & EXPORTS */}
      {activeSubTab === "backup" && (
        <div className="space-y-6">
          {/* RESTORE DAILY FIRESTORE BACKUP CONFIRMATION MODAL */}
          {restoreConfirmDailyBackup && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-zinc-950 border border-blue-500/50 p-6 rounded-2xl w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3 text-blue-400">
                  <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/30">
                    <LucideIcon name="CloudDownload" className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-white uppercase text-base tracking-wider">
                      Obnovit z Půlnoční Cloudové Zálohy?
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Vrátit data baru do stavu z Firestore databáze
                    </p>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-zinc-400">
                    <span>Název zálohy:</span>
                    <span className="text-blue-300 font-bold">{restoreConfirmDailyBackup.title}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Datum uložení:</span>
                    <span className="text-white font-bold">
                      {new Date(restoreConfirmDailyBackup.timestamp).toLocaleString("cs-CZ")}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-zinc-800 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-zinc-950 p-2 rounded border border-zinc-850">
                      <span className="text-zinc-500 block text-[9px] uppercase">Směny</span>
                      <span className="text-blue-400 font-bold">{restoreConfirmDailyBackup.shiftsCount || 0} směn</span>
                    </div>
                    <div className="bg-zinc-950 p-2 rounded border border-zinc-850">
                      <span className="text-zinc-500 block text-[9px] uppercase">Tržby ($)</span>
                      <span className="text-emerald-400 font-bold">
                        ${restoreConfirmDailyBackup.totalRevenue?.toLocaleString("cs-CZ") || "0"}
                      </span>
                    </div>
                    <div className="bg-zinc-950 p-2 rounded border border-zinc-850">
                      <span className="text-zinc-500 block text-[9px] uppercase">Účtenky</span>
                      <span className="text-tequila-yellow font-bold">{restoreConfirmDailyBackup.salesCount || 0} prodejů</span>
                    </div>
                    <div className="bg-zinc-950 p-2 rounded border border-zinc-850">
                      <span className="text-zinc-500 block text-[9px] uppercase">Kasa</span>
                      <span className="text-zinc-300 font-bold">${restoreConfirmDailyBackup.registerBalance?.toFixed(2) || "0.00"}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-950/30 border border-blue-500/20 rounded-xl text-blue-300 text-xs">
                  ℹ️ Aktuální stav baru bude před obnovou automaticky uložen jako záchranný bod.
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      if (onRestoreDailyBackup) {
                        onRestoreDailyBackup(restoreConfirmDailyBackup);
                        triggerAlert("success", `Data byla úspěšně obnovena z cloudové zálohy: ${restoreConfirmDailyBackup.title}`);
                      }
                      setRestoreConfirmDailyBackup(null);
                    }}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-display font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                  >
                    <LucideIcon name="Check" className="w-4 h-4" />
                    Ano, obnovit bar z cloudu
                  </button>
                  <button
                    onClick={() => setRestoreConfirmDailyBackup(null)}
                    className="py-3 px-4 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white font-display font-bold text-xs uppercase tracking-wider rounded-xl border border-zinc-800 transition-all cursor-pointer"
                  >
                    Zrušit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* RESTORE CONFIRMATION MODAL (LOCAL) */}
          {restoreConfirmBackup && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-zinc-950 border border-tequila-orange/50 p-6 rounded-2xl w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3 text-tequila-orange">
                  <div className="p-2.5 bg-tequila-orange/10 rounded-xl border border-tequila-orange/30">
                    <LucideIcon name="RotateCcw" className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-white uppercase text-base tracking-wider">
                      Obnovit stav podniku?
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Vrátit veškerá data do stavu tohoto bodu obnovy
                    </p>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-zinc-400">
                    <span>Čas bodu:</span>
                    <span className="text-white font-bold">
                      {new Date(restoreConfirmBackup.timestamp).toLocaleString("cs-CZ")}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Důvod zálohy:</span>
                    <span className="text-tequila-yellow font-bold">{restoreConfirmBackup.reason}</span>
                  </div>
                  <div className="pt-2 border-t border-zinc-800 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-zinc-950 p-2 rounded border border-zinc-850">
                      <span className="text-zinc-500 block text-[9px] uppercase">Zaměstnanci</span>
                      <span className="text-emerald-400 font-bold">{restoreConfirmBackup.bartendersCount || 0} uživatelů</span>
                    </div>
                    <div className="bg-zinc-950 p-2 rounded border border-zinc-850">
                      <span className="text-zinc-500 block text-[9px] uppercase">Záznamy prodejů</span>
                      <span className="text-tequila-orange font-bold">{restoreConfirmBackup.salesCount || 0} účtenek</span>
                    </div>
                    <div className="bg-zinc-950 p-2 rounded border border-zinc-850">
                      <span className="text-zinc-500 block text-[9px] uppercase">Směny</span>
                      <span className="text-blue-400 font-bold">{restoreConfirmBackup.shiftsCount || 0} směn</span>
                    </div>
                    <div className="bg-zinc-950 p-2 rounded border border-zinc-850">
                      <span className="text-zinc-500 block text-[9px] uppercase">Položky skladu</span>
                      <span className="text-zinc-300 font-bold">{restoreConfirmBackup.itemsCount || 0} položek</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-amber-950/30 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
                  ⚠️ Před obnovou bude aktuální stav automaticky zálohován, takže o nic nepřijdete.
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      if (onRestoreBackup) {
                        onRestoreBackup(restoreConfirmBackup);
                        triggerAlert("success", `Data byla úspěšně obnovena z bodu: ${restoreConfirmBackup.reason}`);
                      }
                      setRestoreConfirmBackup(null);
                    }}
                    className="flex-1 py-3 bg-tequila-orange hover:bg-tequila-orange/90 text-white font-display font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-tequila-orange/20 flex items-center justify-center gap-2"
                  >
                    <LucideIcon name="Check" className="w-4 h-4" />
                    Ano, obnovit tento stav
                  </button>
                  <button
                    onClick={() => setRestoreConfirmBackup(null)}
                    className="py-3 px-4 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white font-display font-bold text-xs uppercase tracking-wider rounded-xl border border-zinc-800 transition-all cursor-pointer"
                  >
                    Zrušit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* FIRESTORE CLOUD MIDNIGHT BACKUPS PANEL */}
          <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-blue-950/30 border border-blue-500/30 p-5 rounded-2xl space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-blue-500/15 border border-blue-500/30 text-blue-400 rounded-lg">
                    <LucideIcon name="Cloud" className="w-4 h-4" />
                  </span>
                  <h3 className="text-base font-display font-bold text-white uppercase tracking-tight flex items-center gap-2">
                    Automatické Půlnoční Zálohy (Cloud Firestore)
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Aktivní (00:00)
                    </span>
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Systém každý den přesně o půlnoci (00:00) automaticky uloží kompletní záložní bod podniku do Firestore databáze. Zálohy jsou trvale uchovány v cloudu.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    if (onCreateDailyCloudBackup) {
                      onCreateDailyCloudBackup();
                      triggerAlert("success", "Záloha byla úspěšně odeslána do Firestore databáze!");
                    }
                  }}
                  className="py-2.5 px-4 bg-blue-600 hover:bg-blue-500 border border-blue-400/40 text-white font-display font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
                >
                  <LucideIcon name="CloudUpload" className="w-4 h-4" />
                  Vytvořit okamžitou zálohu do Firestore
                </button>
              </div>
            </div>

            {/* Daily Firestore Backups List */}
            {dailyFirestoreBackups.length === 0 ? (
              <div className="bg-zinc-950/60 border border-dashed border-blue-500/20 rounded-xl p-8 text-center space-y-2">
                <LucideIcon name="Cloud" className="w-8 h-8 text-blue-400/60 mx-auto" />
                <p className="text-xs text-zinc-300 font-mono">
                  Zatím nebyla zaznamenána žádná cloudová záloha.
                </p>
                <p className="text-[11px] text-zinc-500">
                  První automatická záloha se provede dnes o půlnoci (00:00), nebo můžete provést okamžitou zálohu tlačítkem výše.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {dailyFirestoreBackups.map((b) => (
                  <div
                    key={b.id}
                    className="bg-zinc-950/85 border border-blue-500/20 hover:border-blue-400/50 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                          <LucideIcon name="Calendar" className="w-3.5 h-3.5 text-blue-400" />
                          {b.dateKey || new Date(b.timestamp).toLocaleDateString("cs-CZ")}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-bold uppercase tracking-wider">
                          {b.type === "midnight_auto" ? "Půlnoční automatická" : "Ruční cloudová"}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {new Date(b.timestamp).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono flex-wrap">
                        <span className="flex items-center gap-1">
                          <LucideIcon name="Clock" className="w-3 h-3 text-blue-400" />
                          <strong className="text-blue-400">{b.shiftsCount ?? b.state?.shifts?.length ?? 0}</strong> směn
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <LucideIcon name="DollarSign" className="w-3 h-3 text-emerald-400" />
                          <strong className="text-emerald-400">
                            ${b.totalRevenue?.toLocaleString("cs-CZ") || (b.state?.sales || []).reduce((acc, s) => acc + (s.totalAmount || 0), 0).toLocaleString("cs-CZ")}
                          </strong> tržby
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <LucideIcon name="Receipt" className="w-3 h-3 text-tequila-yellow" />
                          <strong className="text-tequila-yellow">{b.salesCount ?? b.state?.sales?.length ?? 0}</strong> účtenek
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <LucideIcon name="Users" className="w-3 h-3 text-purple-400" />
                          <strong className="text-purple-400">{b.bartendersCount ?? b.state?.bartenders?.length ?? 0}</strong> uživatelů
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <LucideIcon name="Coins" className="w-3 h-3 text-zinc-400" />
                          Kasa: ${b.registerBalance?.toFixed(2) || b.state?.registerBalance?.toFixed(2) || "0.00"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setRestoreConfirmDailyBackup(b)}
                        className="py-1.5 px-3 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                        title="Obnovit bar z této cloudové zálohy"
                      >
                        <LucideIcon name="RotateCcw" className="w-3.5 h-3.5" />
                        Obnovit
                      </button>

                      <button
                        onClick={() => {
                          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(b.state));
                          const dlAnchor = document.createElement("a");
                          dlAnchor.setAttribute("href", dataStr);
                          dlAnchor.setAttribute("download", `tequilala_firestore_backup_${b.dateKey || "snapshot"}.json`);
                          document.body.appendChild(dlAnchor);
                          dlAnchor.click();
                          dlAnchor.remove();
                        }}
                        className="p-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white border border-zinc-800 rounded-lg transition-colors cursor-pointer"
                        title="Stáhnout JSON soubor této cloudové zálohy"
                      >
                        <LucideIcon name="Download" className="w-3.5 h-3.5" />
                      </button>

                      {onDeleteDailyBackup && (
                        <button
                          onClick={() => {
                            if (confirm(`Opravdu chcete smazat zálohu z ${b.dateKey}?`)) {
                              onDeleteDailyBackup(b.id);
                              triggerAlert("success", "Záloha byla odstraněna z cloudu.");
                            }
                          }}
                          className="p-1.5 bg-zinc-900 hover:bg-rose-950/40 text-zinc-600 hover:text-rose-400 border border-zinc-800 hover:border-rose-900/30 rounded-lg transition-colors cursor-pointer"
                          title="Odstranit tuto cloudovou zálohu"
                        >
                          <LucideIcon name="Trash2" className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AUTO-BACKUPS HISTORY PANEL */}
          <div className="bg-tequila-card border border-tequila-border p-5 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-tequila-orange/10 border border-tequila-orange/30 text-tequila-orange rounded-lg">
                    <LucideIcon name="History" className="w-4 h-4" />
                  </span>
                  <h3 className="text-base font-display font-bold text-white uppercase tracking-tight">
                    Automatické záchranné zálohy & Body obnovy
                  </h3>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Systém automaticky ukládá časové snímky baru před každou synchronizací, prodejem či změnou. Kliknutím na "Obnovit" můžete vrátit ztracené záznamy nebo uživatele.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {showCreateBackupInput ? (
                  <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-xl border border-tequila-border">
                    <input
                      type="text"
                      placeholder="Název bodu obnovy..."
                      value={manualBackupName}
                      onChange={(e) => setManualBackupName(e.target.value)}
                      className="bg-transparent text-xs text-white px-2 py-1 focus:outline-none font-mono"
                    />
                    <button
                      onClick={() => {
                        if (onCreateManualBackup) {
                          onCreateManualBackup(manualBackupName || "Ruční záloha");
                          triggerAlert("success", "Ruční bod obnovy byl úspěšně vytvořen!");
                          setManualBackupName("");
                          setShowCreateBackupInput(false);
                        }
                      }}
                      className="py-1 px-2.5 bg-tequila-orange text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-tequila-orange/90"
                    >
                      Uložit
                    </button>
                    <button
                      onClick={() => setShowCreateBackupInput(false)}
                      className="text-zinc-500 hover:text-white p-1 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCreateBackupInput(true)}
                    className="py-2 px-3.5 bg-zinc-900 hover:bg-zinc-850 border border-tequila-border hover:border-tequila-orange/40 text-tequila-orange font-display font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <LucideIcon name="Plus" className="w-3.5 h-3.5" />
                    Vytvořit bod obnovy nyní
                  </button>
                )}
              </div>
            </div>

            {/* Backups List */}
            {backups.length === 0 ? (
              <div className="bg-zinc-950/60 border border-dashed border-zinc-800 rounded-xl p-8 text-center space-y-2">
                <LucideIcon name="HardDrive" className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400 font-mono">
                  Zatím nebyl zaznamenán žádný záchranný bod obnovy. Vytvořte jej tlačítkem výše nebo proveďte libovolnou operaci v baru.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {backups.map((b) => (
                  <div
                    key={b.id}
                    className="bg-zinc-950/80 border border-zinc-800 hover:border-tequila-orange/30 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-white">
                          {new Date(b.timestamp).toLocaleString("cs-CZ")}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-tequila-orange/10 border border-tequila-orange/20 text-tequila-orange font-bold uppercase tracking-wider">
                          {b.reason}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono flex-wrap">
                        <span className="flex items-center gap-1">
                          <LucideIcon name="Users" className="w-3 h-3 text-emerald-400" />
                          <strong className="text-emerald-400">{b.bartendersCount ?? b.state?.bartenders?.length ?? 0}</strong> uživatelů
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <LucideIcon name="Receipt" className="w-3 h-3 text-tequila-yellow" />
                          <strong className="text-tequila-yellow">{b.salesCount ?? b.state?.sales?.length ?? 0}</strong> prodejů
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <LucideIcon name="Clock" className="w-3 h-3 text-blue-400" />
                          <strong className="text-blue-400">{b.shiftsCount ?? b.state?.shifts?.length ?? 0}</strong> směn
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <LucideIcon name="Coins" className="w-3 h-3 text-zinc-400" />
                          Kasa: ${b.state?.registerBalance?.toFixed(2) || "0.00"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setRestoreConfirmBackup(b)}
                        className="py-1.5 px-3 bg-tequila-orange/15 hover:bg-tequila-orange text-tequila-orange hover:text-white border border-tequila-orange/30 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                        title="Obnovit bar do tohoto stavu"
                      >
                        <LucideIcon name="RotateCcw" className="w-3.5 h-3.5" />
                        Obnovit
                      </button>

                      <button
                        onClick={() => {
                          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(b.state));
                          const dlAnchor = document.createElement("a");
                          dlAnchor.setAttribute("href", dataStr);
                          dlAnchor.setAttribute("download", `tequilala_backup_${new Date(b.timestamp).toISOString().slice(0, 19).replace(/[:]/g, "-")}.json`);
                          document.body.appendChild(dlAnchor);
                          dlAnchor.click();
                          dlAnchor.remove();
                        }}
                        className="p-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white border border-zinc-800 rounded-lg transition-colors cursor-pointer"
                        title="Stáhnout JSON soubor této zálohy"
                      >
                        <LucideIcon name="Download" className="w-3.5 h-3.5" />
                      </button>

                      {onDeleteBackup && (
                        <button
                          onClick={() => onDeleteBackup(b.id)}
                          className="p-1.5 bg-zinc-900 hover:bg-rose-950/40 text-zinc-600 hover:text-rose-400 border border-zinc-800 hover:border-rose-900/30 rounded-lg transition-colors cursor-pointer"
                          title="Odstranit bod obnovy"
                        >
                          <LucideIcon name="Trash2" className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Export card */}
            <div className="bg-tequila-card border border-tequila-border p-5 rounded-2xl flex flex-col justify-between">
              <div className="space-y-3">
                <h3 className="text-base font-display font-bold text-tequila-orange uppercase tracking-tight">
                  Exportovat Aktuální Zálohu (JSON)
                </h3>
                <p className="text-xs text-gray-400">
                  Stáhněte si kompletní data vašeho baru Tequi-la-la do souboru JSON. Tento soubor si můžete uschovat jako trvalou zálohu do PC nebo jej sdílet s ostatními manažery baru.
                </p>
                <div className="bg-tequila-dark/40 border border-tequila-border/60 p-4 rounded-xl text-[11px] font-mono text-gray-500 leading-relaxed">
                  Záloha obsahuje kompletní seznam položek na skladě, míchací recepty, barové zaměstnance, PIN kódy, provize a kompletní historii tržeb a směn.
                </div>
              </div>

              <button
                onClick={onExportBackup}
                className="mt-6 w-full py-3 bg-tequila-orange hover:bg-tequila-orange/90 text-white font-display font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
              >
                <LucideIcon name="Download" className="w-4 h-4" />
                Stáhnout záložní soubor podniku
              </button>
            </div>

            {/* Import card */}
            <div className="bg-tequila-card border border-tequila-border p-5 rounded-2xl space-y-4">
              <h3 className="text-base font-display font-bold text-tequila-yellow uppercase tracking-tight">
                Načíst Zálohu Podniku (Import ze souboru/textu)
              </h3>
              <p className="text-xs text-gray-400">
                Chcete-li obnovit stav vašeho baru z dříve exportovaného souboru, vložte sem zkopírovaný JSON text a klikněte na "Obnovit".
              </p>

              <textarea
                placeholder='Vložte JSON zálohu sem... (např. {"items": [], "bartenders": [], "sales": [], ...})'
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                className="w-full h-32 bg-tequila-dark border border-tequila-border p-3.5 rounded-xl text-xs font-mono text-gray-300 focus:outline-none focus:border-tequila-yellow"
              ></textarea>

              <button
                onClick={handleImport}
                className="w-full py-3 bg-tequila-yellow hover:bg-tequila-yellow/90 text-tequila-dark font-display font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
              >
                <LucideIcon name="Upload" className="w-4 h-4" />
                Obnovit data ze zadaného JSONu
              </button>
            </div>

            {/* Quick Simulation Data Load */}
            {onLoadSimulatedData && (
              <div className="bg-amber-950/20 border border-amber-500/30 p-5 rounded-2xl md:col-span-2 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-display font-bold text-amber-400 uppercase tracking-wide text-sm flex items-center gap-2">
                    <LucideIcon name="Sparkles" className="w-4 h-4" />
                    Záchrana dat za srpen 2026 (110 hodin směn & ~$130 000 tržeb)
                  </h4>
                  <p className="text-xs text-amber-200/80">
                    Načte realisticky vygenerované směny a účtenky od 1. do 26. srpna rozdělené mezi všechny barmany s odpovídajícími provizemi.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onLoadSimulatedData();
                    triggerAlert("success", "Srpnová data (110h směn, $130k tržeb) byla úspěšně načtena do baru!");
                  }}
                  className="py-2.5 px-5 bg-amber-500 hover:bg-amber-400 text-black font-display font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 shadow-lg shadow-amber-500/20 active:scale-95"
                >
                  <LucideIcon name="RefreshCw" className="w-4 h-4" />
                  Načíst srpnová data
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
