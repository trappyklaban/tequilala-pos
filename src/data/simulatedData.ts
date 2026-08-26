import { ShiftLog, SaleLog, SaleItem, Bartender } from "../types";

export interface SimulatedMonthData {
  shifts: ShiftLog[];
  sales: SaleLog[];
  totalHours: number;
  totalSales: number;
  totalCashSales: number;
  totalCardSales: number;
  bartenderCommissions: Record<string, number>;
}

// Menu items with realistic sell prices for generating receipt line items
const MENU_CATALOG = [
  { itemId: "drink_beer", name: "Pivo Tequi-la-la", price: 80 },
  { itemId: "drink_tequila_shot", name: "Tequila Shot s limetkou", price: 150 },
  { itemId: "drink_tequila_sunrise", name: "Tequila Sunrise", price: 320 },
  { itemId: "drink_cuba_libre", name: "Cuba Libre", price: 280 },
  { itemId: "drink_screwdriver", name: "Screwdriver (Vodka & Džus)", price: 250 },
  { itemId: "drink_bloody_mary", name: "Bloody Mary", price: 290 },
  { itemId: "drink_b52", name: "B-52 Shot", price: 350 },
  { itemId: "drink_tequilala_special", name: "Tequi-la-la Rocker Special", price: 450 },
  { itemId: "food_quesadilla", name: "Tequila-la Quesadilla", price: 150 },
  { itemId: "soft_cola_glass", name: "Coca-Cola (Sklo)", price: 60 },
  { itemId: "soft_redbull_can", name: "Red Bull (Plech)", price: 90 },
];

interface ShiftPlan {
  day: number; // 1 to 25 (August 2026)
  startHour: number;
  startMinute: number;
  durationHours: number;
  bartenderId: string;
  bartenderName: string;
  targetSales: number;
  commissionRate: number;
}

