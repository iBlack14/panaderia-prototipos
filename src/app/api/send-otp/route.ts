import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    let apiKey = process.env.RESEND_API_KEY;
    let fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    // Manual fallback for reading .env in dev mode if process.env isn't populated
    if (!apiKey) {
      try {
        const envPath = path.join(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf8');
          const keyMatch = envContent.match(/^RESEND_API_KEY\s*=\s*(.*)$/m);
          if (keyMatch) {
            apiKey = keyMatch[1].trim();
            console.log('[Resend Fallback] Loaded RESEND_API_KEY manually from .env');
          }
          const fromMatch = envContent.match(/^RESEND_FROM_EMAIL\s*=\s*(.*)$/m);
          if (fromMatch) {
            fromEmail = fromMatch[1].trim();
            console.log('[Resend Fallback] Loaded RESEND_FROM_EMAIL manually from .env:', fromEmail);
          }
        }
      } catch (e) {
        console.warn('[Resend Fallback] Failed to read .env file manually:', e);
      }
    }

    if (!apiKey) {
      console.error('[Resend Config Error] RESEND_API_KEY is not defined in environment variables or .env file.');
      return NextResponse.json({ 
        error: 'La API Key de Resend (RESEND_API_KEY) no está definida. Por favor, verifica tu archivo .env y reinicia el servidor Next.js.' 
      }, { status: 500 });
    }

    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Correo inválido' }, { status: 400 });
    }

    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from: `Snack Roque <${fromEmail}>`,
      to: [email],
      subject: `🔐 Tu código de verificación: ${otp}`,
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Código de Verificación</title>
        </head>
        <body style="margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 0;">
            <tr>
              <td align="center">
                <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background:linear-gradient(135deg,#c0392b,#e74c3c);padding:32px 40px;text-align:center;">
                      <div style="font-size:40px;margin-bottom:8px;">🥖</div>
                      <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Snack Roque</div>
                      <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">Panadería & Pastelería</div>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding:36px 40px;">
                      <h2 style="margin:0 0 8px;color:#1a1a2e;font-size:20px;font-weight:700;">Código de verificación</h2>
                      <p style="margin:0 0 28px;color:#666;font-size:14px;line-height:1.6;">
                        Recibimos una solicitud para restablecer la contraseña de tu cuenta.<br>
                        Ingresa el siguiente código en la aplicación:
                      </p>

                      <!-- OTP Box -->
                      <div style="background:#f8f8fc;border:2px dashed #e74c3c;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
                        <div style="font-size:42px;font-weight:800;letter-spacing:12px;color:#c0392b;font-family:'Courier New',monospace;">${otp}</div>
                        <div style="font-size:12px;color:#999;margin-top:8px;">Válido por <strong>10 minutos</strong></div>
                      </div>

                      <p style="margin:0;color:#888;font-size:13px;line-height:1.6;">
                        Si no solicitaste este código, puedes ignorar este correo.<br>
                        Tu contraseña no cambiará a menos que uses este código.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background:#f8f8fc;padding:20px 40px;border-top:1px solid #eee;">
                      <p style="margin:0;color:#aaa;font-size:12px;text-align:center;">
                        © ${new Date().getFullYear()} Snack Roque · Sistema de Gestión Interno<br>
                        Este es un correo automático, por favor no respondas.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[Resend Error]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err: unknown) {
    console.error('[send-otp route error]', err);
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
