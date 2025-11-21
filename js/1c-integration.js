class OneCIntegration {
    constructor() {
        this.apiBaseUrl = ''; // Будет настроено позже
        this.isConnected = false;
    }

    // Метод для подготовки данных для 1С
    prepareDataFor1C(report) {
        return {
            document: {
                type: 'QR_CODE_REPORT',
                number: report.sequentialNumber,
                date: report.createdAt,
                contractor: report.contractors.map(c => ({
                    id: c.id,
                    name: c.name
                })),
                codes: report.codes.map(codeObj => ({
                    code: codeObj.code,
                    scannedAt: codeObj.timestamp
                })),
                metadata: {
                    generatedBy: 'MegaQR Web App',
                    version: '1.0'
                }
            }
        };
    }

    // Экспорт данных в формате для 1С
    exportTo1CFormat(report) {
        const data = this.prepareDataFor1C(report);
        
        // JSON для ручного импорта
        const jsonData = JSON.stringify(data, null, 2);
        this.downloadFile(jsonData, `1C_import_${report.sequentialNumber}.json`, 'application/json');
        
        // CSV для бухгалтерии
        const csvData = this.generateCSV(report);
        this.downloadFile(csvData, `codes_${report.sequentialNumber}.csv`, 'text/csv');
        
        return data;
    }

    generateCSV(report) {
        let csv = 'QR Code,Scanned At,Contractor\n';
        
        report.codes.forEach(codeObj => {
            const contractorName = report.contractorName.replace(/,/g, ';');
            const scannedAt = new Date(codeObj.timestamp).toLocaleString('ru-RU');
            csv += `"${codeObj.code}","${scannedAt}","${contractorName}"\n`;
        });
        
        return csv;
    }

    downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
    }

    // Метод для будущей автоматической интеграции
    async sendTo1C(report) {
        if (!this.apiBaseUrl) {
            throw new Error('URL для интеграции с 1С не настроен');
        }

        try {
            const data = this.prepareDataFor1C(report);
            const response = await fetch(`${this.apiBaseUrl}/api/reports`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Ошибка интеграции с 1С:', error);
            throw error;
        }
    }
}