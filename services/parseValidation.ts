/**
 * Parse Validation Service
 * 
 * Tracks and reports issues during Excel parsing.
 * Provides visible feedback instead of silent failures.
 */

/**
 * Severity levels for validation issues
 */
export type IssueSeverity = 'error' | 'warning' | 'info';

/**
 * A single validation issue found during parsing
 */
export interface ValidationIssue {
    employeeId: string;
    employeeName: string;
    field: string;
    rawValue: any;
    parsedValue: any;
    message: string;
    messageJa: string;  // Japanese message for UI
    severity: IssueSeverity;
    rowIndex?: number;
}

/**
 * Summary of all validation issues
 */
export interface ValidationSummary {
    totalRows: number;
    validRows: number;
    errors: number;
    warnings: number;
    skippedRows: number;
}

/**
 * Complete validation result
 */
export interface ValidationResult {
    isValid: boolean;
    issues: ValidationIssue[];
    summary: ValidationSummary;
}

/**
 * Validation context for tracking issues during parsing
 */
export class ParseValidationContext {
    private issues: ValidationIssue[] = [];
    private rowCount: number = 0;
    private skippedCount: number = 0;

    /**
     * Add an issue to the context
     */
    addIssue(issue: Omit<ValidationIssue, 'parsedValue'> & { parsedValue?: any }): void {
        this.issues.push({
            ...issue,
            parsedValue: issue.parsedValue ?? null
        });
    }

    /**
     * Record a skipped row (missing required data)
     */
    skipRow(employeeId: string, employeeName: string, reason: string, rowIndex?: number): void {
        this.skippedCount++;
        this.addIssue({
            employeeId,
            employeeName,
            field: 'row',
            rawValue: null,
            parsedValue: null,
            message: reason,
            messageJa: this.translateToJapanese(reason),
            severity: 'warning',
            rowIndex
        });
    }

    /**
     * Validate and parse a numeric field
     * Returns the parsed value or fallback if invalid
     */
    parseNumber(
        value: any,
        fieldName: string,
        employeeId: string,
        employeeName: string,
        fallback: number = 0,
        rowIndex?: number
    ): number {
        // Empty or null is OK, use fallback
        if (value === null || value === undefined || value === '') {
            return fallback;
        }

        // Already a valid number
        if (typeof value === 'number' && !isNaN(value)) {
            return value;
        }

        // Try to parse string
        const parsed = Number(value);

        if (isNaN(parsed)) {
            // Invalid data - log issue and return fallback
            this.addIssue({
                employeeId,
                employeeName,
                field: fieldName,
                rawValue: value,
                parsedValue: fallback,
                message: `Invalid numeric value "${value}" in field "${fieldName}", using ${fallback}`,
                messageJa: `${fieldName}に無効な値「${value}」が含まれています（${fallback}に変換）`,
                severity: 'error',
                rowIndex
            });
            return fallback;
        }

        // Check for negative values where they shouldn't be
        if (parsed < 0 && ['granted', 'used', 'balance', '付与数', '消化日数', '期末残高'].includes(fieldName)) {
            this.addIssue({
                employeeId,
                employeeName,
                field: fieldName,
                rawValue: value,
                parsedValue: Math.abs(parsed),
                message: `Negative value ${parsed} in field "${fieldName}", using absolute value`,
                messageJa: `${fieldName}に負の値（${parsed}）があります（絶対値に変換）`,
                severity: 'warning',
                rowIndex
            });
            return Math.abs(parsed);
        }

        return parsed;
    }

