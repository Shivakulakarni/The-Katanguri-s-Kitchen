/**
 * Dispatch Adapters - Barrel Export
 * 
 * Import this file to register all available dispatch providers.
 * The active provider is configured via DISPATCH_PROVIDER env var.
 * 
 * Usage:
 *   import './adapters/index.js'; // Registers all adapters
 *   import { createDispatchAdapter } from './adapters/base.js';
 *   const adapter = createDispatchAdapter(); // Uses DISPATCH_PROVIDER env var
 */

import './dunzo.adapter.js';
import './porter.adapter.js';
import './shadowfax.adapter.js';

export { createDispatchAdapter, registerAdapter } from './base.js';
export type {
  DispatchProviderAdapter,
  DispatchOrderRequest,
  DispatchOrderResponse,
  DispatchTrackingResponse,
  DispatchCancelResponse,
  DispatchRider,
} from './types.js';
