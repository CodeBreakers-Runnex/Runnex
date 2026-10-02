import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FirebaseError } from "firebase/app";
import { Capacitor, registerPlugin } from "@capacitor/core";
import type {
  BackgroundGeolocationPlugin,
  CallbackError,
  Location as BackgroundLocation,
} from "@capacitor-community/background-geolocation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Pause, 
  Play, 
  Square, 
  MapPin, 
  Timer, 
  Zap, 
  TrendingUp,
  Map as MapIcon,
  Navigation,
  Loader2,
  Music,
  X,
  ExternalLink
} from "lucide-react";
import { MapContainer, TileLayer, Polyline, useMap, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { darkMapTiles } from "@/lib/mapTiles";
import { useAuth } from "@/hooks/useAuth";
import { saveActivity } from "@/services/database";
import { ApiError } from "@/services/apiClient";
import { toast } from "sonner";
import { getBestUserPhotoURL } from "@/lib/user-photo";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import { decimateRoute, haversineKm } from "@/lib/route";

const BackgroundGeolocation =
  registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

type ScreenWakeLockSentinel = {
  release: () => Promise<void>;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<ScreenWakeLockSentinel>;
  };
};

const SIMULATED_ROUTE: [number, number][] = [
  [-23.55053, -46.63331],
  [-23.55038, -46.63308],
  [-23.55021, -46.63274],
  [-23.55008, -46.63235],
  [-23.55020, -46.63203],
  [-23.55048, -46.63182],
  [-23.55083, -46.63193],
  [-23.55108, -46.63224],
  [-23.55118, -46.63269],
  [-23.55105, -46.63309],
  [-23.55080, -46.63342],
  [-23.55051, -46.63368],
  [-23.55020, -46.63355],
  [-23.55007, -46.63322],
  [-23.55024, -46.63292],
  [-23.55055, -46.63278],
  [-23.55082, -46.63296],
  [-23.55093, -46.63331],
  [-23.55074, -46.63362],
  [-23.55053, -46.63331],
];
// 12 km/h (pace 5'00"/km): ritmo de corrida plausivel para demonstracao.
const SIMULATED_TICK_MS = 1000;
const SIMULATED_STEP_KM = 12 / 3600;

// Snapshot da corrida em andamento, salvo localmente para sobreviver a um
// fechamento do app pelo sistema operacional (processo morto = serviço de
// GPS em segundo plano também é encerrado, então não há como recuperar isso
// de outra forma).
const ACTIVE_RUN_STORAGE_KEY = "veloxy_active_run_v1";

type ActiveRunSnapshot = {
  distance: number;
  seconds: number;
  path: [number, number][];
  isSimulating: boolean;
  savedAt: number;
};

function clearActiveRunSnapshot() {
  try {
    localStorage.removeItem(ACTIVE_RUN_STORAGE_KEY);
  } catch {
    // localStorage indisponível (modo privado etc.) — nada a limpar
  }
}

const getSaveErrorMessage = (error: unknown) => {
  // Fase 1: saveActivity agora chama o backend próprio — erros de validação
  // vêm como ApiError (ver src/services/apiClient.ts), não mais FirebaseError.
  if (error instanceof ApiError) {
    // 422 traz o motivo da recusa em texto (velocidade acima de 30 km/h,
    // distancia incompativel com a rota, limite diario - ver
    // backend/app/activity_rules.py) e 429 avisa do rate limit.
    if (error.status === 422 || error.status === 429) {
      return `Não foi possível salvar a corrida: ${error.message}`;
    }
    if (error.status === 400) {
      return "Não foi possível salvar a corrida (dados fora dos limites permitidos). Tente novamente ou entre em contato com o suporte.";
    }
    if (error.status === 401) {
      return "Sessão expirada. Faça login novamente.";
    }
    if (error.status === 403) {
      return "Confirme seu email antes de salvar corridas. Veja a tela de verificação.";
    }
    if (error.status >= 500) {
      return "Servidor indisponível agora. Tente novamente em instantes.";
    }
    return error.message || "Erro ao salvar corrida.";
  }

  if (error instanceof FirebaseError) {
    return `Erro Firebase: ${error.code}`;
  }

  return "Erro ao salvar corrida. Veja o console para detalhes.";
};

