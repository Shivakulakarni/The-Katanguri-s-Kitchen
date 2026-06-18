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

const log = logger.child({ module: 'dispatch-porter' });

/**
 * Porter Dispatch Adapter
 * 
 * Integration with Porter's On-Demand Delivery API.
 * Docs: https://developer.porter.in/
 * 
 * Required env vars:
 *   PORTER_API_KEY    — API key from Porter developer portal
 *   PORTER_BASE_URL   — Base URL (default: https://api.porter.in)
 */
class PorterDispatchAdapter implements DispatchProviderAdapter {
  readonly provider = 'porter';

  private get apiKey(): string { return process.env.PORTER_API_KEY || ''; }
  private get baseUrl(): string { return process.env.PORTER_BASE_URL || 'https://api.porter.in'; }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': this.apiKey,
    };
  }

  async createOrder(request: DispatchOrderRequest): Promise<DispatchOrderResponse> {
    try {
      // Porter API order creation
      // Docs: https://developer.porter.in/api-reference/#create-delivery
      const body = {
        order_reference_id: `order_${request.orderId}`,
        pickup: {
          address: request.pickup.address || '',
          latitude: request.pickup.lat,
          longitude: request.pickup.lng,
          contact: { name: request.customerName || 'Kitchen', phone: request.customerPhone || '' },
        },
        drop: {
          address: request.dropoff.address || '',
          latitude: request.dropoff.lat,
          longitude: request.dropoff.lng,
          contact: { name: request.customerName || 'Customer', phone: request.customerPhone || '' },
        },
        item_description: request.items.map(i => `${i.quantity}x ${i.name}`).join(', '),
        vehicle_type: 'BIKE',
        payment_mode: 'PREPAID',
        instructions: request.notes || 'Handle with care',
      };

      const response = await fetch(`${this.baseUrl}/v3/business/delivery/create`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as any;
        log.error({ status: response.status, error: errorData }, '[Porter] Order creation failed');
        return {
          dispatchId: `PORTER_FAILED_${request.orderId}`,
          provider: 'porter',
          status: 'failed',
          raw: errorData,
        };
      }

      const data = (await response.json()) as any;
      return {
        dispatchId: data.delivery_id || data.order_id,
        provider: 'porter',
        riderName: data.trip?.driver?.name,
        riderPhone: data.trip?.driver?.phone,
        riderVehicle: data.trip?.vehicle?.registration_number,
        etaMinutes: data.trip?.eta_to_pickup ? Math.round(data.trip.eta_to_pickup / 60) : undefined,
        estimatedCost: data.estimated_cost,
        status: 'assigned',
        raw: data,
      };
    } catch (err: any) {
      log.error({ err: err.message }, '[Porter] Network error');
      return {
        dispatchId: `PORTER_ERROR_${request.orderId}`,
        provider: 'porter',
        status: 'failed',
      };
    }
  }

  async trackOrder(dispatchId: string): Promise<DispatchTrackingResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/v3/business/delivery/${dispatchId}/track`, {
        headers: this.headers,
      });

      if (!response.ok) {
        return { dispatchId, status: 'failed' };
      }

      const data = (await response.json()) as any;
      const trip = data.trip || {};
      const statusMap: Record<string, DispatchTrackingResponse['status']> = {
        'SEARCHING': 'assigned',
        'ALLOTTED': 'assigned',
        'ARRIVED_AT_PICKUP': 'assigned',
        'PICKED_UP': 'picked_up',
        'IN_TRANSIT': 'in_transit',
        'DELIVERED': 'delivered',
        'CANCELLED': 'failed',
        'FAILED': 'failed',
      };

      return {
        dispatchId,
        status: statusMap[trip.status || data.status] || 'in_transit',
        riderLocation: trip.driver?.current_location
          ? { lat: trip.driver.current_location.latitude, lng: trip.driver.current_location.longitude }
          : trip.current_drop_location
          ? { lat: trip.current_drop_location.latitude, lng: trip.current_drop_location.longitude }
          : undefined,
        riderName: trip.driver?.name,
        riderPhone: trip.driver?.phone,
        etaMinutes: trip.eta_to_drop ? Math.round(trip.eta_to_drop / 60) : undefined,
        raw: data,
      };
    } catch (err: any) {
      log.error({ err: err.message }, '[Porter] Track failed');
      return { dispatchId, status: 'failed' };
    }
  }

  async cancelOrder(dispatchId: string, reason?: string): Promise<DispatchCancelResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/v3/business/delivery/${dispatchId}/cancel`, {
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
    // Skip real API call if no API key is configured — return simulation data
    if (!this.apiKey || this.apiKey === 'CHANGE_ME' || this.apiKey.startsWith('CHANGE_ME')) {
      log.debug({ location, radiusKm }, '[Porter] getAvailableRiders — simulation mode (no API key)');
      return [
        { id: `porter-sim-${Math.random().toString(36).slice(2, 8)}`, name: 'Porter Driver (Sim)', phone: '9000000001', vehicleType: 'Bike', rating: 4.5, etaMinutes: 5 },
      ];
    }

    try {
      const response = await fetch(`${this.baseUrl}/v3/business/delivery/available-vehicles`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          pickup: { latitude: location.lat, longitude: location.lng },
          radius_km: radiusKm,
        }),
      });

      if (!response.ok) return [];

      const data = (await response.json()) as any;
      return (data.vehicles || []).map((v: any) => ({
        id: v.vehicle_id || `porter-${Math.random().toString(36).slice(2, 8)}`,
        name: v.driver?.name || 'Porter Driver',
        phone: v.driver?.phone || '',
        vehicleType: v.vehicle_type || 'Bike',
        rating: v.driver?.rating,
        etaMinutes: v.eta_minutes,
        location: v.location ? { lat: v.location.latitude, lng: v.location.longitude } : undefined,
      }));
    } catch (err: any) {
      log.error({ err: err.message }, '[Porter] getAvailableRiders failed');
      return [];
    }
  }
}

registerAdapter('porter', () => new PorterDispatchAdapter());
