// pdf-generator-bwip.js - генератор PDF с настоящими DataMatrix через bwip-js
class PDFGeneratorBwip {
    constructor() {
        console.log('📄 PDF Generator (bwip-js) initialized');
        
        // Проверяем библиотеки
        if (typeof bwipjs === 'undefined') {
            console.error('❌ bwip-js не загружен!');
            throw new Error('bwip-js не загружен');
        }
        
        if (typeof pdfMake === 'undefined') {
            console.error('❌ pdfMake не загружен!');
            throw new Error('pdfMake не загружен');
        }
        
        console.log('✅ Все библиотеки загружены');
    }

    async generateReport(reportData) {
        console.log('📄 Генерация PDF отчета с bwip-js...');
        
        try {
            // Генерируем DataMatrix изображения заранее
            const dataMatrixImages = await this.generateAllDataMatrixImages(reportData.codes);
            
            // Создаем документ
            const docDefinition = this.createDocument(reportData, dataMatrixImages);
            
            // Создаем PDF
            return new Promise((resolve, reject) => {
                try {
                    pdfMake.createPdf(docDefinition).getBlob((blob) => {
                        if (!blob) {
                            reject(new Error('Не удалось создать PDF'));
                            return;
                        }
                        
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsArrayBuffer(blob);
                    });
                } catch (error) {
                    reject(error);
                }
            });
            
        } catch (error) {
            console.error('❌ Ошибка генерации PDF:', error);
            throw error;
        }
    }

    async generateAllDataMatrixImages(codes) {
        console.log(`🔷 Генерация ${codes.length} DataMatrix кодов...`);
        
        const images = {};
        
        // Ограничиваем количество для производительности
        const maxCodes = Math.min(codes.length, 100);
        
        for (let i = 0; i < maxCodes; i++) {
            const code = codes[i];
            const codeValue = typeof code === 'string' ? code : code.code;
            const imageKey = `dm${i}`;
            
            try {
                const imageUrl = await this.generateDataMatrixWithBwip(codeValue);
                if (imageUrl) {
                    images[imageKey] = imageUrl;
                    console.log(`✅ Сгенерирован код ${i + 1}: ${codeValue.substring(0, 20)}...`);
                }
            } catch (error) {
                console.error(`❌ Ошибка генерации кода ${i + 1}:`, error);
            }
        }
        
        return images;
    }

    async generateDataMatrixWithBwip(data, size = 40) {
        return new Promise((resolve, reject) => {
            try {
                // Создаем canvas
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                
                // ВАЖНО: Правильные настройки для DataMatrix
                bwipjs.toCanvas(canvas, {
                    bcid: 'datamatrix',       // Тип кода
                    text: data,               // Данные
                    
                    // Критические параметры для правильного DataMatrix
                    scale: 3,                 // Масштаб
                    width: size,              // Ширина
                    height: size,             // Высота
                    
                    // Убираем все лишнее
                    includetext: false,       // Не показывать текст
                    textxalign: 'center',
                    
                    // Автоматический размер матрицы
                    columns: 0,               // Автоопределение
                    rows: 0,                  // Автоопределение
                    
                    // Цвета
                    backgroundcolor: 'FFFFFF',
                    barcolor: '000000',
                    
                    // Отступы
                    paddingwidth: 0,
                    paddingheight: 0
                });
                
                resolve(canvas.toDataURL('image/png'));
                
            } catch (error) {
                console.error('❌ Ошибка bwip-js:', error);
                
                // Пробуем альтернативные настройки
                try {
                    const canvas2 = document.createElement('canvas');
                    canvas2.width = size;
                    canvas2.height = size;
                    
                    bwipjs.toCanvas(canvas2, {
                        bcid: 'datamatrix',
                        text: data,
                        scale: 1,
                        width: size,
                        height: size,
                        includetext: false
                    });
                    
                    resolve(canvas2.toDataURL('image/png'));
                } catch (error2) {
                    reject(error2);
                }
            }
        });
    }

    createDocument(reportData, dataMatrixImages) {
        // Создаем секцию с DataMatrix кодами
        const dataMatrixContent = this.createDataMatrixContent(reportData.codes, dataMatrixImages);
        
        return {
            content: [
                // Заголовок
                {
                    text: 'ОТЧЕТ СКАНИРОВАНИЯ',
                    style: 'header',
                    alignment: 'center',
                    margin: [0, 0, 0, 10]
                },
                {
                    text: 'Система "Честный ЗНАК" - Складской учет',
                    style: 'subheader',
                    alignment: 'center',
                    margin: [0, 0, 0, 20]
                },
                
                // Информация отчета
                {
                    style: 'reportInfo',
                    table: {
                        widths: ['auto', '*'],
                        body: [
                            [
                                { text: 'Дата формирования:', style: 'label' },
                                { text: new Date().toLocaleString('ru-RU'), style: 'value' }
                            ],
                            [
                                { text: 'Номер отчета:', style: 'label' },
                                { text: `#${reportData.sequentialNumber || reportData.id}`, style: 'value' }
                            ],
                            [
                                { text: 'Период сканирования:', style: 'label' },
                                { text: new Date(reportData.createdAt).toLocaleDateString('ru-RU'), style: 'value' }
                            ],
                            [
                                { text: 'Всего кодов:', style: 'label' },
                                { text: String(reportData.codes ? reportData.codes.length : 0), style: 'value' }
                            ]
                        ]
                    },
                    layout: 'noBorders',
                    margin: [0, 0, 0, 20]
                },
                
                // Контрагенты
                {
                    text: 'Контрагенты:',
                    style: 'sectionHeader',
                    margin: [0, 0, 0, 10]
                },
                ...this.createContractorsSection(reportData.contractors),
                
                // Разделитель
                {
                    canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1, lineColor: '#cccccc' }],
                    margin: [0, 20, 0, 20]
                },
                
                // Список кодов
                {
                    text: 'Список отсканированных кодов:',
                    style: 'sectionHeader',
                    margin: [0, 0, 0, 10]
                },
                this.createCodesTable(reportData.codes),
                
                // DataMatrix коды (на новой странице)
                { text: '', pageBreak: 'before' },
                {
                    text: 'DATA MATRIX КОДЫ ДЛЯ ПЕЧАТИ',
                    style: 'header',
                    alignment: 'center',
                    margin: [0, 0, 0, 20]
                },
                {
                    text: `Отчет #${reportData.sequentialNumber || reportData.id} | ${new Date(reportData.createdAt).toLocaleDateString('ru-RU')}`,
                    style: 'subheader',
                    alignment: 'center',
                    margin: [0, 0, 0, 10]
                },
                ...dataMatrixContent
            ],
            
