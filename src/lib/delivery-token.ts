import { createHmac, timingSafeEqual } from 'node:crypto';
function secret() {
  const value = process.env.DELIVERY_SECRET || (process.env.NODE_ENV === 'development' ? 'development-only' : '');
  if (!value) throw new Error('DELIVERY_SECRET is required');
  return value;
}
export function signDelivery(requestId: string) { return createHmac('sha256', secret()).update(`delivery-v2:${requestId}`).digest('hex'); }
export function verifyDelivery(requestId: string, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(signDelivery(requestId)));
}
