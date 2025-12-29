const { ipcRenderer, desktopCapturer } = require('electron');
const { BrowserWindow } = require('@electron/remote');
let mainStream;
let pipStream;
let mediaRecorder;
let isDragging = false;
let startX, startY;
let pipVideo;
let desktopTrack;
let cameraTrack;
let micTrack;
let systemAudioTrack;

document.getElementById('open-new-window').addEventListener('click', () => {
    const newWindow = new BrowserWindow({
        width: 400,
        height: 400,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });
    console.log('newWindow', newWindow)

    newWindow.loadFile('new-window.html');
});

document.getElementById('start-record').addEventListener('click', async () => {
    try {
        console.log('DesktopCapturer', desktopCapturer)
        // const desktopCapturer = remote.require('electron').desktopCapturer;
        const desktopSources = await DesktopCapturer.getSources({ types: ['screen'] });
        const desktopSource = desktopSources[0];
        const desktopConstraints = {
            video: {
                mandatory: {
                    chromeMediaSource:'screen',
                    chromeMediaSourceId: desktopSource.id,
                    maxWidth: window.screen.width,
                    maxHeight: window.screen.height
                }
            },
            audio: false
        };

        const cameraConstraints = {
            video: { width: 1280, height: 720, facingMode: 'user' },
            audio: false
        };

        const micConstraints = {
            audio: true,
            video: false
        };

        const systemAudioSources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
        const systemAudioSource = systemAudioSources.find(s => s.name === 'System Audio');
        const systemAudioConstraints = {
            audio: {
                mandatory: {
                    chromeMediaSource:'system',
                    chromeMediaSourceId: systemAudioSource.id
                }
            },
            video: false
        };

        const desktopPromise = navigator.mediaDevices.getUserMedia(desktopConstraints);
        const cameraPromise = navigator.mediaDevices.getUserMedia(cameraConstraints);
        const micPromise = navigator.mediaDevices.getUserMedia(micConstraints);
        const systemAudioPromise = systemAudioSource? navigator.mediaDevices.getUserMedia(systemAudioConstraints) : Promise.resolve(null);

        const [desktopMedia, cameraMedia, micMedia, systemAudioMedia] = await Promise.all([desktopPromise, cameraPromise, micPromise, systemAudioPromise]);

        mainStream = new MediaStream();
        pipStream = new MediaStream();

        desktopTrack = desktopMedia.getVideoTracks()[0];
        cameraTrack = cameraMedia.getVideoTracks()[0];
        micTrack = micMedia.getAudioTracks()[0];
        systemAudioTrack = systemAudioMedia? systemAudioMedia.getAudioTracks()[0] : null;

        mainStream.addTrack(desktopTrack);
        mainStream.addTrack(micTrack);
        if (systemAudioTrack) {
            mainStream.addTrack(systemAudioTrack);
        }

        pipStream.addTrack(cameraTrack);

        document.getElementById('main-video').srcObject = mainStream;
        pipVideo = document.getElementById('pip-video');
        pipVideo.srcObject = pipStream;

        startRecording();
    } catch (err) {
        console.error('无法获取录制源:', err);
    }
});

document.getElementById('stop-record').addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state!== 'inactive') {
        mediaRecorder.stop();
        if (mainStream) {
            mainStream.getTracks().forEach(track => track.stop());
        }
        if (pipStream) {
            pipStream.getTracks().forEach(track => track.stop());
        }
        document.getElementById('stop-record').disabled = true;
        document.getElementById('start-record').disabled = false;
    }
});

document.getElementById('disable-mic').addEventListener('click', () => {
    if (micTrack) {
        micTrack.enabled =!micTrack.enabled;
        document.getElementById('disable-mic').text = micTrack.enabled? '禁用麦克风' : '启用麦克风';
    }
});

document.getElementById('close-camera').addEventListener('click', () => {
    if (cameraTrack) {
        cameraTrack.enabled =!cameraTrack.enabled;
        document.getElementById('close-camera').text = cameraTrack.enabled? '关闭摄像头' : '打开摄像头';
    }
});

document.getElementById('close-desktop-record').addEventListener('click', () => {
    if (desktopTrack) {
        desktopTrack.enabled =!desktopTrack.enabled;
        document.getElementById('close-desktop-record').text = desktopTrack.enabled? '关闭桌面录制' : '打开桌面录制';
    }
});

document.getElementById('mute-system-audio').addEventListener('click', () => {
    if (systemAudioTrack) {
        systemAudioTrack.enabled =!systemAudioTrack.enabled;
        document.getElementById('mute-system-audio').text = systemAudioTrack.enabled? '系统音频静音' : '系统音频取消静音';
    }
});

function startRecording() {
    const combinedStream = new MediaStream();
    if (mainStream) {
        mainStream.getTracks().forEach(track => combinedStream.addTrack(track));
    }
    if (pipStream) {
        pipStream.getTracks().forEach(track => combinedStream.addTrack(track));
    }
    mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/mp4'
    });
    const chunks = [];
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/mp4' });
        // 这里可以添加保存文件的逻辑，例如通过ipcRenderer发送给主进程保存
    };
    mediaRecorder.start();
    document.getElementById('stop-record').disabled = false;
    document.getElementById('start-record').disabled = true;
}

function setupPIP() {

    const pipVideo = document.getElementById('pip-video');
    console.log('setupPIP', pipVideo)
    pipVideo.style.position = 'absolute';
    pipVideo.style.left = '20px';
    pipVideo.style.top = '20px';

    pipVideo.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX-parseInt(pipVideo.style.left);
        startY = e.clientY-parseInt(pipVideo.style.top);
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            pipVideo.style.left = (e.clientX-startX) + 'px';
            pipVideo.style.top = (e.clientY-startY) + 'px';
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // 缩放功能示例（通过滚轮事件）
    pipVideo.addEventListener('wheel', (e) => {
        e.preventDefault();
        const scale = e.deltaY > 0? 0.9 : 1.1;
        const currentWidth = parseFloat(pipVideo.style.width);
        const currentHeight = parseFloat(pipVideo.style.height);
        pipVideo.style.width = (currentWidth * scale) + 'px';
        pipVideo.style.height = (currentHeight * scale) + 'px';
    });
}

setupPIP();