            // Добавляем все изображения в документ
            images: dataMatrixImages,
            
            styles: {
                header: {
                    fontSize: 18,
                    bold: true,
                    color: '#333333'
                },
                subheader: {
                    fontSize: 10,
                    color: '#666666'
                },
                sectionHeader: {
                    fontSize: 12,
                    bold: true,
                    color: '#333333'
                },
                label: {
                    fontSize: 12,
                    bold: true,
                    color: '#333333'
                },
                value: {
                    fontSize: 12,
                    color: '#333333'
                },
                tableHeader: {
                    bold: true,
                    fontSize: 10,
                    color: 'white',
                    fillColor: '#2c3e50'
                },
                tableCell: {
                    fontSize: 9
                }
            },
            
            defaultStyle: {
                font: 'Roboto'
            }
        };
    }

    createDataMatrixContent(codes, images) {
        const rows = [];
        let currentRow = [];
        
        // Ограничиваем количество
        const maxCodes = Math.min(codes.length, Object.keys(images).length);
        
        for (let i = 0; i < maxCodes; i++) {
            const code = codes[i];
            const codeValue = typeof code === 'string' ? code : code.code;
            const imageKey = `dm${i}`;
            
            const dmItem = {
                stack: [
                    {
                        image: imageKey,
                        width: 40,
                        height: 40,
                        alignment: 'center'
                    },
                    {
                        text: `${i + 1}. ${this.formatCodeShort(codeValue)}`,
                        fontSize: 6,
                        alignment: 'center',
                        margin: [0, 2, 0, 0]
                    }
                ],
                width: 80,
                alignment: 'center',
                margin: [0, 0, 0, 5]
            };
            
            currentRow.push(dmItem);
            
            // 4 кода в строке
            if (currentRow.length === 4 || i === maxCodes - 1) {
                rows.push({
                    columns: currentRow,
                    margin: [0, 0, 0, 10]
                });
                currentRow = [];
            }
        }
        
        return rows;
    }

    createContractorsSection(contractors) {
        if (!contractors || !Array.isArray(contractors)) {
            return [{ text: 'Контрагенты не указаны', italics: true, margin: [0, 0, 0, 10] }];
        }

        return contractors.map((contractor, index) => ({
            text: `${index + 1}. ${contractor.name} (${contractor.category})`,
            margin: [15, 0, 0, 5]
        }));
    }

    createCodesTable(codes) {
        if (!codes || codes.length === 0) {
            return { text: 'Нет отсканированных кодов', italics: true };
        }

        const tableBody = [
            [
                { text: '№', style: 'tableHeader', alignment: 'center' },
                { text: 'КОД DATA MATRIX', style: 'tableHeader' },
                { text: 'ДАТА СКАНИРОВАНИЯ', style: 'tableHeader' },
                { text: 'ВРЕМЯ', style: 'tableHeader' }
            ]
        ];

        codes.forEach((code, index) => {
            const codeValue = typeof code === 'string' ? code : code.code;
            const scanDate = code.timestamp ? new Date(code.timestamp) : new Date();
            
            tableBody.push([
                { text: (index + 1).toString(), style: 'tableCell', alignment: 'center' },
                { text: this.formatCodeForDisplay(codeValue), style: 'tableCell' },
                { text: scanDate.toLocaleDateString('ru-RU'), style: 'tableCell' },
                { text: scanDate.toLocaleTimeString('ru-RU'), style: 'tableCell' }
            ]);
        });

        return {
            table: {
                headerRows: 1,
                widths: ['auto', '*', 'auto', 'auto'],
                body: tableBody
            },
            layout: {
                fillColor: function (rowIndex) {
                    return (rowIndex % 2 === 0) ? '#f8f9fa' : null;
                }
            }
        };
    }

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
        if (cleanCode.length <= 8) return cleanCode;
        
        return cleanCode.substring(0, 4) + '...' + cleanCode.substring(cleanCode.length - 2);
    }

    downloadPDF(pdfBytes, filename) {
        console.log('💾 Скачивание PDF...');
        
        try {
            if (!pdfBytes) {
                throw new Error('Нет данных PDF');
            }
            
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename || `scan_report_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(link);
            link.click();
            
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);
            
            console.log('✅ PDF отправлен на скачивание');
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка скачивания PDF:', error);
            if (window.showError) {
                showError('Ошибка скачивания файла: ' + error.message);
            }
            return false;
        }
    }
}

// Глобальный экземпляр
const pdfMakeGenerator = new PDFGeneratorBwip();
