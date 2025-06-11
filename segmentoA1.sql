-- Usuarios nuevos del día anterior

SELECT
  LOWER(TRIM(c.email)) AS email,
  CASE s.nombre
    WHEN '' THEN ''
    ELSE CONCAT(INITCAP(s.nombre), '; ')
  END AS nombre
FROM sistema.contacto AS c
JOIN sistema.usuario AS s
  ON c.usuario_id = s.id
JOIN sistema.lineas_producto AS l
  ON c.usuario_id = l.usuario_entrega_id
JOIN sistema.ordenes AS o
  ON l.orden_id = o.id
WHERE c.email NOT LIKE ''
AND c.email LIKE '%@%'
AND c.activo = 'Y'
AND c.predeterminado = 'Y'
AND c.tipo = '03'
AND s.tipo_persona IN ('N', 'M')
AND l.producto LIKE '%PRODUCTO_MARCA%'
AND o.estado = 'CO'
AND DATE(o.fecha_activacion) = current_date - INTEGER '1'
AND o.status = 'ACTIVO'
AND o.tipo_pedido IN ('NUEVO', 'RENOVACION')
AND o.tipo_suscripcion NOT IN ('FIDE', 'UNIV', 'CORTESIA')
AND LOWER(TRIM(c.email)) NOT IN (
  SELECT DISTINCT(destination) AS email
  FROM sistema.email_hardbounce
)
GROUP BY LOWER(TRIM(c.email)), s.nombre;