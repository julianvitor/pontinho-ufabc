"""
Modelos de validação de dados Pydantic do Pontinho UFABC
"""
from typing import List, Optional
from pydantic import BaseModel, Field

class RegisterRequest(BaseModel):
    email: str = Field(..., description="E-mail acadêmico da UFABC (@aluno.ufabc.edu.br)")
    name: str = Field(..., min_length=2, description="Nome completo")
    password: str = Field(..., min_length=4, description="Senha de acesso")
    ra: Optional[str] = Field(default="", description="RA (Registro Acadêmico) opcional")

class LoginRequest(BaseModel):
    email: str = Field(..., description="E-mail acadêmico da UFABC (ex: aluno@aluno.ufabc.edu.br)")
    password: str = Field(..., description="Senha do estudante")

class SwipeRequest(BaseModel):
    target_user_id: int
    action: str  # 'like' ou 'pass'

class MessageCreate(BaseModel):
    text: str

class UserCreateOrUpdate(BaseModel):
    email: Optional[str] = ""
    name: str
    age: int = 20
    campus: str  # 'Santo André' ou 'São Bernardo do Campo'
    course: str
    specific_course: str
    entity: str
    looking_for: str  # 'Algo sério', 'Algo casual', 'Amizade'
    bio: Optional[str] = ""
    interests: List[str] = Field(default_factory=list)
    photos: List[str] = Field(..., min_length=2, description="Pelo menos duas fotos obrigatórias")
    prompt1_q: Optional[str] = ""
    prompt1_a: Optional[str] = ""
    prompt2_q: Optional[str] = ""
    prompt2_a: Optional[str] = ""
    prompt3_q: Optional[str] = ""
    prompt3_a: Optional[str] = ""
    gender: Optional[str] = "Não informado"  # 'Mulher', 'Homem', 'Não-binário', 'Outro'
    target_gender: Optional[str] = "Todos"   # 'Mulheres', 'Homens', 'Não-binário', 'Todos'
    songs: List[str] = Field(default_factory=list, description="Lista de músicas / trilha sonora do perfil")

class CourseCreate(BaseModel):
    name: str
    category: str  # 'base' ou 'especifico'

class EntityCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class PromptCreate(BaseModel):
    question: str

class AdCreateOrUpdate(BaseModel):
    title: str
    description: Optional[str] = ""
    image_url: str
    button_text: Optional[str] = "Conferir"
    link_url: str
    is_active: Optional[int] = 1
    frequency: Optional[int] = 4
