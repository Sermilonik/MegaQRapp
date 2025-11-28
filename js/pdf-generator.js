// js/pdf-generator.js
class PDFGenerator {
    constructor() {
        console.log('📄 PDF Generator initialized');
    }

        formatCodeForDisplay(code) {
            if (!code) return 'N/A';
            
            // Убираем специальные символы для лучшего отображения
            const cleanCode = code.replace(/[^\x20-\x7E]/g, '');
            
            if (cleanCode.length > 30) {
                return cleanCode.substring(0, 15) + '...' + cleanCode.substring(cleanCode.length - 10);
            }
            
            return cleanCode;
        }

        async generateReport(reportData) {
            console.log('📄 Generating PDF report:', reportData);
            
            try {
                if (typeof jspdf === 'undefined') {
                    throw new Error('jspdf библиотека не загружена');
                }
                
                const { jsPDF } = jspdf;
                
                // ИСПРАВЬТЕ создание документа - добавьте поддержку кириллицы:
                const doc = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });
                
                // ДОБАВЬТЕ этот код для поддержки кириллицы:
                doc.setLanguage('ru');
                
                // Основная информация с исправленными шрифтами
                await this.addHeader(doc, reportData);
                await this.addReportInfo(doc, reportData);
                await this.addContractorsInfo(doc, reportData);
                await this.addCodesTable(doc, reportData);
                
                // DataMatrix коды
                if (typeof bwipjs !== 'undefined') {
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
    
    // ДОБАВЬТЕ этот метод в pdf-generator.js
    addNoDataMatrixMessage(doc) {
        doc.addPage();
        doc.setFontSize(14);
        doc.setTextColor(100, 100, 100);
        doc.text('DATA MATRIX КОДЫ НЕДОСТУПНЫ', 105, 100, { align: 'center' });
        doc.text('Библиотека bwip-js не загружена', 105, 110, { align: 'center' });
        doc.text('Коды доступны в текстовом виде на предыдущей странице', 105, 120, { align: 'center' });
    }

    addHeader(doc, reportData) {
        // Установите стандартный шрифт, поддерживающий кириллицу
        doc.setFont('helvetica', 'normal');
        
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
        let yPosition = 135;

        doc.setFont(undefined, 'bold');
        doc.text('Список отсканированных кодов:', 20, 120);
        
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
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(16);
        doc.text('DATA MATRIX КОДЫ ДЛЯ ПЕЧАТИ', 105, 20, { align: 'center' });
        
        let xPosition = 25;
        let yPosition = 40;
        const dmSize = 35; // УМЕНЬШИТЕ размер для лучшего размещения
        const spacing = 10;
        const codesPerRow = 3; // УМЕНЬШИТЕ количество в строке
        
        let codesGenerated = 0;
        
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
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(16);
                doc.text('DATA MATRIX КОДЫ ДЛЯ ПЕЧАТИ (ПРОДОЛЖЕНИЕ)', 105, 20, { align: 'center' });
                yPosition = 40;
                xPosition = 25;
            }
            
            // Генерируем DataMatrix
            console.log(`🔷 Генерация DataMatrix ${i + 1}/${reportData.codes.length}`);
            const dataMatrixUrl = await this.generateDataMatrix(codeValue);
            
            if (dataMatrixUrl) {
                try {
                    // Добавляем DataMatrix изображение
                    doc.addImage(dataMatrixUrl, 'PNG', xPosition, yPosition, dmSize, dmSize);
                    codesGenerated++;
                    
                    // Текст под кодом
                    doc.setFontSize(8);
                    doc.text(`${i + 1}`, xPosition + dmSize/2, yPosition + dmSize + 4, { align: 'center' });
                    
                    // Сокращенный код
                    const shortCode = this.formatCodeShort(codeValue);
                    if (shortCode.length > 12) {
                        // Разбиваем длинный код на две строки
                        const firstPart = shortCode.substring(0, 12);
                        const secondPart = shortCode.substring(12);
                        doc.text(firstPart, xPosition + dmSize/2, yPosition + dmSize + 8, { align: 'center' });
                        doc.text(secondPart, xPosition + dmSize/2, yPosition + dmSize + 12, { align: 'center' });
                    } else {
                        doc.text(shortCode, xPosition + dmSize/2, yPosition + dmSize + 8, { align: 'center' });
                    }
                    
                    xPosition += dmSize + spacing;
                    
                } catch (imageError) {
                    console.error(`❌ Ошибка добавления изображения ${i + 1}:`, imageError);
                    // Показываем текст вместо изображения
                    this.addCodeAsText(doc, codeValue, xPosition, yPosition, i);
                    xPosition += 80;
                }
            } else {
                // Если не удалось сгенерировать DataMatrix, показываем текст
                this.addCodeAsText(doc, codeValue, xPosition, yPosition, i);
                xPosition += 80;
            }
        }
        
        console.log(`✅ Сгенерировано DataMatrix кодов: ${codesGenerated}/${reportData.codes.length}`);
    }
    
    // ДОБАВЬТЕ этот вспомогательный метод
    addCodeAsText(doc, code, x, y, index) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`${index + 1}. ${this.formatCodeForDisplay(code)}`, x, y + 15);
    }

    async generateDataMatrix(data) {
        return new Promise((resolve) => {
            try {
                if (typeof bwipjs === 'undefined') {
                    console.warn('⚠️ bwip-js not available for DataMatrix');
                    resolve(null);
                    return;
                }
                
                const canvas = document.createElement('canvas');
                // УВЕЛИЧЬТЕ размер для лучшего качества
                canvas.width = 200;
                canvas.height = 200;
                
                // УЛУЧШЕННЫЕ НАСТРОЙКИ DataMatrix
                bwipjs.toCanvas(canvas, {
                    bcid: 'datamatrix',       // Тип кода
                    text: data,               // Данные
                    scale: 3,                 // Масштаб
                    height: 10,               // Высота
                    width: 10,                // Ширина
                    includetext: false,       // Не показывать текст
                    textxalign: 'center',     // Выравнивание
                });
                
                console.log('✅ DataMatrix generated successfully');
                
                // Проверяем что canvas не пустой
                if (canvas.width > 0 && canvas.height > 0) {
                    resolve(canvas.toDataURL('image/png'));
                } else {
                    console.warn('⚠️ Canvas пустой');
                    resolve(null);
                }
                
            } catch (error) {
                console.error('❌ Data Matrix generation failed:', error);
                resolve(null);
            }
        });
    }
    formatCodeShort(code) {
        if (!code) return 'N/A';
        
        try {
            let cleanCode = code;
            if (code.includes('\u001d')) {
                cleanCode = code.replace(/\u001d/g, '');
            }
            
            if (cleanCode.length > 15) {
                return cleanCode.substring(0, 8) + '...';
            }
            return cleanCode;
        } catch (error) {
            return 'ERR';
        }
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
