class AppState {
    constructor() {
        this.contractors = [];
        this.currentSession = {
            id: null,
            contractorIds: [],
            scannedCodes: [],
            createdAt: null
        };
        
        this.sentSessions = [];
        this.reports = [];
        this.reportCounter = 1;
        this.firebaseSync = null;
        
        this.init();
    }
    
    async init() {
        this.loadContractors();
        this.loadFromStorage();
        this.ensureDefaultContractors();
        
        // Инициализируем Firebase синхронизацию
        await this.initFirebaseSync();
    }

    // Инициализация Firebase синхронизации
    async initFirebaseSync() {
        console.log('🔄 AppState: Инициализация Firebase синхронизации...');
        
        if (typeof initFirebaseSync === 'function') {
            try {
                // Ждем инициализации FirebaseSyncManager
                let attempts = 0;
                while (attempts < 10) {
                    this.firebaseSync = initFirebaseSync();
                    if (this.firebaseSync && this.firebaseSync.isConnected) {
                        console.log('✅ AppState: Firebase синхронизация активирована');
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                    attempts++;
                }
                
                if (this.firebaseSync && this.firebaseSync.isConnected) {
                    // Синхронизируем данные при старте
                    setTimeout(async () => {
                        await this.syncWithFirebase();
                    }, 3000);
                } else {
                    console.log('ℹ️ AppState: Firebase синхронизация недоступна');
                }
            } catch (error) {
                console.error('❌ AppState: Ошибка инициализации Firebase:', error);
                this.firebaseSync = null;
            }
        } else {
            console.log('ℹ️ AppState: Модуль FirebaseSync не загружен');
        }
    }

    // Синхронизация с Firebase
    async syncWithFirebase() {
        console.log('🔄 AppState: Синхронизация с Firebase...');
        
        if (!this.firebaseSync || !this.firebaseSync.isConnected) {
            console.log('🔄 AppState: Firebase не доступен');
            return this.contractors;
        }
    
        try {
            // Загружаем данные из Firebase
            const cloudContractors = await this.firebaseSync.loadFromFirebase();
            
            if (!cloudContractors || cloudContractors.length === 0) {
                console.log('☁️ В облаке нет данных, сохраняем локальные...');
                await this.firebaseSync.saveContractorsToFirebase(this.contractors);
                return this.contractors;
            }
    
            // Объединяем данные
            const mergedContractors = this.mergeContractors(this.contractors, cloudContractors);
            
            // Сохраняем объединенные данные обратно
            await this.firebaseSync.saveContractorsToFirebase(mergedContractors);
            
            // Обновляем локальные данные
            this.contractors = mergedContractors;
            this.saveContractors();
            
            console.log(`🔄 Синхронизация завершена. Результат: ${mergedContractors.length} контрагентов`);
            
            return mergedContractors;
    
        } catch (error) {
            console.error('❌ AppState: Ошибка синхронизации с Firebase:', error);
            return this.contractors;
        }
    }

    // Метод объединения контрагентов
    mergeContractors(local, cloud) {
        console.log('🔄 Объединение данных...');
        console.log('📱 Локальные:', local.map(c => `${c.id}:${c.name}`));
        console.log('☁️ Облачные:', cloud.map(c => `${c.id}:${c.name}`));
        
        // Создаем карту для объединения
        const mergedMap = new Map();
        
        // Сначала добавляем облачные данные (приоритет облака)
        cloud.forEach(cloudContractor => {
            mergedMap.set(cloudContractor.id, { ...cloudContractor, source: 'cloud' });
        });
        
        // Затем добавляем локальные, только если ID нет в облаке
        local.forEach(localContractor => {
            if (!mergedMap.has(localContractor.id)) {
                mergedMap.set(localContractor.id, { ...localContractor, source: 'local' });
            } else {
                console.log(`⚡ Конфликт ID ${localContractor.id}: Облако "${mergedMap.get(localContractor.id).name}" vs Локально "${localContractor.name}"`);
                // Приоритет у облачных данных
            }
        });
        
        const merged = Array.from(mergedMap.values()).map(({ source, ...contractor }) => contractor);
        
        console.log(`📊 Объединение завершено. Локально: ${local.length}, Облако: ${cloud.length}, Результат: ${merged.length}`);
        console.log('✅ Результат:', merged.map(c => `${c.id}:${c.name}`));
        
        return merged.sort((a, b) => a.id - b.id);
    }
    
    // Гарантируем наличие контрагентов по умолчанию
    ensureDefaultContractors() {
        console.log('🔄 AppState: Проверка контрагентов по умолчанию');
        
        // Если контрагентов нет вообще - создаем стандартных
        if (this.contractors.length === 0) {
            console.log('📝 AppState: Создаем контрагентов по умолчанию');
            
            const defaultContractors = [
                { id: 1, name: 'ООО "Ромашка"', category: 'Оптовый покупатель', createdAt: new Date().toISOString() },
                { id: 2, name: 'ИП Иванов', category: 'Розничная сеть', createdAt: new Date().toISOString() },
                { id: 3, name: 'ООО "Луч"', category: 'Дилер', createdAt: new Date().toISOString() },
                { id: 4, name: 'АО "Вектор"', category: 'Партнер', createdAt: new Date().toISOString() }
            ];
            
            this.contractors = defaultContractors;
            this.saveContractors();
            console.log('✅ AppState: Созданы контрагенты по умолчанию');
        } else {
            console.log(`✅ AppState: Уже есть ${this.contractors.length} контрагентов`);
        }
    }

    // ОСНОВНОЙ МЕТОД ЗАГРУЗКИ КОНТРАГЕНТОВ
    loadContractors() {
        console.log('🔍 AppState: Загрузка контрагентов из хранилища');
        
        try {
            const savedContractors = localStorage.getItem('honest_sign_contractors');
            
            if (savedContractors) {
                this.contractors = JSON.parse(savedContractors);
                console.log(`✅ AppState: Загружено ${this.contractors.length} контрагентов из localStorage`);
            } else {
                console.log('ℹ️ AppState: Нет сохраненных контрагентов');
            }
        } catch (error) {
            console.error('❌ AppState: Ошибка загрузки контрагентов:', error);
            this.contractors = [];
        }
    }

    // ОСНОВНОЙ МЕТОД СОХРАНЕНИЯ КОНТРАГЕНТОВ
    saveContractors() {
        console.log('💾 AppState: Сохранение контрагентов в хранилище');
        console.log('📊 Данные для сохранения:', this.contractors);
        
        try {
            localStorage.setItem('honest_sign_contractors', JSON.stringify(this.contractors));
            
            // Проверяем сохранение
            const saved = localStorage.getItem('honest_sign_contractors');
            if (saved) {
                const parsed = JSON.parse(saved);
                console.log(`✅ AppState: Сохранено ${parsed.length} контрагентов`);
                console.log('🔍 Проверка:', parsed.length === this.contractors.length ? '✅ Данные совпадают' : '❌ Данные не совпадают');
            } else {
                console.error('❌ AppState: Данные не сохранились в localStorage');
            }
            
        } catch (error) {
            console.error('❌ AppState: Критическая ошибка сохранения контрагентов:', error);
        }
    }

    // Контрагенты - геттеры
    getContractors() {
        return this.contractors;
    }

    getContractor(id) {
        return this.contractors.find(c => c.id === id);
    }

    getAllContractors() {
        return this.contractors;
    }

    // Добавление контрагента
    addContractor(name, category = 'Партнер') {
        console.log(`👤 AppState: Добавление контрагента "${name}"`);
        
        const newContractor = {
            id: this.generateContractorId(),
            name: name,
            category: category,
            createdAt: new Date().toISOString()
        };
    
        this.contractors.push(newContractor);
        this.saveContractors();
        return newContractor;
    }

    updateContractor(id, name, category) {
        const contractor = this.contractors.find(c => c.id === id);
        if (contractor) {
            contractor.name = name;
            contractor.category = category;
            this.saveContractors();
            return true;
        }
        return false;
    }

    deleteContractor(id) {
        this.contractors = this.contractors.filter(c => c.id !== id);
        this.saveContractors();
        return true;
    }

    generateContractorId() {
        const maxId = this.contractors.reduce((max, c) => Math.max(max, c.id), 0);
        return maxId + 1;
    }

    // Импорт/экспорт
    exportContractorsToCSV() {
        const headers = ['ID', 'Название', 'Категория', 'Дата создания'];
        const rows = this.contractors.map(c => [
            c.id,
            `"${c.name}"`,
            `"${c.category}"`,
            c.createdAt
        ]);
    
        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        return csv;
    }

    importContractorsFromCSV(csvData) {
        console.log('📥 AppState: Импорт контрагентов из CSV');
        
        try {
            const lines = csvData.split('\n').filter(line => line.trim());
            
            if (lines.length === 0) {
                throw new Error('Файл пустой');
            }
            
            let importedCount = 0;
            let skippedCount = 0;
            
            console.log(`📊 Найдено строк в CSV: ${lines.length}`);
            
            // Обрабатываем каждую строку
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Пропускаем пустые строки и заголовки
                if (!line || this.isHeaderLine(line)) {
                    console.log(`⏭️ Пропускаем строку ${i + 1}: "${line}"`);
                    skippedCount++;
                    continue;
                }
                
                const cells = this.parseCSVLine(line);
                console.log(`📝 Обработка строки ${i + 1}:`, cells);
                
                if (cells.length >= 1) {
                    const name = cells[0].replace(/"/g, '').trim();
                    const category = cells[1] ? cells[1].replace(/"/g, '').trim() : 'Импортированные';
                    
                    if (name) {
                        // Проверяем дубликаты
                        const exists = this.contractors.some(c => 
                            c.name.toLowerCase() === name.toLowerCase()
                        );
                        
                        if (!exists) {
                            const contractor = this.addContractor(name, category);
                            importedCount++;
                            console.log(`✅ Добавлен: ${name}`);
                        } else {
                            skippedCount++;
                            console.log(`⏭️ Дубликат: ${name}`);
                        }
                    } else {
                        skippedCount++;
                        console.log(`⏭️ Пустое название в строке ${i + 1}`);
                    }
                } else {
                    skippedCount++;
                    console.log(`⏭️ Недостаточно данных в строке ${i + 1}`);
                }
            }
            
            console.log(`📊 Итоги импорта: добавлено ${importedCount}, пропущено ${skippedCount}`);
            
            if (importedCount > 0) {
                showSuccess(`Импортировано ${importedCount} контрагентов`, 5000);
            } else {
                showWarning('Не найдено новых контрагентов для импорта', 5000);
            }
            
            return importedCount;
            
        } catch (error) {
            console.error('❌ Ошибка импорта:', error);
            showError(`Ошибка импорта: ${error.message}`);
            throw error;
        }
    }
    
    // Вспомогательный метод для определения заголовков
    isHeaderLine(line) {
        const headerPatterns = [
            /название/i, /name/i, /контрагент/i, /организация/i,
            /категория/i, /category/i, /id/i, /№/i
        ];
        
        return headerPatterns.some(pattern => pattern.test(line));
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }

    // Текущая сессия
    startNewSession(contractorIds) {
        this.currentSession = {
            id: this.generateId(),
            contractorIds: Array.isArray(contractorIds) ? contractorIds : [contractorIds],
            scannedCodes: [],
            createdAt: new Date().toISOString()
        };
        this.saveToStorage();
    }

    getCurrentSession() {
        return this.currentSession;
    }

    clearCurrentSession() {
        this.currentSession = {
            id: null,
            contractorIds: [],
            scannedCodes: [],
            createdAt: null
        };
        this.saveToStorage();
    }

    // Добавление кода
    addScannedCode(code) {
        console.log('💾 AppState: Добавление сканированного кода:', code.substring(0, 20) + '...');
        
        // Проверяем, что currentSession существует
        if (!this.currentSession) {
            console.error('❌ currentSession не существует, создаем новую');
            this.currentSession = {
                id: this.generateId(),
                contractorIds: [],
                scannedCodes: [],
                createdAt: new Date().toISOString()
            };
        }
        
        // Проверяем, что scannedCodes массив существует
        if (!Array.isArray(this.currentSession.scannedCodes)) {
            console.error('❌ scannedCodes не массив, создаем новый');
            this.currentSession.scannedCodes = [];
        }
        
        const scannedCode = {
            code: code,
            timestamp: new Date().toISOString()
        };
        
        console.log('📦 Добавляем код в scannedCodes');
        this.currentSession.scannedCodes.push(scannedCode);
        
        console.log('💾 Сохраняем в хранилище...');
        this.saveToStorage();
        
        console.log(`✅ Код добавлен. Всего кодов: ${this.currentSession.scannedCodes.length}`);
        
        return scannedCode;
    }

    removeScannedCode(code) {
        console.log('🗑️ AppState: Удаление кода:', code.substring(0, 20) + '...');
        
        if (!this.currentSession || !Array.isArray(this.currentSession.scannedCodes)) {
            console.error('❌ Нет сессии или scannedCodes для удаления');
            return;
        }
        
        const initialLength = this.currentSession.scannedCodes.length;
        this.currentSession.scannedCodes = this.currentSession.scannedCodes.filter(
            scannedCode => scannedCode.code !== code
        );
        
        const finalLength = this.currentSession.scannedCodes.length;
        console.log(`📊 Удалено кодов: ${initialLength} → ${finalLength}`);
        
        this.saveToStorage();
        console.log('✅ Код удален и сохранен');
    }

    hasCodeBeenScanned(code) {
        if (!this.currentSession || !Array.isArray(this.currentSession.scannedCodes)) {
            console.log('ℹ️ Нет сессии или scannedCodes, считаем код новым');
            return false;
        }
        
        const isDuplicate = this.currentSession.scannedCodes.some(
            scannedCode => scannedCode.code === code
        );
        
        console.log(`🔍 Проверка дубликата "${code.substring(0, 20)}...": ${isDuplicate ? 'ДУБЛИКАТ' : 'НОВЫЙ'}`);
        return isDuplicate;
    }

    // Отчеты
    saveReport(report) {
        console.log('💾 AppState: Сохранение отчета');

        // Добавляем порядковый номер
        report.sequentialNumber = this.reportCounter++;
        report.submittedAt = new Date().toISOString();

        console.log('🔢 Назначен номер:', report.sequentialNumber);
        console.log('👥 Контрагенты в отчете:', report.contractors);
        
        this.reports.unshift(report);
        this.saveReports(this.reports);
        
        // Очищаем текущую сессию после сохранения отчета
        this.clearCurrentSession();
        
        // Сохраняем счетчик в localStorage
        this.saveToStorage();

        console.log('✅ Отчет сохранен');
    }

    getReports() {
        return this.reports;
    }

    getAllReports() {
        return this.reports;
    }

    saveReports(reports) {
        this.reports = reports;
        localStorage.setItem('honest_sign_reports', JSON.stringify(reports));
    }

    // Отправка сессий
    sendCurrentSession() {
        if (this.currentSession.scannedCodes.length === 0) {
            return false;
        }

        this.sentSessions.unshift({
            ...this.currentSession,
            sentAt: new Date().toISOString()
        });

        this.saveToStorage();
        return true;
    }

    // Вспомогательные методы
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Сохранение
    saveToStorage() {
        console.log('💾 AppState: Сохранение в localStorage...');
        
        try {
            localStorage.setItem('honest_sign_current_session', JSON.stringify(this.currentSession));
            localStorage.setItem('honest_sign_sent_sessions', JSON.stringify(this.sentSessions));
            localStorage.setItem('honest_sign_reports', JSON.stringify(this.reports));
            localStorage.setItem('honest_sign_report_counter', this.reportCounter.toString());
            
            // Сохраняем выбранных контрагентов отдельно
            const selectedContractorsData = {
                contractorIds: this.currentSession.contractorIds || [],
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('honest_sign_selected_contractors', JSON.stringify(selectedContractorsData));
            
            console.log('✅ Данные сохранены в localStorage');
            
        } catch (error) {
            console.error('❌ Ошибка сохранения в localStorage:', error);
        }
    }

    //Загрузка
    loadFromStorage() {
        try {
            const savedSession = localStorage.getItem('honest_sign_current_session');
            const savedSentSessions = localStorage.getItem('honest_sign_sent_sessions');
            const savedReports = localStorage.getItem('honest_sign_reports');
            const savedCounter = localStorage.getItem('honest_sign_report_counter');

            if (savedSession) {
                this.currentSession = JSON.parse(savedSession);
            }
            
            if (savedSentSessions) {
                this.sentSessions = JSON.parse(savedSentSessions);
            }
            
            if (savedReports) {
                this.reports = JSON.parse(savedReports);
            }
            
            if (savedCounter) {
                this.reportCounter = parseInt(savedCounter);
            }
        } catch (error) {
            console.error('Ошибка загрузки из localStorage:', error);
        }
    }

    // СИНХРОНИЗАЦИЯ ДАННЫХ МЕЖДУ УСТРОЙСТВАМИ
    syncWithCloud() {
        console.log('☁️ AppState: Синхронизация с облаком');
        
        // Проверяем наличие облачного API
        if (typeof CloudSync !== 'undefined' && CloudSync.isAvailable()) {
            return this.syncWithCloudAPI();
        } 
        // Проверяем наличие Firebase
        else if (typeof firebase !== 'undefined') {
            return this.syncWithFirebase();
        }
        // Базовый обмен через QR-код
        else {
            return this.syncWithQRCode();
        }
    }

    // Базовый обмен данными через QR-код
    syncWithQRCode() {
        console.log('📱 AppState: Синхронизация через QR-код');
        
        const syncData = {
            contractors: this.contractors,
            timestamp: new Date().toISOString(),
            device: navigator.userAgent.substring(0, 50)
        };
        
        const jsonData = JSON.stringify(syncData);
        
        // Показываем QR-код для экспорта
        this.showExportQRCode(jsonData);
        
        return new Promise((resolve) => {
            // Здесь будет логика сканирования QR-кода для импорта
            console.log('✅ Данные готовы для экспорта через QR-код');
            resolve(true);
        });
    }

    showExportQRCode(data) {
        // Создаем модальное окно с QR-кодом
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); display: flex; justify-content: center;
            align-items: center; z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 10px; text-align: center;">
                <h3>📱 Синхронизация данных</h3>
                <p>Отсканируйте этот QR-код на другом устройстве:</p>
                <div id="qrcodeContainer"></div>
                <button onclick="this.closest('.sync-modal').remove()" 
                        style="margin-top: 15px; padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px;">
                    Закрыть
                </button>
            </div>
        `;
        
        modal.className = 'sync-modal';
        document.body.appendChild(modal);
        
        // Генерируем QR-код (нужна библиотека QRCode.js)
        if (typeof QRCode !== 'undefined') {
            new QRCode(document.getElementById('qrcodeContainer'), {
                text: data,
                width: 200,
                height: 200
            });
        }
    }

    // Импорт данных из QR-кода
    importFromQRCode(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            if (data.contractors && Array.isArray(data.contractors)) {
                console.log(`📥 Импорт ${data.contractors.length} контрагентов`);
                
                let importedCount = 0;
                
                data.contractors.forEach(contractor => {
                    // Проверяем дубликаты по ID и имени
                    const existsById = this.contractors.some(c => c.id === contractor.id);
                    const existsByName = this.contractors.some(c => c.name === contractor.name);
                    
                    if (!existsById && !existsByName) {
                        this.contractors.push(contractor);
                        importedCount++;
                    }
                });
                
                this.saveContractors();
                showSuccess(`Импортировано ${importedCount} контрагентов`, 5000);
                return true;
            }
        } catch (error) {
            console.error('❌ Ошибка импорта из QR-кода:', error);
            showError('Ошибка импорта данных');
        }
        return false;
    }

    // Экспорт данных для синхронизации
    exportForSync() {
        const exportData = {
            contractors: this.contractors,
            timestamp: new Date().toISOString(),
            version: '1.0',
            total: this.contractors.length
        };
        
        console.log(`📤 Экспорт ${this.contractors.length} контрагентов`);
        return JSON.stringify(exportData, null, 2);
    }

    manualImport(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            if (data.contractors && Array.isArray(data.contractors)) {
                console.log(`📥 Импорт ${data.contractors.length} контрагентов`);
                
                let importedCount = 0;
                
                data.contractors.forEach(contractor => {
                    // Проверяем дубликаты по ID и имени
                    const existsById = this.contractors.some(c => c.id === contractor.id);
                    const existsByName = this.contractors.some(c => c.name === contractor.name);
                    
                    if (!existsById && !existsByName) {
                        this.contractors.push(contractor);
                        importedCount++;
                    }
                });
                
                this.saveContractors();
                showSuccess(`Импортировано ${importedCount} контрагентов`, 5000);
                return importedCount;
            }
        } catch (error) {
            console.error('❌ Ошибка импорта:', error);
            showError('Ошибка импорта данных');
        }
        return 0;
    }
    
    syncWithQRCode() {
        console.log('📱 AppState: Показать QR-код для синхронизации');
        
        const exportData = this.exportForSync();
        
        // Создаем модальное окно с информацией
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); display: flex; justify-content: center;
            align-items: center; z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 10px; text-align: center; max-width: 90%;">
                <h3>📱 Синхронизация данных</h3>
                <p>Экспортировано контрагентов: <strong>${this.contractors.length}</strong></p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <p><strong>Скопируйте этот текст на другом устройстве:</strong></p>
                    <textarea style="width: 100%; height: 100px; border: 1px solid #ddd; border-radius: 4px; padding: 8px; font-family: monospace; font-size: 12px;" readonly>${exportData}</textarea>
                </div>
                <p><small>На другом устройстве используйте "Импорт данных" → Вставить JSON</small></p>
                <button onclick="this.closest('.sync-modal').remove()" 
                        style="margin-top: 15px; padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px;">
                    Закрыть
                </button>
            </div>
        `;
        
        modal.className = 'sync-modal';
        document.body.appendChild(modal);
    }
    
    importFromQRCode(jsonData) {
        return this.manualImport(jsonData);
    }
}

// Глобальный экземпляр
const appState = new AppState();
