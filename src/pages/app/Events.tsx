import { motion, AnimatePresence } from "framer-motion";
import { Calendar, MapPin, Users, ChevronRight, Bell, Tag, Clock, Loader2, CheckCircle, ExternalLink, Navigation } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getEvents,
  joinEvent,
  getUserProfile,
  RunningEvent
} from "@/services/database";
import { toast } from "sonner";
import { toDateSafe } from "@/lib/feed-utils";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";

const categories = ["Proximos", "Perto", "Inscrito", "Passados"];
const distanceFilters = ["Todos", "5K", "10K", "21K", "42K"];
const radiusFilters = [
    { label: "25 km", value: 25 },
    { label: "50 km", value: 50 },
    { label: "100 km", value: 100 },
    { label: "Todos", value: 0 },
];

const getEventDate = (event: RunningEvent) => {
    return toDateSafe(event.timestamp) ?? new Date(0);
};

const toRad = (value: number) => (value * Math.PI) / 180;

const getDistanceKm = (from: { lat: number; lng: number }, event: RunningEvent) => {
    if (typeof event.lat !== "number" || typeof event.lng !== "number") return null;

    const earthRadiusKm = 6371;
    const dLat = toRad(event.lat - from.lat);
    const dLng = toRad(event.lng - from.lng);
    const lat1 = toRad(from.lat);
    const lat2 = toRad(event.lat);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Evento sem imagem (ou com URL quebrada) mostrava o texto alternativo
// cru ("featured"/"event") no lugar da foto; cai num gradiente da marca.
function EventImage({ src, className }: { src?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className={cn(className, "bg-gradient-to-br from-purple-600/50 via-purple-900/40 to-secondary")} aria-hidden="true" />;
  }
  return <img src={src} alt="" className={className} onError={() => setFailed(true)} />;
}

const Events = ({ embedded = false }: { embedded?: boolean }) => {
    const { user } = useAuth();
    const [events, setEvents] = useState<RunningEvent[]>([]);
    const [enrolledIds, setEnrolledIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("Proximos");
    const [userCity, setUserCity] = useState("");
    const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [selectedDistance, setSelectedDistance] = useState("Todos");
    const [selectedRadius, setSelectedRadius] = useState(50);

    const userInitials = user?.displayName?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "U";

    useEffect(() => {
        const loadData = async () => {
            if (!user) return;
            try {
                
                // Pegar cidade do perfil
                const profile = await getUserProfile(user.uid);
                const city = profile?.location || "";
                setUserCity(city);
                setEnrolledIds(profile?.enrolledEvents || []);

                // Buscar todos os eventos ordenados/filtrados por cidade
                const allEvents = await getEvents(city);
                setEvents(allEvents);
            } catch (error) {
                console.error("Erro ao carregar eventos:", error);
                toast.error("Não foi possível carregar os eventos.");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [user]);

    const requestLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Seu navegador nao liberou localizacao.");
            return;
        }

        setLocationLoading(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUserCoords({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
                setActiveTab("Perto");
                toast.success("Eventos perto de voce ativados.");
                setLocationLoading(false);
            },
            () => {
                toast.error("Nao foi possivel acessar sua localizacao.");
                setLocationLoading(false);
            },
            { enableHighAccuracy: true, timeout: 9000, maximumAge: 1000 * 60 * 10 }
        );
    };

    const handleJoin = async (event: RunningEvent) => {
        if (!user) return;
        const officialUrl = event.officialUrl || event.sourceUrl;

        if (officialUrl) {
            window.open(officialUrl, "_blank", "noopener,noreferrer");
        }

        const eventId = event.id;
        if (enrolledIds.includes(eventId)) {
            toast.info("Evento ja esta salvo no seu perfil.");
            return;
        }

        try {
            await joinEvent(eventId, user.uid);
            setEnrolledIds(prev => [...prev, eventId]);
            toast.success(officialUrl ? "Evento salvo. Abrindo site oficial." : "Evento salvo no perfil.");
        } catch (error) {
            toast.error("Nao foi possivel salvar este evento.");
        }
    };

    const filteredEvents = useMemo(() => {
        let nextEvents = events.map((event) => ({
            event,
            distanceKm: userCoords ? getDistanceKm(userCoords, event) : null,
        }));

        if (activeTab === "Inscrito") {
            nextEvents = nextEvents.filter(({ event }) => enrolledIds.includes(event.id));
        }
        if (activeTab === "Passados") {
            nextEvents = nextEvents.filter(({ event }) => getEventDate(event) < new Date());
        } else {
            nextEvents = nextEvents.filter(({ event }) => getEventDate(event) >= new Date());
        }

        if (activeTab === "Perto") {
            nextEvents = nextEvents.filter(({ distanceKm }) => {
                if (!userCoords) return false;
                if (selectedRadius === 0) return distanceKm !== null;
                return distanceKm !== null && distanceKm <= selectedRadius;
            });
        }

        if (selectedDistance !== "Todos") {
            nextEvents = nextEvents.filter(({ event }) => {
                const options = event.distanceOptions || event.category.split("/").map((item) => item.trim());
                return options.some((option) => option.toUpperCase().includes(selectedDistance));
            });
        }

        return nextEvents
            .sort((a, b) => {
                if (activeTab === "Perto") return (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER);
                return getEventDate(a.event).getTime() - getEventDate(b.event).getTime();
            })
            .map(({ event, distanceKm }) => ({ ...event, distanceKm }));
    }, [events, activeTab, enrolledIds, selectedDistance, selectedRadius, userCoords]);

    if (loading) {
        return (
            <div className={`${embedded ? "min-h-[280px]" : "app-shell"} flex flex-col items-center justify-center gap-4`}>
                <Loader2 className="animate-spin text-purple-500" size={40} />
                <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase">Buscando Corridas...</p>
            </div>
        );
    }

  return (
    <div className={`${embedded ? "min-h-0 pb-4" : "app-shell pb-24 safe-top"}`}>
      {/* Header */}
      {!embedded && <header className="bg-card/80 backdrop-blur-xl border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center border border-input overflow-hidden">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-purple-500">{userInitials}</span>
          )}
        </div>
        
        <h1 className="font-display font-black text-2xl tracking-tighter text-purple-500">
          VELOXY EVENTS
        </h1>
        
        <button className="w-10 h-10 rounded-full bg-card flex items-center justify-center border border-border text-muted-foreground" aria-label="Ver calendário de eventos">
          <Calendar size={18} />
        </button>
      </header>}

      {/* Categories Horizontal */}
      <section className={`${embedded ? "mt-2 px-0" : "mt-8 px-6"}`}>
        <div className="flex gap-3 overflow-x-auto no-scrollbar">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => {
                if (c === "Perto" && !userCoords) {
                  requestLocation();
                  return;
                }
                setActiveTab(c);
              }}
              className={`px-6 py-2 rounded-full text-[10px] font-black tracking-widest transition-all ${
                activeTab === c
                  ? "bg-purple-600 text-white"
                  : "bg-card/80 backdrop-blur-xl border border-border text-muted-foreground"
              }`}
            >
              {c.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
          <button
            onClick={requestLocation}
            disabled={locationLoading}
            className="bg-card/80 backdrop-blur-xl border border-border flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground disabled:opacity-60"
          >
            {locationLoading ? <Loader2 size={14} className="animate-spin text-purple-500" /> : <Navigation size={14} className="text-purple-500" />}
            {userCoords ? "Localizacao ativa" : "Usar minha localizacao"}
          </button>
          <div className="bg-card/80 backdrop-blur-xl border border-border flex min-h-12 items-center justify-center rounded-2xl px-4 text-[10px] font-black uppercase tracking-widest text-purple-400">
            {filteredEvents.length} eventos
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {distanceFilters.map((distance) => (
            <button
              key={distance}
              onClick={() => setSelectedDistance(distance)}
              className={`rounded-full px-4 py-2 text-[9px] font-black uppercase tracking-widest transition ${
                selectedDistance === distance ? "bg-purple-600 text-white" : "bg-card/80 backdrop-blur-xl border border-border text-muted-foreground"
              }`}
            >
              {distance}
            </button>
          ))}
        </div>

        {activeTab === "Perto" && (
          <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
            {radiusFilters.map((radius) => (
              <button
                key={radius.label}
                onClick={() => setSelectedRadius(radius.value)}
                className={`rounded-full px-4 py-2 text-[9px] font-black uppercase tracking-widest transition ${
                  selectedRadius === radius.value ? "bg-purple-600 text-white" : "bg-card/80 backdrop-blur-xl border border-border text-muted-foreground"
                }`}
              >
                {radius.label}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Featured Event Banner */}
      {events[0] && <section className={`${embedded ? "px-0 mt-6" : "px-6 mt-10"}`}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="group relative h-64 rounded-3xl overflow-hidden border border-border cursor-pointer shadow-2xl"
          >
              <EventImage src={events[0].image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
              <div className="absolute bottom-8 left-8 right-8 text-white">
                  <div className="flex items-center gap-2 mb-3">
                      <div className="bg-purple-600 px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase shadow-lg shadow-purple-600/30">EM BREVE</div>
                      <div className="bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase">Geral</div>
                  </div>
                  <h2 className="font-display font-black text-2xl tracking-tighter uppercase mb-2 leading-none">{events[0].title}</h2>
                  <div className="flex items-center gap-4 text-white/70 text-[10px] font-bold uppercase tracking-widest">
                      <span className="flex items-center gap-1.5"><Calendar size={12} className="text-purple-500" /> {events[0].date}</span>
                      <span className="flex items-center gap-1.5"><MapPin size={12} className="text-purple-500" /> {events[0].city}</span>
                  </div>
              </div>
          </motion.div>
      </section>}

      {/* All Events List */}
      <section className={`${embedded ? "mt-8 px-0 pb-2" : "mt-12 px-6 pb-10"} space-y-8`}>
        <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-black text-sm tracking-tighter uppercase">Todas as Corridas</h3>
            <span className="text-[10px] font-black text-muted-foreground tracking-widest">{filteredEvents.length} DISPONIVEIS</span>
        </div>

        {!filteredEvents.length ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <Calendar size={48} className="text-muted-foreground/50" />
                <p className="font-black text-muted-foreground/70 uppercase tracking-widest text-xs">
                    Nenhum evento encontrado nesta categoria
                </p>
            </div>
        ) : filteredEvents.map((event, i) => {
          const isInscrito = enrolledIds.includes(event.id);
          const isLocal = userCity && event.city.toLowerCase().includes(userCity.split(",")[0].toLowerCase().trim());
          const distanceKm = event.distanceKm;
          const hasOfficialUrl = Boolean(event.officialUrl || event.sourceUrl);

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cn(GLASS_CARD_CLASS, "p-5 flex flex-col gap-6 transition-all", isLocal && "border-purple-500/30 bg-purple-500/5")}
            >
               <div className="flex items-center gap-5">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden border border-border relative flex-shrink-0">
                      <EventImage src={event.image} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md p-1.5 rounded-xl border border-white/10">
                          <Tag size={12} className="text-purple-500" />
                      </div>
                      {(isLocal || typeof distanceKm === "number") && (
                        <div className="absolute bottom-0 left-0 right-0 bg-purple-600 text-[7px] font-black text-center py-0.5">
                          {typeof distanceKm === "number" ? `${distanceKm.toFixed(0)} KM` : "PERTO DE VOCE"}
                        </div>
                      )}
                  </div>
                  <div className="flex-1 min-w-0">
                      <h4 className="font-display font-black text-lg tracking-tighter uppercase truncate leading-tight mb-1">{event.title}</h4>
                      <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-muted-foreground text-[9px] font-bold tracking-widest uppercase leading-none">
                              <Clock size={10} className="text-purple-500" /> {event.date} • 07:00 AM
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground text-[9px] font-bold tracking-widest uppercase leading-none mt-1">
                              <MapPin size={10} className="text-purple-500" /> {event.location}
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground text-[9px] font-bold tracking-widest uppercase leading-none mt-1">
                              <ExternalLink size={10} className="text-purple-500" /> {event.source || "Fonte oficial"}
                              {event.verified ? " · verificado" : ""}
                          </div>
                      </div>
                  </div>
               </div>
  
               <div className="flex items-center justify-between pt-6 border-t border-border/50">
                  <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                          <p className="text-[9px] font-black text-muted-foreground/70 uppercase tracking-widest leading-none mb-1">Inscrição</p>
                          <p className="text-sm font-black text-purple-500 uppercase leading-none">{event.price}</p>
                      </div>
                      <div className="w-[1px] h-6 bg-border/50" />
                      <div className="flex flex-col">
                          <p className="text-[9px] font-black text-muted-foreground/70 uppercase tracking-widest leading-none mb-1">Salvos</p>
                          <div className="flex items-center gap-1 leading-none">
                              <Users size={10} className="text-muted-foreground" />
                              <span className="text-[10px] font-black text-foreground">{event.participantsCount}</span>
                          </div>
                      </div>
                  </div>
                  
                  <button 
                    onClick={() => handleJoin(event)}
                    className={`h-12 px-6 rounded-full flex items-center justify-center gap-2 transition-all shadow-lg ${
                        isInscrito 
                        ? "bg-green-500/20 border border-green-500/30 text-green-500" 
                        : "bg-purple-600 text-white border border-purple-500 shadow-purple-600/20 hover:scale-105 active:scale-95"
                    }`}
                  >
                        {isInscrito ? (
                            <><CheckCircle size={16} /> <span className="text-[10px] font-black tracking-widest uppercase">{hasOfficialUrl ? "Abrir site" : "Salvo"}</span></>
                        ) : (
                            <><span className="text-[10px] font-black tracking-widest uppercase">{hasOfficialUrl ? "Site oficial" : "Salvar"}</span> <ChevronRight size={16} strokeWidth={3} /></>
                        )}
                  </button>
               </div>
            </motion.div>
          );
        })}
      </section>
    </div>
  );
};

export default Events;
