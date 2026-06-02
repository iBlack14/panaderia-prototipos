import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/consulta-dni
 * Proxy seguro para consultar datos de una persona por DNI.
 * Usa apiperu.dev (plan gratuito: https://apiperu.dev)
 * El token se mantiene en el servidor para no exponerlo al cliente.
 */
export async function POST(request: NextRequest) {
  try {
    const { dni } = await request.json();

    if (!dni || !/^\d{8}$/.test(dni)) {
      return NextResponse.json(
        { success: false, message: 'El DNI debe tener exactamente 8 dígitos numéricos.' },
        { status: 400 }
      );
    }

    const token = process.env.APIPERU_TOKEN;

    if (!token || token === 'TU_TOKEN_AQUI') {
      return NextResponse.json(
        { success: false, message: 'Token de API no configurado. Regístrate en apiperu.dev y agrega APIPERU_TOKEN al archivo .env' },
        { status: 503 }
      );
    }

    const response = await fetch('https://apiperu.dev/api/dni', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ dni }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: data?.message || 'Error al consultar la API de DNI.' },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error('[consulta-dni] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error interno al consultar el DNI.' },
      { status: 500 }
    );
  }
}
