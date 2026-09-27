import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .database import Base, engine
from .routers import appointments, auth, dashboard, doctors, patients, payments, users

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Sowaka Care CRM", version="0.1.0")

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth, users, doctors, patients, appointments, payments, dashboard):
    app.include_router(r.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Single-server deployment: serve the built React app if present (frontend/dist).
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        file = DIST / full_path
        if full_path and file.is_file() and DIST in file.resolve().parents:
            return FileResponse(file)
        return FileResponse(DIST / "index.html")
