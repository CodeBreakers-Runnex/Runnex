export type LatLng = [number, number];

const EARTH_RADIUS_KM = 6371;

// Mesma formula de backend/app/activity_rules.py, que confere a distancia
// declarada contra o comprimento da rota enviada.
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function routeLengthKm(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
  }
  return total;
}

// Filtro de pontos de GPS durante a corrida. Abaixo de 5 m é ruído do
// receptor (o ponto "treme" parado). Acima de 500 m entre duas leituras não
// dá para ter corrido: é túnel, sinal perdido ou pausa seguida de
// deslocamento. Antes esse salto era só descartado, e como o último ponto
// nunca mudava, todos os pontos seguintes também eram descartados até o fim
// da corrida (distância "congelava").
export const GPS_MIN_STEP_KM = 0.005;
export const GPS_MAX_STEP_KM = 0.5;

export function acceptGpsPoint(path: LatLng[], point: LatLng): { path: LatLng[]; addedKm: number } {
  if (path.length === 0) return { path: [point], addedKm: 0 };

  const last = path[path.length - 1];
  const d = haversineKm(last[0], last[1], point[0], point[1]);

  if (d < GPS_MIN_STEP_KM) return { path, addedKm: 0 };
  if (d < GPS_MAX_STEP_KM) return { path: [...path, point], addedKm: d };

  // Salto grande: o ponto vira a nova âncora sem somar distância, para que
  // as próximas leituras voltem a ser comparadas com a posição atual. A rota
  // salva fica maior que a distância declarada, o que o backend aceita
  // (activity_rules.py só recusa distância MAIOR que a rota).
  return { path: [...path, point], addedKm: 0 };
}

// O backend rejeita rotas com mais de 5000 pontos (schemas.ActivityCreate);
// mantemos uma margem de segurança e decimamos localmente antes de salvar
// em vez de deixar corridas longas falharem ao salvar.
export const MAX_ROUTE_POINTS = 4500;

export function decimateRoute(points: LatLng[]): LatLng[] {
  if (points.length <= MAX_ROUTE_POINTS) return points;

  const step = points.length / MAX_ROUTE_POINTS;
  const result: LatLng[] = [];
  for (let i = 0; i < MAX_ROUTE_POINTS; i++) {
    result.push(points[Math.floor(i * step)]);
  }
  // Garante que o ponto final real da corrida seja preservado
  result[result.length - 1] = points[points.length - 1];
  return result;
}
