"""
Serviço de envio de e-mails transacionais (Resend.com) do Pontinho UFABC.
Responsável por códigos de verificação de 4 dígitos e links de recuperação de senha.
"""
import os
import json
import logging
import urllib.request
import urllib.error

logger = logging.getLogger("pontinho.email")

RESEND_API_URL = "https://api.resend.com/emails"

def get_resend_api_key() -> str:
    return os.getenv("RESEND_API_KEY", "").strip()

def get_resend_from_email() -> str:
    return os.getenv("RESEND_FROM_EMAIL", "Pontinho UFABC <onboarding@resend.dev>").strip()

def send_email(to_email: str, subject: str, html_content: str) -> dict:
    """
    Envia um e-mail transacional via API do Resend.com.
    Em modo de teste (sem chave configurada), simula o envio com log.
    """
    api_key = get_resend_api_key()
    from_email = get_resend_from_email()

    if not api_key:
        logger.warning(f"[Email Simulado] RESEND_API_KEY não definida. Para: {to_email} | Assunto: {subject}")
        return {"id": "mock_simulated", "simulated": True}

    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "html": html_content
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "PontinhoUFABC/2.0"
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(RESEND_API_URL, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read().decode("utf-8")
            result = json.loads(resp_body) if resp_body else {}
            logger.info(f"[Email] Enviado com sucesso para {to_email}. ID: {result.get('id')}")
            return result
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        logger.error(f"[Email Erro HTTP {e.code}] Falha ao enviar para {to_email}: {error_body}")
        raise RuntimeError(f"Erro no serviço de e-mail ({e.code}): {error_body}")
    except Exception as e:
        logger.error(f"[Email Erro] Exceção inesperada ao enviar para {to_email}: {e}")
        raise RuntimeError(f"Erro de conexão com o serviço de e-mail: {e}")


def send_verification_email(to_email: str, code: str, name: str = "") -> dict:
    """
    Envia o código de 4 dígitos para confirmação de e-mail acadêmico no cadastro.
    """
    subject = f"Seu código de confirmação: {code} - Pontinho UFABC"
    display_name = name.strip() if name and name.strip() else "Estudante"

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código de Confirmação - Pontinho UFABC</title>
</head>
<body style="margin: 0; padding: 0; background-color: #020617; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #020617; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #0f172a; border-radius: 24px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 20px; text-align: center; background: linear-gradient(180deg, rgba(6, 78, 59, 0.4) 0%, rgba(15, 23, 42, 0) 100%); border-bottom: 1px solid rgba(16, 185, 129, 0.15);">
              <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px; color: #34d399;">
                Pontinho <span style="font-size: 16px; font-weight: 600; color: #94a3b8; letter-spacing: normal;">UFABC</span>
              </h1>
              <p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8; font-weight: 500;">
                Confirmação de E-mail Acadêmico
              </p>
            </td>
          </tr>

          <!-- Corpo -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5; color: #e2e8f0;">
                Olá, <strong>{display_name}</strong>! 👋
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                Para concluir seu cadastro no Pontinho e validar seu acesso com a comunidade universitária da UFABC, utilize o código de segurança abaixo:
              </p>

              <!-- Caixa do Código -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <div style="background-color: #064e3b; border: 2px solid #10b981; border-radius: 16px; padding: 18px 32px; display: inline-block;">
                      <span style="font-size: 38px; font-weight: 900; letter-spacing: 12px; color: #6ee7b7; font-family: monospace;">
                        {code}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 12px; font-size: 12px; color: #64748b; text-align: center;">
                ⏱️ Este código expira em <strong>15 minutos</strong> e pode ser usado apenas uma vez.
              </p>

              <hr style="border: 0; border-top: 1px solid #1e293b; margin: 28px 0;">

              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #64748b; text-align: center;">
                Se você não solicitou este cadastro no Pontinho UFABC, por favor desconsidere este e-mail. Nenhuma conta será criada sem a validação deste código.
              </p>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="padding: 20px 32px; background-color: #020617; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #475569;">
                © 2026 Pontinho UFABC · A rede exclusiva da Universidade Federal do ABC
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
    return send_email(to_email, subject, html)


def send_password_reset_email(to_email: str, reset_link: str, name: str = "") -> dict:
    """
    Envia o e-mail de recuperação de senha com botão e link direto.
    """
    subject = "Recuperação de Senha - Pontinho UFABC"
    display_name = name.strip() if name and name.strip() else "Estudante"

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperação de Senha - Pontinho UFABC</title>
</head>
<body style="margin: 0; padding: 0; background-color: #020617; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #020617; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #0f172a; border-radius: 24px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 20px; text-align: center; background: linear-gradient(180deg, rgba(6, 78, 59, 0.4) 0%, rgba(15, 23, 42, 0) 100%); border-bottom: 1px solid rgba(16, 185, 129, 0.15);">
              <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px; color: #34d399;">
                Pontinho <span style="font-size: 16px; font-weight: 600; color: #94a3b8; letter-spacing: normal;">UFABC</span>
              </h1>
              <p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8; font-weight: 500;">
                Redefinição de Senha de Acesso
              </p>
            </td>
          </tr>

          <!-- Corpo -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5; color: #e2e8f0;">
                Olá, <strong>{display_name}</strong>! 🔐
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                Recebemos uma solicitação para redefinir a senha da sua conta no Pontinho. Se foi você, clique no botão abaixo para cadastrar sua nova senha:
              </p>

              <!-- Botão de Ação -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="{reset_link}" target="_blank" style="background-color: #10b981; color: #022c22; text-decoration: none; font-size: 16px; font-weight: 800; padding: 15px 32px; border-radius: 14px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3);">
                      Redefinir Minha Senha ➜
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 12px; font-size: 12px; color: #64748b; text-align: center;">
                ⏱️ Este link de recuperação expira em <strong>1 hora</strong> e é de uso único.
              </p>

              <hr style="border: 0; border-top: 1px solid #1e293b; margin: 24px 0;">

              <p style="margin: 0 0 8px; font-size: 12px; color: #64748b;">
                Se o botão acima não funcionar, copie e cole o endereço abaixo no seu navegador:
              </p>
              <p style="margin: 0 0 24px; font-size: 11px; word-break: break-all; color: #38bdf8;">
                <a href="{reset_link}" style="color: #38bdf8; text-decoration: underline;">{reset_link}</a>
              </p>

              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #64748b;">
                ⚠️ Se você não solicitou a redefinição de senha, fique tranquilo: nenhuma alteração foi realizada e sua conta continua protegida.
              </p>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="padding: 20px 32px; background-color: #020617; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #475569;">
                © 2026 Pontinho UFABC · A rede exclusiva da Universidade Federal do ABC
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
    return send_email(to_email, subject, html)
