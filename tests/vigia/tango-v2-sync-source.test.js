import { describe, expect, it } from 'vitest';
import { mapTangoApiV2SaleToSyncRow, mergeTangoApiV2RowsWithLegacyRows } from '../../src/backend/services/tangoV2SyncMapper.js';

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
});
