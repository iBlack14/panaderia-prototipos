import { NextResponse } from 'next/server';
import {
  disconnectWhatsAppGateway,
  getWhatsAppStatus,
  startWhatsAppGateway
} from '@/lib/baileys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ success: true, ...getWhatsAppStatus() });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || (body.connected === false ? 'disconnect' : 'start');

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
