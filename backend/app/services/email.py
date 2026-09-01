"""Outbound email via SMTP (password reset links)."""

from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailError(Exception):
    """Failed to send email."""


class EmailNotConfiguredError(EmailError):
    """SMTP settings missing."""


class EmailAuthError(EmailError):
    """SMTP username/password rejected."""


def is_configured() -> bool:
    return bool(_smtp_username() and _smtp_password())


def _strip_env_quotes(value: str) -> str:
    raw = value.strip()
    if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in {'"', "'"}:
        return raw[1:-1].strip()
    return raw


def _smtp_username() -> str:
    return _strip_env_quotes(settings.SMTP_USERNAME)


def _smtp_password() -> str:
    # Gmail hiện App Password dạng "xxxx xxxx xxxx xxxx" — SMTP chỉ nhận 16 ký tự liền.
    cleaned = "".join(_strip_env_quotes(settings.SMTP_PASSWORD).split())
    if cleaned and len(cleaned) != 16:
        logger.warning(
            "SMTP_PASSWORD length is %s after stripping spaces; "
            "Gmail App Password must be exactly 16 characters",
            len(cleaned),
        )
    return cleaned


def send_password_reset_link(to_email: str, reset_url: str) -> None:
    if not is_configured():
        raise EmailNotConfiguredError("SMTP is not configured")

    from_addr = _smtp_username()
    subject = "Đặt lại mật khẩu — AI Trợ lý Dinh dưỡng"
    text = (
        "Bạn vừa yêu cầu đặt lại mật khẩu trên AI Trợ lý Dinh dưỡng.\n\n"
        f"Mở liên kết sau để chọn mật khẩu mới (hết hạn sau 1 giờ):\n{reset_url}\n\n"
        "Nếu bạn không yêu cầu, hãy bỏ qua email này.\n"
    )
    html = f"""\
<html>
  <body style="font-family: sans-serif; color: #1a1a1a; line-height: 1.5;">
    <p>Bạn vừa yêu cầu đặt lại mật khẩu trên <strong>AI Trợ lý Dinh dưỡng</strong>.</p>
    <p><a href="{reset_url}">Đặt lại mật khẩu</a></p>
    <p style="color: #666; font-size: 13px;">
      Liên kết hết hạn sau 1 giờ. Nếu bạn không yêu cầu, hãy bỏ qua email này.
    </p>
  </body>
</html>
"""

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    try:
        _deliver(msg)
    except EmailNotConfiguredError:
        raise
    except EmailAuthError:
        raise
    except Exception as exc:
        logger.exception("SMTP send failed")
        raise EmailError("SMTP send failed") from exc


def _deliver(msg: EmailMessage) -> None:
    host = settings.SMTP_HOST
    port = settings.SMTP_PORT
    timeout = 20
    context = ssl.create_default_context()
    if port == 465:
        client: smtplib.SMTP = smtplib.SMTP_SSL(
            host, port, timeout=timeout, context=context
        )
    else:
        client = smtplib.SMTP(host, port, timeout=timeout)
    try:
        with client:
            client.ehlo()
            if port != 465 and settings.SMTP_USE_TLS:
                client.starttls(context=context)
                client.ehlo()
            client.login(_smtp_username(), _smtp_password())
            client.send_message(msg)
    except smtplib.SMTPAuthenticationError as exc:
        err = exc.smtp_error
        if isinstance(err, bytes):
            err = err.decode("utf-8", errors="replace")
        logger.warning("SMTP authentication failed: code=%s error=%s", exc.smtp_code, err)
        raise EmailAuthError("SMTP authentication failed") from exc
