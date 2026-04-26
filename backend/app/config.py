from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    app_name: str = 'poetry-ai-api'
    app_env: str = Field(default='development', alias='APP_ENV')
    app_debug: bool = Field(default=False, alias='APP_DEBUG')
    log_level: str = Field(default='INFO', alias='LOG_LEVEL')
    slow_request_threshold_ms: int = Field(default=1200, alias='SLOW_REQUEST_THRESHOLD_MS')
    request_log_exclude_paths: str = Field(default='/api/health', alias='REQUEST_LOG_EXCLUDE_PATHS')

    supabase_url: str = Field(default='', alias='SUPABASE_URL')
    supabase_anon_key: str = Field(default='', alias='SUPABASE_ANON_KEY')
    supabase_service_role_key: str = Field(default='', alias='SUPABASE_SERVICE_ROLE_KEY')
    auth_request_timeout_seconds: int = Field(default=10, alias='AUTH_REQUEST_TIMEOUT_SECONDS')
    auth_user_cache_ttl_seconds: int = Field(default=30, alias='AUTH_USER_CACHE_TTL_SECONDS')
    redis_url: str = Field(default='', alias='REDIS_URL')
    redis_cache_ttl_seconds: int = Field(default=120, alias='REDIS_CACHE_TTL_SECONDS')

    doubao_api_key: str = Field(default='', alias='DOUBAO_API_KEY')
    doubao_model_id: str = Field(default='', alias='DOUBAO_MODEL_ID')
    doubao_base_url: str = Field(default='https://ark.cn-beijing.volces.com/api/v3', alias='DOUBAO_BASE_URL')
    ai_retry_attempts: int = Field(default=2, alias='AI_RETRY_ATTEMPTS')
    ai_retry_backoff_seconds: float = Field(default=0.8, alias='AI_RETRY_BACKOFF_SECONDS')
    practice_ai_timeout_seconds: int = Field(default=18, alias='PRACTICE_AI_TIMEOUT_SECONDS')
    practice_ai_max_attempts: int = Field(default=1, alias='PRACTICE_AI_MAX_ATTEMPTS')
    practice_ai_cache_ttl_seconds: int = Field(default=300, alias='PRACTICE_AI_CACHE_TTL_SECONDS')

    request_timeout_seconds: int = Field(default=60, alias='REQUEST_TIMEOUT_SECONDS')


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
