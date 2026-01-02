/**
 * Migration Service
 *
 * Servicio para migrar datos de versiones antiguas al nuevo formato.
 * Maneja la transición de datos existentes sin pérdida de información.
 *
 * Responsabilidades:
 * - Detectar versión de datos
 * - Crear backup antes de migrar
 * - Agregar campos nuevos a employees
 * - Migrar records aprobados a yukyuDates[]
 * - Garantizar compatibilidad hacia atrás
 */

import { AppData, Employee, LeaveRecord } from '../types';

const BACKUP_KEY = 'yukyu_pro_backup_v1';
const DATA_VERSION = 2; // Versión actual de los datos

/**
 * Información sobre la migración realizada
 */
export interface MigrationInfo {
  wasNeeded: boolean;
  oldVersion: number;
  newVersion: number;
  employeesMigrated: number;
  recordsSynced: number;
  backupCreated: boolean;
}

/**
 * Verifica si los datos necesitan migración
 */
export function needsMigration(data: any): boolean {
  // Si no tiene versión o tiene versión antigua
  return !data.version || data.version < DATA_VERSION;
}

/**
 * Crea un backup de los datos en localStorage
 */
function createBackup(data: AppData): boolean {
  try {
    const backup = {
      timestamp: new Date().toISOString(),
      data: data
    };
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
    console.log('✅ Backup creado en:', BACKUP_KEY);
    return true;
  } catch (error) {
    console.error('❌ Error creando backup:', error);
    return false;
  }
}

/**
 * Restaura los datos desde el backup
 */
export function restoreFromBackup(): AppData | null {
  try {
    const backupRaw = localStorage.getItem(BACKUP_KEY);
    if (!backupRaw) {
      console.warn('No se encontró backup');
      return null;
    }

    const backup = JSON.parse(backupRaw);
    console.log('📦 Backup encontrado del:', backup.timestamp);
    return backup.data;
  } catch (error) {
    console.error('❌ Error restaurando backup:', error);
    return null;
  }
}

/**
 * Elimina el backup de localStorage
 */
export function deleteBackup(): void {
  localStorage.removeItem(BACKUP_KEY);
  console.log('🗑️ Backup eliminado');
}

/**
 * Migra los datos al nuevo formato (versión 2)
 *
 * Cambios en v2:
 * 1. Agregar employee.lastExcelSync
 * 2. Agregar employee.localModifications
 * 3. Agregar record.syncedToYukyuDates
 * 4. Migrar records aprobados a yukyuDates[]
 * 5. Inicializar yukyuDates[] si no existe
 *
 * @param data - Datos a migrar
 * @returns Datos migrados e información de la migración
 */
export function migrateData(data: AppData): { data: AppData; info: MigrationInfo } {
  const oldVersion = (data as any).version || 1;

  // Si no necesita migración, retornar tal cual
  if (!needsMigration(data)) {
    return {
      data,
      info: {
        wasNeeded: false,
        oldVersion,
        newVersion: DATA_VERSION,
        employeesMigrated: 0,
        recordsSynced: 0,
        backupCreated: false
      }
    };
  }

  console.log('🔄 Iniciando migración de datos...');
  console.log(`   Versión antigua: ${oldVersion} → Versión nueva: ${DATA_VERSION}`);

  // 1. Crear backup
  const backupCreated = createBackup(data);

  let employeesMigrated = 0;
  let recordsSynced = 0;

  // 2. Migrar employees
  data.employees = data.employees.map(emp => {
    let modified = false;

    // Inicializar yukyuDates si no existe
    if (!emp.yukyuDates) {
      emp.yukyuDates = [];
      modified = true;
    }

    // Agregar lastExcelSync si no existe
    if (!emp.lastExcelSync) {
      emp.lastExcelSync = undefined; // Se llenará en la primera sync
      modified = true;
    }

    // Agregar localModifications si no existe
    if (!emp.localModifications) {
      emp.localModifications = {
        approvedDates: [],
        manualAdjustments: 0
      };
      modified = true;
    }

    if (modified) {
      employeesMigrated++;
    }

    return emp;
  });

  // 3. Migrar records aprobados a yukyuDates[]
  // Esto sincroniza las aprobaciones locales antiguas con yukyuDates
  data.records.forEach(record => {
    // Solo procesar records de vacaciones pagadas aprobadas
    if (record.type === 'paid' && record.status === 'approved') {
      const emp = data.employees.find(e => e.id === record.employeeId);

      if (emp && emp.yukyuDates) {
        // Verificar si la fecha ya está en yukyuDates
        if (!emp.yukyuDates.includes(record.date)) {
          // Agregar la fecha
          emp.yukyuDates.push(record.date);

          // Marcar como modificación local
          if (emp.localModifications) {
            emp.localModifications.approvedDates.push(record.date);
          }

          recordsSynced++;
        }

        // Marcar el record como sincronizado
        record.syncedToYukyuDates = true;
      }
    }
  });

  // 4. Ordenar yukyuDates de cada empleado
  data.employees.forEach(emp => {
    if (emp.yukyuDates && emp.yukyuDates.length > 0) {
      emp.yukyuDates.sort();
    }
  });

  // 5. Agregar versión a los datos
  (data as any).version = DATA_VERSION;

  console.log('✅ Migración completada:');
  console.log(`   - Empleados migrados: ${employeesMigrated}`);
  console.log(`   - Records sincronizados: ${recordsSynced}`);
  console.log(`   - Backup creado: ${backupCreated ? 'Sí' : 'No'}`);

  return {
    data,
    info: {
      wasNeeded: true,
      oldVersion,
      newVersion: DATA_VERSION,
      employeesMigrated,
      recordsSynced,
      backupCreated
    }
  };
}

/**
 * Función de utilidad para mostrar info de migración al usuario
 */
export function showMigrationInfo(info: MigrationInfo): void {
  if (!info.wasNeeded) {
    console.log('ℹ️ No se necesitó migración de datos');
    return;
  }

  const message = `
    📊 Migración de Datos Completada

    Versión: ${info.oldVersion} → ${info.newVersion}

    Cambios realizados:
    - ${info.employeesMigrated} empleados actualizados
    - ${info.recordsSynced} aprobaciones sincronizadas
    - Backup creado: ${info.backupCreated ? '✅ Sí' : '❌ No'}

    ${info.backupCreated ? 'Si encuentra problemas, puede restaurar desde consola: restoreFromBackup()' : ''}
  `.trim();

  console.log(message);

  // También podríamos mostrar una notificación al usuario
  // pero para no interrumpir, solo lo dejamos en consola
}

/**
 * Función de debugging para verificar el estado de migración
 */
export function getMigrationStatus(data: AppData): {
  version: number;
  needsMigration: boolean;
  hasBackup: boolean;
  employeesWithNewFields: number;
  totalEmployees: number;
} {
  const version = (data as any).version || 1;
  const hasBackup = localStorage.getItem(BACKUP_KEY) !== null;

  let employeesWithNewFields = 0;

  data.employees.forEach(emp => {
    if (emp.lastExcelSync !== undefined && emp.localModifications) {
      employeesWithNewFields++;
    }
  });

  return {
    version,
    needsMigration: needsMigration(data),
    hasBackup,
    employeesWithNewFields,
    totalEmployees: data.employees.length
  };
}

// Exponer funciones en window para debugging en consola
if (typeof window !== 'undefined') {
  (window as any).yukyu_debug = {
    ...(window as any).yukyu_debug,
    restoreFromBackup,
    deleteBackup,
    getMigrationStatus
  };
}
