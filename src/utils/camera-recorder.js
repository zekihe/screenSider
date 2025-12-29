// utils/camera-recorder.js
const { spawn } = require('child_process');

class CameraRecorder {
    constructor() {
        this.process = null;
    }
    
    async start(options) {
        // 直接录制摄像头，不录制屏幕
        const args = [
            '-f', 'avfoundation',
            '-i', `0:${options.audioDevice || 'default'}`,  // 0是摄像头
            '-c:v', 'h264_videotoolbox',
            '-q:v', '80',
            '-c:a', 'aac',
            '-b:a', '128k',
            options.outputPath
        ];
        
        this.process = spawn('ffmpeg', args);
        
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve({ success: true });
            }, 500);
        });
    }
    
    stop() {
        if (this.process) {
            this.process.kill('SIGINT');
            this.process = null;
            return true;
        }
        return false;
    }
}

module.exports = new CameraRecorder();