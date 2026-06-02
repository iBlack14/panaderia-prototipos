
import { NextRequest, NextResponse } from 'next/server';
const sendgridKey = process.env.SENDGRID_API_KEY;
const mailgunKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const resendKey = process.env.RESEND_API_KEY;
// Usar un dominio verificado en Resend, fallback a onboarding@resend.dev
const emailFrom = process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

async function sendWithResend(email: string, subject: string, text: string, html: string) {
  if (!resendKey) {
    throw new Error('RESEND_API_KEY no está configurado');
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: emailFrom,
        to: email,
        subject,
        html
      })
    });
    if (!response.ok) {
      const body = await response.text();
      console.error('Resend response error:', body);
      throw new Error(`Resend error: ${response.status} ${body}`);
    }
    const data = await response.json();
    console.log('Email enviado via Resend:', data);
  } catch (error: any) {
    console.error('Error en sendWithResend:', error);
    throw error;
  }
}

async function sendWithSendGrid(email: string, subject: string, text: string, html: string) {
  if (!sendgridKey) {
    throw new Error('SENDGRID_API_KEY no está configurado');
  }
  const payload = {
    personalizations: [{ to: [{ email }] }],
    from: { email: emailFrom },
    subject,
    content: [
      { type: 'text/plain', value: text },
      { type: 'text/html', value: html }
    ]
  };
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sendgridKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const body = await response.text();
    console.error('SendGrid response error:', body);
    throw new Error(`SendGrid error: ${response.status} ${body}`);
  }
  console.log('Email enviado via SendGrid');
}

async function sendWithMailgun(email: string, subject: string, text: string, html: string) {
  if (!mailgunKey || !mailgunDomain) {
    throw new Error('MAILGUN_API_KEY o MAILGUN_DOMAIN no están configurados');
  }
  const formData = new URLSearchParams();
  formData.append('from', emailFrom);
  formData.append('to', email);
  formData.append('subject', subject);
  formData.append('text', text);
  formData.append('html', html);
  const auth = Buffer.from(`api:${mailgunKey}`).toString('base64');
  const response = await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData.toString()
  });
  if (!response.ok) {
    const body = await response.text();
    console.error('Mailgun response error:', body);
    throw new Error(`Mailgun error: ${response.status} ${body}`);
  }
  console.log('Email enviado via Mailgun');
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = body?.email;
  const code = body?.code;
  console.log('Send-OTP request:', { email, codeLength: code?.length });
  if (!email || !code) {
    return NextResponse.json({ message: 'Se requiere email y código OTP.' }, { status: 400 });
  }
  const subject = '🔐 Tu código de verificación — Snack Roque';
  const text = `Tu código de verificación es: ${code}. Válido por 10 minutos. Si no solicitaste este código, ignora este mensaje.`;
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Código de verificación</title>
</head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(46,26,10,0.10);">
          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#b07d2e 0%,#8a5e1a 100%);padding:36px 40px 28px;text-align:center;">
              <div style="font-size:40px;margin-bottom:10px;">🥐</div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Snack Roque</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px;font-weight:500;">Panadería &amp; Pastelería</p>
            </td>
          </tr>
          <!-- BODY -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <h2 style="margin:0 0 8px;color:#2e1a0a;font-size:18px;font-weight:800;">Código de verificación</h2>
              <p style="margin:0 0 28px;color:#6b5744;font-size:14px;line-height:1.6;">
                Usa el siguiente código para verificar tu correo electrónico en el sistema de gestión de Snack Roque.
              </p>
              <!-- OTP BOX -->
              <div style="background:#fdf6ec;border:2px dashed #b07d2e;border-radius:14px;padding:28px 20px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#8a5e1a;text-transform:uppercase;letter-spacing:1px;">Tu código es</p>
                <div style="font-size:42px;font-weight:900;letter-spacing:10px;color:#b07d2e;font-family:'Courier New',monospace;">${code}</div>
                <p style="margin:10px 0 0;font-size:12px;color:#9e8a78;">⏱ Válido por <strong>10 minutos</strong></p>
              </div>
              <p style="margin:0 0 8px;color:#6b5744;font-size:13px;line-height:1.6;">
                Ingresa este código en la pantalla de verificación para continuar.
              </p>
              <p style="margin:0;color:#9e8a78;font-size:12px;line-height:1.6;">
                Si no solicitaste este código, puedes ignorar este mensaje con seguridad. Tu cuenta no ha sido modificada.
              </p>
            </td>
          </tr>
          <!-- FOOTER -->
          <tr>
            <td style="background:#fdf6ec;padding:20px 40px;border-top:1px solid #ede0cc;text-align:center;">
              <p style="margin:0;color:#9e8a78;font-size:11px;line-height:1.6;">
                © ${new Date().getFullYear()} Snack Roque · Panadería &amp; Pastelería<br/>
                Este es un correo automático, por favor no respondas a este mensaje.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  try {
    console.log('Intentando enviar OTP a:', email);
    // Intentar en orden: Resend → SendGrid → Mailgun
    if (resendKey) {
      console.log('Usando Resend con from:', emailFrom);
      await sendWithResend(email, subject, text, html);
    } else if (sendgridKey) {
      console.log('Usando SendGrid');
      await sendWithSendGrid(email, subject, text, html);
    } else if (mailgunKey && mailgunDomain) {
      console.log('Usando Mailgun');
      await sendWithMailgun(email, subject, text, html);
    } else {
      console.error('No email service configured');
      return NextResponse.json({ 
        message: 'No está configurado un servicio de envío de correo. Configure RESEND_API_KEY, SENDGRID_API_KEY o MAILGUN_API_KEY + MAILGUN_DOMAIN.' 
      }, { status: 500 });
    }
    console.log('Email enviado exitosamente a:', email);
    return NextResponse.json({ success: true, message: 'Código OTP enviado' });
  } catch (error: any) {
    console.error('Error enviando OTP:', error);
    return NextResponse.json({ 
      message: error?.message || 'Error enviando OTP.',
      error: error?.message
    }, { status: 500 });
  }
}
