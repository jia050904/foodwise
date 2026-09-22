import type { EventType, Weather } from "./types";

/*
 * Prototype simulation parameters.
 * Replace with learned model parameters when real restaurant data is available.
 */
export const simulationConfig = {
  weatherFactors: {
    sunny: 1.033,
    cloudy: 1,
    rain: 0.93,
    snow: 0.88,
  } satisfies Record<Weather, number>,
  eventFactors: {
    none: 1,
    local_event: 1.07,
    holiday: 1.1,
    group_booking: 1.13,
  } satisfies Record<EventType, number>,
  dayFactors: [1.04, 0.93, 0.96, 0.98, 1, 1.07, 1.1],
  dayLabels: [
    "일요일",
    "월요일",
    "화요일",
    "수요일",
    "목요일",
    "금요일",
    "토요일",
  ],
  temperatureComfort: 23,
  temperatureWeight: 0.003,
  trendWeight: 0.18,
  maxTemperatureAdjustment: 0.04,
  savedWasteObservationWeight: 0.15,
  savedOperationWeight: 0.15,
  historicalWasteLossPerKg: 600,
  wasteRiskThresholds: {
    low: 0.18,
    medium: 0.24,
  },
  cookingFactors: {
    low: 1.03,
    medium: 1.01,
    high: 0.96,
  },
};
