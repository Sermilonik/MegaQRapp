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
        
        this.init();
    }
    
    init() {
        this.loadContractors();
        this.loadFromStorage();
        this.ensureDefaultContractors(); // Теперь этот метод существует
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
        try {
            const lines = csvData.split('\n').filter(line => line.trim());
            const imported = [];
        
            for (let i = 1; i < lines.length; i++) {
                const cells = this.parseCSVLine(lines[i]);
                if (cells.length >= 2) {
                    const name = cells[0].replace(/"/g, '').trim();
                    const category = cells[1] ? cells[1].replace(/"/g, '').trim() : 'Партнер';
                
                    if (name && !this.contractors.some(c => c.name === name)) {
                        const contractor = this.addContractor(name, category);
                        imported.push(contractor);
                    }
                }
            }
        
            return imported;
        } catch (error) {
            console.error('Import error:', error);
            throw new Error('Ошибка импорта данных');
        }
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

    // Работа с кодами
    addScannedCode(code) {
        const scannedCode = {
            code: code,
            timestamp: new Date().toISOString()
        };
        
        this.currentSession.scannedCodes.push(scannedCode);
        this.saveToStorage();
        
        return scannedCode;
    }

    removeScannedCode(code) {
        this.currentSession.scannedCodes = this.currentSession.scannedCodes.filter(
            scannedCode => scannedCode.code !== code
        );
        this.saveToStorage();
    }

    hasCodeBeenScanned(code) {
        return this.currentSession.scannedCodes.some(
            scannedCode => scannedCode.code === code
        );
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

    // Сохранение/загрузка
    saveToStorage() {
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
    }

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
}

// Глобальный экземпляр
const appState = new AppState();
