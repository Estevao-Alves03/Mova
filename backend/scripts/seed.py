"""Seed idempotente com dados FICTÍCIOS (nunca dados reais de pacientes).

Uso (a partir de backend/, com o Supabase local rodando):
    .venv/bin/python -m scripts.seed

Cria usuários pela API admin do Supabase Auth e depois os registros nas tabelas.
A senha de todos os usuários vem de SEED_PASSWORD (.env), nunca é commitada.
Registros existentes não são sobrescritos.
"""

import sys
import uuid
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import get_engine

NAMESPACE = uuid.UUID("6f1b6f0e-7d0c-4c1a-9a3e-0c6d3a5b9e11")
TZ = ZoneInfo("America/Sao_Paulo")


def uid(name: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, name)


CLINIC_ID = uid("clinic:jardins")
UNIT_ID = uid("unit:jardins")
ROOMS = {
    "Consultório 01": uid("room:1"),
    "Consultório 02": uid("room:2"),
    "Sala de Antropometria": uid("room:antropometria"),
}

STAFF = [
    dict(key="admin", email="ana.rocha@mova.nutri.br", role="admin", name="Ana Beatriz Rocha",
         phone="(11) 99811-2040", member_since="2021-08-10"),
    dict(key="reception", email="atendimento.sp@mova.nutri.br", role="receptionist", name="Mariana Fagundes",
         phone="(11) 3255-9012", member_since="2022-05-16"),
    dict(key="henrique", email="henrique.silva@mova.nutri.br", role="nutritionist", name="Dr. Henrique Silva",
         phone="(11) 98452-9104", crn="CRN-3 48291", crn_state="São Paulo (CRN-3)",
         specialty="Nutrição Clínica Avançada & Performance Esportiva",
         bio=("Nutricionista Clínico e Esportivo (CRN-3 48291). Mestre em Fisiologia do Exercício pela USP. "
              "Especialista em modulação metabólica, hipertrofia muscular e reeducação alimentar preventiva."),
         member_since="2022-02-01"),
    dict(key="camila", email="camila.meireles@mova.nutri.br", role="nutritionist", name="Dra. Camila Meireles",
         phone="(11) 97321-4408", crn="CRN-3 51042", crn_state="São Paulo (CRN-3)",
         specialty="Nutrição Comportamental",
         bio="Nutricionista comportamental com foco em reeducação alimentar e saúde da mulher.",
         member_since="2023-03-20"),
]
PATIENT_USER = dict(key="patient", email="camila.vasconcellos@email.com", role="patient",
                    name="Camila Vasconcellos", member_since="2024-10-22")

# Agenda de cada nutricionista: passo de início, almoço, duração por tipo de atendimento e uma faixa por
# dia da semana (0 = domingo). O "Henrique" segue o exemplo do produto: qua sem atendimento.
SCHEDULES = {
    "henrique": dict(
        step=30, lunch=("12:00", "14:00"),
        durations={"first_consultation": 90, "return_consultation": 60, "assessment": 60},
        days={1: ("08:00", "18:00"), 2: ("08:00", "12:00"), 4: ("14:00", "18:00"), 5: ("08:00", "17:00")},
    ),
    "camila": dict(
        step=30, lunch=("12:00", "13:00"),
        durations={"first_consultation": 60, "return_consultation": 45, "assessment": 45},
        days={weekday: ("09:00", "17:00") for weekday in range(1, 6)},
    ),
}

# (nome, sexo, nascimento, nutricionista, dias desde o cadastro | "mes")
PATIENTS = [
    ("Mariana Siqueira", "female", "1996-05-14", "henrique", 200),
    ("Tiago Mendes", "male", "1990-03-02", "henrique", 180),
    ("Beatriz Costa", "female", "2000-07-21", "henrique", 150),
    ("Lucas Arantes", "male", "1993-01-15", "henrique", 120),
    ("Diego Faria", "male", "1986-11-09", "henrique", 90),
    ("Carlos Eduardo Rocha", "male", "1997-09-30", "henrique", "mes"),
    ("Vanessa Toledo", "female", "1983-04-04", "camila", 210),
    ("Gabriela Vasconcelos", "female", "1995-12-01", "camila", 60),
    ("Rodrigo Mendes", "male", "1988-06-17", "camila", "mes"),
    ("Camila Vasconcellos", "female", "1994-08-18", "camila", 20),
]


def admin_headers(settings) -> dict[str, str]:
    key = settings.supabase_service_role_key
    return {"Authorization": f"Bearer {key}", "apikey": key, "Content-Type": "application/json"}


