import type {
  DispatchProviderAdapter,
  DispatchOrderRequest,
  DispatchOrderResponse,
  DispatchTrackingResponse,
  DispatchCancelResponse,
  DispatchRider,
} from './types.js';
import { logger } from '../../../utils/logger.js';
import { registerAdapter } from './base.js';

const log = logger.child({ module: 'dispatch-shadowfax' });

/**
 * Shadowfax Dispatch Adapter
 * 
 * Integration with Shadowfax's Hyperlocal Delivery API.
 * Docs: https://shadowfax.in/developer-docs
 * 
 * Required env vars:
 *   SHADOWFAX_API_KEY    — API key
 *   SHADOWFAX_API_SECRET — API secret
 *   SHADOWFAX_BASE_URL   — Base URL (default: https://api.shadowfax.in)
 */
class ShadowfaxDispatchAdapter implements DispatchProviderAdapter {
  readonly provider = 'shadowfax';

  private get apiKey(): string { return process.env.SHADOWFAX_API_KEY || ''; }
  private get apiSecret(): string { return process.env.SHADOWFAX_API_SECRET || ''; }
  private get baseUrl(): string { return process.env.SHADOWFAX_BASE_URL || 'https://api.shadowfax.in'; }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')}`,
    };
  }

  async createOrder(request: DispatchOrderRequest): Promise<DispatchOrderResponse> {
    try {
      // Shadowfax API order creation
      const body = {
        client_order_id: `order_${request.orderId}`,
        order_type: 'DELIVERY',
        pickup: {
          address: request.pickup.address || '',
          latitude: request.pickup.lat,
          longitude: request.pickup.lng,
          contact_person: request.customerName || 'Kitchen',
          contact_number: request.customerPhone || '',
        },
        delivery: {
          address: request.dropoff.address || '',
          latitude: request.dropoff.lat,
          longitude: request.dropoff.lng,
          contact_person: request.customerName || 'Customer',
          contact_number: request.customerPhone || '',
        },
        items: request.items.map(i => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price || 0,
        })),
        order_value: request.items.reduce((sum, i) => sum + (i.price || 0) * i.quantity, 0),
        instructions: request.notes || 'Handle with care',
        scheduled_delivery_time: request.scheduledTime?.toISOString(),
      };

      const response = await fetch(`${this.baseUrl}/api/v1/orders`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as any;
        log.error({ status: response.status, error: errorData }, '[Shadowfax] Order creation failed');
        return {
          dispatchId: `SF_FAILED_${request.orderId}`,
          provider: 'shadowfax',
          status: 'failed',
          raw: errorData,
        };
      }

      const data = (await response.json()) as any;
      return {
        dispatchId: data.order_id || data.id,
        provider: 'shadowfax',
        riderName: data.assigned_agent?.name,
        riderPhone: data.assigned_agent?.phone,
        riderVehicle: data.assigned_agent?.vehicle_type,
        etaMinutes: data.estimated_pickup_time ? Math.round((new Date(data.estimated_pickup_time).getTime() - Date.now()) / 60000) : undefined,
        estimatedCost: data.delivery_charges,
        status: 'assigned',
        raw: data,
      };
    } catch (err: any) {
      log.error({ err: err.message }, '[Shadowfax] Network error');
      return {
        dispatchId: `SF_ERROR_${request.orderId}`,
        provider: 'shadowfax',
        status: 'failed',
      };
    }
  }

  async trackOrder(dispatchId: string): Promise<DispatchTrackingResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/orders/${dispatchId}/tracking`, {
        headers: this.headers,
      });

      if (!response.ok) {
        return { dispatchId, status: 'failed' };
      }

      const data = (await response.json()) as any;
      const statusMap: Record<string, DispatchTrackingResponse['status']> = {
        'CREATED': 'assigned',
        'AGENT_ASSIGNED': 'assigned',
        'AGENT_ARRIVED_AT_PICKUP': 'assigned',
        'PICKED_UP': 'picked_up',
        'IN_TRANSIT': 'in_transit',
        'DELIVERED': 'delivered',
        'CANCELLED': 'failed',
        'RTO': 'failed',
      };

      const agent = data.assigned_agent || data.current_agent || {};
      return {
        dispatchId,
        status: statusMap[data.status || data.order_status] || 'in_transit',
        riderLocation: agent.current_location
          ? { lat: agent.current_location.lat, lng: agent.current_location.lng }
          : undefined,
        riderName: agent.name,
        riderPhone: agent.phone,
        etaMinutes: data.estimated_delivery_time
          ? Math.round((new Date(data.estimated_delivery_time).getTime() - Date.now()) / 60000)
          : undefined,
        raw: data,
      };
    } catch (err: any) {
      log.error({ err: err.message }, '[Shadowfax] Track failed');
      return { dispatchId, status: 'failed' };
    }
  }

  async cancelOrder(dispatchId: string, reason?: string): Promise<DispatchCancelResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/orders/${dispatchId}/cancel`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ reason: reason || 'Customer cancelled' }),
      });

      const data = (await response.json().catch(() => ({}))) as any;
      return {
        success: response.ok,
        refund: data.refund_amount,
        raw: data,
      };
    } catch {
      return { success: false };
    }
  }

  async getAvailableRiders(location: { lat: number; lng: number }, radiusKm: number = 5): Promise<DispatchRider[]> {
    // Shadowfax assigns riders automatically based on proximity
    // This endpoint is for custom integrations
    log.debug({ location, radiusKm }, '[Shadowfax] getAvailableRiders — Shadowfax auto-assigns riders');
    return [];
  }
}

registerAdapter('shadowfax', () => new ShadowfaxDispatchAdapter());