const getGpsErrorMessage = (error: GeolocationPositionError) => {
  if (!window.isSecureContext) {
    return "GPS real precisa de HTTPS no celular. Use o simulador ou abra por um link HTTPS.";
  }

  if (error.code === error.PERMISSION_DENIED) {
    return "Permissao de GPS negada. Libere a localizacao no navegador.";
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Localizacao indisponivel agora. Tente em uma area com melhor sinal.";
  }

  if (error.code === error.TIMEOUT) {
    return "Tempo esgotado ao buscar GPS. Tente novamente.";
  }

  return `Erro ao acessar GPS: ${error.message}`;
};

const getBackgroundGpsErrorMessage = (error: CallbackError) => {
  if (error.code === "NOT_AUTHORIZED") {
    return "Permissao de GPS negada. Libere a localizacao nas configuracoes do app.";
  }

  if (error.message) {
    return `Erro no GPS em segundo plano: ${error.message}`;
  }

  return "Erro no GPS em segundo plano.";
};

// Componente de nível de módulo (não recriado a cada render de RunTracking,
// que re-renderiza a cada segundo/ponto de GPS).
const RecenterMap = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(coords);
  }, [coords, map]);
  return null;
};

const RunTracking = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Stats simulados
  // Stats Reais
  const [distance, setDistance] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [path, setPath] = useState<[number, number][]>([]);
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState("Pronto para iniciar");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isMusicOpen, setIsMusicOpen] = useState(false);
  const [recoverableRun, setRecoverableRun] = useState<ActiveRunSnapshot | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const wakeLockRef = useRef<ScreenWakeLockSentinel | null>(null);
  const simulatedPointRef = useRef(0);
  const isNativeAndroid = Capacitor.getPlatform() === "android";

  // Ao abrir a tela, verifica se existe uma corrida que não chegou a ser
  // salva (ex: app foi encerrado pelo Android no meio do treino).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACTIVE_RUN_STORAGE_KEY);
      if (!raw) return;
      const snapshot = JSON.parse(raw) as ActiveRunSnapshot;
      if (snapshot && Array.isArray(snapshot.path) && typeof snapshot.distance === "number" && snapshot.distance > 0.01) {
        setRecoverableRun(snapshot);
      } else {
        clearActiveRunSnapshot();
      }
    } catch (error) {
      console.warn("Nao foi possivel ler a corrida salva:", error);
      clearActiveRunSnapshot();
    }
  }, []);

  // Salva um retrato da corrida a cada mudança relevante enquanto ela está
  // ativa, para poder recuperar depois de um fechamento inesperado do app.
  useEffect(() => {
    if (!isRunning) return;
    try {
      const snapshot: ActiveRunSnapshot = { distance, seconds, path, isSimulating, savedAt: Date.now() };
      localStorage.setItem(ACTIVE_RUN_STORAGE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.warn("Nao foi possivel salvar o progresso da corrida:", error);
    }
  }, [isRunning, distance, seconds, path, isSimulating]);

  // Gerenciar Screen Wake Lock para PWA (Não deixar a tela do celular apagar/pausar o app)
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        const navigatorWithWakeLock = navigator as NavigatorWithWakeLock;
        if (navigatorWithWakeLock.wakeLock) {
          wakeLockRef.current = await navigatorWithWakeLock.wakeLock.request("screen");
        }
      } catch (err) {
        console.error(`Wake Lock error: ${err}`);
      }
    };

    const releaseWakeLock = () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().then(() => {
          wakeLockRef.current = null;
        });
      }
    };

    if (isRunning && !isPaused) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => releaseWakeLock();
  }, [isRunning, isPaused]);


  // Função para calcular distância entre dois pontos (Haversine)

  const applyGpsPoint = useCallback((
    latitude: number,
    longitude: number,
    accuracy: number,
    speed: number | null,
    source: "web" | "background",
  ) => {
    setGpsAccuracy(accuracy);

    if (accuracy > 50) {
      setTrackingStatus("Sinal GPS fraco");
      if (source === "web") {
        toast.warning("Sinal de GPS fraco. Aguardando uma posicao melhor.");
      }
      return;
    }

    if (speed && speed > 8.33) {
      console.warn("Velocidade incompatÃ­vel com corrida. Trecho ignorado.");
      setTrackingStatus("Trecho ignorado por velocidade alta");
      return;
    }

    const newPoint: [number, number] = [latitude, longitude];
    setCurrentPos(newPoint);
    setTrackingStatus(source === "background" ? "GPS em segundo plano ativo" : "GPS conectado");

    setPath(prevPath => {
      if (prevPath.length > 0) {
        const lastPoint = prevPath[prevPath.length - 1];
        const d = haversineKm(lastPoint[0], lastPoint[1], latitude, longitude);

        if (d > 0.005 && d < 0.5) {
          setDistance(prev => prev + d);
          return [...prevPath, newPoint];
        }
        return prevPath;
      }
      return [newPoint];
    });
  }, []);

  // Cronômetro real
  // Busca sinal antes do usuário iniciar a gravação. No Android nativo isso
  // fica a cargo do plugin de background-geolocation quando a corrida
  // começa; usar navigator.geolocation aqui também seria uma segunda fonte
  // de GPS rodando à toa (gasto de bateria) só para mostrar "GPS pronto".
  useEffect(() => {
    if (isRunning || isSimulating || isNativeAndroid) return undefined;

    if (!("geolocation" in navigator)) {
      setTrackingStatus("GPS indisponivel");
      return undefined;
    }

    if (!window.isSecureContext) {
      setTrackingStatus("GPS exige HTTPS");
      return undefined;
    }

    setTrackingStatus("Buscando sinal GPS");
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setGpsAccuracy(accuracy);
        setCurrentPos([latitude, longitude]);
        setTrackingStatus(accuracy <= 50 ? "GPS pronto" : "Sinal GPS fraco");
      },
      (error) => {
        console.error("GPS preflight error:", error);
        setTrackingStatus(getGpsErrorMessage(error));
      },
      { enableHighAccuracy: true, maximumAge: 1000 * 10, timeout: 12000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isRunning, isSimulating, isNativeAndroid]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, isPaused]);

  // Rastreamento GPS real
  useEffect(() => {
    let watchId: number | undefined;

    if (isNativeAndroid) return undefined;

    if (isRunning && !isPaused && !isSimulating && "geolocation" in navigator) {
      if (!window.isSecureContext) {
        setTrackingStatus("GPS exige HTTPS");
        toast.error("GPS real precisa de HTTPS no celular. Ative o simulador ou use um link HTTPS.", { duration: 8000 });
        return;
      }

      setTrackingStatus("Buscando sinal GPS");
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy, speed } = position.coords;
          console.log(`GPS Success: Lat ${latitude}, Lng ${longitude}, Acc ${accuracy}m`);

          if (accuracy > 50) {
            setTrackingStatus("Sinal GPS fraco");
            toast.warning("Sinal de GPS fraco. Aguardando uma posição melhor.");
            return;
          }

          // Anti-Cheat: Se a velocidade exceder 30km/h (8.33 m/s), o cara pode estar num carro/bike
          if (speed && speed > 8.33) {
            console.warn("Velocidade incompatível com corrida. Trecho ignorado.");
            setTrackingStatus("Trecho ignorado por velocidade alta");
            return;
          }
          
          const newPoint: [number, number] = [latitude, longitude];
          setCurrentPos(newPoint);
          setTrackingStatus("GPS conectado");

          setPath(prevPath => {
            if (prevPath.length > 0) {
              const lastPoint = prevPath[prevPath.length - 1];
              const d = haversineKm(lastPoint[0], lastPoint[1], latitude, longitude);
              
              // Filtro de Ruído Geográfico:
              // Limite superior de pulo: mais que 500m (0.5km) entre duas coletas é falha grossa do GPS
              if (d > 0.005 && d < 0.5) { 
                setDistance(prev => prev + d);
                return [...prevPath, newPoint];
              }
              return prevPath;
            }
            return [newPoint];
          });
        },
        (error) => {
          console.error("GPS Error:", error);
          setTrackingStatus("Erro no GPS");
          toast.error(getGpsErrorMessage(error), { duration: 8000 });
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
      );
    } else if (isRunning && !isPaused && !isSimulating && !("geolocation" in navigator)) {
      setTrackingStatus("GPS indisponivel");
      toast.error("GPS não disponível neste dispositivo.");
    }

    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, [isNativeAndroid, isRunning, isPaused, isSimulating]);

  // Rastreamento GPS nativo no Android. Mantem a corrida ativa com notificacao fixa.
  useEffect(() => {
    let watcherId: string | null = null;
    let cancelled = false;

    if (!isNativeAndroid || !isRunning || isPaused || isSimulating) {
      return undefined;
    }

    setTrackingStatus("Ativando GPS em segundo plano");

    BackgroundGeolocation.addWatcher(
      {
        backgroundTitle: "Runnex gravando corrida",
        backgroundMessage: "Sua corrida continua sendo registrada enquanto o app esta em segundo plano.",
        requestPermissions: true,
        stale: false,
        distanceFilter: 5,
      },
      (location?: BackgroundLocation, error?: CallbackError) => {
        if (error) {
          console.error("Background GPS Error:", error);
          setTrackingStatus("Erro no GPS em segundo plano");
          toast.error(getBackgroundGpsErrorMessage(error), { duration: 8000 });
          return;
        }

        if (!location) return;

        applyGpsPoint(
          location.latitude,
          location.longitude,
          location.accuracy,
          location.speed,
          "background",
        );
      },
    ).then((id) => {
      if (cancelled) {
        BackgroundGeolocation.removeWatcher({ id }).catch((error) => {
          console.warn("Nao foi possivel remover watcher nativo:", error);
        });
        return;
      }

      watcherId = id;
    }).catch((error: CallbackError) => {
      console.error("Erro ao iniciar GPS em segundo plano:", error);
      setTrackingStatus("Erro no GPS em segundo plano");
      toast.error(getBackgroundGpsErrorMessage(error), { duration: 8000 });
    });

    return () => {
      cancelled = true;
      if (watcherId) {
        BackgroundGeolocation.removeWatcher({ id: watcherId }).catch((error) => {
          console.warn("Nao foi possivel remover watcher nativo:", error);
        });
      }
    };
  }, [applyGpsPoint, isNativeAndroid, isRunning, isPaused, isSimulating]);

  // Formatar Ritmo (Pace) - Minutos por km
  const getPace = () => {
    if (distance === 0) return "0'00\"";
    const paceDecimal = (seconds / 60) / distance;
    const mins = Math.floor(paceDecimal);
    const secs = Math.round((paceDecimal - mins) * 60);
    return `${mins}'${secs.toString().padStart(2, '0')}"`;
  };

  // Simulação de movimento para testes
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isSimulating && isRunning && !isPaused) {
      setTrackingStatus("Simulando corrida");
      
      interval = setInterval(() => {
        setPath(prev => {
          if (prev.length === 0) {
            simulatedPointRef.current = 1;
            setCurrentPos(SIMULATED_ROUTE[0]);
            return [SIMULATED_ROUTE[0]];
          }

          // Anda SIMULATED_STEP_KM por tick em direcao ao proximo vertice do
          // circuito. Antes pulava um vertice inteiro (~30 m) a cada 1,4 s,
          // ~75 km/h - acima do limite de velocidade que o backend aplica.
          const last = prev[prev.length - 1];
          const target = SIMULATED_ROUTE[simulatedPointRef.current % SIMULATED_ROUTE.length];
          const remaining = haversineKm(last[0], last[1], target[0], target[1]);

          let next = target;
          if (remaining > SIMULATED_STEP_KM) {
            const ratio = SIMULATED_STEP_KM / remaining;
            next = [last[0] + (target[0] - last[0]) * ratio, last[1] + (target[1] - last[1]) * ratio];
          } else {
            simulatedPointRef.current += 1;
          }

          const d = haversineKm(last[0], last[1], next[0], next[1]);
          setDistance(old => old + d);
          setCurrentPos(next);
          return [...prev, next];
        });
      }, SIMULATED_TICK_MS);
    }
    return () => clearInterval(interval);
  }, [isSimulating, isRunning, isPaused]);

  // Calorias estimadas (Média de 60kcal por km)
  const getCalories = () => (distance * 60).toFixed(0);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    const startPoint = !isSimulating ? currentPos : null;
    setDistance(0);
    setSeconds(0);
    setPath(startPoint ? [startPoint] : []);
    setCurrentPos(startPoint);
    simulatedPointRef.current = 0;
    setTrackingStatus(isSimulating ? "Preparando simulacao" : startPoint ? "GPS pronto" : "Buscando sinal GPS");
    setIsPaused(false);
    setIsRunning(true);
  };

  const handleResumeRun = () => {
    if (!recoverableRun) return;
    setDistance(recoverableRun.distance);
    setSeconds(recoverableRun.seconds);
    setPath(recoverableRun.path);
    setCurrentPos(recoverableRun.path[recoverableRun.path.length - 1] ?? null);
    setIsSimulating(recoverableRun.isSimulating);
    simulatedPointRef.current = recoverableRun.path.length;
    setIsPaused(false);
    setIsRunning(true);
    setRecoverableRun(null);
    toast.success("Corrida retomada. O cronometro continua a partir de onde parou.");
  };

  const handleDiscardRun = () => {
    clearActiveRunSnapshot();
    setRecoverableRun(null);
    toast.info("Corrida descartada.");
  };

  const handleBack = () => {
    if (isRunning && !confirmExit) {
      setConfirmExit(true);
      toast.warning("Toque novamente para sair. Sua corrida fica salva e voce pode continuar depois.");
      return;
    }
    navigate("/");
  };

  // Corrida sem distancia real (iniciou sem querer e parou logo em seguida)
  // nao deve tentar salvar: o backend rejeita distance<=0 e isso aparecia
  // para quem so queria cancelar como se fosse um erro de verdade.
  const MIN_DISTANCE_TO_SAVE_KM = 0.01;

  const handleFinish = async () => {
    if (!user) return;

    if (distance < MIN_DISTANCE_TO_SAVE_KM) {
      clearActiveRunSnapshot();
      toast.info("Corrida cancelada — nenhuma distancia percorrida.");
      navigate("/");
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveActivity({
        userId: user.uid,
        userName: user.displayName || "Corredor",
        userAvatar: getBestUserPhotoURL(user),
        distance: Number(distance.toFixed(2)),
        time: formatTime(seconds),
        durationSeconds: seconds,
        pace: getPace(),
        calories: Number(getCalories()),
        route: decimateRoute(path).map(([lat, lng]) => ({ lat, lng })),
        type: "RUNNING"
      });

      clearActiveRunSnapshot();
      if (result.xpUpdateFailed) {
        toast.warning("Corrida salva, mas nao foi possivel atualizar seu XP agora. Tente novamente mais tarde.", { duration: 8000 });
      } else {
        toast.success("Corrida salva com sucesso!");
      }
      navigate("/");
    } catch (error) {
      console.error("Erro ao finalizar corrida:", error);
      toast.error(getSaveErrorMessage(error), { duration: 8000 });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col safe-top">
      {/* Premium Header */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
        className="px-6 py-4 flex items-center justify-between sticky top-0 bg-background/90 backdrop-blur-2xl z-40 border-b border-border/60 shadow-[0_16px_34px_rgba(0,0,0,0.28)]"
      >
        <button onClick={handleBack} className="w-10 h-10 rounded-full bg-card/80 backdrop-blur-xl border border-border flex items-center justify-center text-muted-foreground active:scale-95 transition-transform" aria-label="Voltar">
          <ArrowLeft size={20} />
        </button>
        <motion.h1
          key={`${isRunning}-${isPaused}-${isSimulating}`}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="font-display font-black text-xl tracking-tighter text-purple-500 uppercase drop-shadow-[0_0_18px_rgba(168,85,247,0.35)]"
        >
          {isRunning ? (isPaused ? "PAUSADO" : isSimulating ? "SIMULANDO..." : "MONITORANDO") : "INICIAR TREINO"}
        </motion.h1>
        {import.meta.env.DEV ? (
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`text-[10px] font-black px-3 py-2 rounded-xl border transition-colors ${isSimulating ? 'bg-purple-600 border-purple-400 text-white' : 'bg-card/80 backdrop-blur-xl border-border text-muted-foreground'}`}
          >
            {isSimulating ? "OFF" : "SIMULAR"}
          </button>
        ) : (
          <div className="w-10 h-10" aria-hidden="true" />
        )}
      </motion.header>

      {/* Map Content Section */}
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1], delay: 0.08 }}
        className={cn(GLASS_CARD_CLASS, "flex-1 relative mx-6 mt-6 overflow-hidden shadow-inner group")}
        style={{ minHeight: '350px' }}
      >
        <MapContainer 
          center={[-23.5505, -46.6333]} // Padrão SP
          zoom={16} 
          style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer {...darkMapTiles} />
          {path.length > 0 && (
            <Polyline 
              positions={path} 
              color="#9333ea" 
              weight={6}
              opacity={0.8}
            />
          )}
          {currentPos && (
             <>
               <Circle center={currentPos} radius={10} pathOptions={{ color: '#9333ea', fillColor: '#9333ea', fillOpacity: 0.8 }} />
               <RecenterMap coords={currentPos} />
             </>
          )}
          
          {/* Fallback Overlay se não houver GPS ou ainda não carregou a primeira posição */}
          {!currentPos && !isSimulating && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/60 backdrop-blur-md z-[1000] pointer-events-none">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20 mb-4 animate-float animate-soft-glow">
                    <Navigation size={32} className="text-purple-500" />
                </div>
                <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                  {isRunning ? "BUSCANDO SINAL GPS..." : "AGUARDANDO SINAL GPS..."}
                </p>
              </div>
            </div>
          )}
        </MapContainer>

        <div className="absolute bottom-5 left-6 right-6 z-[1002] flex items-center justify-between rounded-2xl bg-card/80 backdrop-blur-xl border border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${isPaused ? "bg-yellow-400" : currentPos ? "bg-green-400 animate-status-pulse" : isRunning ? "bg-purple-400 animate-status-pulse" : "bg-zinc-600"}`} />
            <span className="text-[9px] font-black uppercase tracking-widest text-foreground/80">
              {isPaused ? "Pausado" : trackingStatus}
            </span>
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">
            {gpsAccuracy ? `${gpsAccuracy.toFixed(0)}m` : `${path.length} pontos`}
          </span>
        </div>

        {/* Floating Mini Stats Group */}
        <AnimatePresence>
          {isRunning && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-6 left-6 right-6 grid grid-cols-2 gap-3 z-[1002]"
            >
                <div className={cn(GLASS_CARD_CLASS, "p-4 flex items-center gap-3")}>
                    <div className="w-10 h-10 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                        <MapIcon size={18} />
                    </div>
                    <div>
                        <p className="text-[8px] font-black text-muted-foreground uppercase leading-none mb-1">Pace</p>
                        <p className="text-sm font-black font-display leading-none">{getPace()}</p>
                    </div>
                </div>
                <div className={cn(GLASS_CARD_CLASS, "p-4 flex items-center gap-3")}>
                    <div className="w-10 h-10 rounded-2xl bg-orange-500/20 flex items-center justify-center text-orange-400">
                        <Zap size={18} />
                    </div>
                    <div>
                        <p className="text-[8px] font-black text-muted-foreground uppercase leading-none mb-1">Calorias</p>
                        <p className="text-sm font-black font-display leading-none">{getCalories()} kcal</p>
                    </div>
                </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Primary Running Stats Card */}
      <section className="px-6 py-8">
        <motion.div 
            layout
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.14 }}
            className={cn(GLASS_CARD_CLASS, "p-8")}
        >
          <div className="text-center mb-10">
            <motion.p
              key={isRunning ? "running" : "idle"}
              initial={{ scale: 0.8 }}
              animate={{ scale: [0.96, 1.03, 1] }}
              transition={{ duration: 0.32 }}
              className="text-7xl font-display font-black text-purple-500 tracking-tighter drop-shadow-[0_0_24px_rgba(168,85,247,0.35)]"
            >
              {distance.toFixed(2)}
            </motion.p>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mt-2">DISTÂNCIA TOTAL (KM)</p>
          </div>

          <div className="grid grid-cols-3 divide-x divide-border">
            <div className="text-center">
              <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Tempo</p>
              <p className="font-display font-black text-lg">{formatTime(seconds)}</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Ritmo</p>
              <p className="font-display font-black text-lg">{getPace()}</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Velocidade</p>
              <p className="font-display font-black text-lg">{(distance > 0 ? (distance / (seconds / 3600)) : 0).toFixed(1)}</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Control Actions Section */}
      <footer className="px-6 pb-12 safe-bottom">
        <div className="flex items-center justify-center gap-8">
          {!isRunning ? (
            <>
              <motion.button
                initial={{ opacity: 0, scale: 0.82, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsMusicOpen(true)}
                className="w-16 h-16 rounded-2xl bg-card/80 backdrop-blur-xl border border-border flex items-center justify-center text-purple-500 active:scale-95 transition-transform"
                aria-label="Abrir musica"
              >
                <Music size={24} />
              </motion.button>
              <motion.button
                initial={{ opacity: 0, scale: 0.82, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleStart}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-[0_14px_44px_rgba(147,51,234,0.48)] border-4 border-background group animate-soft-glow"
                aria-label="Iniciar corrida"
              >
                <Play size={40} className="text-white fill-current ml-2 group-hover:scale-110 transition-transform" />
              </motion.button>
              <div className="w-16 h-16" aria-hidden="true" />
            </>
          ) : (
            <>
              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 360, damping: 22 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleFinish}
                disabled={isSaving}
                className="w-16 h-16 rounded-2xl bg-card/80 backdrop-blur-xl border border-border flex items-center justify-center text-red-500 disabled:opacity-50 active:scale-95 transition-transform"
                aria-label="Finalizar corrida"
              >
                {isSaving ? <Loader2 className="animate-spin" /> : <Square size={24} className="fill-current" />}
              </motion.button>
              
              <motion.button
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 360, damping: 22, delay: 0.06 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsPaused(!isPaused)}
                className="w-24 h-24 rounded-full bg-zinc-100 flex items-center justify-center shadow-[0_16px_42px_rgba(255,255,255,0.16)] border-4 border-background group active:scale-95 transition-transform"
                aria-label={isPaused ? "Retomar corrida" : "Pausar corrida"}
              >
                {isPaused ? (
                  <Play size={40} className="text-black fill-current ml-2" />
                ) : (
                  <Pause size={40} className="text-black fill-current" />
                )}
              </motion.button>

              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 360, damping: 22, delay: 0.12 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsMusicOpen(true)}
                className="w-16 h-16 rounded-2xl bg-card/80 backdrop-blur-xl border border-border flex items-center justify-center text-purple-500 active:scale-95 transition-transform"
              >
                <Music size={24} />
              </motion.button>
            </>
          )}
        </div>
      </footer>

      <AnimatePresence>
        {recoverableRun && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1200] bg-background/75 backdrop-blur-md"
            />
            <div className="fixed inset-0 z-[1210] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, y: 28, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 28, scale: 0.96 }}
                className={cn(GLASS_CARD_CLASS, "pointer-events-auto w-full max-w-md p-6")}
              >
                <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">Veloxy</p>
                <h2 className="mt-1 font-display text-xl font-black text-purple-500 uppercase">Corrida nao finalizada</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Encontramos {recoverableRun.distance.toFixed(2)} km de uma corrida que nao chegou a ser salva. Quer continuar de onde parou ou descartar?
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={handleDiscardRun}
                    className="flex-1 rounded-xl border border-input bg-secondary py-3 text-xs font-black uppercase tracking-widest text-foreground/80"
                  >
                    Descartar
                  </button>
                  <button
                    onClick={handleResumeRun}
                    className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-700 transition py-3 text-xs font-black uppercase tracking-widest text-white"
                  >
                    Continuar
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMusicOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1200] bg-background/75 backdrop-blur-md"
              onClick={() => setIsMusicOpen(false)}
            />
            <div className="fixed inset-0 z-[1210] flex items-end justify-center p-4 pointer-events-none sm:items-center">
              <motion.div
                initial={{ opacity: 0, y: 28, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 28, scale: 0.96 }}
                className={cn(GLASS_CARD_CLASS, "pointer-events-auto w-full max-w-md p-5")}
              >
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">Treino</p>
                    <h2 className="font-display text-2xl font-black text-purple-500">Musica</h2>
                  </div>
                  <button
                    onClick={() => setIsMusicOpen(false)}
                    className="bg-card/80 backdrop-blur-xl border border-border flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground"
                    aria-label="Fechar musica"
                  >
                    <X size={18} />
                  </button>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                  Abra sua playlist antes ou durante a corrida. O Veloxy continua acompanhando o treino quando você voltar para o app.
                </p>
                <div className="grid gap-3">
                  {[
                    { label: "Spotify", url: "https://open.spotify.com/search/running%20playlist" },
                    { label: "YouTube Music", url: "https://music.youtube.com/search?q=running+playlist" },
                    { label: "Deezer", url: "https://www.deezer.com/search/running%20playlist" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
                      className="bg-card/80 backdrop-blur-xl border border-border flex items-center justify-between rounded-2xl px-4 py-4 text-left text-sm font-black"
                    >
                      {item.label}
                      <ExternalLink size={16} className="text-purple-500" />
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RunTracking;
