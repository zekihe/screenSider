import React, { useState, useEffect, useRef } from 'react'
import './common/styles/App.styl'

function App() {
    // State
    const [isRecording, setIsRecording] = useState(false)
    const [isMicEnabled, setIsMicEnabled] = useState(false)
    const [isCameraEnabled, setIsCameraEnabled] = useState(false)
    const [statusText, setStatusText] = useState('Ready')
    const [currentRecordingSource, setCurrentRecordingSource] = useState(null)
    const [supportedFormats, setSupportedFormats] = useState([])
    const [selectedFormat, setSelectedFormat] = useState('mp4')

    // Refs
    const mediaRecorderRef = useRef(null)
    const recordedChunksRef = useRef([])
    const recordingStreamRef = useRef(null)
    const audioStreamRef = useRef(null)
    const cameraStreamRef = useRef(null)

    // Initialize
    useEffect(() => {
        detectSupportedFormats()
        setupIPCEvents()
    }, [])

    // Detect supported video formats
    const detectSupportedFormats = () => {
        const formatsToCheck = [
            { name: 'webm', mimeType: 'video/webm;codecs=vp9' },
            { name: 'webm', mimeType: 'video/webm;codecs=vp8' },
            { name: 'mp4', mimeType: 'video/mp4;codecs=h264' },
            { name: 'mp4', mimeType: 'video/mp4;codecs=avc1' },
            { name: 'webm', mimeType: 'video/webm' },
            { name: 'mp4', mimeType: 'video/mp4' }
        ]

        const supported = formatsToCheck.filter((format) =>
            MediaRecorder.isTypeSupported(format.mimeType)
        )

        setSupportedFormats(supported)

        // Update selectedFormat if default is not supported
        if (!supported.some((format) => format.name === selectedFormat)) {
            setSelectedFormat(supported[0]?.name || 'webm')
        }
    }

    // Setup IPC events
    const setupIPCEvents = () => {
        // Format selection from settings window
        if (window.electronAPI && window.electronAPI.onStatusChange) {
            window.electronAPI.onStatusChange((status) => {
                setStatusText(status)
            })
        } else {
            console.warn('electronAPI not available yet, retrying...')
            // Retry after a short delay
            // setTimeout(setupIPCEvents, 100);
        }
    }

    // Recording Functions
    const toggleRecording = async () => {
        if (isRecording) {
            stopRecording()
        } else {
            await startRecording()
        }
    }

    const startRecording = async () => {
        try {
            // Get screen recording permission
            const permission = await window.electronAPI.toggleRecording()
            if (!permission) {
                showErrorNotification('申请桌面录制权限失败')
                return
            }

            let screenSource

            // If already have a selected recording source, use it
            if (currentRecordingSource) {
                screenSource = currentRecordingSource
            } else {
                // Otherwise get default recording source
                const sources = await window.electronAPI.getSources()
                if (sources.length === 0) {
                    showErrorNotification('未找到可用的录制源')
                    return
                }

                // Prefer screen as default recording source
                screenSource = sources.find(
                    (source) => source.type === 'screen' || source.id.startsWith('screen')
                )

                // If no screen source, choose first window source
                if (!screenSource) {
                    screenSource = sources.find(
                        (source) => source.type === 'window' || source.id.startsWith('window')
                    )
                }

                // If still no source found, use first available source
                if (!screenSource) {
                    screenSource = sources[0]
                }

                // Save current selected recording source
                setCurrentRecordingSource(screenSource)
            }

            if (!screenSource) {
                showErrorNotification('未找到可用的录制源')
                return
            }

            // Create media stream with screen recording
            let stream
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: screenSource.id,
                            minWidth: 1280,
                            maxWidth: 1920,
                            minHeight: 720,
                            maxHeight: 1080
                        }
                    }
                })
            } catch (screenError) {
                console.error('Error accessing screen:', screenError)
                let errorMessage = '无法访问屏幕录制功能'
                if (screenError.name === 'NotAllowedError') {
                    errorMessage = '屏幕录制权限被拒绝，请在系统设置中允许访问'
                } else if (screenError.name === 'NotFoundError') {
                    errorMessage = '未找到可用的屏幕录制设备'
                }
                showErrorNotification(errorMessage)
                return
            }

            // Store the recording stream
            recordingStreamRef.current = stream

            // Add microphone audio stream if enabled
            if (isMicEnabled) {
                try {
                    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
                    const audioTrack = audioStream.getAudioTracks()[0]
                    audioTrack.enabled = isMicEnabled
                    stream.addTrack(audioTrack)
                    audioStreamRef.current = audioStream
                } catch (audioError) {
                    console.error('Error adding audio stream:', audioError)
                    audioStreamRef.current = null
                    setIsMicEnabled(false)
                    let errorMessage = '无法访问麦克风'
                    if (audioError.name === 'NotAllowedError') {
                        errorMessage = '麦克风权限被拒绝，请在系统设置中允许访问'
                    } else if (audioError.name === 'NotFoundError') {
                        errorMessage = '未检测到麦克风设备'
                    }
                    showErrorNotification(errorMessage)
                }
            }

            // Add camera stream if enabled
            if (isCameraEnabled) {
                try {
                    const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true })
                    const cameraTrack = cameraStream.getVideoTracks()[0]
                    stream.addTrack(cameraTrack)
                    cameraStreamRef.current = cameraStream
                } catch (cameraError) {
                    console.error('Error adding camera stream:', cameraError)
                    cameraStreamRef.current = null
                    setIsCameraEnabled(false)
                    let errorMessage = '无法访问摄像头'
                    if (cameraError.name === 'NotAllowedError') {
                        errorMessage = '摄像头权限被拒绝，请在系统设置中允许访问'
                    } else if (cameraError.name === 'NotFoundError') {
                        errorMessage = '未检测到摄像头设备'
                    }
                    showErrorNotification(errorMessage)
                }
            }

            // Start recording
            // Find the best MIME type for the selected format
            const formatMimeTypes = supportedFormats.filter(
                (format) => format.name === selectedFormat
            )
            const mimeType = formatMimeTypes[0]?.mimeType || 'video/webm;codecs=vp9'

            const mediaRecorder = new MediaRecorder(stream, { mimeType })
            mediaRecorderRef.current = mediaRecorder
            recordedChunksRef.current = []

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data)
                }
            }

            mediaRecorder.onstop = () => {
                saveRecording(recordedChunksRef.current)
                recordedChunksRef.current = []
                // Stream cleanup is handled in stopRecording function
            }

            mediaRecorder.start()
            setIsRecording(true)
            setStatusText('Recording')
        } catch (error) {
            console.error('Error starting recording:', error)
            let errorMessage = '无法开始录制'
            if (error.name === 'NotAllowedError') {
                errorMessage = '录制权限被拒绝，请检查系统权限设置'
            }
            showErrorNotification(errorMessage)
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
            setStatusText('Ready')

            // Stop and clean up all streams
            if (recordingStreamRef.current) {
                recordingStreamRef.current.getTracks().forEach((track) => track.stop())
                recordingStreamRef.current = null
            }

            if (audioStreamRef.current) {
                audioStreamRef.current.getTracks().forEach((track) => track.stop())
                audioStreamRef.current = null
            }

            if (cameraStreamRef.current) {
                cameraStreamRef.current.getTracks().forEach((track) => track.stop())
                cameraStreamRef.current = null
            }
        }
    }

    const saveRecording = (chunks) => {
        // Get the MIME type for the selected format
        const formatMimeTypes = supportedFormats.filter((format) => format.name === selectedFormat)
        const mimeType = formatMimeTypes[0]?.mimeType || 'video/webm'

        const blob = new Blob(chunks, { type: mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `recording-${Date.now()}.${selectedFormat}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    // Control Functions
    const toggleMic = async () => {
        try {
            const flagPermiss = await window.electronAPI.sysPermission('microphone')
            if (!flagPermiss) {
                showErrorNotification('用户拒绝了麦克风访问权限')
                return
            }

            const newState = !isMicEnabled
            setIsMicEnabled(newState)

            // If already recording, update audio track
            if (isRecording && recordingStreamRef.current && audioStreamRef.current) {
                audioStreamRef.current.getTracks().forEach((track) => {
                    track.enabled = newState
                })
            }
        } catch (error) {
            console.error('Error toggling mic:', error)
        }
    }

    const toggleCamera = async () => {
        try {
            const flagPermiss = await window.electronAPI.sysPermission('camera')
            if (!flagPermiss) {
                showErrorNotification('用户拒绝了摄像头访问权限')
                return
            }

            const newState = !isCameraEnabled
            setIsCameraEnabled(newState)

            console.log(`
        Toggling Permiss to ${flagPermiss}\n  
        Toggling camera to ${newState}\n
      `)
            // Toggle camera window
            window.electronAPI.toggleCameraWindow(newState)

            // If already recording, update camera track
            if (isRecording && cameraStreamRef.current) {
                cameraStreamRef.current.getTracks().forEach((track) => {
                    track.enabled = newState
                })
            } else if (!isRecording && cameraStreamRef.current) {
                // If not recording, stop camera stream
                cameraStreamRef.current.getTracks().forEach((track) => track.stop())
                cameraStreamRef.current = null
            }
        } catch (error) {
            console.error('Error toggling camera:', error)
        }
    }

    const openSettings = () => {
        // Open settings window and pass current selected format
        window.electronAPI.showSettingsWindow(selectedFormat)
    }

    const showScreenSelector = () => {
        try {
            // Show screen selector window
            window.electronAPI.showScreenSelector()

            // Wait for user to select a screen source
            window.electronAPI.onScreenSelected((event, selectedSource) => {
                if (selectedSource) {
                    setCurrentRecordingSource(selectedSource)
                }
            })
        } catch (error) {
            console.error('Error showing screen selector:', error)
            showErrorNotification('无法显示屏幕选择器')
        }
    }

    // Error Notification
    const showErrorNotification = (message, duration = 3000) => {
        // Send error message to main process
        window.electronAPI.showError({ message, duration })
    }

    return (
        <div className="app">
            <div className="container">
                <div className={`status-indicator ${isRecording ? 'active' : ''}`}>
                    <div className="status-dot"></div>
                    <span className="status-text">{isRecording ? 'Recording' : 'Ready'}</span>
                </div>

                <div className="controls">
                    <button
                        id="mic-btn"
                        className={`control-btn ${isMicEnabled ? 'active' : ''}`}
                        onClick={toggleMic}
                        title="麦克风"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                            <line x1="12" y1="19" x2="12" y2="23"></line>
                            <line x1="8" y1="23" x2="16" y2="23"></line>
                        </svg>
                    </button>

                    <button
                        id="camera-btn"
                        className={`control-btn ${isCameraEnabled ? 'active' : ''}`}
                        onClick={toggleCamera}
                        title="摄像头"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                            <line x1="8" y1="21" x2="16" y2="21"></line>
                            <line x1="12" y1="17" x2="12" y2="21"></line>
                        </svg>
                    </button>

                    <button
                        id="settings-btn"
                        className="control-btn"
                        onClick={openSettings}
                        title="设置"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                        </svg>
                    </button>
                </div>

                <button
                    id="rec-btn"
                    className={`rec-btn ${isRecording ? 'recording' : ''}`}
                    onClick={toggleRecording}
                >
                    <div className={`rec-indicator ${isRecording ? 'blinking' : ''}`}></div>
                    <span>{isRecording ? 'stop' : 'REC'}</span>
                </button>
            </div>
        </div>
    )
}

export default App
