const { createFFmpeg, fetchFile } = require('@ffmpeg/ffmpeg');

class VideoConverter {
    constructor() {
        this.ffmpeg = createFFmpeg({
            log: true,
            corePath: require.resolve('@ffmpeg/core/dist/umd/ffmpeg-core.js')
        });
        this.initialized = false;
    }

    async init() {
        if (!this.initialized) {
            console.log('初始化 FFmpeg...');
            await this.ffmpeg.load();
            this.initialized = true;
            console.log('FFmpeg 初始化完成');
        }
    }

    async convertWebmToMp4(webmBlob, outputFileName = 'output.mp4') {
        try {
            await this.init();
            
            // 将 Blob 转换为 ArrayBuffer
            const arrayBuffer = await webmBlob.arrayBuffer();
            
            // 写入 FFmpeg 文件系统
            this.ffmpeg.FS('writeFile', 'input.webm', new Uint8Array(arrayBuffer));
            
            // 转换命令
            await this.ffmpeg.run(
                '-i', 'input.webm',
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-movflags', '+faststart',
                outputFileName
            );
            
            // 读取输出文件
            const data = this.ffmpeg.FS('readFile', outputFileName);
            
            // 清理文件系统
            this.ffmpeg.FS('unlink', 'input.webm');
            this.ffmpeg.FS('unlink', outputFileName);
            
            // 返回新的 Blob
            return new Blob([data.buffer], { type: 'video/mp4' });
            
        } catch (error) {
            console.error('转换失败:', error);
            throw error;
        }
    }

    async convertToFormat(inputBlob, format = 'mp4') {
        const inputName = 'input.webm';
        const outputName = `output.${format}`;
        
        try {
            await this.init();
            
            const arrayBuffer = await inputBlob.arrayBuffer();
            this.ffmpeg.FS('writeFile', inputName, new Uint8Array(arrayBuffer));
            
            let command = ['-i', inputName];
            
            switch (format) {
                case 'mp4':
                    command.push(
                        '-c:v', 'libx264',
                        '-preset', 'fast',
                        '-crf', '23',
                        '-c:a', 'aac',
                        '-b:a', '128k',
                        '-movflags', '+faststart'
                    );
                    break;
                case 'mov':
                    command.push(
                        '-c:v', 'libx264',
                        '-c:a', 'aac',
                        '-f', 'mov'
                    );
                    break;
                case 'avi':
                    command.push(
                        '-c:v', 'mpeg4',
                        '-q:v', '5',
                        '-c:a', 'mp3',
                        '-b:a', '192k'
                    );
                    break;
                case 'gif':
                    command.push(
                        '-vf', 'fps=10,scale=640:-1:flags=lanczos',
                        '-c:v', 'gif'
                    );
                    break;
                default:
                    throw new Error(`不支持的格式: ${format}`);
            }
            
            command.push(outputName);
            
            await this.ffmpeg.run(...command);
            
            const data = this.ffmpeg.FS('readFile', outputName);
            
            // 清理
            this.ffmpeg.FS('unlink', inputName);
            this.ffmpeg.FS('unlink', outputName);
            
            const mimeTypes = {
                mp4: 'video/mp4',
                mov: 'video/quicktime',
                avi: 'video/x-msvideo',
                gif: 'image/gif'
            };
            
            return new Blob([data.buffer], { type: mimeTypes[format] });
            
        } catch (error) {
            console.error(`转换为 ${format} 失败:`, error);
            throw error;
        }
    }

    async getVideoInfo(blob) {
        try {
            await this.init();
            
            const arrayBuffer = await blob.arrayBuffer();
            this.ffmpeg.FS('writeFile', 'temp.webm', new Uint8Array(arrayBuffer));
            
            await this.ffmpeg.run('-i', 'temp.webm');
            
            // 解析输出信息（简化版）
            const logs = this.ffmpeg.logger.logs.join('\n');
            
            this.ffmpeg.FS('unlink', 'temp.webm');
            
            const durationMatch = logs.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
            const resolutionMatch = logs.match(/(\d+)x(\d+)/);
            const fpsMatch = logs.match(/(\d+(\.\d+)?) fps/);
            
            return {
                duration: durationMatch ? 
                    `${durationMatch[1]}:${durationMatch[2]}:${Math.floor(parseFloat(durationMatch[3]))}` : 
                    '未知',
                resolution: resolutionMatch ? 
                    `${resolutionMatch[1]}x${resolutionMatch[2]}` : 
                    '未知',
                fps: fpsMatch ? fpsMatch[1] : '未知',
                format: blob.type,
                size: (blob.size / (1024 * 1024)).toFixed(2) + ' MB'
            };
            
        } catch (error) {
            console.error('获取视频信息失败:', error);
            return null;
        }
    }
}

// 导出单例
module.exports = new VideoConverter();