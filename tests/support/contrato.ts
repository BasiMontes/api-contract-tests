import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import SwaggerParser from '@apidevtools/swagger-parser';

// La especificación es la fuente de verdad: las pruebas leen openapi.yaml, no una copia.
const ESPECIFICACION = path.join(__dirname, '..', '..', 'openapi.yaml');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

let documento: Promise<any> | undefined;

function cargarEspecificacion(): Promise<any> {
  documento ??= SwaggerParser.dereference(ESPECIFICACION);
  return documento;
}

/** Errores de validar `dato` contra el esquema `nombre` de components/schemas. Lista vacía = cumple. */
export async function erroresDeEsquema(nombre: string, dato: unknown): Promise<string[]> {
  const doc = await cargarEspecificacion();
  const schema = doc.components.schemas[nombre];
  if (!schema) throw new Error(`El esquema ${nombre} no existe en openapi.yaml`);
  const validar = ajv.compile(schema);
  const ok = validar(dato);
  return ok ? [] : (validar.errors ?? []).map((e) => `${e.instancePath || '(raíz)'} ${e.message}`);
}

/** ¿Declara la especificación este código de estado para esta operación? */
export async function declarado(metodo: string, ruta: string, status: number): Promise<boolean> {
  const doc = await cargarEspecificacion();
  const operacion = doc.paths[ruta]?.[metodo.toLowerCase()];
  return Boolean(operacion?.responses?.[String(status)]);
}

/** Operaciones de la especificación como pares [método, ruta]. */
export async function operaciones(): Promise<[string, string][]> {
  const doc = await cargarEspecificacion();
  const resultado: [string, string][] = [];
  for (const [ruta, valor] of Object.entries<any>(doc.paths)) {
    for (const metodo of ['get', 'post', 'put', 'delete', 'patch']) {
      if (valor[metodo]) resultado.push([metodo, ruta]);
    }
  }
  return resultado;
}

/** ¿Declara la operación una respuesta por defecto (cualquier otro código)? */
export async function tieneRespuestaPorDefecto(metodo: string, ruta: string): Promise<boolean> {
  const doc = await cargarEspecificacion();
  return Boolean(doc.paths[ruta]?.[metodo.toLowerCase()]?.responses?.default);
}
