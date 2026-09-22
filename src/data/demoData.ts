import type {
  DemoState,
  HistoricalSalesRecord,
  Ingredient,
  MenuItem,
  WeeklyDatum,
} from "../lib/types";

function getTomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export const emptyInventory: Record<string, number | ""> = {
  pork: "",
  rice: "",
  vegetables: "",
  soybeanPaste: "",
  tofu: "",
  broth: "",
};

export const exampleForecastInput = {
  forecastDate: "2026-10-01",
  reservationCount: 280,
  weather: "sunny" as const,
  temperature: 24,
  event: "none" as const,
};

export const exampleInventoryInput = {
  pork: 8.9,
  rice: 16.5,
  vegetables: 8,
  soybeanPaste: 2,
  tofu: 7.7,
  broth: 6.1,
};

export const defaultDemoState: DemoState = {
  forecastDate: getTomorrowDate(),
  reservationCount: "",
  weather: "",
  temperature: "",
  event: "none",
  hasForecast: false,
  inventory: emptyInventory,
  hasOrderCalculation: false,
  traditionalPlanCost: "",
  restaurant: {
    name: "경희키친",
    address: "서울 동대문구",
  },
  actualLog: null,
  operationHistory: [],
  wasteHistory: [],
  forecastCreatedAt: null,
};

// Prototype Load Cell readings, not measurements from connected hardware.
export const sampleSensorReadings = [
  { id: "breakfast", label: "아침", weightKg: 8.5 },
  { id: "lunch", label: "점심", weightKg: 17.2 },
  { id: "dinner", label: "저녁", weightKg: 13.6 },
];

export const menuItems: MenuItem[] = [
  {
    id: "pork",
    name: "제육볶음",
    demandShare: 0.427,
    historicalWasteRate: 0.18,
    servingWeightKg: 0.22,
    preference: 1,
  },
  {
    id: "stew",
    name: "된장찌개",
    demandShare: 0.373,
    historicalWasteRate: 0.17,
    servingWeightKg: 0.22,
    preference: 1,
  },
  {
    id: "salad",
    name: "샐러드",
    demandShare: 0.264,
    historicalWasteRate: 0.3,
    servingWeightKg: 0.22,
    preference: 1,
  },
  {
    id: "rice-bowl",
    name: "공기밥",
    demandShare: 0.831,
    historicalWasteRate: 0.156,
    servingWeightKg: 0.1,
    preference: 1,
  },
];

export const ingredients: Ingredient[] = [
  {
    id: "pork",
    name: "돼지고기",
    unit: "kg",
    unitPrice: 9000,
    recipes: [{ menuId: "pork", gramsPerServing: 150 }],
  },
  {
    id: "rice",
    name: "쌀",
    unit: "kg",
    unitPrice: 3000,
    recipes: [{ menuId: "rice-bowl", gramsPerServing: 100 }],
  },
  {
    id: "vegetables",
    name: "채소",
    unit: "kg",
    unitPrice: 6000,
    recipes: [
      { menuId: "salad", gramsPerServing: 105 },
      { menuId: "pork", gramsPerServing: 22 },
    ],
  },
  {
    id: "soybeanPaste",
    name: "된장",
    unit: "kg",
    unitPrice: 7000,
    recipes: [{ menuId: "stew", gramsPerServing: 18 }],
  },
  {
    id: "tofu",
    name: "두부",
    unit: "kg",
    unitPrice: 4500,
    recipes: [{ menuId: "stew", gramsPerServing: 70 }],
  },
  {
    id: "broth",
    name: "육수·부재료",
    unit: "kg",
    unitPrice: 8500,
    recipes: [{ menuId: "stew", gramsPerServing: 55 }],
  },
];

