// js/pdf-generator.js
class PDFGenerator {
    constructor() {
        console.log('📄 PDF Generator initialized');
    }

    async generateReport(reportData) {
        console.log('📄 Generating PDF report:', reportData);
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Основная информация
        this.addHeader(doc, reportData);
        this.addReportInfo(doc, reportData);
        this.addContractorsInfo(doc, reportData);
        this.addCodesTable(doc, reportData);
        
        // Генерируем DataMatrix коды на отдельной странице
        await this.addDataMatrixCodes(doc, reportData);
        
        return doc.output('arraybuffer');
    }

    addHeader(doc, reportData) {
        // Заголовок
        doc.setFontSize(18);
        doc.setTextColor(40, 40, 40);
        doc.text('ОТЧЕТ СКАНИРОВАНИЯ', 105, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('Система "Честный ЗНАК" - Складской учет', 105, 28, { align: 'center' });
        
        // Линия разделитель
        doc.setDrawColor(200, 200, 200);
        doc.line(20, 35, 190, 35);
    }

    addReportInfo(doc, reportData) {
        let yPosition = 45;
        
        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        
        // Дата отчета
        doc.setFont(undefined, 'bold');
        doc.text('Дата формирования:', 20, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(new Date().toLocaleString('ru-RU'), 70, yPosition);
        yPosition += 8;
        
        // Номер отчета
        doc.setFont(undefined, 'bold');
        doc.text('Номер отчета:', 20, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(`#${reportData.sequentialNumber || reportData.id}`, 70, yPosition);
        yPosition += 8;
        
        // Дата сканирования
        doc.setFont(undefined, 'bold');
        doc.text('Период сканирования:', 20, yPosition);
        doc.setFont(undefined, 'normal');
        const scanDate = new Date(reportData.createdAt);
        doc.text(scanDate.toLocaleDateString('ru-RU'), 70, yPosition);
        yPosition += 8;
        
        // Количество кодов
        doc.setFont(undefined, 'bold');
        doc.text('Всего кодов:', 20, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(String(reportData.codes ? reportData.codes.length : 0), 70, yPosition);
        yPosition += 15;
    }

    addContractorsInfo(doc, reportData) {
        let yPosition = 85;
        
        doc.setFont(undefined, 'bold');
        doc.text('Контрагенты:', 20, yPosition);
        doc.setFont(undefined, 'normal');
        yPosition += 8;
        
        if (reportData.contractors && Array.isArray(reportData.contractors)) {
            reportData.contractors.forEach((contractor, index) => {
                const contractorText = `${index + 1}. ${contractor.name} (${contractor.category})`;
                const lines = doc.splitTextToSize(contractorText, 150);
                lines.forEach(line => {
                    doc.text(line, 25, yPosition);
                    yPosition += 6;
                });
            });
        } else if (reportData.contractorName) {
            const lines = doc.splitTextToSize(reportData.contractorName, 150);
            lines.forEach(line => {
                doc.text(line, 25, yPosition);
                yPosition += 6;
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
        doc.text('Список отсканированных кодов:', 20, 120);
        yPosition = 135;
        
        // Заголовок таблицы
        doc.setFillColor(240, 240, 240);
        doc.rect(20, yPosition, 170, 8, 'F');
        doc.setFont(undefined, 'bold');
        doc.text('№', 25, yPosition + 6);
        doc.text('КОД DATA MATRIX', 40, yPosition + 6);
        doc.text('ДАТА СКАНИРОВАНИЯ', 130, yPosition + 6);
        doc.text('ВРЕМЯ', 170, yPosition + 6);
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
            doc.text(scanDate.toLocaleDateString('ru-RU'), 130, yPosition);
            doc.text(scanDate.toLocaleTimeString('ru-RU'), 170, yPosition);
            yPosition += 8;
        });
    }

    async addDataMatrixCodes(doc, reportData) {
        console.log('🔷 Adding DataMatrix codes to PDF...');
        
        // Новая страница для DataMatrix
        doc.addPage();
        
        doc.setFontSize(16);
        doc.text('DATA MATRIX КОДЫ ДЛЯ ПЕЧАТИ', 105, 20, { align: 'center' });
        
        let xPosition = 20;
        let yPosition = 40;
        const dmSize = 40;
        const spacing = 15;
        const codesPerRow = 4;
        
        for (let i = 0; i < reportData.codes.length; i++) {
            const code = reportData.codes[i];
            const codeValue = typeof code === 'string' ? code : code.code;
            
            // Новая строка
            if (i > 0 && i % codesPerRow === 0) {
                xPosition = 20;
                yPosition += dmSize + 25;
            }
            
            // Новая страница
            if (yPosition + dmSize + 20 > 270) {
                doc.addPage();
                doc.setFontSize(16);
                doc.text('DATA MATRIX КОДЫ ДЛЯ ПЕЧАТИ (ПРОДОЛЖЕНИЕ)', 105, 20, { align: 'center' });
                yPosition = 40;
                xPosition = 20;
            }
            
            // Генерируем DataMatrix
            const dataMatrixUrl = await this.generateDataMatrix(codeValue);
            
            if (dataMatrixUrl) {
                // DataMatrix изображение
                doc.addImage(dataMatrixUrl, 'PNG', xPosition, yPosition, dmSize, dmSize);
                
                // Текст под кодом
                doc.setFontSize(8);
                doc.text(`${i + 1}`, xPosition + dmSize/2, yPosition + dmSize + 4, { align: 'center' });
                doc.text(this.formatCodeShort(codeValue), xPosition + dmSize/2, yPosition + dmSize + 8, { align: 'center' });
                
                xPosition += dmSize + spacing;
            } else {
                // Если не удалось сгенерировать DataMatrix, показываем текст
                doc.setFontSize(10);
                doc.text(`${i + 1}. ${this.formatCodeForDisplay(codeValue)}`, xPosition, yPosition + dmSize/2);
                xPosition += 80;
            }
        }
    }

    async generateDataMatrix(data) {
        return new Promise((resolve) => {
            try {
                if (typeof bwipjs === 'undefined') {
                    console.warn('⚠️ bwip-js not available');
                    resolve(null);
                    return;
                }
                
                const canvas = document.createElement('canvas');
                
                bwipjs.toCanvas(canvas, {
                    bcid: 'datamatrix',
                    text: data,
                    scale: 3,
                    height: 10,
                    width: 10,
                    includetext: false,
                    textxalign: 'center'
                });
                
                resolve(canvas.toDataURL('image/png'));
                
            } catch (error) {
                console.error('Data Matrix generation error:', error);
                resolve(null);
            }
        });
    }

    formatCodeForDisplay(code) {
        if (!code) return 'N/A';
        if (code.length > 30) {
            return code.substring(0, 15) + '...' + code.substring(code.length - 10);
        }
        return code;
    }

    formatCodeShort(code) {
        if (!code) return 'N/A';
        if (code.length > 15) {
            return code.substring(0, 8) + '...';
        }
        return code;
    }

    downloadPDF(pdfBytes, filename) {
        try {
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename || `scanning_report_${new Date().toISOString().split('T')[0]}.pdf`;
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
