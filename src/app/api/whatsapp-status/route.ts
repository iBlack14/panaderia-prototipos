import { NextResponse } from 'next/server';
import { getWhatsAppStatus } from '@/lib/baileys-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET solo lee estado ligero (sin cargar Baileys/WAProto).
 * POST start/disconnect importa Baileys de forma diferida.
 */
export async function GET() {
  return NextResponse.json({ success: true, ...getWhatsAppStatus() });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || (body.connected === false ? 'disconnect' : 'start');

    // Carga pesada solo cuando se inicia/desconecta el gateway
    const { disconnectWhatsAppGateway, startWhatsAppGateway } = await import('@/lib/baileys');

    if (action === 'disconnect') {
      const status = await disconnectWhatsAppGateway();
      return NextResponse.json({ success: true, ...status });
    }

    const status = await startWhatsAppGateway();
    return NextResponse.json({ success: true, ...status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error en gateway WhatsApp' },
      { status: 500 }
    );
  }
}
