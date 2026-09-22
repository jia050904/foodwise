import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});

try {
  const {
    defaultDemoState,
    exampleForecastInput,
    exampleInventoryInput,
    historicalSales,
    historicalCostCategories,
    weeklyData,
  } = await server.ssrLoadModule("/src/data/demoData.ts");
  const { runSimulation } = await server.ssrLoadModule(
    "/src/lib/simulation.ts",
  );
  const result = runSimulation({
    ...defaultDemoState,
    ...exampleForecastInput,
    inventory: exampleInventoryInput,
    traditionalPlanCost: 160000,
    hasForecast: true,
    hasOrderCalculation: true,
  });
  const reportedWeek = historicalSales.filter(
    (record) => record.date >= "2026-09-21" && record.date <= "2026-09-27",
  );
  for (const [index, day] of weeklyData.entries()) {
    if (
      reportedWeek[index].visitors !== day.actual ||
      reportedWeek[index].wasteKg !== day.waste
    ) {
      throw new Error(
        `Weekly report and sales history disagree on ${reportedWeek[index].date}`,
      );
    }
  }
  if (
    historicalCostCategories.reduce((sum, item) => sum + item.cost, 0) !==
    weeklyData.reduce((sum, item) => sum + item.cost, 0)
  ) {
    throw new Error(
      "Historical cost categories must total the weekly purchase cost",
    );
  }
  const orders = Object.fromEntries(
    result.ingredientNeeds.map((item) => [item.id, item.recommendedOrder]),
  );
  const expected = {
    expectedVisitors: 295,
    porkOrder: 10,
    riceOrder: 8,
    vegetableOrder: 3,
    recommendedCost: 132000,
    expectedSavings: 28000,
    traditionalWasteBaseline: 28.6,
    estimatedWaste: 18.2,
    wasteReduction: 10.4,
  };
  const actual = {
    expectedVisitors: result.expectedVisitors,
    porkOrder: orders.pork,
    riceOrder: orders.rice,
    vegetableOrder: orders.vegetables,
    recommendedCost: result.recommendedCost,
    expectedSavings: result.expectedSavings,
    traditionalWasteBaseline: result.traditionalWasteBaseline,
    estimatedWaste: result.estimatedWaste,
    wasteReduction: result.wasteReduction,
  };

  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value)
      throw new Error(`${key}: expected ${value}, received ${actual[key]}`);
  }
  if (result.savingRate !== 17.5)
    throw new Error(`savingRate: expected 17.5, received ${result.savingRate}`);
  if (
    result.recommendedCost !==
    result.ingredientNeeds.reduce((sum, item) => sum + item.estimatedCost, 0)
  ) {
    throw new Error("Recommended cost must equal the sum of ingredient costs");
  }
  if (
    result.menuWastePredictions.some(
      (item) => item.recommendedCookingAmount < 0,
    )
  ) {
    throw new Error("Recommended cooking amount must not be negative");
  }
  const changedDemand = runSimulation({
    ...defaultDemoState,
    ...exampleForecastInput,
    reservationCount: 240,
    inventory: exampleInventoryInput,
  });
  if (
    changedDemand.expectedVisitors === result.expectedVisitors ||
    changedDemand.menuPredictions[0].predicted ===
      result.menuPredictions[0].predicted
  ) {
    throw new Error(
      "Changing reservations must change visitors and menu demand",
    );
  }
  const changedInventory = runSimulation({
    ...defaultDemoState,
    ...exampleForecastInput,
    inventory: { ...exampleInventoryInput, pork: 12 },
  });
  if (changedInventory.recommendedCost >= result.recommendedCost)
    throw new Error("More inventory must reduce recommended cost");
  const rainyForecast = runSimulation({
    ...defaultDemoState,
    ...exampleForecastInput,
    weather: "rain",
    inventory: exampleInventoryInput,
  });
  if (rainyForecast.expectedVisitors >= result.expectedVisitors)
    throw new Error("Weather must affect expected visitors");
  const savedObservation = {
    source: "prototype-load-cell",
    measuredAt: "2026-10-01T12:00:00.000Z",
    savedAt: "2026-10-01T12:01:00.000Z",
    meals: [
      { id: "breakfast", label: "아침", weightKg: 8.5 },
      { id: "lunch", label: "점심", weightKg: 17.2 },
      { id: "dinner", label: "저녁", weightKg: 13.6 },
    ],
    totalKg: 39.3,
  };
  const currentForecast = runSimulation({
    ...defaultDemoState,
    ...exampleForecastInput,
    forecastCreatedAt: "2026-10-01T11:00:00.000Z",
    wasteHistory: [savedObservation],
  });
  const nextForecast = runSimulation({
    ...defaultDemoState,
    ...exampleForecastInput,
    forecastCreatedAt: "2026-10-02T11:00:00.000Z",
    wasteHistory: [savedObservation],
  });
  if (
    currentForecast.traditionalWasteBaseline !== result.traditionalWasteBaseline ||
    nextForecast.traditionalWasteBaseline === result.traditionalWasteBaseline ||
    nextForecast.estimatedWaste !== result.estimatedWaste
  ) {
    throw new Error("Aggregate sensor waste must affect only subsequent baselines, not menu estimates");
  }
  const savedOperation = {
    visitors: 320,
    reservations: 280,
    operatingDate: "2026-10-01",
    menuSales: { pork: 155, stew: 115, salad: 63, "rice-bowl": 265 },
    inventoryNote: "",
    wasteNote: "",
    savedAt: "2026-10-01T12:01:00.000Z",
  };
  const unchangedCurrent = runSimulation({
    ...defaultDemoState,
    ...exampleForecastInput,
    forecastCreatedAt: "2026-10-01T11:00:00.000Z",
    operationHistory: [savedOperation],
  });
  const updatedNext = runSimulation({
    ...defaultDemoState,
    ...exampleForecastInput,
    forecastCreatedAt: "2026-10-02T11:00:00.000Z",
    operationHistory: [savedOperation],
  });
  if (
    unchangedCurrent.expectedVisitors !== result.expectedVisitors ||
    updatedNext.expectedVisitors === result.expectedVisitors
  ) {
    throw new Error("Saved operation must affect only subsequent forecasts");
  }
  console.log("Presentation scenario verified:", actual);
} finally {
  await server.close();
}
