export type Weather = "sunny" | "cloudy" | "rain" | "snow";
export type ForecastWeather = Weather | "";
export type EventType = "none" | "local_event" | "holiday" | "group_booking";

export interface DemoState {
  forecastDate: string;
  reservationCount: number | "";
  weather: ForecastWeather;
  temperature: number | "";
  event: EventType;
  hasForecast: boolean;
  inventory: Record<string, number | "">;
  hasOrderCalculation: boolean;
  traditionalPlanCost: number | "";
  restaurant: {
    name: string;
    address: string;
  };
  actualLog: ActualLog | null;
  operationHistory: OperationalHistoryRecord[];
  wasteHistory: SensorWasteRecord[];
  forecastCreatedAt: string | null;
}

export interface ActualLog {
  visitors: number;
  menuSales: Record<string, number>;
  inventoryNote: string;
  wasteNote: string;
  savedAt: string;
}

export interface OperationalHistoryRecord extends ActualLog {
  reservations: number | null;
  operatingDate: string;
}

export interface SensorWasteRecord {
  source: "prototype-load-cell";
  measuredAt: string;
  meals: Array<{ id: string; label: string; weightKg: number }>;
  totalKg: number;
  savedAt: string;
}

export interface MenuItem {
  id: string;
  name: string;
  demandShare: number;
  historicalWasteRate: number;
  servingWeightKg: number;
  preference: number;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: "kg";
  unitPrice: number;
  recipes: Array<{
    menuId: string;
    gramsPerServing: number;
  }>;
}

export interface MenuPrediction {
  id: string;
  name: string;
  predicted: number;
}

export type WasteRisk = "낮음" | "보통" | "높음";

export interface MenuWastePrediction {
  menuId: string;
  name: string;
  predictedSales: number;
  historicalWasteRate: number;
  expectedWasteKg: number;
  wasteRisk: WasteRisk;
  recommendedCookingAmount: number;
}

export interface IngredientNeed {
  id: string;
  name: string;
  unit: "kg";
  needed: number;
  currentStock: number;
  recommendedOrder: number;
  unitPrice: number;
  estimatedCost: number;
  status: "발주 필요" | "충분";
  formulas: string[];
}

export interface SimulationResult {
  expectedVisitors: number;
  reservationDelta: number;
  dayLabel: string;
  factorSignals: Array<{ label: string; direction: "up" | "flat" | "down" }>;
  menuPredictions: MenuPrediction[];
  ingredientNeeds: IngredientNeed[];
  recommendedCost: number;
  traditionalPlanCost: number | null;
  expectedSavings: number | null;
  savingRate: number | null;
  menuWastePredictions: MenuWastePrediction[];
  traditionalWasteBaseline: number;
  estimatedWaste: number;
  wasteReduction: number;
}

export interface WeeklyDatum {
  day: string;
  forecast: number;
  actual: number;
  waste: number;
  cost: number;
}

export interface HistoricalSalesRecord {
  date: string;
  weather: Weather;
  reservations: number;
  visitors: number;
  menuSales: Record<string, number>;
  wasteKg: number;
}