export const historicalSales: HistoricalSalesRecord[] = [
  {
    date: "2026-09-16",
    weather: "cloudy",
    reservations: 224,
    visitors: 229,
    menuSales: { pork: 98, stew: 83, salad: 61, "rice-bowl": 188 },
    wasteKg: 14.1,
  },
  {
    date: "2026-09-17",
    weather: "sunny",
    reservations: 236,
    visitors: 246,
    menuSales: { pork: 105, stew: 91, salad: 66, "rice-bowl": 204 },
    wasteKg: 14.8,
  },
  {
    date: "2026-09-18",
    weather: "rain",
    reservations: 242,
    visitors: 231,
    menuSales: { pork: 96, stew: 94, salad: 55, "rice-bowl": 191 },
    wasteKg: 13.9,
  },
  {
    date: "2026-09-19",
    weather: "sunny",
    reservations: 268,
    visitors: 286,
    menuSales: { pork: 123, stew: 105, salad: 76, "rice-bowl": 239 },
    wasteKg: 17.2,
  },
  {
    date: "2026-09-20",
    weather: "cloudy",
    reservations: 255,
    visitors: 263,
    menuSales: { pork: 112, stew: 99, salad: 68, "rice-bowl": 216 },
    wasteKg: 15.7,
  },
  {
    date: "2026-09-21",
    weather: "sunny",
    reservations: 226,
    visitors: 235,
    menuSales: { pork: 101, stew: 88, salad: 62, "rice-bowl": 195 },
    wasteKg: 13.4,
  },
  {
    date: "2026-09-22",
    weather: "cloudy",
    reservations: 238,
    visitors: 244,
    menuSales: { pork: 103, stew: 90, salad: 64, "rice-bowl": 201 },
    wasteKg: 14.2,
  },
  {
    date: "2026-09-23",
    weather: "sunny",
    reservations: 248,
    visitors: 261,
    menuSales: { pork: 111, stew: 98, salad: 70, "rice-bowl": 217 },
    wasteKg: 15.1,
  },
  {
    date: "2026-09-24",
    weather: "rain",
    reservations: 252,
    visitors: 238,
    menuSales: { pork: 99, stew: 97, salad: 56, "rice-bowl": 196 },
    wasteKg: 14.6,
  },
  {
    date: "2026-09-25",
    weather: "cloudy",
    reservations: 244,
    visitors: 251,
    menuSales: { pork: 107, stew: 93, salad: 64, "rice-bowl": 209 },
    wasteKg: 14.9,
  },
  {
    date: "2026-09-26",
    weather: "sunny",
    reservations: 258,
    visitors: 276,
    menuSales: { pork: 118, stew: 103, salad: 73, "rice-bowl": 229 },
    wasteKg: 16.4,
  },
  {
    date: "2026-09-27",
    weather: "sunny",
    reservations: 282,
    visitors: 304,
    menuSales: { pork: 132, stew: 112, salad: 82, "rice-bowl": 253 },
    wasteKg: 18.1,
  },
  {
    date: "2026-09-28",
    weather: "rain",
    reservations: 260,
    visitors: 242,
    menuSales: { pork: 101, stew: 99, salad: 57, "rice-bowl": 199 },
    wasteKg: 15.2,
  },
  {
    date: "2026-09-29",
    weather: "cloudy",
    reservations: 258,
    visitors: 265,
    menuSales: { pork: 113, stew: 98, salad: 69, "rice-bowl": 221 },
    wasteKg: 15.8,
  },
];

export const weeklyData: WeeklyDatum[] = [
  { day: "월", forecast: 242, actual: 235, waste: 13.4, cost: 98000 },
  { day: "화", forecast: 251, actual: 244, waste: 14.2, cost: 104000 },
  { day: "수", forecast: 269, actual: 261, waste: 15.1, cost: 112000 },
  { day: "목", forecast: 244, actual: 238, waste: 14.6, cost: 106000 },
  { day: "금", forecast: 241, actual: 251, waste: 14.9, cost: 124000 },
  { day: "토", forecast: 270, actual: 276, waste: 16.4, cost: 131000 },
  { day: "일", forecast: 296, actual: 304, waste: 18.1, cost: 66000 },
];

export const traditionalWasteHistory = [
  27.2, 29.1, 28.5, 30.4, 31.2, 26.8, 27.0,
];

export const previousWeekSummary = {
  wasteKg: 121.8,
  cost: 810000,
};

export const historicalCostCategories = [
  { name: "육류", cost: 340860 },
  { name: "채소", cost: 177840 },
  { name: "곡류", cost: 133380 },
  { name: "기타", cost: 88920 },
];
