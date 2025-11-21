class CodeValidator {
    static validateHonestSignCode(code) {
        if (typeof code !== 'string') return false;
        
        const cleanedCode = code.trim();
        
        // Базовая проверка длины (может варьироваться)
        if (cleanedCode.length < 10 || cleanedCode.length > 150) {
            return false;
        }
        
        // Проверка на допустимые символы
        if (!/^[A-Za-z0-9+/\-=]+$/.test(cleanedCode)) {
            return false;
        }
        
        // Дополнительные проверки для формата "Честный знак"
        return this.validateGTIN(cleanedCode) || this.validateSGTIN(cleanedCode);
    }
    
    static validateGTIN(code) {
        // Проверка формата GTIN (Global Trade Item Number)
        const gtinPattern = /^01(\d{14})21([A-Za-z0-9!\"%&'()*+,\-./:;<=>?_]{1,20})$/;
        return gtinPattern.test(code);
    }
    
    static validateSGTIN(code) {
        // Проверка формата SGTIN (Serialized Global Trade Item Number)
        const sgtinPattern = /^(\d{14})21([A-Za-z0-9!\"%&'()*+,\-./:;<=>?_]{1,20})$/;
        return sgtinPattern.test(code);
    }
    
    static extractGTINFromCode(code) {
        // Извлечение GTIN из кода
        const match = code.match(/^01(\d{14})/);
        return match ? match[1] : null;
    }
    
    static formatCodeForDisplay(code) {
        if (!code) return '';
        
        // Форматирование для лучшего отображения
        if (code.length > 30) {
            return `${code.substring(0, 15)}...${code.substring(code.length - 10)}`;
        }
        
        return code;
    }
}