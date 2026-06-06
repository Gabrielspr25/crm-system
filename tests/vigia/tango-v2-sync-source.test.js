import { describe, expect, it } from 'vitest';
import {
  buildTangoCommissionPendingSale,
  classifyTangoVentaTipo,
  classifyPymesAutocreateVentaTipo,
  isAllowedPymesCommissionVentaTipo,
  isPymesAutocreateVentaTipo,
  mapTangoApiV2SaleToSyncRow,
  mergeTangoApiV2RowsWithLegacyRows,
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

  it('mantiene V2 como fuente principal y solo completa con legacy cuando falta', () => {
    const legacyRows = [
      {
        ventaid: '79989',
        ban: '845452959',
        phone: '9392454780',
        plan_code: 'BREDP4',
        ventatipoid: '139',
        mensualidad: '30.00',
        com_empresa: '148.50',
        com_vendedor: '0.00',
        fechaactivacion: '2026-05-05T00:00:00.000Z',
        cliente: 'CARIBE TRACK',
        vendedor: 'Gabriel Sanchez',
      },
    ];
    const apiRows = [
      {
        ventaid: 79989,
        ban: '845452959',
        numerocelularactivado: 9392454780,
        codigovoz: 'BREDP4',
        ventatipo: { id: 139, nombre: 'PYMES Update NEW' },
        fechaactivacion: '2026-05-05T00:00:00.000Z',
        pagomensual: 30,
        cliente: { nombre: 'CARIBE TRACK' },
        vendedor: { id: 66, nombre: 'Gabriel' },
      },
      {
        ventaid: 80036,
        ban: '809070837',
        numerocelularactivado: 7873798351,
        codigovoz: 'BREDP1',
        ventatipo: { id: 138, nombre: 'PYMES Update REN' },
        fechaactivacion: '2026-05-22T00:00:00.000Z',
        pagomensual: 65,
        cliente: { nombre: 'GRUPO CLINICO DEL NOR' },
        vendedor: { id: 66, nombre: 'Gabriel' },
      },
    ];

    const merged = mergeTangoApiV2RowsWithLegacyRows({ apiRows, legacyRows, commissionsById: new Map() });

    expect(merged.map((row) => Number(row.ventaid))).toEqual([79989, 80036]);
    expect(merged.find((row) => Number(row.ventaid) === 79989)).toMatchObject({
      source_priority: 'api_v2',
      com_empresa: 148.5,
    });
    expect(merged.find((row) => Number(row.ventaid) === 80036)).toMatchObject({
      source_priority: 'api_v2',
      ban: '809070837',
    });
  });

  it('incluye ventas V2-only de GRUPO CLINICO y conserva CARIBE TRACK de mayo 2026', () => {
    const legacyRows = [
      {
        ventaid: '79989',
        ban: '845452959',
        phone: '9392454780',
        plan_code: 'BREDP4',
        ventatipoid: '139',
        mensualidad: '30.00',
        com_empresa: '148.50',
        com_vendedor: '0.00',
        fechaactivacion: '2026-05-05T00:00:00.000Z',
        cliente: 'CARIBE TRACK',
        vendedor: 'Gabriel Sanchez',
      },
    ];
    const apiRows = [
      {
        ventaid: 79989,
        ban: '845452959',
        numerocelularactivado: 9392454780,
        codigovoz: 'BREDP4',
        ventatipoid: 139,
        fechaactivacion: '2026-05-05T00:00:00.000Z',
        pagomensual: 30,
        cliente: { nombre: 'CARIBE TRACK' },
        vendedor: { id: 66, nombre: 'Gabriel' },
      },
      ...[80036, 80037, 80038, 80041].map((ventaid, index) => ({
        ventaid,
        ban: '809070837',
        numerocelularactivado: `78737983${51 + index}`,
        codigovoz: 'BREDP1',
        ventatipoid: 138,
        fechaactivacion: '2026-05-22T00:00:00.000Z',
        pagomensual: 65,
        cliente: { nombre: 'GRUPO CLINICO DEL NOR' },
        vendedor: { id: 66, nombre: 'Gabriel' },
      })),
    ];
    const commissionsById = new Map(
      [80036, 80037, 80038, 80041].map((ventaid) => [
        ventaid,
        {
          ventaid,
          comisiones: {
            comisionclaro: 156.2,
            comisionvendedor: 0,
            bonoportabilidad: 0,
          },
        },
      ])
    );

    const merged = mergeTangoApiV2RowsWithLegacyRows({ apiRows, legacyRows, commissionsById });
    const ventaIds = merged.map((row) => Number(row.ventaid));

    expect(ventaIds).toEqual([79989, 80036, 80037, 80038, 80041]);
    expect(merged.filter((row) => row.ban === '809070837')).toHaveLength(4);
    expect(merged.filter((row) => row.cliente === 'GRUPO CLINICO DEL NOR').map((row) => Number(row.ventaid))).toEqual([
      80036,
      80037,
      80038,
      80041,
    ]);
    expect(merged.find((row) => Number(row.ventaid) === 79989)).toMatchObject({
      source_priority: 'api_v2',
      cliente: 'CARIBE TRACK',
      ban: '845452959',
    });
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
      [80087, 25, 'Claro Update NEW', 'movil', 'NEW', true],
      [80099, 26, 'Claro Update REN', 'movil', 'REN', true],
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

  it('limita autocreate PYMES a los IDs aprobados', () => {
    const allowed = [8, 25, 26, 138, 139, 140, 141];
    const blocked = [20, 60, 121, 142, 999];

    for (const id of allowed) {
      expect(isPymesAutocreateVentaTipo(id)).toBe(true);
      expect(classifyPymesAutocreateVentaTipo(id)).toMatchObject({ negocio: 'PYMES' });
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
  });
});
