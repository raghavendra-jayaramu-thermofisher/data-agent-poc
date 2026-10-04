from __future__ import annotations

import re
import ssl
from urllib.parse import quote, quote_plus

from app.data_sources.errors import DataSourceOperationError


def sanitize_driver_message(message: str, secrets: tuple[str, ...] = ()) -> str:
    for secret in sorted((item for item in secrets if item), key=len, reverse=True):
        for value in {secret, repr(secret)[1:-1], quote(secret, safe=""), quote_plus(secret)}:
            message = message.replace(value, "[redacted]")
    message = re.sub(r"(?i)\b(?:postgres(?:ql)?|mysql|mssql|odbc)[\w+]*://\S+", "[connection URL redacted]", message)
    message = re.sub(r"(?i)\b(password|pwd|username|user|uid|token|secret)\s*[=:]\s*(?:\{[^}]*\}|\"[^\"]*\"|'[^']*'|[^;\s,)]+)", r"\1=[redacted]", message)
    message = re.sub(r"(?i)(for user\s+)(?:'[^']*'|\"[^\"]*\")", r"\1'[redacted]'", message)
    message = message.split("[SQL:", 1)[0].split("[parameters:", 1)[0]
    return message[:2000]


def connection_error(exc: Exception, *, stage: str, secrets: tuple[str, ...] = ()) -> DataSourceOperationError:
    driver = getattr(exc, "orig", None) or exc
    raw = str(driver)
    # Classification uses the original evidence; only sanitized evidence is retained.
    evidence = (type(driver).__name__ + " " + raw).lower()
    state = getattr(driver, "sqlstate", None) or getattr(driver, "pgcode", None)
    args = getattr(driver, "args", ())
    if not state and args and isinstance(args[0], str) and re.fullmatch(r"[A-Z0-9]{5}", args[0]):
        state = args[0]
    number = args[0] if args and isinstance(args[0], int) else None
    if number is None:
        match = re.search(r"\((18456|4060|10061|11001|53)\)", raw)
        number = int(match[1]) if match else None
    category, title, steps = "unknown", "The database operation failed; the cause could not be determined.", ["Review the technical details and server logs, then retry the connection test."]
    if isinstance(driver, (ImportError, ModuleNotFoundError)) or any(word in evidence for word in ("can't open lib", "driver manager", "no module named")) or state in ("IM002", "IM003"):
        category, title, steps = "driver", "The database driver could not be loaded.", ["Verify the configured driver name and install that driver in the API and worker environment."]
    elif isinstance(driver, TimeoutError) or "timeout" in evidence or "timed out" in evidence or state in ("HYT00", "HYT01"):
        category, title, steps = "timeout", "The database connection timed out.", ["Check the host, port, firewall, VPN and whether the database accepts connections from the worker."]
    elif any(word in evidence for word in ("name or service not known", "getaddrinfo", "nodename nor servname", "name resolution", "11001")):
        category, title, steps = "dns", "The database hostname could not be resolved.", ["Check the hostname and DNS resolution from the worker environment."]
    elif "connection refused" in evidence or "10061" in evidence or isinstance(driver, ConnectionRefusedError):
        category, title, steps = "refused", "The database connection was refused.", ["Check that the database is running, listening on the configured port, and reachable through the firewall."]
    elif state in ("28P01", "28000") or number in (1045, 18456) or any(word in evidence for word in ("login failed", "password authentication failed", "access denied for user")):
        category, title, steps = "authentication", "The database rejected the login.", ["Check the username, password and enabled authentication method; confirm the login is enabled."]
    elif state in ("3D000", "42501") or number in (1044, 1049, 4060) or any(word in evidence for word in ("cannot open database", "unknown database", "permission denied")) or ("database" in evidence and "does not exist" in evidence):
        category, title, steps = "database_access", "The requested database or object is unavailable or access was denied.", ["Verify the database and schema names, and confirm that the login has permission to access them."]
    elif isinstance(driver, ssl.SSLError) or any(word in evidence for word in ("certificate", "ssl error", "tls", "ssl handshake")):
        category, title, steps = "tls", "A secure connection could not be established.", ["Check encryption settings, certificate trust and the certificate hostname. Install a trusted certificate when required."]
    diagnostics: dict[str, object] = {
        "category": category, "stage": stage, "message": title,
        "driver_message": sanitize_driver_message(raw or f"{type(driver).__name__}: no additional driver message.", secrets), "next_steps": steps,
        "sqlstate": str(state) if state and re.fullmatch(r"[A-Z0-9]{5}", str(state)) else None,
        "error_number": number,
    }
    return DataSourceOperationError("DATASOURCE_CONNECTION_" + category.upper(), title, retryable=category in ("timeout", "dns", "refused"), diagnostics=diagnostics)
