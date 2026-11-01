import { describe, it, expect } from 'vitest';
import { preferredCheckoutService, resolveCheckoutServiceChoice } from '../src/core/checkout-service-choice.js';

describe('checkout: tipo de entrega disponible', () => {
  it('prefiere delivery si ambos servicios están abiertos', () => {
    expect(preferredCheckoutService(true, true)).toBe('delivery');
    expect(resolveCheckoutServiceChoice({current:'pickup',reset:true,deliveryAvailable:true,pickupAvailable:true})).toBe('delivery');
  });
  it('elige retiro por defecto si delivery está cerrado o pausado', () => {
    expect(preferredCheckoutService(false, true)).toBe('pickup');
    expect(resolveCheckoutServiceChoice({current:'delivery',deliveryAvailable:false,pickupAvailable:true})).toBe('pickup');
  });
  it('elige delivery si retiro no está disponible', () => {
    expect(preferredCheckoutService(true, false)).toBe('delivery');
  });
  it('respeta el retiro elegido manualmente mientras siga disponible', () => {
    expect(resolveCheckoutServiceChoice({current:'pickup',manual:true,deliveryAvailable:true,pickupAvailable:true})).toBe('pickup');
  });
  it('cambia al otro servicio si el seleccionado queda fuera de horario en vivo', () => {
    expect(resolveCheckoutServiceChoice({current:'pickup',manual:true,deliveryAvailable:true,pickupAvailable:false})).toBe('delivery');
    expect(resolveCheckoutServiceChoice({current:'delivery',manual:true,deliveryAvailable:false,pickupAvailable:true})).toBe('pickup');
  });
  it('vuelve al delivery predeterminado cuando se reabre sin elección manual', () => {
    expect(resolveCheckoutServiceChoice({current:'pickup',manual:false,deliveryAvailable:true,pickupAvailable:true})).toBe('delivery');
  });
  it('si ambos servicios están cerrados, no ofrece un servicio ficticio', () => {
    expect(resolveCheckoutServiceChoice({current:'pickup',deliveryAvailable:false,pickupAvailable:false})).toBe('delivery');
  });
});
