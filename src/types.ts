export type ItemCategory = "alcohol" | "soft" | "garnish" | "other" | "drink" | "shot" | "beer" | "food" | "hookah" | "tobacco";

export interface InventoryItem {
  id: string;
  name: string;
  type: "raw" | "crafted";
  stock: number;
  minStock: number;
  purchasePrice: number; // Cost to buy this item (primarily for raw ingredients)
  sellPrice: number;     // Cost at which we sell this item (for crafted drinks or beers)
  iconName: string;      // Lucide icon name string
  category: ItemCategory;
}

export interface RecipeIngredient {
  itemId: string;
  quantity: number;
}

export interface Recipe {
  id: string;
  resultItemId: string;   // ID of the crafted drink
  ingredients: RecipeIngredient[];
  craftTimeSeconds: number; // Simulated crafting time
  yieldAmount?: number;   // How many pieces are produced per batch (defaults to 20 if not specified)
}

export interface Bartender {
  id: string;
  name: string;
  commissionRate: number; // Commission percentage, e.g., 15 for 15%
  totalCommissionEarned: number; // Commission accumulated in current session
  status: "active" | "inactive";
  pin?: string;
  role?: "manager" | "barman";
  onShift?: boolean;
}

export interface SaleItem {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface SaleLog {
  id: string;
  timestamp: string;
  items: SaleItem[];
  totalAmount: number;
  bartenderId: string;
  bartenderName: string;
  commissionPaid: number;
  discountPercentage?: number;
  discountAmount?: number;
  isEmployeeDiscount?: boolean;
  paymentMethod?: "cash" | "card";
}

export interface PurchaseItem {
  itemId: string;
  name: string;
  quantity: number;
  pricePerUnit: number;
}

export interface PurchaseLog {
  id: string;
  timestamp: string;
  items: PurchaseItem[];
  totalAmount: number;
}

export interface PayoutLog {
  id: string;
  timestamp: string;
  bartenderId: string;
  bartenderName: string;
  amount: number;
}

export interface ShiftLog {
  id: string;
  bartenderId: string;
  bartenderName: string;
  startTime: string;
  endTime: string;
  salesCount: number;
  salesTotal: number;
  commissionEarned: number;
  cashSalesTotal?: number;
  cardSalesTotal?: number;
  autoClosed?: boolean;
  sales?: SaleLog[];
}

export interface BarTab {
  id: string;
  name: string;
  items: SaleItem[];
  createdAt: string;
}

export interface BusinessState {
  items: InventoryItem[];
  recipes: Recipe[];
  bartenders: Bartender[];
  sales: SaleLog[];
  purchases: PurchaseLog[];
  payouts: PayoutLog[];
  registerBalance: number; // Current cash register balance
  barTabs?: BarTab[];
  shifts?: ShiftLog[];
}
