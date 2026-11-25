import { isCity } from "../domain/air";
import { errorResponse, HttpError } from "./http";
import { createForecastService } from "./open-meteo";

export function createForecastHandler(getForecast = createForecastService()) {
  return async function GET(request: Request) {
    const city = new URL(request.url).searchParams.get("city");
    if (!isCity(city))
      return errorResponse(
        new HttpError(400, "Choose Delhi, Noida or Gurugram."),
        "",
      );
    try {
      return Response.json(await getForecast(city), {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      return errorResponse(
        error,
        "The forecast is unavailable. Try again or load the sample.",
      );
    }
  };
}