def get_or_create_auth_user(client: httpx.Client, settings, email: str, password: str) -> uuid.UUID:
    base = f"{settings.supabase_url}/auth/v1/admin/users"
    response = client.post(
        base, headers=admin_headers(settings),
        json={"email": email, "password": password, "email_confirm": True},
    )
    if response.status_code in (200, 201):
        return uuid.UUID(response.json()["id"])
    # Já existe: localiza pelo e-mail (sem alterar a senha).
    page = 1
    while True:
        listing = client.get(base, headers=admin_headers(settings), params={"page": page, "per_page": 200})
        listing.raise_for_status()
        users = listing.json()["users"]
        for user in users:
            if user["email"] == email:
                return uuid.UUID(user["id"])
        if len(users) < 200:
            break
        page += 1
    response.raise_for_status()
    raise RuntimeError(f"Não foi possível criar/localizar {email}")


def main() -> int:
    settings = get_settings()
    if not settings.seed_password or len(settings.seed_password) < 8:
        print("Defina SEED_PASSWORD (mínimo 8 caracteres) em backend/.env", file=sys.stderr)
        return 1
    if not settings.supabase_service_role_key:
        print("Defina SUPABASE_SERVICE_ROLE_KEY em backend/.env", file=sys.stderr)
        return 1

    now = datetime.now(TZ)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    with httpx.Client(timeout=15) as client, get_engine().begin() as conn:
        auth_ids = {
            person["key"]: get_or_create_auth_user(client, settings, person["email"], settings.seed_password)
            for person in [*STAFF, PATIENT_USER]
        }

        conn.execute(text("insert into clinics (id, name) values (:id, :name) on conflict (id) do nothing"),
                     {"id": CLINIC_ID, "name": "Clínica Jardins"})
        conn.execute(
            text("insert into units (id, clinic_id, name, address) values (:id, :c, :n, :a) on conflict (id) do nothing"),
            {"id": UNIT_ID, "c": CLINIC_ID, "n": "Unidade Jardins", "a": "Alameda Santos, 1470 - São Paulo"},
        )
        for name, room_id in ROOMS.items():
            conn.execute(
                text("insert into rooms (id, clinic_id, unit_id, name) values (:id, :c, :u, :n) on conflict (id) do nothing"),
                {"id": room_id, "c": CLINIC_ID, "u": UNIT_ID, "n": name},
            )

        membership_ids: dict[str, uuid.UUID] = {}
        for person in [*STAFF, PATIENT_USER]:
            membership_id = uid(f"membership:{person['email']}")
            membership_ids[person["key"]] = membership_id
            conn.execute(
                text(
                    """
                    insert into memberships (id, clinic_id, user_id, role, full_name, phone, crn, crn_state,
                                             specialty, bio, created_at)
                    values (:id, :clinic, :user, cast(:role as user_role), :name, :phone, :crn, :crn_state,
                            :specialty, :bio, :since)
                    on conflict (id) do nothing
                    """
                ),
                {
                    "id": membership_id, "clinic": CLINIC_ID, "user": auth_ids[person["key"]],
                    "role": person["role"], "name": person["name"], "phone": person.get("phone"),
                    "crn": person.get("crn"), "crn_state": person.get("crn_state"),
                    "specialty": person.get("specialty"), "bio": person.get("bio"),
                    "since": datetime.fromisoformat(person["member_since"]).replace(tzinfo=TZ),
                },
            )

        for key, schedule in SCHEDULES.items():
            # O admin vincula cada nutricionista às unidades em que atende (aqui, a única unidade do seed).
            conn.execute(
                text("insert into unit_members (unit_id, membership_id, clinic_id) values (:u, :m, :c) on conflict do nothing"),
                {"u": UNIT_ID, "m": membership_ids[key], "c": CLINIC_ID},
            )
            _seed_schedule(conn, key, membership_ids[key], schedule)

        patient_ids: dict[str, uuid.UUID] = {}
        for name, sex, birth, owner, since in PATIENTS:
            patient_id = uid(f"patient:{name}")
            patient_ids[name] = patient_id
            created = month_start + timedelta(hours=8) if since == "mes" else now - timedelta(days=since)
            conn.execute(
                text(
                    """
                    insert into patients (id, clinic_id, user_id, nutritionist_id, full_name, sex, birth_date,
                                          created_by, created_at)
                    values (:id, :c, :user, :n, :name, cast(:sex as patient_sex), :birth, :by, :created)
                    on conflict (id) do nothing
                    """
                ),
                {"id": patient_id, "c": CLINIC_ID,
                 "user": auth_ids["patient"] if name == PATIENT_USER["name"] else None,
                 "n": membership_ids[owner], "name": name, "sex": sex, "birth": birth,
                 "by": membership_ids["reception"], "created": created},
            )

        # Consultas: um dia distinto por consulta e por profissional (sem sobreposição). As passadas são
        # histórico (concluídas); as futuras caem sempre em um horário válido da agenda do profissional.
        counters = {"henrique": 0, "camila": 0}
        used_days: dict[str, set] = {"henrique": set(), "camila": set()}
        rooms = {"henrique": ROOMS["Consultório 01"], "camila": ROOMS["Consultório 02"]}
        for name, _sex, _birth, owner, _since in PATIENTS:
            past = 3 if owner == "henrique" and name != "Carlos Eduardo Rocha" else 1
            for n in range(past):
                counters[owner] += 1
                day = (now - timedelta(days=counters[owner] * 2 + 1)).date()
                kind = "first_consultation" if n == 0 else "return_consultation"
                start = datetime.combine(day, time(10, 0), tzinfo=TZ)
                _upsert_appointment(conn, name, owner, n, start, kind, "completed", membership_ids, patient_ids, rooms)
            future_start = _next_valid_start(owner, now, used_days[owner])
            # Consulta agendada de uma versão anterior do seed pode estar em horário inválido: refaz.
            conn.execute(text("delete from appointments where id = :id and status = 'scheduled'"),
                         {"id": uid(f"appointment:{name}:99")})
            _upsert_appointment(conn, name, owner, 99, future_start, "return_consultation", "scheduled",
                                membership_ids, patient_ids, rooms)

    print("Seed concluído. Usuários (senha = SEED_PASSWORD do .env):")
    for person in [*STAFF, PATIENT_USER]:
        print(f"  {person['role']:13s} {person['email']}")
    return 0