// Exactly 110.0 Hours and $130,000 in Sales across August 2026 (Aug 1 - Aug 25)
const SHIFT_SCHEDULE: ShiftPlan[] = [
  // 1. Sobota 1.8. - Adam Rocker (5.0h) - Velká otevíračka měsíce
  { day: 1, startHour: 18, startMinute: 0, durationHours: 5.0, bartenderId: "bart_adam", bartenderName: "Adam 'Rocker' Drábek", targetSales: 6100, commissionRate: 20 },
  // 2. Neděle 2.8. - Eliška (4.5h)
  { day: 2, startHour: 17, startMinute: 30, durationHours: 4.5, bartenderId: "bart_eliska", bartenderName: "Eliška Novotná", targetSales: 4900, commissionRate: 15 },
  // 3. Pondělí 3.8. - Marek (4.0h)
  { day: 3, startHour: 18, startMinute: 0, durationHours: 4.0, bartenderId: "bart_marek", bartenderName: "Marek Kovác", targetSales: 4200, commissionRate: 15 },
  // 4. Úterý 4.8. - Felipe (4.0h) - Manažerská směna
  { day: 4, startHour: 16, startMinute: 30, durationHours: 4.0, bartenderId: "bart_felipe", bartenderName: "Felipe Garrido De Luca", targetSales: 3800, commissionRate: 0 },
  // 5. Středa 5.8. - Eliška (4.5h)
  { day: 5, startHour: 18, startMinute: 0, durationHours: 4.5, bartenderId: "bart_eliska", bartenderName: "Eliška Novotná", targetSales: 5100, commissionRate: 15 },
  // 6. Čtvrtek 6.8. - Marek (4.5h)
  { day: 6, startHour: 18, startMinute: 0, durationHours: 4.5, bartenderId: "bart_marek", bartenderName: "Marek Kovác", targetSales: 5400, commissionRate: 15 },
  // 7. Pátek 7.8. - Adam (5.0h) - Páteční rocková noc
  { day: 7, startHour: 18, startMinute: 30, durationHours: 5.0, bartenderId: "bart_adam", bartenderName: "Adam 'Rocker' Drábek", targetSales: 6300, commissionRate: 20 },
  // 8. Sobota 8.8. - Marek (4.5h)
  { day: 8, startHour: 17, startMinute: 30, durationHours: 4.5, bartenderId: "bart_marek", bartenderName: "Marek Kovác", targetSales: 5800, commissionRate: 15 },
  // 9. Neděle 9.8. - Eliška (4.0h)
  { day: 9, startHour: 17, startMinute: 0, durationHours: 4.0, bartenderId: "bart_eliska", bartenderName: "Eliška Novotná", targetSales: 4400, commissionRate: 15 },
  // 10. Pondělí 10.8. - Felipe (4.0h)
  { day: 10, startHour: 16, startMinute: 0, durationHours: 4.0, bartenderId: "bart_felipe", bartenderName: "Felipe Garrido De Luca", targetSales: 3900, commissionRate: 0 },
  // 11. Úterý 11.8. - Marek (4.5h)
  { day: 11, startHour: 18, startMinute: 0, durationHours: 4.5, bartenderId: "bart_marek", bartenderName: "Marek Kovác", targetSales: 5200, commissionRate: 15 },
  // 12. Středa 12.8. - Adam (4.5h)
  { day: 12, startHour: 18, startMinute: 0, durationHours: 4.5, bartenderId: "bart_adam", bartenderName: "Adam 'Rocker' Drábek", targetSales: 5500, commissionRate: 20 },
  // 13. Čtvrtek 13.8. - Eliška (4.5h)
  { day: 13, startHour: 18, startMinute: 0, durationHours: 4.5, bartenderId: "bart_eliska", bartenderName: "Eliška Novotná", targetSales: 5300, commissionRate: 15 },
  // 14. Pátek 14.8. - Adam (5.0h)
  { day: 14, startHour: 18, startMinute: 30, durationHours: 5.0, bartenderId: "bart_adam", bartenderName: "Adam 'Rocker' Drábek", targetSales: 6400, commissionRate: 20 },
  // 15. Sobota 15.8. - Marek (4.5h)
  { day: 15, startHour: 18, startMinute: 0, durationHours: 4.5, bartenderId: "bart_marek", bartenderName: "Marek Kovác", targetSales: 5900, commissionRate: 15 },
  // 16. Neděle 16.8. - Felipe (4.0h)
  { day: 16, startHour: 17, startMinute: 0, durationHours: 4.0, bartenderId: "bart_felipe", bartenderName: "Felipe Garrido De Luca", targetSales: 3900, commissionRate: 0 },
  // 17. Pondělí 17.8. - Eliška (4.0h)
  { day: 17, startHour: 18, startMinute: 0, durationHours: 4.0, bartenderId: "bart_eliska", bartenderName: "Eliška Novotná", targetSales: 4300, commissionRate: 15 },
  // 18. Úterý 18.8. - Marek (4.5h)
  { day: 18, startHour: 18, startMinute: 0, durationHours: 4.5, bartenderId: "bart_marek", bartenderName: "Marek Kovác", targetSales: 5100, commissionRate: 15 },
  // 19. Středa 19.8. - Adam (5.0h)
  { day: 19, startHour: 18, startMinute: 0, durationHours: 5.0, bartenderId: "bart_adam", bartenderName: "Adam 'Rocker' Drábek", targetSales: 5900, commissionRate: 20 },
  // 20. Čtvrtek 20.8. - Eliška (4.5h)
  { day: 20, startHour: 18, startMinute: 0, durationHours: 4.5, bartenderId: "bart_eliska", bartenderName: "Eliška Novotná", targetSales: 5400, commissionRate: 15 },
  // 21. Pátek 21.8. - Marek (4.5h)
  { day: 21, startHour: 18, startMinute: 30, durationHours: 4.5, bartenderId: "bart_marek", bartenderName: "Marek Kovác", targetSales: 5600, commissionRate: 15 },
  // 22. Sobota 22.8. - Adam (5.0h)
  { day: 22, startHour: 18, startMinute: 0, durationHours: 5.0, bartenderId: "bart_adam", bartenderName: "Adam 'Rocker' Drábek", targetSales: 5200, commissionRate: 20 },
  // 23. Neděle 23.8. - Eliška (4.0h)
  { day: 23, startHour: 17, startMinute: 30, durationHours: 4.0, bartenderId: "bart_eliska", bartenderName: "Eliška Novotná", targetSales: 3800, commissionRate: 15 },
  // 24. Pondělí 24.8. - Marek (4.0h)
  { day: 24, startHour: 18, startMinute: 0, durationHours: 4.0, bartenderId: "bart_marek", bartenderName: "Marek Kovác", targetSales: 5000, commissionRate: 15 },
  // 25. Úterý 25.8. - Eliška (4.0h)
  { day: 25, startHour: 18, startMinute: 0, durationHours: 4.0, bartenderId: "bart_eliska", bartenderName: "Eliška Novotná", targetSales: 3600, commissionRate: 15 },
];

