"""
Routes package for Yukyu Pro Backend
"""
from .employees import router as employees_router
from .records import router as records_router
from .ai import router as ai_router

__all__ = ["employees_router", "records_router", "ai_router"]
