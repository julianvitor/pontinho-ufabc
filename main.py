"""
Ponto de entrada raiz (shim de compatibilidade para backend.main)
"""
from backend.main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
