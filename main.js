
import pgpkg from 'pg';
const { Client } = pgpkg;
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { PinpointClient, CreateImportJobCommand, GetImportJobCommand, UpdateSegmentCommand, UpdateCampaignCommand } from '@aws-sdk/client-pinpoint';
import moment from 'moment';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();
import * as csv from 'csv';
import md5 from 'md5';

const ENABLE_LOGS = true;
const IS_TEST_MODE = false;
const SEGMENT_WAIT_SECONDS = 60; // segundos de espera entre cada segmento
const RETRY_WAIT_MS = 1000 * 60 * 1;
const ERROR_RESTART_MINUTES = 30;
const MAX_ATTEMPTS = ENABLE_LOGS ? 1 : 5;

const segmentos = [
  {
    nombre: '1 de 7 segmentoA',
    idProyecto: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    idSegmento: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    idCampana: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    template: 'plantilla_segmentoA',
    query: 'segmentoA1.sql'
  },
  {
    nombre: '1 de 7 segmentoB',
    idProyecto: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    idSegmento: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    idCampana: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    template: 'plantilla_segmentoB1',
    query: 'segmentoB1.sql'
  },
  {
    nombre: '2 de 7 segmentoB (tipo 1)',
    idProyecto: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    idSegmento: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    idCampana: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    template: 'plantilla_segmentoB2_tipo1',
    query: 'segmentoB2a.sql'
  },
  {
    nombre: '2 de 7 segmentoB (tipo 2)',
    idProyecto: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    idSegmento: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    idCampana: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    template: 'plantilla_segmentoB2_tipo2',
    query: 'segmentoB2b.sql'
  },
  {
    nombre: '2 de 7 segmentoB (tipo 3)',
    idProyecto: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    idSegmento: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    idCampana: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    template: 'plantilla_segmentoB2_tipo3',
    query: 'segmentoB2c.sql'
  },
  {
    nombre: '3 de 7 segmentoB',
    idProyecto: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    idSegmento: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    idCampana: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    template: 'plantilla_segmentoB3',
    query: 'segmentoB3.sql'
  },
  {
    nombre: '4 de 7 segmentoB',
    idProyecto: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    idSegmento: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    idCampana: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    template: 'plantilla_segmentoB4',
    query: 'segmentoB4.sql'
  },
  {
    nombre: '5 de 7 segmentoB (condición especial)',
    idProyecto: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    idSegmento: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    idCampana: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    template: 'plantilla_segmentoB5',
    query: 'segmentoB5.sql'
  },
  {
    nombre: '6 de 7 segmentoB',
    idProyecto: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    idSegmento: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    idCampana: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    template: 'plantilla_segmentoB6',
    query: 'segmentoB6.sql'
  },
  {
    nombre: '7 de 7 segmentoB',
    idProyecto: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    idSegmento: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    idCampana: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    template: 'plantilla_segmentoB7',
    query: 'segmentoB7.sql'
  }
];

const usuariosTest = [
  { email: 'usuario@emaildeprueba.cl', nombre: 'Usuario Test' },
]

const s3 = new S3Client({
  AWS_REGION: process.env.AWS_REGION,
  credentials: {
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  },
});


