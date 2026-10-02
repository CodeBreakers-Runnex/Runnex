// Camada de tiles unica para todos os mapas do app (corrida ao vivo e
// previews de rota no feed/historico).
//
// Desde o fim de agosto/2026 a CARTO exige chave em basemaps.cartocdn.com:
// sem ?key= os tiles voltam com a marca d'agua "API KEY REQUIRED" no lugar do
// mapa. A chave e gratuita (carto.com/basemaps/apikey, sem conta) e, como a do
// Firebase, e um identificador de cliente — fica no .env.local.
//
// Sem chave configurada caimos no Dark Gray Canvas da Esri, que nao exige
// chave, para o mapa nao ficar quebrado em dev/CI. Producao deve usar a CARTO.

const CARTO_API_KEY = (import.meta.env.VITE_CARTO_API_KEY as string | undefined)?.trim();

export interface MapTileConfig {
  url: string;
  attribution: string;
  subdomains?: string;
  maxNativeZoom: number;
  maxZoom: number;
}

const cartoDark = (key: string): MapTileConfig => ({
  url: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(key)}`,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxNativeZoom: 20,
  maxZoom: 20,
});

// O Dark Gray Canvas so tem tiles ate o zoom 16; acima disso o Leaflet
// amplia o tile do 16 em vez de pedir tiles que nao existem.
const esriDarkGray: MapTileConfig = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors",
  maxNativeZoom: 16,
  maxZoom: 20,
};

if (!CARTO_API_KEY) {
  console.warn(
    "VITE_CARTO_API_KEY nao definida: mapas usando tiles da Esri como fallback. " +
      "Gere uma chave gratuita em carto.com/basemaps/apikey e coloque no .env.local"
  );
}

export const darkMapTiles: MapTileConfig = CARTO_API_KEY ? cartoDark(CARTO_API_KEY) : esriDarkGray;
