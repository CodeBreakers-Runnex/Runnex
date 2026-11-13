// Funcionalidades fora desta versão: o código continua no projeto, mas telas,
// menus e botões ficam escondidos. Para religar uma delas, troque para true
// (e, no caso das de saúde, devolva as permissões em AndroidManifest.xml).
export const features = {
  // Tela de sono e recuperação (/sono), incluindo a importação do Health Connect.
  sleep: false,
  // Importação de corridas do relógio pelo Health Connect (/dispositivos).
  healthConnectRuns: false,
  // Sensor cardíaco Bluetooth na corrida e zonas cardíacas nas estatísticas.
  heartRateSensor: false,
  // Atalhos para Spotify, YouTube Music e Deezer na tela de corrida.
  music: false,
} as const;
