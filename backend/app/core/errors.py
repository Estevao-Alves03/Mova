from fastapi import HTTPException


def field_error(status_code: int, field: str, message: str) -> HTTPException:
    """Erro de validação no mesmo formato do FastAPI, apontando o campo (o front mapeia por `loc`)."""
    return HTTPException(
        status_code=status_code,
        detail=[{"loc": ["body", field], "msg": message, "type": "value_error"}],
    )
