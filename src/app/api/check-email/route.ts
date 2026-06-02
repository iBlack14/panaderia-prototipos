import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Este endpoint verifica si un correo existe en profiles
// usando service role (sin RLS) — necesario porque el usuario NO está autenticado
// durante el flujo de recuperación de contraseña.
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      // Sin service role key, intentamos con anon key como fallback
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) {
        return NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 });
      }
      const supabase = createClient(supabaseUrl, anonKey);
      const { data } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('correo', email)
        .maybeSingle();

      if (!data) {
        return NextResponse.json({ found: false }, { status: 200 });
      }
      return NextResponse.json({ found: true, userId: data.id, username: data.username });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('correo', email)
      .maybeSingle();

    if (error) {
      console.error('check-email error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    return NextResponse.json({ found: true, userId: data.id, username: data.username });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
