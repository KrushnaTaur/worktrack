from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db.models import ProtectedError
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

STATUS_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    429: "throttled",
}


def _body(code, message, details=None):
    return {"error": {"code": code, "message": message, "details": details}}


def custom_exception_handler(exc, context):
    """Return every error in one shape: {"error": {"code", "message", "details"}}."""
    if isinstance(exc, DjangoValidationError):
        exc = ValidationError(
            detail=exc.message_dict if hasattr(exc, "error_dict") else exc.messages
        )
    if isinstance(exc, ProtectedError):
        return Response(
            _body("conflict", "This record is used by other records and cannot be deleted."),
            status=409,
        )
    if isinstance(exc, IntegrityError):
        return Response(_body("conflict", "The change conflicts with existing data."), status=409)

    response = drf_exception_handler(exc, context)
    if response is None:  # unhandled -> Django returns a 500
        return None

    if isinstance(exc, ValidationError):
        response.data = _body("validation_error", "Validation failed.", response.data)
    else:
        detail = response.data.get("detail") if isinstance(response.data, dict) else None
        response.data = _body(
            STATUS_CODES.get(response.status_code, "error"),
            str(detail or "Request failed."),
        )
    return response