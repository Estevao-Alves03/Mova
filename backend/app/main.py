from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.modules.auth.router import router as auth_router
from app.modules.notifications.router import router as notifications_router
from app.modules.patients.router import router as patients_router
from app.modules.schedule.router import router as schedule_router
from app.modules.settings.notification_router import patient_router, staff_router
from app.modules.settings.router import router as settings_router
from app.modules.settings.team_router import router as team_router
from app.modules.settings.unit_router import router as unit_router

settings = get_settings()

app = FastAPI(title="Mova API", docs_url="/docs", redoc_url=None)

# Autenticação por Bearer token (sem cookies): credenciais não são enviadas pelo navegador.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(settings_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(schedule_router, prefix="/api/v1")
app.include_router(staff_router, prefix="/api/v1")
app.include_router(patient_router, prefix="/api/v1")
app.include_router(team_router, prefix="/api/v1")
app.include_router(unit_router, prefix="/api/v1")
app.include_router(patients_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
