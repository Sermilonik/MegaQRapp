// js/pdfmake-generator.js
class PDFMakeGenerator {
    constructor() {
        console.log('📄 PDFMake Generator initialized');
        
        // Проверяем загрузку pdfmake
        if (typeof pdfMake === 'undefined') {
            console.error('❌ pdfmake не загружен');
        } else {
            console.log('✅ pdfmake доступен');
        }
    }

    async generateReport(reportData) {
        console.log('📄 Generating PDF report with pdfmake:', reportData);
        
        try {
            if (typeof pdfMake === 'undefined') {
                throw new Error('pdfmake библиотека не загружена');
            }
    
            // Определяем документ (теперь асинхронно)
            const docDefinition = await this.createDocument(reportData);
            
            // Создаем PDF
            return new Promise((resolve, reject) => {
                pdfMake.createPdf(docDefinition).getBlob((blob) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        resolve(reader.result);
                    };
                    reader.onerror = reject;
                    reader.readAsArrayBuffer(blob);
                });
            });
            
        } catch (error) {
            console.error('❌ PDF generation error:', error);
            throw error;
        }
    }

    async createDocument(reportData) {
        // Генерируем DataMatrix секцию заранее
        const dataMatrixSection = await this.createDataMatrixSection(reportData.codes);
        
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
                ...dataMatrixSection
            ],
            
            styles: {
                // ... существующие стили без изменений
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
            // Заголовок таблицы
            [
                { text: '№', style: 'tableHeader', alignment: 'center' },
                { text: 'КОД DATA MATRIX', style: 'tableHeader' },
                { text: 'ДАТА СКАНИРОВАНИЯ', style: 'tableHeader' },
                { text: 'ВРЕМЯ', style: 'tableHeader' }
            ]
        ];

        // Данные таблицы
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

    async createDataMatrixSection(codes) {
        if (!codes || codes.length === 0) {
            return [{ text: 'Нет кодов для генерации', italics: true }];
        }
    
        const content = [];
        let currentRow = [];
        
        console.log('🔷 Генерация DataMatrix кодов...');
        
        // Генерируем все изображения заранее
        const imagePromises = codes.map(async (code, index) => {
            const codeValue = typeof code === 'string' ? code : code.code;
            
            try {
                if (typeof simpleQRGenerator !== 'undefined') {
                    const imageUrl = await simpleQRGenerator.generateDataMatrixForPDF(codeValue, 60);
                    if (imageUrl) {
                        return {
                            image: imageUrl,
                            width: 60,
                            height: 60,
                            alignment: 'center'
                        };
                    }
                }
            } catch (error) {
                console.error(`❌ Ошибка генерации кода ${index + 1}:`, error);
            }
            
            // Fallback - текстовый блок
            return {
                text: `Код ${index + 1}\n${this.formatCodeShort(codeValue)}`,
                alignment: 'center',
                fontSize: 8,
                margin: [0, 10, 0, 0]
            };
        });
        
        const images = await Promise.all(imagePromises);
        console.log(`✅ Сгенерировано ${images.filter(img => img.image).length} DataMatrix кодов`);
        
        // Создаем строки с изображениями
        images.forEach((imageItem, index) => {
            const code = codes[index];
            const codeValue = typeof code === 'string' ? code : code.code;
            
            const dataMatrixItem = {
                stack: [
                    imageItem,
                    {
                        text: `${index + 1}. ${this.formatCodeShort(codeValue)}`,
                        alignment: 'center',
                        fontSize: 7,
                        margin: [0, 5, 0, 0],
                        bold: true
                    }
                ],
                width: 'auto',
                alignment: 'center',
                margin: [0, 0, 15, 0]
            };
            
            currentRow.push(dataMatrixItem);
            
            // 3 элемента в строке для лучшего размещения
            if (currentRow.length === 3 || index === codes.length - 1) {
                content.push({
                    columns: currentRow,
                    margin: [0, 0, 0, 20]
                });
                currentRow = [];
            }
        });
    
        return content;
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
        return cleanCode.length > 15 
            ? cleanCode.substring(0, 8) + '...'
            : cleanCode;
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
const pdfMakeGenerator = new PDFMakeGenerator();