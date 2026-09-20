from app.modules.auth.models import UserRole

# Opções do "Estado do Conselho Emissor" (as do design aprovado).
# A clínica precisa completar a lista com os demais conselhos regionais.
CRN_STATE_OPTIONS = [
    "São Paulo (CRN-3)",
    "Rio de Janeiro (CRN-4)",
    "Minas Gerais (CRN-9)",
    "Rio Grande do Sul (CRN-2)",
    "Paraná (CRN-8)",
]

# Papéis que possuem registro profissional, apresentação e resumo clínico.
PROFESSIONAL_ROLES = {UserRole.nutritionist, UserRole.admin}

MAX_BIO_LENGTH = 350
MAX_AVATAR_BYTES = 2 * 1024 * 1024