const pinpoint = new PinpointClient({
  AWS_REGION: process.env.AWS_REGION,
  credentials: {
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

moment.suppressDeprecationWarnings = true;

const tiempoTranscurrido = (tiempoInicial) => {
  const tiempoFinal = moment().utc();
  const diferencia = tiempoFinal.diff(tiempoInicial);
  let tiempoTranscurrido = moment.utc(diferencia).format('HH:mm:ss');
  if (tiempoTranscurrido === '00:00:00') tiempoTranscurrido = moment.utc(diferencia).format('HH:mm:ss.SSS');
  return tiempoTranscurrido;
};

const mensaje = (texto) => {
  if (ENABLE_LOGS) console.log(texto);
}

const wait = async (segundos) => {
  return new Promise(resolve => {
      let restante = segundos;
      const interval = setInterval(() => {
          process.stdout.write(`\r⌛ Esperando ${restante}s antes del siguiente segmento...`);
          restante--;
          if (restante < 0) {
              clearInterval(interval);
              process.stdout.write('\r✅ Espera finalizada                       \n');
              resolve();
          }
      }, 1000);
  });
};

/* Fin funciones reutilizables */

/* Funciones Waterfall */
const conexionRedshift = async () => {
  mensaje('==> Conectándose a Redshift');
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
  const client = new Client({
      DB_HOST,
      DB_PORT,
      DB_NAME,
      DB_USER,
      DB_PASSWORD,
      query_timeout: 120000,
      connectionTimeoutMillis: 180000
  });
  await client.connect();
  return client;
};

const confirmarActualizacionAdempiere = async (client) => {
  const tabla = 'automatizaciones.registro_automatizaciones';
  const nombre = 'Adempiere';

  mensaje('==> Confirmando actualización Adempiere');
  for (let intento = 0; intento < MAX_ATTEMPTS; intento++) {
      try {
          const res = await client.query(
              `SELECT ultima_actualizacion FROM ${tabla} WHERE nombre = $1`,
              [nombre]
          );
          if (res.rows[0] && moment(res.rows[0].ultima_actualizacion).isSame(moment(), 'day')) return;
          throw new Error('Adempiere pendiente');
      } catch (err) {
          if (intento < MAX_ATTEMPTS - 1) {
              await wait(RETRY_WAIT_MS / 1000);
          } else {
              throw err;
          }
      }
  }
};

const confirmarActualizacionBienvenida = async (client) => {
  mensaje('==> Confirmando actualización bienvenida');
  if (IS_TEST_MODE) return;
  for (let intento = 0; intento < MAX_ATTEMPTS; intento++) {
      try {
          const res = await client.query(`SELECT ultima_actualizacion FROM automatizaciones.registro_automatizaciones WHERE nombre = 'Bienvenida nuevos clientes [Marca]'`);
          if (res.rows.length === 0) return;
          if (moment(res.rows[0].ultima_actualizacion).isSame(moment(), 'day')) throw new Error('La automatización ya fue ejecutada hoy');
          return;
      } catch (err) {
          if (intento < MAX_ATTEMPTS - 1) {
              await wait(RETRY_WAIT_MS / 1000);
          } else {
              throw err;
          }
      }
  }
};

const obtenerSuscriptoresNuevos = async (client, segmento) => {
  mensaje(`==> Obtener suscriptores nuevos: ${segmento.nombre}`);
  segmento.incluirEnEnvio = md5(`${diaInicioScript}|${segmento.nombre}`);

  for (let intento = 0; intento < MAX_ATTEMPTS; intento++) {
    try {
      const fileContent = fs.readFileSync(`./${segmento.query}`, 'utf-8');
      const res = await client.query(fileContent);

      if (!res.rows || res.rows.length === 0) {
        console.warn(`⚠️ Segmento vacío: ${segmento.nombre}. Usando usuarios de prueba.`);
        segmento.usuarios = usuariosTest.map(u => ({
          email: u.email?.trim()?.toLowerCase() || '',
          nombre: u.nombre || ''
        }));
      } else {
        segmento.usuarios = res.rows;
      }

      mensaje(`✅ ${segmento.nombre}: ${segmento.usuarios.length} usuarios.`);
      return;

    } catch (err) {
      if (intento < MAX_ATTEMPTS - 1) {
        await wait(RETRY_WAIT_MS / 1000);
      } else {
        throw err;
      }
    }
  }
};

const cargarSegmentoEnS3 = async (segmento) => {
  mensaje(`==> Cargando en S3: ${segmento.nombre}`);

  if (!segmento.usuarios || segmento.usuarios.length === 0) {
    mensaje(`⚠️ No hay usuarios para ${segmento.nombre}, no se sube a S3`);
    return;
  }

  mensaje(`📨 Usuarios recibidos para ${segmento.nombre}: ${segmento.usuarios.length}`);

  const usuariosFormateados = segmento.usuarios.map(u => ({
    ChannelType: 'EMAIL',
    Address: u.email?.trim()?.toLowerCase() || '',
    OptOut: 'NONE',
    'Attributes.md5': md5(u.email?.trim()?.toLowerCase() || ''),
    'Attributes.nombre': u.nombre ? u.nombre.trim() : '',
    'Attributes.incluirEnEnvio': segmento.incluirEnEnvio
  }));

  mensaje(`📤 Usuarios formateados: ${usuariosFormateados.length}`);

  const csvContent = await new Promise((resolve, reject) => {
    csv.stringify(
      usuariosFormateados,
      { header: true, quoted: true, quoted_empty: true, quoted_string: true },
      (err, output) => err ? reject(err) : resolve(output)
    );
  });

  // Logs de depuración
  console.log(`🧪 Preview CSV (${segmento.nombre}):\n${csvContent.slice(0, 300)}...`);
  console.log(`📏 Longitud del CSV generado: ${csvContent.length} caracteres`);

  // Asegurar carpeta ./export
  const exportFolder = './export';
  if (!fs.existsSync(exportFolder)) fs.mkdirSync(exportFolder);

  // Guardar copia local
  const localPath = `${exportFolder}/debug_${segmento.nombre}.csv`;
  fs.writeFileSync(localPath, csvContent);
  console.log(`💾 CSV guardado localmente como ${localPath}`);

  // Verificación de seguridad
  if (!csvContent || csvContent.trim().length === 0) {
    console.error(`❌ CSV generado para ${segmento.nombre} está vacío. Abortando carga.`);
    return;
  }

  await s3.send(new PutObjectCommand({
    Body: csvContent,
    Bucket: 'bucket',
    Key: `temp/bienvenida-clientes/${segmento.nombre}.csv`
  }));

  mensaje(`✅ Segmento ${segmento.nombre} cargado en S3`);
};

const importarEndpoints = async (segmento) => {
  if (!segmento.usuarios || segmento.usuarios.length === 0) return;

  const res = await pinpoint.send(new CreateImportJobCommand({
      ApplicationId: segmento.idProyecto,
      ImportJobRequest: {
          Format: 'CSV',
          RoleArn: process.env.rolPinpoint,
          S3Url: `s3://bucket/temp/bienvenida-clientes/${segmento.nombre}.csv`,
          RegisterEndpoints: true
      }
  }));

  const Id = res.ImportJobResponse.Id;

  while (true) {
      const statusRes = await pinpoint.send(new GetImportJobCommand({
          ApplicationId: segmento.idProyecto,
          JobId: Id
      }));

      if (statusRes.ImportJobResponse.JobStatus === 'COMPLETED') break;

      await wait(25); // 25 segundos
  }

  mensaje(`✅ Import job completo: ${segmento.nombre}`);

  await s3.send(new DeleteObjectCommand({
      Bucket: 'bucket',
      Key: `temp/bienvenida-clientes/${segmento.nombre}.csv`
  }));
}

const actualizarSegmentoDinamico = async (client, segmento) => {
  if (!segmento.usuarios || segmento.usuarios.length === 0) return;

  await pinpoint.send(new UpdateSegmentCommand({
      ApplicationId: segmento.idProyecto,
      SegmentId: segmento.idSegmento,
      WriteSegmentRequest: {
          Dimensions: {
              Attributes: {
                  'incluirEnEnvio': {
                      Values: [segmento.incluirEnEnvio],
                      AttributeType: 'INCLUSIVE'
                  }
              }
          },
          Name: `${segmento.nombre} ${moment().format('YYYY-MM-DD HH:mm:ss')}`
      }
  }));
}

const actualizarCampana = async (segmento) => {
  if (!segmento.usuarios || segmento.usuarios.length === 0) {
    await pinpoint.send(new UpdateCampaignCommand({
      ApplicationId: segmento.idProyecto,
      CampaignId: segmento.idCampana,
      WriteCampaignRequest: { IsPaused: true }
    }));
    if (ENABLE_LOGS) {
      console.log(`⏸️ Campaña "${segmento.nombre}" pausada (sin usuarios para enviar).`);
    }
    return;
  }

  const horaEnvio = moment().hour() >= 12
    ? moment().add(30, 'minutes')
    : moment().set({ hour: 12, minute: 0, second: 0 });

  await pinpoint.send(new UpdateCampaignCommand({
    ApplicationId: segmento.idProyecto,
    CampaignId: segmento.idCampana,
    WriteCampaignRequest: {
      IsPaused: false,
      Schedule: {
        StartTime: horaEnvio.toISOString(),
        EndTime: moment().add(2, 'months').toISOString(),
        Frequency: 'MONTHLY',
        Timezone: `UTC-0${parseInt(moment().utcOffset() / 60 * -1)}`
      },
      TemplateConfiguration: {
        EmailTemplate: { Name: segmento.template }
      },
      Name: segmento.nombre,
      SegmentId: segmento.idSegmento
    }
  }));

  if (ENABLE_LOGS) {
    console.log(`📤 Campaña "${segmento.nombre}" programada para enviarse a las ${horaEnvio.format('HH:mm:ss')} (hora local).`);
  }
};

const actualizarEstadoAutomatizacion = async (client) => {
  mensaje('==> Actualizando estado de automatización');

  const nombre = 'Bienvenida nuevos clientes [Marca]';
  const lenguaje = 'NodeJS';
  const ultima_actualizacion = moment().format();
  const tiempo_ejecucion = tiempoTranscurrido(inicioScript);
  const frecuenciaActualizacion = 'Diaria';
  const proximaActualizacion = moment().add(1, 'days').set({ hour: 5, minute: 16, second: 0, millisecond: 0 }).format();
  const comentario = '[Ver campaña en AWS Pinpoint]';

  const queryCheck = `
      SELECT * 
      FROM automatizaciones.registro_automatizaciones 
      WHERE nombre = '${nombre}'
  `;

  const queryInsert = `
      INSERT INTO automatizaciones.registro_automatizaciones 
      (nombre, lenguaje, ultima_actualizacion, tiempo_ejecucion, frecuencia_actualizacion, proxima_actualizacion, comentario) 
      VALUES (
          '${nombre}', '${lenguaje}', '${ultima_actualizacion}', 
          '${tiempo_ejecucion}', '${frecuenciaActualizacion}', 
          '${proximaActualizacion}', '${comentario}'
      )
  `;

  const queryUpdate = `
      UPDATE automatizaciones.registro_automatizaciones
      SET
          ultima_actualizacion = '${ultima_actualizacion}',
          tiempo_ejecucion = '${tiempo_ejecucion}',
          proxima_actualizacion = '${proximaActualizacion}',
          comentario = '${comentario}'
      WHERE nombre = '${nombre}'
  `;

  const res = await client.query(queryCheck);
  if (res.rows.length === 0) {
      await client.query(queryInsert);
  } else {
      await client.query(queryUpdate);
  }
}

const cerrarConexionRedshift = async (client) => {
  mensaje('==> Cerrando conexión Redshift');
  await client.end();
}

const withRedshiftClient = async (fn) => {
  const client = await conexionRedshift();
  try {
    return await fn(client);
  } finally {
    await cerrarConexionRedshift(client);
  }
};

/* Fin funciones Waterfall */

let inicioScript;
let diaInicioScript;

const main = async () => {
  inicioScript = moment();
  diaInicioScript = inicioScript.format('YYYY-MM-DD');

  while (true) {
      try {
          
          // Logs iniciales
          console.log(`\n=== SCRIPT INICIADO ===`);
          console.log(`Fecha congelada para hash y procesamiento: ${diaInicioScript}`);
          console.log(`Hora exacta de inicio: ${inicioScript.format('DD-MM-YYYY HH:mm:ss')}`);
          console.log('============================================');

          // Validación previa
          await withRedshiftClient(async (client) => {
            await confirmarActualizacionAdempiere(client);
            await confirmarActualizacionBienvenida(client);
          });

          // Procesar cada segmento
          for (const segmento of segmentos) {
              console.log(`\n➡️ Procesando segmento: ${segmento.nombre}`);

              try {
                  // Obtener suscriptores
                  await withRedshiftClient((client) => obtenerSuscriptoresNuevos(client, segmento));
                  // Cargar, importar, actualizar y lanzar
                  await cargarSegmentoEnS3(segmento);
                  await importarEndpoints(segmento);

                  await withRedshiftClient((client) => actualizarSegmentoDinamico(client, segmento));

                  await actualizarCampana(segmento);

                  // Espera entre segmentos
                  console.log(`✅ Segmento "${segmento.nombre}" completado. Esperando ${SEGMENT_WAIT_SECONDS} segundos...\n`);
                  // await wait(SEGMENT_WAIT_SECONDS); 
                  // Se puede activar esta espera si se desea pausar entre segmentos.

              } catch (err) {
                  console.error(`❌ Error al procesar el segmento "${segmento.nombre}":`, err);
              }
          }

          // Registro final
          await withRedshiftClient(actualizarEstadoAutomatizacion);

          // Espera hasta mañana
          const tiempo = moment().add(1, 'days').set({ hour: 5, minute: 16 }).diff(moment());
          console.log(`\n✅ Automatización finalizada correctamente en ${tiempoTranscurrido(inicioScript)}.`);
          console.log(`⏰ Esperando hasta la próxima ejecución en ${Math.floor(tiempo / 1000 / 60)} minutos...`);
          console.log('============================================\n');
          await wait(tiempo / 1000);

      } catch (err) {
          console.error(`\n❌ Error general del proceso:`, err);
          console.error(`⏳ Reiniciando en ${ERROR_RESTART_MINUTES} minutos...\n`);
          await wait(ERROR_RESTART_MINUTES * 60);
      }
  }
};

main();
