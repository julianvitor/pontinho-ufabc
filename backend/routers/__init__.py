"""
Módulos de rotas do Pontinho
"""
from backend.routers.auth import router as auth_router
from backend.routers.feed import router as feed_router
from backend.routers.matches import router as matches_router
from backend.routers.users import router as users_router
from backend.routers.admin import router as admin_router

__all__ = ["auth_router", "feed_router", "matches_router", "users_router", "admin_router"]