def _seed_schedule(conn, key: str, professional_id: uuid.UUID, schedule: dict) -> None:
    """Configuração do profissional. Idempotente: não sobrescreve o que ele já ajustou."""
    lunch_start, lunch_end = schedule["lunch"]
    conn.execute(
        text(
            """
            insert into professional_schedule_settings (professional_id, clinic_id, start_step_minutes, lunch_start, lunch_end)
            values (:p, :c, :step, :ls, :le) on conflict (professional_id) do nothing
            """
        ),
        {"p": professional_id, "c": CLINIC_ID, "step": schedule["step"], "ls": lunch_start, "le": lunch_end},
    )
    for kind, minutes in schedule["durations"].items():
        conn.execute(
            text(
                """
                insert into professional_appointment_durations (professional_id, appointment_type, minutes)
                values (:p, cast(:t as appointment_type), :m) on conflict do nothing
                """
            ),
            {"p": professional_id, "t": kind, "m": minutes},
        )
    already_configured = conn.execute(
        text("select count(*) from professional_availability where professional_id = :p"), {"p": professional_id}
    ).scalar()
    if already_configured:
        return
    for weekday, (start, end) in schedule["days"].items():
        conn.execute(
            text(
                """
                insert into professional_availability (id, clinic_id, professional_id, unit_id, weekday, start_time, end_time)
                values (:id, :c, :p, :u, :w, :s, :e) on conflict (id) do nothing
                """
            ),
            {"id": uid(f"availability:{key}:{weekday}"), "c": CLINIC_ID, "p": professional_id,
             "u": UNIT_ID, "w": weekday, "s": start, "e": end},
        )


def _next_valid_start(owner: str, now: datetime, used_days: set) -> datetime:
    """Próximo dia de atendimento ainda livre (no seed), no primeiro horário útil da faixa do dia."""
    schedule = SCHEDULES[owner]
    day = now.date()
    while True:
        day += timedelta(days=1)
        weekday = (day.weekday() + 1) % 7
        if weekday in schedule["days"] and day not in used_days:
            used_days.add(day)
            hour, minute = map(int, schedule["days"][weekday][0].split(":"))
            return datetime.combine(day, time(hour, minute), tzinfo=TZ)


def _upsert_appointment(conn, patient, owner, n, start, kind, status, membership_ids, patient_ids, rooms) -> None:
    minutes = SCHEDULES[owner]["durations"][kind]
    conn.execute(
        text(
            """
            insert into appointments (id, clinic_id, patient_id, professional_id, unit_id, room_id, starts_at,
                                      ends_at, status, appointment_type, created_by)
            values (:id, :c, :p, :prof, :u, :r, :s, :e, cast(:status as appointment_status),
                    cast(:kind as appointment_type), :by)
            on conflict (id) do nothing
            """
        ),
        {"id": uid(f"appointment:{patient}:{n}"), "c": CLINIC_ID, "p": patient_ids[patient],
         "prof": membership_ids[owner], "u": UNIT_ID, "r": rooms[owner], "s": start,
         "e": start + timedelta(minutes=minutes), "status": status, "kind": kind, "by": membership_ids["reception"]},
    )


if __name__ == "__main__":
    raise SystemExit(main())
