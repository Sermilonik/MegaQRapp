class PDFGenerator {
    async generateReport(reportData) {
        console.log('📄 PDF Generator received data:', reportData);
        
        const doc = new jspdf.jsPDF();
        
        // Улучшенная структура отчета
        const text = {
            title: 'WAREHOUSE SCANNING REPORT',
            reportNumber: 'Report Number:',
            sequentialNumber: 'Sequential No:',
            scanDate: 'Scan Date:',
            contractor: 'Contractor:',
            contractors: 'Contractors:',
            reportId: 'Report ID:',
            codesCount: 'Total Codes:',
            status: 'Status:',
            codesList: 'Scanned Codes List:',
            individualDataMatrix: 'INDIVIDUAL DATA MATRIX CODES'
        };
        
        // ЗАГОЛОВОК
        doc.setFontSize(18);
        doc.setTextColor(40, 40, 40);
        doc.text(text.title, 105, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('Honest Sign System - Warehouse Operations', 105, 28, { align: 'center' });
        
        let yPosition = 45;
        
        // ОСНОВНАЯ ИНФОРМАЦИЯ ОБ ОТЧЕТЕ
        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        
        // Порядковый номер отчета - ИСПРАВЛЯЕМ ЭТО
        doc.setFont(undefined, 'bold');
        doc.text(text.sequentialNumber, 20, yPosition);
        doc.setFont(undefined, 'normal');
        const sequentialNumber = reportData.sequentialNumber || 'N/A';
        doc.text(`#${sequentialNumber}`, 70, yPosition);
        yPosition += 8;
        
        // ID отчета
        doc.setFont(undefined, 'bold');
        doc.text(text.reportId, 20, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(reportData.id || 'N/A', 70, yPosition);
        yPosition += 8;
        
        // Дата сканирования
        doc.setFont(undefined, 'bold');
        doc.text(text.scanDate, 20, yPosition);
        doc.setFont(undefined, 'normal');
        const scanDate = new Date(reportData.createdAt);
        doc.text(scanDate.toLocaleString('ru-RU'), 70, yPosition);
        yPosition += 8;
        
        // Контрагенты - ИСПРАВЛЯЕМ ЭТО
        doc.setFont(undefined, 'bold');
        doc.text(text.contractors, 20, yPosition);
        doc.setFont(undefined, 'normal');
        
        // Безопасное получение имен контрагентов
        let contractorsText = 'Unknown';
            if (reportData.contractors && Array.isArray(reportData.contractors)) {
                contractorsText = reportData.contractors.map(c => {
                return c && c.name ? this.transliterate(c.name) : 'Unknown Contractor';
            }).join(', ');
        } else if (reportData.contractorName) {

            contractorsText = this.transliterate(reportData.contractorName);
        }
        
        console.log('👥 Contractors text for PDF:', contractorsText);
        
        // Разбиваем длинный текст на несколько строк если нужно
        const contractorsLines = doc.splitTextToSize(contractorsText, 120);
        doc.text(contractorsLines, 70, yPosition);
        yPosition += contractorsLines.length * 7;
        
        // Количество кодов
        doc.setFont(undefined, 'bold');
        doc.text(text.codesCount, 20, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(String(reportData.codes ? reportData.codes.length : 0), 70, yPosition);
        yPosition += 8;
        
        // Статус
        doc.setFont(undefined, 'bold');
        doc.text(text.status, 20, yPosition);
        doc.setFont(undefined, 'normal');
        const statusText = reportData.status === 'processed' ? 'PROCESSED' : 'PENDING PROCESSING';
        doc.text(statusText, 70, yPosition);
        yPosition += 15;
        
        // РАЗДЕЛИТЕЛЬНАЯ ЛИНИЯ
        doc.setDrawColor(200, 200, 200);
        doc.line(20, yPosition, 190, yPosition);
        yPosition += 10;
        
        // СПИСОК КОДОВ
        doc.setFont(undefined, 'bold');
        doc.text(text.codesList, 20, yPosition);
        yPosition += 8;
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        
        // Заголовки таблицы
        doc.setFillColor(240, 240, 240);
        doc.rect(20, yPosition, 170, 8, 'F');
        doc.setFont(undefined, 'bold');
        doc.text('#', 25, yPosition + 6);
        doc.text('CODE', 40, yPosition + 6);
        doc.text('SCAN TIME', 150, yPosition + 6);
        yPosition += 12;
        
        // Данные кодов
        doc.setFont(undefined, 'normal');
        reportData.codes.forEach((code, index) => {
            if (yPosition > 270) {
                doc.addPage();
                yPosition = 20;
                // Повторяем заголовки на новой странице
                doc.setFont(undefined, 'bold');
                doc.text('Scanned Codes (continued):', 20, yPosition);
                yPosition += 15;
                doc.setFillColor(240, 240, 240);
                doc.rect(20, yPosition, 170, 8, 'F');
                doc.text('#', 25, yPosition + 6);
                doc.text('CODE', 40, yPosition + 6);
                doc.text('SCAN TIME', 150, yPosition + 6);
                yPosition += 12;
                doc.setFont(undefined, 'normal');
            }
            
            const codeValue = typeof code === 'string' ? code : code.code;
            const timestamp = code.timestamp ? 
                new Date(code.timestamp).toLocaleTimeString('ru-RU') : 'N/A';
            
            // Чередуем фон строк для читабельности
            if (index % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(20, yPosition - 4, 170, 8, 'F');
            }
            
            doc.text(`${index + 1}`, 25, yPosition);
            doc.text(this.formatCodeForDisplay(codeValue), 40, yPosition);
            doc.text(timestamp, 150, yPosition);
            yPosition += 8;
        });
    
        // DATA MATRIX КОДЫ НА НОВОЙ СТРАНИЦЕ
        await this.addIndividualDataMatrixToPDF(doc, reportData);
        
        return doc.output('arraybuffer');
    }

    generateAccountantReport(reportData) {
        console.log('📊 Generating accountant report:', reportData);
        
        const doc = new jspdf.jsPDF();
        
        // ЗАГОЛОВОК ДЛЯ БУХГАЛТЕРИИ
        doc.setFontSize(16);
        doc.text('ОТЧЕТ ДЛЯ БУХГАЛТЕРИИ - ЧЕСТНЫЙ ЗНАК', 105, 20, { align: 'center' });
        
        let yPosition = 40;
        
        // ИНФОРМАЦИЯ О КОНТРАГЕНТАХ
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('КОНТРАГЕНТЫ:', 20, yPosition);
        doc.setFont(undefined, 'normal');
        yPosition += 8;
        
        if (reportData.contractors && Array.isArray(reportData.contractors)) {
            reportData.contractors.forEach((contractor, index) => {
                doc.text(`${index + 1}. ${contractor.name} (${contractor.category})`, 25, yPosition);
                yPosition += 6;
            });
        }
        yPosition += 10;
        
        // ТАБЛИЦА КОДОВ ДЛЯ 1С
        doc.setFont(undefined, 'bold');
        doc.text('СПИСОК QR-КОДОВ ДЛЯ СПИСАНИЯ:', 20, yPosition);
        yPosition += 10;
        
        // Заголовок таблицы
        doc.setFillColor(240, 240, 240);
        doc.rect(20, yPosition, 170, 8, 'F');
        doc.setFont(undefined, 'bold');
        doc.text('№', 25, yPosition + 6);
        doc.text('QR-КОД', 40, yPosition + 6);
        doc.text('ДАТА СКАНИРОВАНИЯ', 130, yPosition + 6);
        yPosition += 12;
        
        // Данные кодов
        doc.setFont(undefined, 'normal');
        reportData.codes.forEach((code, index) => {
            if (yPosition > 270) {
                doc.addPage();
                yPosition = 20;
            }
            
            const codeValue = typeof code === 'string' ? code : code.code;
            const scanDate = code.timestamp ? 
                new Date(code.timestamp).toLocaleString('ru-RU') : new Date().toLocaleString('ru-RU');
            
            // Чередующийся фон для читаемости
            if (index % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(20, yPosition - 4, 170, 8, 'F');
            }
            
            doc.text(`${index + 1}`, 25, yPosition);
            doc.text(codeValue, 40, yPosition); // ПОЛНЫЙ КОД ДЛЯ 1С
            doc.text(scanDate, 130, yPosition);
            yPosition += 8;
        });
        
        // ФУТЕР С ИНФОРМАЦИЕЙ
        yPosition += 10;
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Отчет сгенерирован: ${new Date().toLocaleString('ru-RU')}`, 20, yPosition);
        doc.text(`Всего кодов: ${reportData.codes.length}`, 20, yPosition + 5);
        doc.text(`Контрагентов: ${reportData.contractors ? reportData.contractors.length : 1}`, 20, yPosition + 10);
        
        return doc.output('arraybuffer');
    }

    // В pdf-generator.js добавьте метод транслитерации
    transliterate(text) {
        if (!text) return 'Unknown';
    
        const translitMap = {
            'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
            'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
            'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
            'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
            'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
            'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E',
            'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
            'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
            'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '',
            'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
        };
    
        return text.split('').map(char => translitMap[char] || char).join('');
    }

    async addIndividualDataMatrixToPDF(doc, reportData) {
        console.log('🔄 Generating individual Data Matrix codes...');
        
        // Новая страница для Data Matrix кодов
        doc.addPage();
        
        doc.setFontSize(16);
        doc.text('INDIVIDUAL DATA MATRIX CODES', 105, 20, { align: 'center' });
        
        doc.setFontSize(10);
        
        // Безопасное получение данных для заголовка
        const reportId = reportData.id || 'N/A';
        let contractorText = 'Unknown';
        if (reportData.contractors && Array.isArray(reportData.contractors)) {
            contractorText = reportData.contractors.map(c => this.transliterate(c.name)).join(', ');
        } else if (reportData.contractorName) {
            contractorText = this.transliterate(reportData.contractorName);
        }
        
        doc.text(`Report: ${reportId} | Contractor: ${contractorText}`, 105, 30, { align: 'center' });
        
        // Проверяем доступность библиотек
        console.log('📚 dmtx available:', typeof dmtx !== 'undefined');
        console.log('📚 bwipjs available:', typeof bwipjs !== 'undefined');
        
        // Тестируем генерацию
        const testDM = await this.generateDataMatrix('TEST123');
        console.log('🧪 Test Data Matrix result:', testDM !== null);
    
        if (!testDM) {
            console.error('❌ Data Matrix generation failed completely');
            // Можно показать сообщение пользователю
            doc.setFontSize(14);
            doc.text('DATA MATRIX GENERATION UNAVAILABLE', 105, 100, { align: 'center' });
            doc.text('Please check library connections', 105, 110, { align: 'center' });
            return;
        }
    
        let xPosition = 20;
        let yPosition = 50;
        const dmSize = 40;
        const spacing = 15;
        const codesPerRow = 4;
        
        for (let i = 0; i < reportData.codes.length; i++) {
            const code = reportData.codes[i];
            
            if (i > 0 && i % codesPerRow === 0) {
                xPosition = 20;
                yPosition += dmSize + 25;
            }
            
            if (yPosition + dmSize + 20 > 270) {
                doc.addPage();
                yPosition = 20;
                xPosition = 20;
                
                // Добавляем заголовок на новой странице
                doc.setFontSize(16);
                doc.text('INDIVIDUAL DATA MATRIX CODES (CONTINUED)', 105, 20, { align: 'center' });
                doc.setFontSize(10);
                doc.text(`Report: ${reportId} | Contractor: ${contractorText}`, 105, 30, { align: 'center' });
                yPosition = 50;
            }
            
            const dataMatrixUrl = await this.generateDataMatrix(code.code);
            
            if (dataMatrixUrl) {
                doc.addImage(dataMatrixUrl, 'PNG', xPosition, yPosition, dmSize, dmSize);
                
                doc.setFontSize(8);
                doc.text(`${i + 1}.`, xPosition + dmSize/2, yPosition + dmSize + 4, { align: 'center' });
                doc.text(this.formatCodeForDisplay(code.code), xPosition + dmSize/2, yPosition + dmSize + 8, { align: 'center' });
                
                xPosition += dmSize + spacing;
            }
        }
        
        console.log('✅ Individual Data Matrix codes added to PDF');
    }

    async generateDataMatrix(data) {
        return new Promise((resolve) => {
            try {
                console.log('🔷 Generating Data Matrix for:', data);
                
                // Пробуем bwip-js
                if (typeof bwipjs !== 'undefined') {
                    try {
                        const canvas = document.createElement('canvas');
                        
                        // Генерируем Data Matrix через bwip-js
                        bwipjs.toCanvas(canvas, {
                            bcid: 'datamatrix',  // Data Matrix format
                            text: data,          // Data to encode
                            scale: 3,            // 3x scaling
                            height: 12,          // Height in modules
                            width: 12,           // Width in modules  
                            includetext: false,  // Don't include human text
                            textxalign: 'center' // Center alignment
                        });
                        
                        console.log('✅ Data Matrix generated with bwip-js');
                        resolve(canvas.toDataURL('image/png'));
                        return;
                        
                    } catch (error) {
                        console.error('bwip-js Data Matrix error:', error);
                    }
                }
    
                // Если bwip-js не сработал
                console.error('❌ No Data Matrix library available');
                resolve(null);
    
            } catch (error) {
                console.error('Data Matrix generation error:', error);
                resolve(null);
            }
        });
    }
    
    async addIndividualQRCodesToPDF(doc, reportData) {
        console.log('🔄 Generating individual QR codes...');
        
        if (typeof qrcode === 'undefined') {
            console.error('❌ QRCode library not loaded');
            return;
        }

        try {
            // Новая страница для индивидуальных QR-кодов
            doc.addPage();
            
            doc.setFontSize(16);
            doc.text('INDIVIDUAL PRODUCT QR CODES', 105, 20, { align: 'center' });
            
            doc.setFontSize(10);
            doc.text(`Report: ${reportData.id} | Contractor: ${reportData.contractorName}`, 105, 30, { align: 'center' });
            
            let xPosition = 20;
            let yPosition = 50;
            const qrSize = 40;
            const spacing = 15;
            const codesPerRow = 4;
            
            // Генерируем QR-код для каждого продукта
            for (let i = 0; i < reportData.codes.length; i++) {
                const code = reportData.codes[i];
                
                // Новая строка после codesPerRow кодов
                if (i > 0 && i % codesPerRow === 0) {
                    xPosition = 20;
                    yPosition += qrSize + 25;
                }
                
                // Новая страница если не хватает места
                if (yPosition + qrSize + 20 > 270) {
                    doc.addPage();
                    yPosition = 20;
                    xPosition = 20;
                }
                
                // Генерируем QR-код для конкретного кода
                const qrCodeUrl = await this.generateQRCode(code.code);
                
                if (qrCodeUrl) {
                    // QR-код
                    doc.addImage(qrCodeUrl, 'PNG', xPosition, yPosition, qrSize, qrSize);
                    
                    // Номер и код под QR-кодом
                    doc.setFontSize(8);
                    doc.text(`${i + 1}.`, xPosition + qrSize/2, yPosition + qrSize + 4, { align: 'center' });
                    doc.text(this.formatCodeForDisplay(code.code), xPosition + qrSize/2, yPosition + qrSize + 8, { align: 'center' });
                    
                    xPosition += qrSize + spacing;
                }
            }
            
            console.log('✅ Individual QR codes added to PDF');
            
        } catch (error) {
            console.error('❌ Individual QR codes generation failed:', error);
        }
    }
    
    formatCodeForDisplay(code) {
        if (code.length > 15) {
            return code.substring(0, 8) + '...' + code.substring(code.length - 4);
        }
        return code;
    }
    
    async generateQRCode(data) {
        return new Promise((resolve) => {
            try {
                const typeNumber = 0;
                const errorCorrectionLevel = 'H';
                const qr = qrcode(typeNumber, errorCorrectionLevel);
                qr.addData(data);
                qr.make();
                
                const canvas = document.createElement('canvas');
                const size = 100;
                canvas.width = size;
                canvas.height = size;
                
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, size, size);
                
                const moduleCount = qr.getModuleCount();
                const pixelSize = size / moduleCount;
                
                ctx.fillStyle = '#000000';
                for (let row = 0; row < moduleCount; row++) {
                    for (let col = 0; col < moduleCount; col++) {
                        if (qr.isDark(row, col)) {
                            ctx.fillRect(col * pixelSize, row * pixelSize, pixelSize, pixelSize);
                        }
                    }
                }
                
                resolve(canvas.toDataURL('image/png'));
                
            } catch (error) {
                console.error('QR code generation error:', error);
                resolve(null);
            }
        });
    }
    
    downloadPDF(pdfBytes, filename) {
        try {
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
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