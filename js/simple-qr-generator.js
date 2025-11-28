// js/simple-qr-generator.js
class SimpleQRGenerator {
    constructor() {
        console.log('🔷 Simple QR Generator initialized');
    }

    // Простая генерация псевдо-QR кода (прямоугольник с данными)
    generateSimpleCode(data, size = 100) {
        return new Promise((resolve) => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                
                // Очищаем canvas
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, size, size);
                
                // Рамка
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.strokeRect(5, 5, size - 10, size - 10);
                
                // Внутренний узор (упрощенный)
                ctx.fillStyle = '#000';
                
                // Угловые маркеры
                this.drawCornerMarker(ctx, 10, 10, 15);
                this.drawCornerMarker(ctx, size - 25, 10, 15);
                this.drawCornerMarker(ctx, 10, size - 25, 15);
                
                // Текст с данными (первые несколько символов)
                ctx.fillStyle = '#000';
                ctx.font = '8px Arial';
                ctx.textAlign = 'center';
                
                const shortData = data.length > 20 ? data.substring(0, 17) + '...' : data;
                const lines = this.splitText(shortData, 12);
                
                lines.forEach((line, index) => {
                    ctx.fillText(line, size / 2, 50 + (index * 10));
                });
                
                // Номер в центре
                ctx.font = '12px Arial';
                ctx.fillText('📦', size / 2, size - 15);
                
                resolve(canvas.toDataURL('image/png'));
            } catch (error) {
                console.error('❌ Simple code generation failed:', error);
                resolve(null);
            }
        });
    }
    
    drawCornerMarker(ctx, x, y, size) {
        ctx.fillRect(x, y, size, size);
        ctx.clearRect(x + 2, y + 2, size - 4, size - 4);
        ctx.fillRect(x + 4, y + 4, size - 8, size - 8);
    }
    
    splitText(text, maxLength) {
        const words = text.split('');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
            if ((currentLine + word).length <= maxLength) {
                currentLine += word;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        }
        if (currentLine) lines.push(currentLine);
        
        return lines.slice(0, 3); // Максимум 3 строки
    }
    
    // Генерация DataMatrix-like кода (упрощенная версия)
    generateDataMatrix(data, size = 100) {
        return new Promise((resolve) => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                
                // Белый фон
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, size, size);
                
                // Черная рамка как у DataMatrix
                ctx.fillStyle = '#000';
                
                // Создаем простой узор (псевдо-DataMatrix)
                const moduleSize = 4;
                const modules = 10; // 10x10 модулей
                
                // Заполняем случайными модулями на основе хеша данных
                const hash = this.simpleHash(data);
                
                for (let x = 0; x < modules; x++) {
                    for (let y = 0; y < modules; y++) {
                        const index = (x * modules + y) % 32;
                        const bit = (hash >> index) & 1;
                        
                        if (bit) {
                            ctx.fillRect(
                                10 + x * moduleSize, 
                                10 + y * moduleSize, 
                                moduleSize - 1, 
                                moduleSize - 1
                            );
                        }
                    }
                }
                
                // L-образная рамка как у настоящего DataMatrix
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#000';
                
                // Левая и нижняя граница
                ctx.beginPath();
                ctx.moveTo(8, 8);
                ctx.lineTo(8, size - 8);
                ctx.lineTo(size - 8, size - 8);
                ctx.stroke();
                
                // Пунктирная правая и верхняя граница
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.moveTo(size - 8, size - 8);
                ctx.lineTo(size - 8, 8);
                ctx.lineTo(8, 8);
                ctx.stroke();
                ctx.setLineDash([]);
                
                resolve(canvas.toDataURL('image/png'));
            } catch (error) {
                console.error('❌ Simple DataMatrix generation failed:', error);
                resolve(null);
            }
        });
    }

    generateDataMatrix(data, size = 80) {
        return new Promise((resolve) => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                
                // Белый фон
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, size, size);
                
                // Черные модули DataMatrix
                ctx.fillStyle = 'black';
                
                // Создаем псевдо-DataMatrix паттерн на основе хеша данных
                const hash = this.simpleHash(data);
                const modules = 8; // 8x8 модулей для лучшего вида
                const moduleSize = Math.floor(size / modules);
                
                // Заполняем модули на основе хеша
                for (let x = 0; x < modules; x++) {
                    for (let y = 0; y < modules; y++) {
                        const index = (x * modules + y) % 32;
                        const bit = (hash >> index) & 1;
                        
                        if (bit) {
                            ctx.fillRect(
                                x * moduleSize, 
                                y * moduleSize, 
                                moduleSize - 1, 
                                moduleSize - 1
                            );
                        }
                    }
                }
                
                // L-образная рамка как у настоящего DataMatrix
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 2;
                
                // Левая и нижняя граница (сплошные)
                ctx.beginPath();
                ctx.moveTo(2, 2);
                ctx.lineTo(2, size - 2);
                ctx.lineTo(size - 2, size - 2);
                ctx.stroke();
                
                // Правая и верхняя граница (пунктирные для имитации настоящего DataMatrix)
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.moveTo(size - 2, size - 2);
                ctx.lineTo(size - 2, 2);
                ctx.lineTo(2, 2);
                ctx.stroke();
                ctx.setLineDash([]);
                
                console.log('✅ DataMatrix сгенерирован:', data.substring(0, 20) + '...');
                resolve(canvas.toDataURL('image/png'));
                
            } catch (error) {
                console.error('❌ Data Matrix generation failed:', error);
                // Fallback - простой квадрат
                this.generateSimpleFallback(data, size).then(resolve);
            }
        });
    }
    
    //ВСПОМОГАТЕЛЬНЫЙ МЕТОД
    generateDataMatrixForPDF(data, size = 60) {
        return this.generateDataMatrix(data, size);
    }
    
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        // Добавляем больше случайности для лучших паттернов
        hash = hash * 1664525 + 1013904223;
        return Math.abs(hash) % 0xFFFFFFFF;
    }
}

// Глобальный экземпляр
const simpleQRGenerator = new SimpleQRGenerator();