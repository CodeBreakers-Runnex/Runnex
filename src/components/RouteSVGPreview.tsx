import { useMemo } from "react";
import { MapPin } from "lucide-react";
import { MapContainer, TileLayer, Polyline, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { RoutePoint } from "@/types";
import { darkMapTiles } from "@/lib/mapTiles";

interface RouteSVGPreviewProps {
  route: RoutePoint[] | undefined;
  uid: string;
}

export const RouteSVGPreview = ({ route, uid }: RouteSVGPreviewProps) => {
  const data = useMemo(() => {
    if (!route || route.length < 2) return null;

    const positions = route.map((p) => [p.lat, p.lng] as [number, number]);
    const lats = positions.map((p) => p[0]);
    const lngs = positions.map((p) => p[1]);
    const center: [number, number] = [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lngs) + Math.max(...lngs)) / 2
    ];

    return {
      center,
      positions,
      start: positions[0],
      end: positions[positions.length - 1]
    };
  }, [route]);

  if (!data) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-purple-950/30 to-zinc-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 opacity-30">
          <MapPin size={32} className="text-purple-400" />
          <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Sem rota GPS</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-background relative isolate overflow-hidden">
      <MapContainer
        key={uid}
        center={data.center}
        zoom={16}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        zoomControl={false}
        attributionControl={false}
        className="absolute inset-0 z-0 h-full w-full [&_.leaflet-pane]:z-0 [&_.leaflet-top]:z-0 [&_.leaflet-bottom]:z-0"
      >
        <TileLayer {...darkMapTiles} />
        <Polyline positions={data.positions} color="#9333ea" weight={6} opacity={0.28} />
        <Polyline positions={data.positions} color="#a855f7" weight={3.5} opacity={0.95} />
        <CircleMarker center={data.start} radius={5} pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 1 }} />
        <CircleMarker center={data.end} radius={7} pathOptions={{ color: "#a855f7", fillColor: "#9333ea", fillOpacity: 0.9 }} />
      </MapContainer>
      <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-black/45 via-transparent to-black/15" />
    </div>
  );
};