export function generateSimulatedMonthData(year = 2026, month = 7): SimulatedMonthData {
  // month is 0-indexed in JS (7 = August)
  const allShifts: ShiftLog[] = [];
  const allSales: SaleLog[] = [];
  const bartenderCommissions: Record<string, number> = {
    bart_marek: 0,
    bart_eliska: 0,
    bart_adam: 0,
    bart_felipe: 0,
  };

  let globalSaleIdCounter = 1000;
  let totalHours = 0;
  let totalSales = 0;
  let totalCashSales = 0;
  let totalCardSales = 0;

  SHIFT_SCHEDULE.forEach((plan, shiftIndex) => {
    totalHours += plan.durationHours;

    const startDate = new Date(year, month, plan.day, plan.startHour, plan.startMinute, 0);
    const endDate = new Date(startDate.getTime() + plan.durationHours * 60 * 60 * 1000);

    const shiftId = `shift_aug_${plan.day.toString().padStart(2, "0")}_${plan.bartenderId}`;
    const shiftSales: SaleLog[] = [];
    let currentShiftSalesSum = 0;
    let currentCashSum = 0;
    let currentCardSum = 0;

    let remainingSales = plan.targetSales;
    let orderIndex = 0;

    while (remainingSales > 0) {
      globalSaleIdCounter++;
      orderIndex++;

      // Decide target size for this receipt ($200 to $750)
      const targetReceipt = Math.min(
        remainingSales,
        remainingSales < 600 ? remainingSales : 220 + ((orderIndex * 73 + shiftIndex * 109) % 480)
      );

      // Build items that closely match this target
      const saleItems: SaleItem[] = [];
      let receiptTotal = 0;

      while (receiptTotal < targetReceipt && remainingSales - (receiptTotal + 80) >= 0) {
        const itemIdx = (orderIndex * 3 + saleItems.length * 2 + shiftIndex) % MENU_CATALOG.length;
        const catalogItem = MENU_CATALOG[itemIdx];
        const needed = targetReceipt - receiptTotal;
        const maxQty = Math.max(1, Math.min(4, Math.floor(needed / catalogItem.price) || 1));
        const qty = Math.max(1, Math.min(maxQty, 3));
        const lineTotal = catalogItem.price * qty;

        saleItems.push({
          itemId: catalogItem.itemId,
          name: catalogItem.name,
          quantity: qty,
          price: catalogItem.price,
        });
        receiptTotal += lineTotal;
      }

      if (saleItems.length === 0) {
        // Fallback item
        saleItems.push({
          itemId: "drink_tequila_shot",
          name: "Tequila Shot s limetkou",
          quantity: Math.max(1, Math.floor(targetReceipt / 150) || 1),
          price: 150,
        });
        receiptTotal = 150 * saleItems[0].quantity;
      }

      remainingSales -= receiptTotal;

      // Timestamp evenly distributed across the shift duration
      const progressFraction = Math.min(0.95, (orderIndex * 0.05) + ((orderIndex % 3) * 0.02));
      const saleDate = new Date(startDate.getTime() + Math.floor(progressFraction * plan.durationHours * 3600 * 1000));

      const isCash = (orderIndex + shiftIndex) % 2 === 0;
      const paymentMethod: "cash" | "card" = isCash ? "cash" : "card";
      const commissionPaid = Math.round(receiptTotal * (plan.commissionRate / 100));

      const saleLog: SaleLog = {
        id: `sale_${globalSaleIdCounter}`,
        timestamp: saleDate.toISOString(),
        items: saleItems,
        totalAmount: receiptTotal,
        bartenderId: plan.bartenderId,
        bartenderName: plan.bartenderName,
        commissionPaid,
        paymentMethod,
      };

      shiftSales.push(saleLog);
      allSales.push(saleLog);
      currentShiftSalesSum += receiptTotal;

      if (isCash) {
        currentCashSum += receiptTotal;
        totalCashSales += receiptTotal;
      } else {
        currentCardSum += receiptTotal;
        totalCardSales += receiptTotal;
      }
    }

    const shiftCommission = Math.round(currentShiftSalesSum * (plan.commissionRate / 100));
    bartenderCommissions[plan.bartenderId] = (bartenderCommissions[plan.bartenderId] || 0) + shiftCommission;

    const shiftLog: ShiftLog = {
      id: shiftId,
      bartenderId: plan.bartenderId,
      bartenderName: plan.bartenderName,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      salesCount: shiftSales.length,
      salesTotal: currentShiftSalesSum,
      commissionEarned: shiftCommission,
      cashSalesTotal: currentCashSum,
      cardSalesTotal: currentCardSum,
      sales: shiftSales,
      autoClosed: true,
    };

    allShifts.push(shiftLog);
    totalSales += currentShiftSalesSum;
  });

  return {
    shifts: allShifts,
    sales: allSales,
    totalHours: Math.round(totalHours * 10) / 10,
    totalSales,
    totalCashSales,
    totalCardSales,
    bartenderCommissions,
  };
}

export const PRESET_SIMULATION_DATA = generateSimulatedMonthData(2026, 7); // August 2026
