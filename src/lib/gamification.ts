/**
 * Lógica de Gamificação do Veloxy
 */

export interface LevelInfo {
  name: string;
  minXP: number;
}

export const LEVELS: LevelInfo[] = [
  { name: "Iniciante", minXP: 0 },
  { name: "Corredor", minXP: 1000 },
  { name: "Avançado", minXP: 5000 },
  { name: "Elite", minXP: 15000 },
  { name: "Lenda", minXP: 50000 },
];

/**
 * Calcula o XP ganho em uma atividade
 * @param distance Distância em KM
 * @param pace Pace formatado (ex: "5'30\"") ou segundos por KM
 */
export const calculateXP = (distance: number, durationSeconds: number): number => {
  // Base: 100 XP por KM
  let xp = Math.round(distance * 100);

  // Bônus por Pace (se for uma corrida rápida)
  if (distance > 0) {
    const paceSecondsPerKm = durationSeconds / distance;
    if (paceSecondsPerKm < 300) { // Menos de 5'00"/km
       xp = Math.round(xp * 1.2); // +20% de bônus
    }
  }

  return xp;
};

/**
 * Retorna o nível atual baseado no XP total
 */
export const getLevelFromXP = (totalXP: number) => {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVELS[i].minXP) {
      const current = LEVELS[i];
      const next = LEVELS[i + 1] || null;
      
      return {
        currentLevel: current.name,
        progress: next 
          ? ((totalXP - current.minXP) / (next.minXP - current.minXP)) * 100 
          : 100,
        nextLevel: next ? next.name : "Nível Máximo",
        xpToNext: next ? next.minXP - totalXP : 0,
        currentXP: totalXP
      };
    }
  }
  return { currentLevel: LEVELS[0].name, progress: 0, nextLevel: LEVELS[1].name, xpToNext: 1000, currentXP: totalXP };
};
