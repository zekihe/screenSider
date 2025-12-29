// utils/recorder.js - 简单的Node.js录制器
const { spawn } = require('child_process');
const path = require('path');

class SimpleRecorder {
    constructor() {
        this.process = null;
        this.isRecording = false;
    }
    
    async start(options) {
        if (this.isRecording) return;
        
        const outputPath = options.outputPath || 
            path.join(require('os').homedir(), 'Desktop', `recording-${Date.now()}.mp4`);
        
        let args = [];
        
        // macOS
        if (process.platform === 'darwin') {
            args = [
                '-f', 'avfoundation',
                '-capture_cursor', '1',
                '-capture_mouse_clicks', '1',
                '-i', `${options.screenId || '1'}:${options.audioDevice || 'default'}`,
                '-c:v', 'h264_videotoolbox',  // 硬件编码
                '-q:v', '80',
                '-c:a', 'aac',
                '-b:a', '128k',
                outputPath
            ];
        }
        // Windows (可以用gdigrab或dxgigrab)
        else if (process.platform === 'win32') {
            args = [
                '-f', 'gdigrab',
                '-framerate', '30',
                '-i', 'desktop',
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-pix_fmt', 'yuv420p',
                outputPath
            ];
        }
        
        this.process = spawn('ffmpeg', args);
        this.isRecording = true;
        
        // 监听输出
        this.process.stderr.on('data', (data) => {
            console.log('FFmpeg:', data.toString());
        });
        
        return { outputPath, pid: this.process.pid };
    }
    
    stop() {
        if (this.process && this.isRecording) {
            this.process.kill('SIGINT');
            this.isRecording = false;
            this.process = null;
            return true;
        }
        return false;
    }
}

module.exports = new SimpleRecorder();