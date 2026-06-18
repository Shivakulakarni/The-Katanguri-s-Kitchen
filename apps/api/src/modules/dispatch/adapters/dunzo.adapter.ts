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

const log = logger.child({ module: 'dispatch-dunzo' });

/**
 * Dunzo Dispatch Adapter
 * 
 * Integration with Dunzo's Hyperlocal Delivery API.
 * Docs: https://developer.dunzo.com/
 * 
 * Required env vars:
 *   DUNZO_API_KEY    — API key from Dunzo developer portal
 *   DUNZO_CLIENT_ID  — Client ID
 *   DUNZO_BASE_URL   — Base URL (default: https://api.dunzo.com)
 */
class DunzoDispatchAdapter implements DispatchProviderAdapter {
  readonly provider = 'dunzo';

  private get apiKey(): string { return process.env.DUNZO_API_KEY || ''; }
  private get clientId(): string { return process.env.DUNZO_CLIENT_ID || ''; }
  private get baseUrl(): string { return process.env.DUNZO_BASE_URL || 'https://api.dunzo.com'; }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Client-Id': this.clientId,
    };
  }

  async createOrder(request: DispatchOrderRequest): Promise<DispatchOrderResponse> {
    try {
      // Dunzo API order creation
      // Docs: https://developer.dunzo.com/docs/create-task
      const body = {
        task_type_id: 1, // Delivery
       pickup: {
          address: request.pickup.address || '',
          latitude: request.pickup.lat,
          longitude: request.pickup.lng,
          name: request.customerName || 'Kitchen',
          phone_number: request.customerPhone || '',
        },
        drop: {
          address: request.dropoff.address || '',
          latitude: request.dropoff.lat,
          longitude: request.dropoff.lng,
          name: request.customerName || 'Customer',
          phone_number: request.customerPhone || '',
        },
        instructions: request.notes || 'Food delivery - handle with care',
        item_description: request.items.map(i => `${i.quantity}x ${i.name}`).join(', '),
        tip: 0,
        reference_id: `order_${request.orderId}`,
      };

      const response = await fetch(`${this.baseUrl}/v2/business/task`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as any;
        log.error({ status: response.status, error: errorData }, '[Dunzo] Order creation failed');
        return {
          dispatchId: `DUNZO_FAILED_${request.orderId}`,
          provider: 'dunzo',
          status: 'failed',
          raw: errorData,
        };
      }

      const data = (await response.json()) as any;
      return {
        dispatchId: data.task_id || data.id,
        provider: 'dunzo',
        riderName: data.delivery_partner?.name,
        riderPhone: data.delivery_partner?.phone_number,
        riderVehicle: data.delivery_partner?.vehicle_description,
        etaMinutes: data.estimated_pickup_time ? Math.round((data.estimated_pickup_time - Date.now()) / 60000) : undefined,
        estimatedCost: data.total_fee ? data.total_fee / 100 : undefined, // Dunzo returns paise
        status: 'assigned',
        raw: data,
      };
    } catch (err: any) {
      log.error({ err: err.message }, '[Dunzo] Network error');
      return {
        dispatchId: `DUNZO_ERROR_${request.orderId}`,
        provider: 'dunzo',
        status: 'failed',
      };
    }
  }

  async trackOrder(dispatchId: string): Promise<DispatchTrackingResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/business/task/${dispatchId}`, {
        headers: this.headers,
      });

      if (!response.ok) {
        return { dispatchId, status: 'failed' };
      }

      const data = (await response.json()) as any;
      const statusMap: Record<string, DispatchTrackingResponse['status']> = {
        'CREATED': 'assigned',
        'PICKUP_UP_ARRIVED': 'assigned',
        'PICKUP_UP_DONE': 'picked_up',
        'IN_TRANSIT': 'in_transit',
        'DELIVERED': 'delivered',
        'CANCELLED': 'failed',
        'FAILED': 'failed',
      };

      return {
        dispatchId,
        status: statusMap[data.status] || 'in_transit',
        riderLocation: data.delivery_partner?.current_location
          ? { lat: data.delivery_partner.current_location.latitude, lng: data.delivery_partner.current_location.longitude }
          : undefined,
        riderName: data.delivery_partner?.name,
        riderPhone: data.delivery_partner?.phone_number,
        etaMinutes: data.estimated_delivery_time ? Math.round((data.estimated_delivery_time - Date.now()) / 60000) : undefined,
        raw: data,
      };
    } catch (err: any) {
      log.error({ err: err.message }, '[Dunzo] Track failed');
      return { dispatchId, status: 'failed' };
    }
  }

  async cancelOrder(dispatchId: string, reason?: string): Promise<DispatchCancelResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/business/task/${dispatchId}/cancel`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ reason: reason || 'Customer cancelled' }),
      });

      const data = (await response.json().catch(() => ({}))) as any;
      return {
        success: response.ok,
        refund: data.refund_amount ? data.refund_amount / 100 : undefined,
        raw: data,
      };
    } catch {
      return { success: false };
    }
  }

  async getAvailableRiders(location: { lat: number; lng: number }, radiusKm: number = 5): Promise<DispatchRider[]> {
    // Dunzo doesn't have a direct "get available riders" endpoint.
    // Riders are matched automatically when an order is created.
    // This is a placeholder for custom integrations.
    log.debug({ location, radiusKm }, '[Dunzo] getAvailableRiders not supported — Dunzo auto-matches riders');
    return [];
  }
}

registerAdapter('dunzo', () => new DunzoDispatchAdapter());
