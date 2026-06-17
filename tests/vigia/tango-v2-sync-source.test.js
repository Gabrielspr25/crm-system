import { describe, expect, it } from 'vitest';
import {
  buildTangoCommissionPendingSale,
  classifyTangoVentaTipo,
  classifyPymesAutocreateVentaTipo,
  isAllowedPymesCommissionVentaTipo,
  isPymesAutocreateVentaTipo,
  mapTangoApiV2SaleToSyncRow,
  shouldIncludeTangoV2SaleForCommissions,
} from '../../src/backend/services/tangoV2SyncMapper.js';

describe('Tango V2 sync source', () => {
  it('convierte una venta V2-only al formato principal del sync', () => {
    const sale = {
      ventaid: 80036,
      ban: '809070837',
      numerocelularactivado: 7873798351,
      codigovoz: 'BREDP1',
      meses: 30,
      fechaactivacion: '2026-05-22T00:00:00.000Z',
      pagomensual: 65,
      plan: { rate: 65 },
      ventatipo: { id: 138, nombre: 'PYMES Update REN' },
      cliente: { nombre: 'GRUPO CLINICO DEL NOR' },
      vendedor: { id: 66, nombre: 'Gabriel' },
    };
    const commission = {
      ventaid: 80036,
      comisiones: {
        comisionclaro: 156.2,
        comisionvendedor: 0,
        bonoportabilidad: 0,
      },
    };

    expect(mapTangoApiV2SaleToSyncRow(sale, commission)).toMatchObject({
      ventaid: 80036,
      ban: '809070837',
      phone: '7873798351',
      plan_code: 'BREDP1',
      meses: 30,
      ventatipoid: 138,
      mensualidad: 65,
      com_empresa: 156.2,
      com_vendedor: 0,
      portability_bonus: 0,
      fechaactivacion: '2026-05-22T00:00:00.000Z',
      tango_vendor_id: 66,
      cliente: 'GRUPO CLINICO DEL NOR',
      vendedor: 'Gabriel',
      source_priority: 'api_v2',
    });
  });

  // Regresion: el sync (runTangoSync) mapea cada venta y luego filtra con
  // shouldIncludeTangoV2SaleForCommissions(row, row). El row mapeado DEBE
  // conservar ventatipo_nombre, porque el filtro decide la inclusion por el
  // nombre del tipo. Si el row pierde el nombre, TODAS las ventas se excluyen
  // y el sync trae 0 ventas / 0 reportes (bug del badge "V2: 0 ventas").
  it('el row mapeado conserva ventatipo_nombre para que el filtro PyMES funcione', () => {
    const sale = {
      ventaid: 80124,
      ban: '836838649',
      ventatipo: { id: 140, nombre: 'PYMES Fijo REN' },
      fechaactivacion: '2026-06-15T00:00:00.000Z',
      pagomensual: 64.99,
      cliente: { nombre: 'TOMAS JAVARIZ' },
      vendedor: { id: 300, nombre: 'Dayana' },
    };
    const commission = { ventaid: 80124, comisiones: { comisionclaro: 577.47, total: 577.47 } };

    const mapped = mapTangoApiV2SaleToSyncRow(sale, commission);

    // El nombre del tipo debe sobrevivir al mapeo.
    expect(mapped.ventatipoid).toBe(140);
    expect(mapped.ventatipo_nombre).toBe('PYMES Fijo REN');

    // Exactamente como lo invoca runTangoSync: filter(row => shouldInclude(row, row)).
    expect(shouldIncludeTangoV2SaleForCommissions(mapped, mapped)).toBe(true);
  });

  it('una tanda de ventas PyMES reales no se vacia al pasar por map + filter del sync', () => {
    const sales = [
      { ventaid: 1, ventatipo: { id: 139, nombre: 'PYMES Update NEW' }, ban: '1', comisiones: { total: 170 } },
      { ventaid: 2, ventatipo: { id: 140, nombre: 'PYMES Fijo REN' }, ban: '2', comisiones: { total: 577.47 } },
      { ventaid: 3, ventatipo: { id: 8, nombre: 'BA CORP NEW' }, ban: '3', comisiones: { total: 59.99 } },
      // Estas NO deben entrar:
      { ventaid: 4, ventatipo: { id: 26, nombre: 'Claro Update REN' }, ban: '4', comisiones: { total: 109 } },
      { ventaid: 5, ventatipo: { id: 20, nombre: 'BYOP Prepaid' }, ban: '5', comisiones: { total: 15.6 } },
    ];

    const v2Rows = sales
      .map((sale) => mapTangoApiV2SaleToSyncRow(sale, sale))
      .filter((row) => shouldIncludeTangoV2SaleForCommissions(row, row));

    expect(v2Rows.map((r) => r.ventaid)).toEqual([1, 2, 3]);
  });

  it('usa comisiones.total como ganancia oficial cuando Tango V2 trae desglose', () => {
    const sale = {
      ventaid: 80099,
      ban: '718772139',
      numerocelularactivado: 7873275935,
      codigovoz: 'RED3535',
      meses: 30,
      fechaactivacion: '2026-06-05T00:00:00.000Z',
      pagomensual: 35,
      ventatipo: { id: 26, nombre: 'Claro Update REN' },
      cliente: { nombre: 'SONIA ', apellido: 'ARROYO' },
      vendedor: { id: 297, nombre: 'Mayda Salas' },
    };
    const commission = {
      ventaid: 80099,
      comisiones: {
        comisionclaro: 109,
        features: 31.98,
        comisionvendedor: 0,
        total: 140.98,
      },
      desglose: [
        { tipo: 'comision_claro', monto: 109 },
        { tipo: 'features', monto: 31.98 },
      ],
    };

    expect(mapTangoApiV2SaleToSyncRow(sale, commission)).toMatchObject({
      ventaid: 80099,
      ventatipoid: 26,
      com_empresa: 140.98,
      cliente: 'SONIA ARROYO',
      vendedor: 'Mayda Salas',
    });
  });

  it('solo incluye tipos PyMES aunque otros tipos traigan comision real', () => {
    const confirmedTypes = [
      [80087, 25, 'Claro Update NEW', 'movil', 'NEW', false],
      [80099, 26, 'Claro Update REN', 'movil', 'REN', false],
      [80087, 25, 'Corp Update New', 'movil', 'NEW', true],
      [80099, 26, 'Corp Update Ren', 'movil', 'REN', true],
      [80090, 8, 'BA CORP NEW', 'fijo', 'NEW', true],
      [80047, 121, '2 Play', 'fijo', 'NEW', false],
      [80003, 142, 'Claro TV - Servicio', 'tv', 'NEW', false],
    ];

    for (const [ventaid, id, nombre, family, lineType, shouldInclude] of confirmedTypes) {
      const sale = {
        ventaid,
        ventatipo: { id, nombre },
      };
      const commission = {
        ventaid,
        comisiones: { total: 100, comisionclaro: 80 },
      };

      expect(shouldIncludeTangoV2SaleForCommissions(sale, commission)).toBe(shouldInclude);
      expect(classifyTangoVentaTipo(id, nombre)).toMatchObject({ family, lineType });
    }
  });

  it('construye pending sale needs_review cuando falta BAN CRM pero existe comision real', () => {
    const sale = {
      ventaid: 80099,
      ban: '718772139',
      numerocelularactivado: 7873275935,
      ventatipo: { id: 26, nombre: 'Claro Update REN' },
      fechaactivacion: '2026-06-05T00:00:00.000Z',
      cliente: { nombre: 'SONIA', apellido: 'ARROYO' },
    };
    const commission = {
      ventaid: 80099,
      comisiones: {
        comisionvendedor: 0,
        total: 140.98,
      },
    };

    expect(buildTangoCommissionPendingSale(sale, commission, 'ban_no_existe_en_crm')).toMatchObject({
      ventaid: 80099,
      ban_tango: '718772139',
      cliente_tango: 'SONIA ARROYO',
      telefono_tango: '7873275935',
      ventatipo_id: 26,
      ventatipo_nombre: 'Claro Update REN',
      fecha_activacion: '2026-06-05',
      company_earnings: 140.98,
      vendor_commission: 0,
      motivo: 'ban_no_existe_en_crm',
      status: 'needs_review',
    });
  });

  it('limita autocreate PYMES a los nombres oficiales aprobados', () => {
    const allowed = [
      [8, 'BA CORP NEW'],
      [25, 'Corp Update New'],
      [26, 'Corp Update Ren'],
      [138, 'PYMES Update REN'],
      [139, 'PYMES Update NEW'],
      [140, 'PYMES Fijo REN'],
      [141, 'PYMES Fijo NEW'],
    ];
    const blockedByName = [
      [25, 'Claro Update NEW'],
      [26, 'Claro Update REN'],
    ];
    const blocked = [20, 60, 121, 142, 999];

    for (const [id, name] of allowed) {
      expect(isPymesAutocreateVentaTipo(id, name)).toBe(true);
      expect(classifyPymesAutocreateVentaTipo(id, name)).toMatchObject({ negocio: 'PYMES' });
    }

    for (const [id, name] of blockedByName) {
      expect(isPymesAutocreateVentaTipo(id, name)).toBe(false);
      expect(classifyPymesAutocreateVentaTipo(id, name)).toBeNull();
    }

    for (const id of blocked) {
      expect(isPymesAutocreateVentaTipo(id)).toBe(false);
      expect(classifyPymesAutocreateVentaTipo(id)).toBeNull();
    }
  });

  it('excluye BYOP/Prepago aunque Tango traiga comision real', () => {
    const sale = {
      ventaid: 80100,
      ban: '851113612',
      ventatipo: { id: 20, nombre: 'BYOP Prepaid' },
    };
    const commission = {
      ventaid: 80100,
      comisiones: {
        comisionclaro: 15.6,
        comisionvendedor: 0,
      },
    };

    expect(shouldIncludeTangoV2SaleForCommissions(sale, commission)).toBe(false);
  });

  it('acepta los 12 nombres oficiales PyMES y rechaza tipos fuera del negocio', () => {
    const allowedNames = [
      'BA CORP NEW',
      'BA CORP REN',
      'Cloud Negocios',
      'Corp Update New',
      'Corp Update Ren',
      'Office 365 Negocios',
      'PYMES Fijo NEW',
      'PYMES Fijo REN',
      'PYMES Update NEW',
      'PYMES Update REN',
      'Telemetria NEW',
      'Telemetria REN',
    ];

    for (const name of allowedNames) {
      expect(isAllowedPymesCommissionVentaTipo(null, name)).toBe(true);
    }

    for (const name of ['BYOP Prepaid', 'Accesorios', 'Claro TV - Servicio', '2 Play']) {
      expect(isAllowedPymesCommissionVentaTipo(null, name)).toBe(false);
    }

    expect(isAllowedPymesCommissionVentaTipo(25, 'Claro Update NEW')).toBe(false);
    expect(isAllowedPymesCommissionVentaTipo(26, 'Claro Update REN')).toBe(false);
  });
});
