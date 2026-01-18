"""
Yukyu Pro Backend - Main Entry Point
A FastAPI application for managing employee paid leave (Yukyu) compliance in Japan.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from src.config import init_db
from src.routes import employees_router, records_router, ai_router

# --- App Init ---
app = FastAPI(
    title="Yukyu Pro Backend",
    description="Employee paid leave management API",
    version="1.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(employees_router)
app.include_router(records_router)
app.include_router(ai_router)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    init_db()


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "backend": "FastAPI"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
