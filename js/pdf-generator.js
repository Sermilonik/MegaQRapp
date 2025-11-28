// js/pdf-generator.js
class PDFGenerator {
    constructor() {
        console.log('📄 PDF Generator initialized');
    }

    async generateReport(reportData) {
        console.log('📄 Generating PDF report:', reportData);
        
        try {
            if (typeof jspdf === 'undefined') {
                throw new Error('jspdf library not loaded');
            }
            
            const { jsPDF } = jspdf;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // Устанавливаем стандартный шрифт
            doc.setFont('helvetica', 'normal');
            
            // Английская версия отчета
            this.addHeader(doc, reportData);
            this.addReportInfo(doc, reportData);
            this.addContractorsInfo(doc, reportData);
            this.addCodesTable(doc, reportData);
            
            // DataMatrix коды
            if (typeof simpleQRGenerator !== 'undefined') {
                await this.addDataMatrixCodes(doc, reportData);
            } else {
                this.addNoDataMatrixMessage(doc);
            }
            
            return doc.output('arraybuffer');
            
        } catch (error) {
            console.error('❌ PDF generation error:', error);
            throw error;
        }
    }

    addHeader(doc, reportData) {
        // АНГЛИЙСКИЙ заголовок
        doc.setFontSize(18);
        doc.setTextColor(40, 40, 40);
        doc.text('SCAN REPORT', 105, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('Honest SIGN System - Warehouse', 105, 28, { align: 'center' });
        
        // Разделительная линия
        doc.setDrawColor(200, 200, 200);
        doc.line(20, 35, 190, 35);
    }

    addReportInfo(doc, reportData) {
        let yPosition = 45;
        
        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        
        // АНГЛИЙСКИЕ метки
        doc.setFont(undefined, 'bold');
        doc.text('Report Date:', 20, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(new Date().toLocaleString('en-US'), 70, yPosition);
        yPosition += 8;
        
        doc.setFont(undefined, 'bold');
        doc.text('Report Number:', 20, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(`#${reportData.sequentialNumber || reportData.id}`, 70, yPosition);
        yPosition += 8;
        
        doc.setFont(undefined, 'bold');
        doc.text('Scan Period:', 20, yPosition);
        doc.setFont(undefined, 'normal');
        const scanDate = new Date(reportData.createdAt);
        doc.text(scanDate.toLocaleDateString('en-US'), 70, yPosition);
        yPosition += 8;
        
        doc.setFont(undefined, 'bold');
        doc.text('Total Codes:', 20, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(String(reportData.codes ? reportData.codes.length : 0), 70, yPosition);
        yPosition += 15;
    }

    addContractorsInfo(doc, reportData) {
        let yPosition = 85;
        
        doc.setFont(undefined, 'bold');
        doc.text('Contractors:', 20, yPosition);
        doc.setFont(undefined, 'normal');
        yPosition += 8;
        
        if (reportData.contractors && Array.isArray(reportData.contractors)) {
            reportData.contractors.forEach((contractor, index) => {
                // Используем только английские символы для названий
                const safeName = this.getSafeContractorName(contractor.name);
                const safeCategory = this.getSafeContractorName(contractor.category);
                
                const contractorText = `${index + 1}. ${safeName} (${safeCategory})`;
                const lines = doc.splitTextToSize(contractorText, 150);
                
                lines.forEach(line => {
                    doc.text(line, 25, yPosition);
                    yPosition += 6;
                });
            });
        }
        
        yPosition += 10;
        
        // Разделительная линия
        doc.setDrawColor(200, 200, 200);
        doc.line(20, yPosition, 190, yPosition);
        yPosition += 15;
    }

    addCodesTable(doc, reportData) {
        doc.setFont(undefined, 'bold');
        doc.text('Scanned Codes List:', 20, 120);
        let yPosition = 135;
        
        // Заголовок таблицы
        doc.setFillColor(240, 240, 240);
        doc.rect(20, yPosition, 170, 8, 'F');
        doc.setFont(undefined, 'bold');
        doc.text('#', 25, yPosition + 6);
        doc.text('DATA MATRIX CODE', 40, yPosition + 6);
        doc.text('SCAN DATE', 130, yPosition + 6);
        doc.text('TIME', 170, yPosition + 6);
        yPosition += 12;
        
        // Данные кодов
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        
        reportData.codes.forEach((code, index) => {
            if (yPosition > 270) {
                doc.addPage();
                yPosition = 20;
            }
            
            const codeValue = typeof code === 'string' ? code : code.code;
            const scanDate = code.timestamp ? new Date(code.timestamp) : new Date();
            
            // Чередующийся фон
            if (index % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(20, yPosition - 4, 170, 8, 'F');
            }
            
            doc.text(`${index + 1}`, 25, yPosition);
            doc.text(this.formatCodeForDisplay(codeValue), 40, yPosition);
            doc.text(scanDate.toLocaleDateString('en-US'), 130, yPosition);
            doc.text(scanDate.toLocaleTimeString('en-US'), 170, yPosition);
            yPosition += 8;
        });
    }

    // Вспомогательные методы для безопасных названий
    getSafeContractorName(name) {
        const safeNames = {
            'ООО "Ромашка"': 'Romashka LLC',
            'ИП Иванов': 'Ivanov IE', 
            'ООО "Луч"': 'Luch LLC',
            'АО "Вектор"': 'Vector JSC',
            'Пшек': 'Pshek',
            'sdflk': 'Contractor',
            'Яйки Китайки': 'China Eggs'
        };
        
        return safeNames[name] || name.replace(/[^\x20-\x7E]/g, '') || 'Contractor';
    }

    // Остальные методы без изменений
    formatCodeForDisplay(code) {
        if (!code) return 'N/A';
        const cleanCode = code.replace(/[^\x20-\x7E]/g, '');
        return cleanCode.length > 30 
            ? cleanCode.substring(0, 15) + '...' + cleanCode.substring(cleanCode.length - 10)
            : cleanCode;
    }

    formatCodeShort(code) {
        if (!code) return 'N/A';
        const cleanCode = code.replace(/[^\x20-\x7E]/g, '');
        return cleanCode.length > 15 
            ? cleanCode.substring(0, 8) + '...'
            : cleanCode;
    }

    async addDataMatrixCodes(doc, reportData) {
        console.log('🔷 Adding DataMatrix codes to PDF...');
        
        // Новая страница для DataMatrix
        doc.addPage();
        
        doc.setFontSize(16);
        doc.text('DATA MATRIX CODES FOR PRINT', 105, 20, { align: 'center' });
        
        let xPosition = 25;
        let yPosition = 40;
        const dmSize = 35;
        const spacing = 10;
        const codesPerRow = 3;
        
        for (let i = 0; i < reportData.codes.length; i++) {
            const code = reportData.codes[i];
            const codeValue = typeof code === 'string' ? code : code.code;
            
            // Новая строка
            if (i > 0 && i % codesPerRow === 0) {
                xPosition = 25;
                yPosition += dmSize + 20;
            }
            
            // Новая страница если не хватает места
            if (yPosition + dmSize + 30 > 270) {
                doc.addPage();
                doc.setFontSize(16);
                doc.text('DATA MATRIX CODES FOR PRINT (CONTINUED)', 105, 20, { align: 'center' });
                yPosition = 40;
                xPosition = 25;
            }
            
            // Генерируем DataMatrix
            const dataMatrixUrl = await this.generateDataMatrix(codeValue);
            
            if (dataMatrixUrl) {
                try {
                    // DataMatrix изображение
                    doc.addImage(dataMatrixUrl, 'PNG', xPosition, yPosition, dmSize, dmSize);
                    
                    // Текст под кодом
                    doc.setFontSize(8);
                    doc.text(`${i + 1}`, xPosition + dmSize/2, yPosition + dmSize + 4, { align: 'center' });
                    doc.text(this.formatCodeShort(codeValue), xPosition + dmSize/2, yPosition + dmSize + 8, { align: 'center' });
                    
                    xPosition += dmSize + spacing;
                } catch (imageError) {
                    console.error(`❌ Error adding image ${i + 1}:`, imageError);
                    doc.text(`${i + 1}. ${this.formatCodeForDisplay(codeValue)}`, xPosition, yPosition + dmSize/2);
                    xPosition += 80;
                }
            } else {
                doc.text(`${i + 1}. ${this.formatCodeForDisplay(codeValue)}`, xPosition, yPosition + dmSize/2);
                xPosition += 80;
            }
        }
    }

    async generateDataMatrix(data) {
        return new Promise((resolve) => {
            try {
                if (typeof simpleQRGenerator !== 'undefined' && 
                    typeof simpleQRGenerator.generateDataMatrix === 'function') {
                    
                    simpleQRGenerator.generateDataMatrix(data, 80).then(resolve);
                } else {
                    resolve(null);
                }
            } catch (error) {
                console.error('❌ Data Matrix generation failed:', error);
                resolve(null);
            }
        });
    }

    addNoDataMatrixMessage(doc) {
        doc.addPage();
        doc.setFontSize(14);
        doc.setTextColor(100, 100, 100);
        doc.text('DATA MATRIX CODES NOT AVAILABLE', 105, 80, { align: 'center' });
        doc.text('Code generation library not loaded', 105, 90, { align: 'center' });
        doc.text('Codes available in text format on previous page', 105, 100, { align: 'center' });
    }
    
    downloadPDF(pdfBytes, filename) {
        try {
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename || `scan_report_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            return true;
        } catch (error) {
            console.error('Download error:', error);
            return false;
        }
    }
}

// Глобальный экземпляр
const pdfGenerator = new PDFGenerator();
