import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { email, password, userData } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Crear cliente Supabase con service role key (desde servidor)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Configuración de Supabase incompleta' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Crear usuario en auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirmar automáticamente
    });

    if (authError) {
      // Si el error es que el usuario ya existe, está bien
      if (authError.message.includes('already exists')) {
        return NextResponse.json(
          { message: 'Usuario ya existe', userId: null },
          { status: 200 }
        );
      }
      throw authError;
    }

    return NextResponse.json(
      {
        success: true,
        userId: authUser?.user?.id,
        email: authUser?.user?.email,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error creando usuario:', error);
    return NextResponse.json(
      { error: error.message || 'Error creando usuario' },
      { status: 500 }
    );
  }
}
