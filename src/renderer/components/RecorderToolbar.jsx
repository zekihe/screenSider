import React from 'react'
import { Mic, MicOff, Video, VideoOff, Settings2, Play, Pause, Square } from 'lucide-react'
import { useScreenRecorder } from '../hooks/useScreenRecorder'

export function RecorderToolbar() {
    const {
        // State
        isRecording,
        isPaused,
        isMicEnabled,
        isCameraEnabled,
        statusText,
        formattedTime,
        // Functions
        toggleRecording,
        togglePause,
        toggleMic,
        toggleCamera,
        openSettings,
        showScreenSelector
    } = useScreenRecorder()

    return (
        <div className="container">
            {!isRecording ? (
                // Ready state
                <>
                    <div className="status-indicator">
                        <div className="status-dot"></div>
                        <span className="status-text">Ready</span>
                    </div>
                    <div className="controls">
                        <button
                            className={`control-btn ${isMicEnabled ? 'active' : ''}`}
                            onClick={toggleMic}
                            title="麦克风"
                        >
                            {isMicEnabled ? <Mic size={24} /> : <MicOff size={24} />}
                        </button>

                        <button
                            className={`control-btn ${isCameraEnabled ? 'active' : ''}`}
                            onClick={toggleCamera}
                            title="摄像头"
                        >
                            {isCameraEnabled ? <Video size={24} /> : <VideoOff size={24} />}
                        </button>

                        <button
                            className="control-btn"
                            onClick={openSettings}
                            title="设置"
                        >
                            <Settings2 size={24} />
                        </button>
                    </div>
                    <button
                        className="rec-btn"
                        onClick={toggleRecording}
                    >
                        <div className="rec-indicator"></div>
                        <span>REC</span>
                    </button>
                </>
            ) : (
                // Recording state
                <>
                    <div className="status-indicator active">
                        <div className="status-dot"></div>
                        <span className="recording-time">{formattedTime}</span>
                    </div>
                    <div className="controls">
                        <button
                            className="control-btn pause-btn"
                            onClick={togglePause}
                            title={isPaused ? "继续" : "暂停"}
                        >
                            {isPaused ? <Play size={22} fill="currentColor"/> : <Pause size={22} fill="currentColor"/>}
                        </button>
                        <button
                            className="control-btn stop-btn"
                            onClick={toggleRecording}
                            title="停止录制"
                        >
                            <Square size={18} fill="currentColor"/>
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
