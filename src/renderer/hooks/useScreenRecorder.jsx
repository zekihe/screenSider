import { useState, useEffect, useRef } from 'react'

export function useScreenRecorder() {
    // State
    const [isRecording, setIsRecording] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [isMicEnabled, setIsMicEnabled] = useState(false)
    const [isCameraEnabled, setIsCameraEnabled] = useState(false)
    const [statusText, setStatusText] = useState('Ready')
    const [recordingStartTime, setRecordingStartTime] = useState(null)
    const [formattedTime, setFormattedTime] = useState('00:00')
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
            // setTimeout(setupIPCEvents, 100);
        }
    }

    // Recording timer effect
    useEffect(() => {
        let timerInterval = null

        if (recordingStartTime && isRecording && !isPaused) {
            const updateTime = () => {
                const elapsedTime = Date.now() - recordingStartTime
                const minutes = Math.floor(elapsedTime / 60000)
                const seconds = Math.floor((elapsedTime % 60000) / 1000)
                setFormattedTime(
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                )
            }

            // Update time immediately
            updateTime()

            // Set interval to update time every second
            timerInterval = setInterval(updateTime, 1000)
        }

        return () => {
            if (timerInterval) {
                clearInterval(timerInterval)
            }
        }
    }, [recordingStartTime, isRecording, isPaused])

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
            setIsPaused(false)
            setStatusText('Recording')
            setRecordingStartTime(Date.now())
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
            setIsPaused(false)
            setStatusText('Ready')
            setRecordingStartTime(null)
            setFormattedTime('00:00')

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

    const togglePause = () => {
        if (mediaRecorderRef.current && isRecording) {
            const newPausedState = !isPaused
            if (newPausedState) {
                mediaRecorderRef.current.pause()
                setStatusText('Paused')
            } else {
                mediaRecorderRef.current.resume()
                setStatusText('Recording')
            }
            setIsPaused(newPausedState)
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

    return {
        // State
        isRecording,
        isPaused,
        isMicEnabled,
        isCameraEnabled,
        statusText,
        recordingStartTime,
        formattedTime,
        currentRecordingSource,
        supportedFormats,
        selectedFormat,
        // Setters
        setSelectedFormat,
        // Functions
        toggleRecording,
        togglePause,
        toggleMic,
        toggleCamera,
        openSettings,
        showScreenSelector
    }
}
