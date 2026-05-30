
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
  const subject = 'Código de verificación - Panadería';
  const text = `Tu código OTP es ${code}. Ingresa este código en la aplicación para verificar tu correo.`;
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Verificación de correo - Panadería</h2>
      <p>Tu código OTP es:</p>
      <h1 style="color: #007bff; letter-spacing: 2px;">${code}</h1>
      <p>Ingresa este código en la aplicación para verificar tu correo.</p>
      <p style="color: #666; font-size: 12px;">Este código expira en 10 minutos.</p>
    </div>
  `;
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
