import {
  historicalSales,
  ingredients,
  menuItems,
  traditionalWasteHistory,
} from "../data/demoData";
import { simulationConfig } from "./simulationConfig";
import type {
  DemoState,
  EventType,
  ForecastWeather,
  IngredientNeed,
  MenuPrediction,
  MenuWastePrediction,
  SimulationResult,
  WasteRisk,
  Weather,
} from "./types";

export const weatherLabels: Record<Weather, string> = {
  sunny: "맑음",
  cloudy: "흐림",
  rain: "비",
  snow: "눈",
};

export const eventLabels: Record<EventType, string> = {
  none: "없음",
  local_event: "지역 행사",
  holiday: "공휴일",
  group_booking: "단체 예약",
};

export function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

export function formatKg(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}kg` : `${rounded.toFixed(1)}kg`;
}

export function getKoreanDay(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);
  const index = Number.isNaN(date.getTime()) ? 0 : date.getDay();
  return {
    index,
    label: simulationConfig.dayLabels[index],
  };
}

export function isForecastReady(state: DemoState) {
  return Boolean(
    state.forecastDate &&
      state.reservationCount !== "" &&
      state.weather &&
      state.temperature !== "",
  );
}

export function isOrderInputReady(state: DemoState) {
  return ingredients.every(
    (ingredient) => state.inventory[ingredient.id] !== "",
  );
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function requireWeather(weather: ForecastWeather): Weather {
  return weather || "cloudy";
}

export function forecastDemand(state: DemoState) {
  const reservations = Number(state.reservationCount || 0);
  const temperature = Number(
    state.temperature || simulationConfig.temperatureComfort,
  );
  const weather = requireWeather(state.weather);
  const { index, label } = getKoreanDay(state.forecastDate);
  const recentRecords = historicalSales.slice(-7);
  const olderRecords = historicalSales.slice(
    0,
    historicalSales.length - recentRecords.length,
  );
  const recentRatio = average(
    recentRecords.map((record) => record.visitors / record.reservations),
  );
  const eligibleOperations = (state.operationHistory ?? []).filter(
    (record) =>
      record.reservations &&
      (!state.forecastCreatedAt || record.savedAt < state.forecastCreatedAt),
  );
  const observedRatio = eligibleOperations.length
    ? average(
        eligibleOperations.map(
          (record) => record.visitors / Number(record.reservations),
        ),
      )
    : null;
  const operatingRatio =
    observedRatio === null
      ? recentRatio
      : recentRatio * (1 - simulationConfig.savedOperationWeight) +
        observedRatio * simulationConfig.savedOperationWeight;
  const olderRatio = average(
    olderRecords.map((record) => record.visitors / record.reservations),
  );
  const trendAdjustment =
    1 + (recentRatio - olderRatio) * simulationConfig.trendWeight;
  const weatherFactor = simulationConfig.weatherFactors[weather];
  const dayFactor = simulationConfig.dayFactors[index];
  const eventFactor = simulationConfig.eventFactors[state.event];
  const temperatureAdjustment = clamp(
    (temperature - simulationConfig.temperatureComfort) *
      simulationConfig.temperatureWeight,
    -simulationConfig.maxTemperatureAdjustment,
    simulationConfig.maxTemperatureAdjustment,
  );
  const expectedVisitors = Math.max(
    0,
    Math.round(
      reservations *
        operatingRatio *
        trendAdjustment *
        weatherFactor *
        dayFactor *
        eventFactor *
        (1 + temperatureAdjustment),
    ),
  );

  return {
    expectedVisitors,
    reservationDelta: expectedVisitors - reservations,
    dayLabel: label,
    factors: {
      reservation:
        reservations >=
        average(recentRecords.map((record) => record.reservations))
          ? "up"
          : "down",
      weather:
        weatherFactor > 1.01 ? "up" : weatherFactor < 0.99 ? "down" : "flat",
      recentSales:
        trendAdjustment > 1.002
          ? "up"
          : trendAdjustment < 0.998
            ? "down"
            : "flat",
      event: eventFactor > 1 ? "up" : "flat",
    } as const,
  };
}

export function calculateMenuDemand(
  expectedVisitors: number,
  state: DemoState,
): MenuPrediction[] {
  const weather = requireWeather(state.weather);
  const { index } = getKoreanDay(state.forecastDate);
  const eligibleOperations = (state.operationHistory ?? []).filter(
    (record) =>
      !state.forecastCreatedAt || record.savedAt < state.forecastCreatedAt,
  );

  return menuItems.map((menu) => {
    const observedShare = eligibleOperations.length
      ? average(
          eligibleOperations.map(
            (record) =>
              (record.menuSales[menu.id] ?? 0) / Math.max(1, record.visitors),
          ),
        )
      : null;
    const demandShare =
      observedShare === null
        ? menu.demandShare
        : menu.demandShare * (1 - simulationConfig.savedOperationWeight) +
          observedShare * simulationConfig.savedOperationWeight;
    const rainyStewBoost = weather === "rain" && menu.id === "stew" ? 1.07 : 1;
    const snowSaladDrop = weather === "snow" && menu.id === "salad" ? 0.9 : 1;
    const weekendPorkBoost =
      index === 5 || index === 6 ? (menu.id === "pork" ? 1.03 : 1) : 1;
    const predicted = Math.max(
      0,
      Math.round(
        expectedVisitors *
          demandShare *
          menu.preference *
          rainyStewBoost *
          snowSaladDrop *
          weekendPorkBoost,
      ),
    );

    return {
      id: menu.id,
      name: menu.name,
      predicted,
    };
  });
}

export function calculateIngredientNeeds(menuPredictions: MenuPrediction[]) {
  const demandByMenu = Object.fromEntries(
    menuPredictions.map((menu) => [menu.id, menu.predicted]),
  );

  return ingredients.map((ingredient) => {
    const needed = round1(
      ingredient.recipes.reduce((sum, recipe) => {
        return (
          sum +
          ((demandByMenu[recipe.menuId] ?? 0) * recipe.gramsPerServing) / 1000
        );
      }, 0),
    );
    const formulas = ingredient.recipes.map((recipe) => {
      const menuName =
        menuItems.find((menu) => menu.id === recipe.menuId)?.name ?? "메뉴";
      const servings = demandByMenu[recipe.menuId] ?? 0;
      return `${menuName} ${servings}인분 × ${recipe.gramsPerServing}g`;
    });

    return {
      id: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      needed,
      currentStock: 0,
      recommendedOrder: needed,
      unitPrice: ingredient.unitPrice,
      estimatedCost: 0,
      status: "발주 필요" as const,
      formulas,
    };
  });
}

export function compareInventory(
  needs: IngredientNeed[],
  inventory: DemoState["inventory"],
) {
  return needs.map((need) => {
    const currentStock = Number(inventory[need.id] || 0);
    const recommendedOrder = round1(Math.max(0, need.needed - currentStock));
    const estimatedCost = Math.round(recommendedOrder * need.unitPrice);

    return {
      ...need,
      currentStock,
      recommendedOrder,
      estimatedCost,
      status: recommendedOrder > 0 ? ("발주 필요" as const) : ("충분" as const),
      formulas: [
        ...need.formulas,
        `${formatKg(need.needed)} − ${formatKg(currentStock)} = ${formatKg(recommendedOrder)}`,
      ],
    };
  });
}

export function calculateCost(
  orderRecommendations: IngredientNeed[],
  traditionalPlanCost: DemoState["traditionalPlanCost"],
) {
  const recommendedCost = orderRecommendations.reduce(
    (sum, item) => sum + item.estimatedCost,
    0,
  );
  const planCost =
    traditionalPlanCost === "" ? null : Number(traditionalPlanCost);
  const expectedSavings = planCost === null ? null : planCost - recommendedCost;

  return {
    recommendedCost,
    traditionalPlanCost: planCost,
    expectedSavings,
    savingRate:
      planCost === null || planCost <= 0
        ? null
        : round1((expectedSavings! / planCost) * 100),
  };
}

export function calculateWasteRisk(historicalWasteRate: number): WasteRisk {
  if (historicalWasteRate <= simulationConfig.wasteRiskThresholds.low)
    return "낮음";
  if (historicalWasteRate <= simulationConfig.wasteRiskThresholds.medium)
    return "보통";
  return "높음";
}

export function calculateRecommendedCookingAmount(
  predictedSales: number,
  wasteRisk: WasteRisk,
) {
  const factor =
    wasteRisk === "낮음"
      ? simulationConfig.cookingFactors.low
      : wasteRisk === "보통"
        ? simulationConfig.cookingFactors.medium
        : simulationConfig.cookingFactors.high;
  return Math.max(0, Math.round(predictedSales * factor));
}

export function estimateMenuWaste(
  menuPredictions: MenuPrediction[],
): MenuWastePrediction[] {
  return menuPredictions.map((prediction) => {
    const menu = menuItems.find((item) => item.id === prediction.id)!;
    const historicalWasteRate = menu.historicalWasteRate;
    const wasteRisk = calculateWasteRisk(historicalWasteRate);
    const recommendedCookingAmount = calculateRecommendedCookingAmount(
      prediction.predicted,
      wasteRisk,
    );
    return {
      menuId: menu.id,
      name: menu.name,
      predictedSales: prediction.predicted,
      historicalWasteRate,
      expectedWasteKg: round1(
        recommendedCookingAmount * menu.servingWeightKg * historicalWasteRate,
      ),
      wasteRisk,
      recommendedCookingAmount,
    };
  });
}

export function calculateTotalExpectedWaste(
  menuWastePredictions: MenuWastePrediction[],
) {
  return round1(
    menuWastePredictions.reduce((sum, item) => sum + item.expectedWasteKg, 0),
  );
}

export function calculateTraditionalWasteBaseline(state?: DemoState) {
  const historicalAverage = average(traditionalWasteHistory);
  const observations = (state?.wasteHistory ?? []).filter(
    (record) =>
      record.source === "prototype-load-cell" &&
      Number.isFinite(record.totalKg) &&
      (!state?.forecastCreatedAt || record.savedAt < state.forecastCreatedAt),
  );
  if (!observations.length) return round1(historicalAverage);
  const observedAverage = average(observations.map((record) => record.totalKg));
  return round1(
    historicalAverage * (1 - simulationConfig.savedWasteObservationWeight) +
      observedAverage * simulationConfig.savedWasteObservationWeight,
  );
}

export function estimateWaste(menuPredictions: MenuPrediction[]) {
  const wasteKg = calculateTotalExpectedWaste(
    estimateMenuWaste(menuPredictions),
  );

  return wasteKg;
}

export function runSimulation(state: DemoState): SimulationResult {
  const demand = forecastDemand(state);
  const menuPredictions = calculateMenuDemand(demand.expectedVisitors, state);
  const ingredientRequirements = calculateIngredientNeeds(menuPredictions);
  const ingredientNeeds = compareInventory(
    ingredientRequirements,
    state.inventory,
  );
  const cost = calculateCost(ingredientNeeds, state.traditionalPlanCost);
  const menuWastePredictions = estimateMenuWaste(menuPredictions);
  const estimatedWaste = calculateTotalExpectedWaste(menuWastePredictions);
  const traditionalWasteBaseline = calculateTraditionalWasteBaseline(state);

  return {
    expectedVisitors: demand.expectedVisitors,
    reservationDelta: demand.reservationDelta,
    dayLabel: demand.dayLabel,
    factorSignals: [
      { label: "예약", direction: demand.factors.reservation },
      { label: "날씨", direction: demand.factors.weather },
      { label: "최근 판매", direction: demand.factors.recentSales },
      { label: "이벤트", direction: demand.factors.event },
    ],
    menuPredictions,
    ingredientNeeds,
    recommendedCost: cost.recommendedCost,
    traditionalPlanCost: cost.traditionalPlanCost,
    expectedSavings: cost.expectedSavings,
    savingRate: cost.savingRate,
    menuWastePredictions,
    traditionalWasteBaseline,
    estimatedWaste,
    wasteReduction: round1(
      Math.max(0, traditionalWasteBaseline - estimatedWaste),
    ),
  };
}
