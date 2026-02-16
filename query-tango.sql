SELECT TO_CHAR(v.fechaactivacion, 'YYYY-MM') as mes,
       v.ban,
       COALESCE(cc.nombre, 'SIN NOMBRE') as cliente,
       TO_CHAR(v.fechaactivacion, 'DD/MM/YYYY') as fecha,
       vt.nombre as tipo,
       v.status as linea,
       COALESCE(v.comisionclaro,0) as com_empresa,
       COALESCE(v.comisionvendedor,0) as com_vendedor
FROM venta v
JOIN ventatipo vt ON vt.ventatipoid=v.ventatipoid
LEFT JOIN clientecredito cc ON cc.clientecreditoid=v.clientecreditoid
LEFT JOIN vendedor vd ON vd.vendedorid=v.vendedorid
WHERE v.ventatipoid IN (138,139,140,141) AND v.activo=true
ORDER BY v.fechaactivacion DESC, cc.nombre;
