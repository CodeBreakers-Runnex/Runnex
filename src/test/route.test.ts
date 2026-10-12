import { describe, expect, it } from "vitest";
import { acceptGpsPoint, decimateRoute, haversineKm, MAX_ROUTE_POINTS, routeLengthKm } from "@/lib/route";
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

describe("acceptGpsPoint", () => {
  // ~0,00009° de latitude ≈ 10 m
  const start: LatLng = [-23.55, -46.63];
  const north = (p: LatLng, meters: number): LatLng => [p[0] + meters / 111_195, p[1]];

  it("o primeiro ponto vira o início da rota sem somar distância", () => {
    expect(acceptGpsPoint([], start)).toEqual({ path: [start], addedKm: 0 });
  });

  it("ignora ruído abaixo de 5 m", () => {
    const path = [start];
    const result = acceptGpsPoint(path, north(start, 3));
    expect(result.path).toBe(path);
    expect(result.addedKm).toBe(0);
  });

  it("aceita um ponto válido e soma a distância", () => {
    const next = north(start, 20);
    const result = acceptGpsPoint([start], next);
    expect(result.path).toEqual([start, next]);
    expect(result.addedKm).toBeCloseTo(0.02, 4);
  });

  it("salto acima de 500 m vira âncora sem somar distância", () => {
    const far = north(start, 800);
    const result = acceptGpsPoint([start], far);
    expect(result.path).toEqual([start, far]);
    expect(result.addedKm).toBe(0);
  });

  it("depois do salto, os pontos seguintes voltam a ser aceitos e somados", () => {
    // Era o bug: o último ponto ficava preso antes do salto e tudo era descartado.
    let path: LatLng[] = [start];
    let total = 0;
    const far = north(start, 800);
    for (const p of [far, north(far, 20), north(far, 40), north(far, 60)]) {
      const r = acceptGpsPoint(path, p);
      path = r.path;
      total += r.addedKm;
    }
    expect(path).toHaveLength(5);
    expect(total).toBeCloseTo(0.06, 4);
  });

  it("pausa → deslocamento → retomada continua contando a partir do novo lugar", () => {
    let path: LatLng[] = [];
    let total = 0;
    const apply = (p: LatLng) => {
      const r = acceptGpsPoint(path, p);
      path = r.path;
      total += r.addedKm;
    };
    // Corre 100 m
    for (let m = 0; m <= 100; m += 10) apply(north(start, m));
    // Pausado, anda 2 km até outro lugar e retoma
    const resume = north(start, 2100);
    for (let m = 0; m <= 100; m += 10) apply(north(resume, m));

    expect(total).toBeCloseTo(0.2, 3);
    expect(path.at(-1)).toEqual(north(resume, 100));
    // A rota salva fica maior que a distância (inclui o salto) e por isso
    // passa na checagem do backend, que só recusa distância maior que a rota.
    expect(total).toBeLessThanOrEqual(routeLengthKm(path) * BACKEND_TOLERANCE_FACTOR + BACKEND_TOLERANCE_KM);
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
