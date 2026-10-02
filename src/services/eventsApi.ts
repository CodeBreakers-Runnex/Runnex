import { doc, arrayUnion, setDoc } from "firebase/firestore";
import { db } from "@/config/firebase";
import { api } from "@/services/apiClient";
import type { RunningEvent } from "@/types";

const getFallbackEvents = (): RunningEvent[] => {
  const futureDate = (daysFromNow: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date;
  };

  const formatEventDate = (date: Date) => {
    const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    return `${date.getDate().toString().padStart(2, "0")} ${months[date.getMonth()]}`;
  };

  const dates = [futureDate(24), futureDate(52), futureDate(87)];

  return [
    {
      id: "local-sao-paulo-night-run",
      title: "Veloxy Night Run",
      date: formatEventDate(dates[0]),
      location: "Parque do Ibirapuera",
      city: "Sao Paulo",
      participantsCount: 420,
      participantsIds: [],
      category: "5K / 10K",
      distanceOptions: ["5K", "10K"],
      image: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?q=80&w=900&auto=format&fit=crop",
      price: "R$ 89",
      officialUrl: "https://www.ticketsports.com.br/",
      source: "Exemplo Veloxy",
      sourceUrl: "https://www.ticketsports.com.br/",
      sourceType: "demo",
      verified: false,
      status: "unknown",
      lat: -23.5874,
      lng: -46.6576,
      timestamp: dates[0],
    },
    {
      id: "local-rio-half",
      title: "Rio City Half",
      date: formatEventDate(dates[1]),
      location: "Aterro do Flamengo",
      city: "Rio de Janeiro",
      participantsCount: 1280,
      participantsIds: [],
      category: "21K",
      distanceOptions: ["21K"],
      image: "https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=900&auto=format&fit=crop",
      price: "R$ 140",
      officialUrl: "https://www.ticketsports.com.br/",
      source: "Exemplo Veloxy",
      sourceUrl: "https://www.ticketsports.com.br/",
      sourceType: "demo",
      verified: false,
      status: "unknown",
      lat: -22.9339,
      lng: -43.1706,
      timestamp: dates[1],
    },
    {
      id: "local-floripa-marathon",
      title: "Floripa Marathon",
      date: formatEventDate(dates[2]),
      location: "Beira Mar Norte",
      city: "Florianopolis",
      participantsCount: 860,
      participantsIds: [],
      category: "42K",
      distanceOptions: ["42K"],
      image: "https://images.unsplash.com/photo-1502904550040-7534597429ae?q=80&w=900&auto=format&fit=crop",
      price: "R$ 160",
      officialUrl: "https://www.ticketsports.com.br/",
      source: "Exemplo Veloxy",
      sourceUrl: "https://www.ticketsports.com.br/",
      sourceType: "demo",
      verified: false,
      status: "unknown",
      lat: -27.5904,
      lng: -48.5480,
      timestamp: dates[2],
    },
  ];
};

// Preenche defaults amigáveis para campos que o backend pode devolver vazios
// (image/price/etc não são obrigatórios no schema — eventos podem ser
// cadastrados sem essas informações). Mesma lógica que existia no
// normalizeEvent do Firestore, só que aplicada sobre a resposta já tipada
// da API em vez de dados brutos de documento.
const applyEventDefaults = (event: RunningEvent): RunningEvent => {
  const category = event.category || "Corrida";
  return {
    ...event,
    title: event.title || "Corrida oficial",
    location: event.location || "Local a confirmar",
    city: event.city || "Brasil",
    country: event.country || "BR",
    distanceOptions:
      event.distanceOptions && event.distanceOptions.length > 0
        ? event.distanceOptions
        : category.split("/").map((item) => item.trim()).filter(Boolean),
    image: event.image || "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?q=80&w=900&auto=format&fit=crop",
    price: event.price || "Ver no site oficial",
    officialUrl: event.officialUrl || event.sourceUrl || "",
    source: event.source || "Fonte oficial",
    sourceUrl: event.sourceUrl || event.officialUrl || "",
    sourceType: event.sourceType || "manual",
    status: event.status || "unknown",
  };
};

// Fase 1: eventos migraram para o backend próprio. Sem endpoint de criação
// (igual ao Firestore antes: eventos são cadastrados fora do app) — se a API
// não retornar nenhum, caem os eventos de demonstração locais.
export const getEvents = async (cityFilter?: string): Promise<RunningEvent[]> => {
  try {
    const rawEvents = await api.get<RunningEvent[]>("/events");
    let events = rawEvents.length > 0 ? rawEvents.map(applyEventDefaults) : getFallbackEvents();

    if (cityFilter) {
      const normalizedCity = cityFilter.toLowerCase().split(",")[0].trim();
      // Ordenar: Primeiro os da mesma cidade, depois os outros
      events = events.sort((a, b) => {
        const aMatch = a.city.toLowerCase().includes(normalizedCity);
        const bMatch = b.city.toLowerCase().includes(normalizedCity);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return 0;
      });
    }

    return events;
  } catch (error) {
    console.error("Erro ao buscar eventos:", error);
    return [];
  }
};

// Inscreve o usuário em um evento. Eventos locais/demo (prefixo "local-",
// nunca têm linha real no Postgres) continuam gravando enrolledEvents no
// Firestore; eventos reais vão direto para /events/{id}/join.
export const joinEvent = async (eventId: string, userId: string) => {
  try {
    if (eventId.startsWith("local-")) {
      await setDoc(doc(db, "users", userId), { enrolledEvents: arrayUnion(eventId) }, { merge: true });
      return true;
    }

    await api.post(`/events/${eventId}/join`);
    return true;
  } catch (error) {
    console.error("Erro ao se inscrever no evento:", error);
    throw error;
  }
};
