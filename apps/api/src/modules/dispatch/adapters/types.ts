/**
 * Dispatch API Adapter Pattern
 * 
 * Provides a unified interface for multiple dispatch providers (Dunzo, Porter, Shadowfax).
 * Each adapter implements the same interface, allowing the system to switch providers
 * without changing business logic.
 * 
 * Usage:
 *   const adapter = createDispatchAdapter('dunzo');
 *   const result = await adapter.createOrder({ pickup, dropoff, items });
 */

export interface DispatchOrderRequest {
  orderId: number;
  pickup: { lat: number; lng: number; address?: string };
  dropoff: { lat: number; lng: number; address?: string };
  items: Array<{ name: string; quantity: number; price?: number }>;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  scheduledTime?: Date;
}

export interface DispatchOrderResponse {
  dispatchId: string;
  provider: string;
  riderName?: string;
  riderPhone?: string;
  riderVehicle?: string;
  etaMinutes?: number;
  estimatedCost?: number;
  status: 'assigned' | 'pending' | 'failed';
  raw?: any; // Provider-specific response
}

export interface DispatchTrackingResponse {
  dispatchId: string;
  status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed';
  riderLocation?: { lat: number; lng: number };
  riderName?: string;
  riderPhone?: string;
  etaMinutes?: number;
  raw?: any;
}

export interface DispatchCancelResponse {
  success: boolean;
  refund?: number;
  raw?: any;
}

export interface DispatchProviderAdapter {
  readonly provider: string;
  createOrder(request: DispatchOrderRequest): Promise<DispatchOrderResponse>;
  trackOrder(dispatchId: string): Promise<DispatchTrackingResponse>;
  cancelOrder(dispatchId: string, reason?: string): Promise<DispatchCancelResponse>;
  getAvailableRiders(location: { lat: number; lng: number }, radiusKm?: number): Promise<DispatchRider[]>;
}

export interface DispatchRider {
  id: string;
  name: string;
  phone: string;
  vehicleType?: string;
  rating?: number;
  etaMinutes?: number;
  location?: { lat: number; lng: number };
}
