import React, { useEffect, useRef } from 'react'
import './CameraOverlay.styl'

function CameraOverlay() {
    const videoRef = useRef(null)
    let cameraStream = null

    useEffect(() => {
        // 初始化摄像头
        console.log('Camera useEffect', videoRef, videoRef.current)
        if (videoRef.current) {
            setupEventListeners()
        }

        // 清理函数
        return () => {
            stopCameraPreview()
        }
    }, [])

    // 设置事件监听器
    const setupEventListeners = () => {
        console.log('Setting up event listeners for camera overlay')
        if (window.electronAPI) {
            // 启动摄像头预览
            startCameraPreview()
            // 监听主进程的toggle-camera事件
            window.electronAPI.onToggleCamera((isEnabled) => {
                console.log('onToggleCamera', isEnabled)
                if (isEnabled) {
                    startCameraPreview()
                } else {
                    stopCameraPreview()
                }
            })

            // 监听关闭事件
            window.electronAPI.onCloseOverlay(() => {
                console.log('onCloseOverlay')
                stopCameraPreview()
            })
        }
    }

    // 启动摄像头预览
    const startCameraPreview = async () => {
        try {
            console.log('startCameraPreview', cameraStream)
            // 如果已有流，先停止
            if (cameraStream) {
                await stopCameraPreview()
            }

            // 获取摄像头流
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 200 },
                    height: { ideal: 200 },
                    facingMode: 'user'
                }
            })

            // 设置流到video元素
            if (videoRef.current) {
                videoRef.current.srcObject = cameraStream
            }

            // 向主进程发送就绪信号
            window.electronAPI.cameraReady()
        } catch (error) {
            console.error('Failed to start camera preview:', error)

            // 提供用户友好的错误信息
            let errorMessage = '无法访问摄像头'
            if (error.name === 'NotAllowedError') {
                errorMessage = '摄像头权限被拒绝，请在系统设置中允许访问'
            } else if (error.name === 'NotFoundError') {
                errorMessage = '未检测到摄像头设备'
            } else if (error.name === 'NotReadableError') {
                errorMessage = '摄像头正在被其他应用使用'
            }

            // 向主进程发送错误信息
            window.electronAPI.cameraError(errorMessage)
            throw error
        }
    }

    // 停止摄像头预览
    const stopCameraPreview = async () => {
        console.log('Stopping camera preview')
        if (cameraStream) {
            cameraStream.getTracks().forEach((track) => track.stop())
            cameraStream = null
        }

        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject = null
        }

        // 向主进程发送摄像头停止信号
        window.electronAPI.cameraStopped()
    }

    return <video id="camera-preview" ref={videoRef} autoPlay playsInline></video>
}

export default CameraOverlay
