"""
Yukyu Pro Backend - Main Entry Point
A FastAPI application for managing employee paid leave (Yukyu) compliance in Japan.
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from src.config import init_db
from src.routes import employees_router, records_router, ai_router

# --- Environment Variables ---
PORT = int(os.getenv("PORT", "8000"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")

# Parse CORS origins from comma-separated string
cors_origins_list = [origin.strip() for origin in CORS_ORIGINS.split(",") if origin.strip()]

# --- App Init ---
app = FastAPI(
    title="Yukyu Pro Backend",
    description="Employee paid leave management API",
    version="1.0.0"
)

# CORS Middleware - uses origins from env or defaults
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins_list,
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
    print(f"Starting Yukyu Pro Backend on port {PORT}")
    print(f"CORS Origins: {cors_origins_list}")
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
