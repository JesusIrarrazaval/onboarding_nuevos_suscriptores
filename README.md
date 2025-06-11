# Descripción 
Esta automatización gestiona el envío de correos de bienvenida para nuevos suscriptores. A diferencia de un envío masivo genérico, el sistema identifica y segmenta dinámicamente a los usuarios según el tipo de producto contratado (plan A, plan B, plan C, etc.) y la fecha de activación de su suscripción. Cada grupo recibe mensajes personalizados en distintos momentos, lo que asegura una experiencia progresiva y relevante para el usuario.

# Instrucciones de uso
1. Instalar dependencias del proyecto (bash):
   npm install

2. Instalar nodemon de forma global (si no está instalado):
    npm install -g nodemon

3. Ejecutar el script principal:
    nodemon main.js

**Nota:** Dentro de main.js, las constantes ENABLE_LOGS e IS_TEST_MODE deben establecerse en true solo durante las pruebas. Para producción, ambas deben quedar en false, lo que permite mantener los logs del contenedor Docker limpios y evitar ejecuciones de prueba.

# Estructura .env
## Redshift
DB_HOST=xxxx
DB_PORT=xxxx
DB_NAME=xxxx
DB_USER=xxxx
DB_PASSWORD=xxxx

## AWS
AWS_ACCESS_KEY_ID=xxxx
AWS_SECRET_ACCESS_KEY=xxxx
AWS_REGION=us-east-1
rolPinpoint=arn:aws:iam::XXXXXXXXXXXXX:role/pinpointSegmentImport

# Instrucciones para trabajar con git
- Nos posicionamos en la rama principal o desde la rama que queremos comenzar a trabajar `git checkout master`
- Traemos los cambios `git pull origin master`
- Creamos una rama para trabajar en los cambios que vamos a proponer: `git checkout -b <nombre-de-la-rama>`
- Realizamos los cambios necesarios
- Añadimos los cambios `git add .`
- Hacemos commit `git commit -m "YYYY-MM-DD Descripción de los cambios realizados"`
- Publicamos la rama en el repositorio en GitHub `git push -u origin <nombre-de-la-rama>`
- Crear una pull request en GitHub desde la rama nueva a la rama principal del repositorio.

# Checklist de tareas

Este listado permite garantizar la correcta ejecución del proceso, ya sea en entorno de pruebas o en producción:

### Preparación antes de realizar cambios

- [ ] Confirmar que estás en la rama correcta (main o la rama base correspondiente).
- [ ] Hacer un **pull** de la última versión del repositorio antes de realizar cambios.
- [ ] Crear una nueva rama (git checkout -b <nombre-de-la-rama>) para trabajar en los cambios de forma segura.

### Verificación de configuración antes de pruebas

- [ ] Asegurar que las constantes `IS_TEST_MODE` y `ENABLE_LOGS` estén en true para entorno de pruebas.
- [ ] Revisar que el archivo `.env` esté correctamente configurado con credenciales genéricas (o simuladas).
- [ ] Verificar que las queries utilizadas correspondan a segmentos de prueba, si se están haciendo pruebas controladas.
- [ ] Confirmar que los archivos SQL usados por los segmentos están presentes y sin errores de sintaxis.
- [ ] Verificar que la tabla `sistema.segmentos_test` esté actualizada respecto a la tabla original para evitar problemas de testeo ante la creación de nuevos newsletters.

### Revisión del código antes de la ejecución

- [ ] Verificar que no se han dejado líneas comentadas innecesarias o código de pruebas residuales.
- [ ] Confirmar que sólo los segmentos deseados están activos para evitar envíos no deseados.
- [ ] Revisar que los templates usados estén correctamente definidos en Pinpoint. 
- [ ] Confirmar que el nombre de la automatización en la tabla `automatizaciones.registro_automatizaciones` no se modificó accidentalmente.
- [ ] Validar que los usuarios de prueba (**usuariosTest**) están definidos correctamente en el entorno de test.

### Fase de pruebas

- [ ] Confirmar que los usuarios se están obteniendo correctamente desde Redshift.
- [ ] Validar que los CSV se están generando con contenido correcto.
- [ ] Asegurar que los segmentos se están cargando correctamente en S3.
- [ ] Confirmar que el job de importación a Pinpoint se completa sin errores.
- [ ] Verificar que no se actualice la tabla `registro_automatizaciones` durante pruebas.

### Ejecución en *modo producción*

- [ ] Asegurar que `IS_TEST_MODE` y `ENABLE_LOGS` estén en false.
- [ ] Validar que los datos en Redshift son correctos para el día de ejecución.
- [ ] Verificar que los segmentos en Pinpoint se actualizan con la dimensión `incluirEnEnvio` del día.
- [ ] Confirmar que las campañas se reprograman correctamente para el mismo día o próximos días.
- [ ] Validar que la tabla `automatizaciones.registro_automatizaciones` se actualiza correctamente.
- [ ] Verificar que los archivos temporales en S3 se eliminan correctamente tras la importación.

### Flujo de trabajo con Git

- [ ] Revisar los cambios realizados antes de hacer commit (`git diff`, `Source Control`).
- [ ] Confirmar que .env y archivos sensibles estén correctamente listados en `.gitignore`.
- [ ] Validar que las dependencias estén al día si se ha instalado algo nuevo (`npm install`, `package.json`).
- [ ] Añadir los cambios `git add .`.
- [ ] Hacer commit con mensaje claro `git commit -m "YYYY-MM-DD Descripción de los cambios realizados"`.
- [ ] Subir la rama al repositorio remoto `git push -u origin <nombre-de-la-rama>`.
- [ ] Crear una pull request en GitHub desde la nueva rama hacia `main` (u otra rama base).