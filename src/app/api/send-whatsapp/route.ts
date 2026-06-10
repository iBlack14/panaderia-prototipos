import { NextResponse } from 'next/server';
import { getWhatsAppStatus, sendWhatsAppMessage } from '@/lib/baileys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, message, saleId, pdfBase64, fileName } = body;

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Falta el número de teléfono' }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ success: false, error: 'Falta el contenido del mensaje' }, { status: 400 });
    }

    const status = getWhatsAppStatus();
    if (!status.connected) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp no está conectado. Vincula el gateway antes de enviar.' },
        { status: 409 }
      );
    }

    const result = await sendWhatsAppMessage(phone, message, pdfBase64, fileName);

    return NextResponse.json({
      success: true,
      messageId: result?.key?.id || null,
      timestamp: new Date().toISOString(),
      recipient: phone,
      saleId: saleId || null,
      details: {
        network: 'WhatsApp',
        library: 'Baileys real',
        status: 'SENT',
        gatewayPhone: status.phone,
        gatewayDevice: status.device
      }
    });
  } catch (error: any) {
    console.error('[Baileys-API-Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno en el servidor de mensajería' },
      { status: 500 }
    );
  }
}
