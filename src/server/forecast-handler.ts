import { isCity } from "../domain/air";
import { createForecastService } from "./forecast-service";
import { errorResponse, jsonResponse } from "./http";

export function createForecastHandler(getForecast = createForecastService()) {
  return async function GET(request: Request) {
    const city = new URL(request.url).searchParams.get("city");
    if (!isCity(city))
      return jsonResponse({ error: "Choose Delhi, Noida or Gurugram." }, 400);
    try {
      return jsonResponse(await getForecast(city));
    } catch (error) {
      return errorResponse(
        error,
        "The forecast is unavailable. Try again or load the sample.",
      );
    }
  };
}
