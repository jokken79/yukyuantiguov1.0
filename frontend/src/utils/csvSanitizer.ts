/**
 * CSV Sanitizer - Protección contra Formula Injection
 *
 * Previene ataques de formula injection en archivos CSV escapando caracteres peligrosos
 * que podrían ejecutar fórmulas al abrir el CSV en Excel/Google Sheets.
 *
 * Referencias:
 * - OWASP: https://owasp.org/www-community/attacks/CSV_Injection
 * - CWE-1236: Improper Neutralization of Formula Elements in a CSV File
 */

/**
 * Caracteres peligrosos que pueden iniciar fórmulas en Excel/Sheets:
 * = (igual) - Fórmula estándar
 * + (más) - Fórmula de suma
 * - (menos) - Fórmula de resta
 * @ (arroba) - Fórmula de referencia
 * \t (tab) - Puede causar problemas de parsing
 * \r (carriage return) - Puede causar problemas de parsing
 */
const DANGEROUS_CHARS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Sanitiza un valor para exportación CSV segura
 *
 * @param value - Cualquier valor a sanitizar (string, number, boolean, etc.)
 * @returns String sanitizado seguro para CSV
 *
 * @example
 * sanitizeValue('=SUM(A1:A10)') // Returns: "'=SUM(A1:A10)"
 * sanitizeValue('Normal text') // Returns: "Normal text"
 * sanitizeValue('+1234567890') // Returns: "'+1234567890"
 */
export function sanitizeValue(value: any): string {
  // Convertir a string si no lo es
  const str = String(value);

  // Si está vacío, retornar vacío
  if (str.trim() === '') {
    return '';
  }

  // Verificar si comienza con carácter peligroso
  const startsWithDangerousChar = DANGEROUS_CHARS.some(char => str.startsWith(char));

  if (startsWithDangerousChar) {
    // Agregar prefijo de comilla simple para neutralizar la fórmula
    // Excel/Sheets interpreta ' como un prefijo de texto literal
    return `'${str}`;
  }

  return str;
}

/**
 * Sanitiza un array de valores (fila completa de CSV)
 *
 * @param row - Array de valores a sanitizar
 * @returns Array de valores sanitizados
 *
 * @example
 * sanitizeRow(['John', '=SUM(A1:A10)', 'john@example.com'])
 * // Returns: ['John', "'=SUM(A1:A10)", 'john@example.com']
 */
export function sanitizeRow(row: any[]): string[] {
  return row.map(value => sanitizeValue(value));
}

/**
 * Sanitiza una matriz completa de datos (todas las filas de un CSV)
 *
 * @param data - Matriz de valores
 * @returns Matriz de valores sanitizados
 *
 * @example
 * sanitizeData([
 *   ['Name', 'Formula', 'Email'],
 *   ['John', '=1+1', 'john@test.com'],
 *   ['Jane', '@IMPORT', 'jane@test.com']
 * ])
 */
export function sanitizeData(data: any[][]): string[][] {
  return data.map(row => sanitizeRow(row));
}
