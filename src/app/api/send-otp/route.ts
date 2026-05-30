import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sendgridKey = process.env.SENDGRID_API_KEY;
const mailgunKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const emailFrom = process.env.EMAIL_FROM || 'no-reply@panaderia.blxkstudio.com';

async function sendWithSupabaseAuth(email: string, subject: string, text: string, html: string) {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase no está configurado correctamente (falta URL o Service Role Key)');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  // Usar admin API para enviar email personalizado
  const { error } = await supabase.auth.admin.sendRawEmail({
    email,
    html
  });

  if (error) {
    throw new Error(`Error enviando email via Supabase: ${error.message}`);
  }
}

async function sendWithSendGrid(email: string, subject: string, text: string, html: string) {
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
    throw new Error(`SendGrid error: ${response.status} ${body}`);
  }
}

async function sendWithMailgun(email: string, subject: string, text: string, html: string) {
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
    throw new Error(`Mailgun error: ${response.status} ${body}`);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = body?.email;
  const code = body?.code;

  if (!email || !code) {
    return NextResponse.json({ message: 'Se requiere email y código OTP.' }, { status: 400 });
  }

  const subject = 'Código de verificación - Panadería';
  const text = `Tu código OTP es ${code}. Ingresa este código en la aplicación para verificar tu correo.`;
  const html = `<p>Tu código OTP es <strong>${code}</strong>.</p><p>Ingresa este código en la aplicación para verificar tu correo.</p>`;

  try {
    // Intentar usar Supabase primero
    if (supabaseServiceKey) {
      await sendWithSupabaseAuth(email, subject, text, html);
    } else if (sendgridKey) {
      await sendWithSendGrid(email, subject, text, html);
    } else if (mailgunKey && mailgunDomain) {
      await sendWithMailgun(email, subject, text, html);
    } else {
      return NextResponse.json({ message: 'No está configurado un servicio de envío de correo. Configure SUPABASE_SERVICE_ROLE_KEY, SENDGRID_API_KEY o MAILGUN_API_KEY + MAILGUN_DOMAIN.' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error enviando OTP:', error);
    return NextResponse.json({ message: error?.message || 'Error enviando OTP.' }, { status: 500 });
  }
}
