import { describe, expect, it } from 'vitest';
import { applySubscriberSummariesWithoutDuplicatingSavedValues } from '../../src/backend/controllers/sov2Controller.js';

function emptyOpportunity() {
  return {
    id: 'opp-1',
    products: {
      fijo_ren: { money_value: 0, quantity_value: 0 },
      fijo_new: { money_value: 0, quantity_value: 0 },
      movil_ren: { money_value: 0, quantity_value: 4 },
      movil_new: { money_value: 0, quantity_value: 0 },
      claro_tv: { money_value: 0, quantity_value: 0 },
      cloud: { money_value: 0, quantity_value: 0 },
      mpls: { money_value: 0, quantity_value: 0 },
    },
  };
}

describe('SOV2 subscriber summaries', () => {
  it('no duplica lineas activas como movil new si la oportunidad ya trae movil ren', () => {
    const opportunity = emptyOpportunity();
    const summaries = new Map([
      ['opp-1:movil_new', {
        quantity_value: 4,
        money_value: 0,
        banIds: new Set(['ban-1']),
        subscriberIds: new Set(['s1', 's2', 's3', 's4']),
      }],
    ]);

    applySubscriberSummariesWithoutDuplicatingSavedValues(opportunity, summaries);

    expect(opportunity.products.movil_ren.quantity_value).toBe(4);
    expect(opportunity.products.movil_new.quantity_value).toBe(0);
  });

  it('permite contar movil new cuando la oportunidad lo trae guardado', () => {
    const opportunity = emptyOpportunity();
    opportunity.products.movil_new.quantity_value = 2;
    const summaries = new Map([
      ['opp-1:movil_new', {
        quantity_value: 4,
        money_value: 0,
        banIds: new Set(['ban-1']),
        subscriberIds: new Set(['s1', 's2', 's3', 's4']),
      }],
    ]);

    applySubscriberSummariesWithoutDuplicatingSavedValues(opportunity, summaries);

    expect(opportunity.products.movil_ren.quantity_value).toBe(4);
    expect(opportunity.products.movil_new.quantity_value).toBe(2);
  });

  it('corrige fijo guardado como cantidad cuando el resumen trae el monto real', () => {
    const opportunity = emptyOpportunity();
    opportunity.products.fijo_new.money_value = 2;
    const summaries = new Map([
      ['opp-1:fijo_new', {
        quantity_value: 2,
        money_value: 69.98,
        banIds: new Set(['ban-1']),
        subscriberIds: new Set(['s1', 's2']),
      }],
    ]);

    applySubscriberSummariesWithoutDuplicatingSavedValues(opportunity, summaries);

    expect(opportunity.products.fijo_new.money_value).toBe(69.98);
  });
});
