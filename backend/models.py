"""
Modelos de validação de dados Pydantic do Pontinho
"""
from typing import List, Optional
from pydantic import BaseModel, Field

class RegisterRequest(BaseModel):
    email: str = Field(..., description="E-mail de acesso")
    name: str = Field(..., min_length=2, description="Nome completo")
    password: str = Field(..., min_length=4, description="Senha de acesso")
    ra: Optional[str] = Field(default="", description="RA (Registro Acadêmico) opcional")
    terms_accepted: bool = Field(default=True, description="Concordância com os Termos de Uso e Política de Privacidade (LGPD)")

class LoginRequest(BaseModel):
    email: str = Field(..., description="E-mail de acesso")
    password: str = Field(..., description="Senha do usuário")

class SwipeRequest(BaseModel):
    target_user_id: int
    action: str  # 'like' ou 'pass'

class MessageCreate(BaseModel):
    text: str

class ReportCreate(BaseModel):
    reason: str = Field(..., description="Motivo da denúncia")
    details: Optional[str] = Field(default="", description="Detalhes adicionais ou contexto")
    block_user: Optional[bool] = Field(default=True, description="Se também deve bloquear o usuário denunciado")

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
    private_photos: List[str] = Field(default_factory=list, description="Fotos privadas (visíveis após match + autorização)")
    private_bio: Optional[str] = Field(default="", description="Bio secreta/picante para matches autorizados")

class PrivateAccessAction(BaseModel):
    action: str  # 'approve' ou 'reject'

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

class EventCreateOrUpdate(BaseModel):
    title: str = Field(..., min_length=2, max_length=25, description="Nome da festa ou evento (máximo 25 caracteres)")
    description: Optional[str] = Field(default="", description="Descrição completa da festa")
    event_date: str = Field(..., description="Data e horário do evento (ex: 2026-11-14 22:00)")
    location: str = Field(..., min_length=2, description="Local ou Campus do evento")
    image_url: Optional[str] = Field(default="", description="Link ou caminho da imagem ou GIF animado do evento")
    ticket_url: Optional[str] = Field(default="", description="Link externo para compra de ingresso ou lote")

class EventRsvpRequest(BaseModel):
    status: Optional[str] = Field(default="going", description="Status de presença: 'going' ou 'not_going'")

class ComplaintCreate(BaseModel):
    reporter_name: Optional[str] = Field(default="", description="Nome do denunciante (opcional)")
    reporter_contact: str = Field(..., min_length=3, description="E-mail ou WhatsApp para contato e retorno da moderação")
    complaint_type: str = Field(..., description="Tipo da ocorrência: fake_profile, harassment, stalking, image_misuse, defamation, other")
    target_description: str = Field(..., min_length=2, description="Nome, RA, link ou descrição do perfil acusado")
    details: str = Field(..., min_length=5, description="Descrição detalhada do ocorrido")

