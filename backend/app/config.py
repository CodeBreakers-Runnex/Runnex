from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    firebase_project_id: str
    # Compra simulada de RunCoins (sem loja, sem cobranca). So para testar a
    # tela antes da integracao com o Google Play. NUNCA ligar em producao:
    # qualquer usuario ganharia moedas de graca.
    coin_mock_purchases: bool = False
    # /docs e /openapi.json entregam o mapa da API a qualquer um. Fechados por
    # padrao (producao); para usar em desenvolvimento: API_DOCS=true no .env.
    api_docs: bool = False

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