    /**
     * Validate a date field
     */
    parseDate(
        value: any,
        fieldName: string,
        employeeId: string,
        employeeName: string,
        rowIndex?: number
    ): string | undefined {
        if (!value || value === '' || value === 0) {
            return undefined;
        }

        // Excel date number
        if (typeof value === 'number') {
            const date = new Date((value - 25569) * 86400 * 1000);
            if (isNaN(date.getTime())) {
                this.addIssue({
                    employeeId,
                    employeeName,
                    field: fieldName,
                    rawValue: value,
                    parsedValue: undefined,
                    message: `Invalid Excel date number "${value}" in field "${fieldName}"`,
                    messageJa: `${fieldName}に無効な日付番号（${value}）があります`,
                    severity: 'error',
                    rowIndex
                });
                return undefined;
            }
            return date.toISOString().split('T')[0];
        }

        // String date
        if (typeof value === 'string') {
            // Try to parse various formats
            const match = value.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
            if (match) {
                return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
            }

            this.addIssue({
                employeeId,
                employeeName,
                field: fieldName,
                rawValue: value,
                parsedValue: undefined,
                message: `Unrecognized date format "${value}" in field "${fieldName}"`,
                messageJa: `${fieldName}に認識できない日付形式（${value}）があります`,
                severity: 'warning',
                rowIndex
            });
            return undefined;
        }

        return undefined;
    }

    /**
     * Increment row counter
     */
    incrementRowCount(): void {
        this.rowCount++;
    }

    /**
     * Get the final validation result
     */
    getResult(): ValidationResult {
        const errors = this.issues.filter(i => i.severity === 'error').length;
        const warnings = this.issues.filter(i => i.severity === 'warning').length;

        return {
            isValid: errors === 0,
            issues: this.issues,
            summary: {
                totalRows: this.rowCount,
                validRows: this.rowCount - this.skippedCount,
                errors,
                warnings,
                skippedRows: this.skippedCount
            }
        };
    }

    /**
     * Get issues for a specific employee
     */
    getIssuesForEmployee(employeeId: string): ValidationIssue[] {
        return this.issues.filter(i => i.employeeId === employeeId);
    }

    /**
     * Check if there are any critical errors
     */
    hasErrors(): boolean {
        return this.issues.some(i => i.severity === 'error');
    }

    /**
     * Get a summary message for toast notifications
     */
    getSummaryMessage(): string {
        const result = this.getResult();
        const parts: string[] = [];

        if (result.summary.errors > 0) {
            parts.push(`${result.summary.errors}件のエラー`);
        }
        if (result.summary.warnings > 0) {
            parts.push(`${result.summary.warnings}件の警告`);
        }
        if (result.summary.skippedRows > 0) {
            parts.push(`${result.summary.skippedRows}件スキップ`);
        }

        if (parts.length === 0) {
            return '正常にインポートしました';
        }

        return parts.join('、');
    }

    /**
     * Translate common messages to Japanese
     */
    private translateToJapanese(message: string): string {
        const translations: Record<string, string> = {
            'Missing required field': '必須フィールドがありません',
            'Row skipped due to missing ID': 'IDがないため行をスキップしました',
            'Row skipped due to missing entry date': '入社日がないため行をスキップしました'
        };
        return translations[message] || message;
    }

    /**
     * Reset the context for a new parsing session
     */
    reset(): void {
        this.issues = [];
        this.rowCount = 0;
        this.skippedCount = 0;
    }
}

/**
 * Global validation context instance
 */
export const validationContext = new ParseValidationContext();

/**
 * Helper to format issues for console logging
 */
export function logValidationResult(result: ValidationResult): void {
    if (result.issues.length === 0) {
        console.log('✅ Excel parsing completed without issues');
        return;
    }

    console.group('📊 Excel Parsing Validation Report');
    console.log(`Total rows: ${result.summary.totalRows}`);
    console.log(`Valid rows: ${result.summary.validRows}`);
    console.log(`Errors: ${result.summary.errors}`);
    console.log(`Warnings: ${result.summary.warnings}`);
    console.log(`Skipped: ${result.summary.skippedRows}`);

    if (result.issues.length > 0) {
        console.group('Issues:');
        result.issues.forEach((issue, idx) => {
            const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
            console.log(`${icon} [${issue.employeeId}] ${issue.employeeName}: ${issue.message}`);
        });
        console.groupEnd();
    }
    console.groupEnd();
}
