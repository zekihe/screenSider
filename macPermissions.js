class MacPermissions {
    constructor() {
        this.systemPreferences = require('electron').systemPreferences
    }

    async checkPermission(type) {
        switch(type) {
            case 'screen':
            return this.systemPreferences.getMediaAccessStatus('screen')
            case 'camera':
            return this.systemPreferences.getMediaAccessStatus('camera')
            case 'microphone':
            return this.systemPreferences.getMediaAccessStatus('microphone')
            case 'accessibility':
            return this.systemPreferences.isTrustedAccessibilityClient(false)
        }
    }

    async requestPermission(type) {
        try {
            switch(type) {
            case 'screen':
            case 'camera':
            case 'microphone':
                return await this.systemPreferences.askForMediaAccess(type)
            case 'accessibility':
                return this.systemPreferences.isTrustedAccessibilityClient(true)
            }
        } catch(error) {
            console.error(`Error requesting ${type} permission:`, error)
            return false
        }
    }
}

