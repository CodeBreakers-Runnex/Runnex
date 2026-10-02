import { describe, expect, it } from "vitest";
import { decimateRoute, haversineKm, MAX_ROUTE_POINTS, routeLengthKm } from "@/lib/route";
import type { LatLng } from "@/lib/route";

// Tolerância do backend (backend/app/activity_rules.py): a distância
// declarada pode ser até 30% + 200 m maior que o comprimento da rota salva.
const BACKEND_TOLERANCE_FACTOR = 1.3;
const BACKEND_TOLERANCE_KM = 0.2;

// Corrida "real": pontos a cada ~6 m com ruído lateral de GPS de até ~3 m.
function noisyRun(points: number): LatLng[] {
  const route: LatLng[] = [];
  for (let i = 0; i < points; i++) {
    const noise = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    route.push([-23.55 + i * 0.000054, -46.63 + noise * 0.00003]);
  }
  return route;
}

describe("haversineKm", () => {
  it("1 grau de latitude tem ~111,195 km", () => {
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(111.195, 2);
  });

  it("distância zero para o mesmo ponto", () => {
    expect(haversineKm(-23.55, -46.63, -23.55, -46.63)).toBe(0);
  });
});

describe("decimateRoute", () => {
  it("não mexe em rotas dentro do limite", () => {
    const route = noisyRun(100);
    expect(decimateRoute(route)).toBe(route);
  });

  it("reduz para MAX_ROUTE_POINTS preservando início e fim", () => {
    const route = noisyRun(12_000);
    const decimated = decimateRoute(route);
    expect(decimated).toHaveLength(MAX_ROUTE_POINTS);
    expect(decimated[0]).toEqual(route[0]);
    expect(decimated.at(-1)).toEqual(route.at(-1));
  });

  it("a rota decimada continua passando na checagem de distância do backend", () => {
    // Maratona com GPS ruidoso: a distância do app é a soma dos segmentos
    // originais, mas o backend mede a rota já decimada (mais curta).
    const route = noisyRun(8_000);
    const claimedKm = routeLengthKm(route);
    const savedKm = routeLengthKm(decimateRoute(route));

    expect(savedKm).toBeLessThanOrEqual(claimedKm);
    expect(claimedKm).toBeLessThanOrEqual(savedKm * BACKEND_TOLERANCE_FACTOR + BACKEND_TOLERANCE_KM);
  });
});
