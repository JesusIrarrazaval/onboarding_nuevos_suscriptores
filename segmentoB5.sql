-- Usuarios con plan digital sin club (día 5)

SELECT
  LOWER(TRIM(c.email)) AS email,
  CASE u.nombre
    WHEN '' THEN ''
    ELSE CONCAT(INITCAP(u.nombre), '; ')
  END AS nombre
FROM sistema.contacto AS c
JOIN sistema.usuario AS u
  ON c.usuario_id = u.id
JOIN sistema.lineas_producto AS l
  ON c.usuario_id = l.usuario_entrega_id
JOIN sistema.ordenes AS o
  ON l.orden_id = o.id
WHERE c.email NOT LIKE ''
AND c.email LIKE '%@%'
AND c.activo = 'Y'
AND c.predeterminado = 'Y'
AND c.tipo = '03'
AND u.tipo_persona IN ('N', 'M')
AND l.producto LIKE '%PRODUCTO_MARCA%'
AND o.estado = 'CO'
AND DATE(o.fecha_activacion) = current_date - INTEGER '5'
AND o.status = 'ACTIVO'
AND o.tipo_pedido IN ('NUEVO', 'RENOVACION')
AND o.tipo_suscripcion NOT IN ('UNIV')
AND LOWER(TRIM(c.email)) NOT IN (
  SELECT DISTINCT(destination) AS email
  FROM sistema.email_hardbounce
)
AND l.codigo_producto != 'PLAN_DIGITAL_SIN_CLUB'
GROUP BY LOWER(TRIM(c.email)), u.nombre;
