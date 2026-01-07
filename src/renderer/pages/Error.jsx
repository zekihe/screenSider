import React, { useState, useEffect, useRef } from 'react'
import './Error.styl'

function Error() {
    const [message, setMessage] = useState('')
    const [isVisible, setIsVisible] = useState(false)
    const hideTimeoutRef = useRef(null)

    useEffect(() => {
        // 监听主进程的错误信息
        if (window.electronAPI) {
            window.electronAPI.onShowError((event, { message, duration }) => {
                showError(message, duration)
            })
        }

        // 清理函数
        return () => {
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current)
            }
        }
    }, [])

    // 显示错误提示
    const showError = (errorMessage, duration = 3000) => {
        // 设置错误消息
        setMessage(errorMessage)

        // 显示错误通知
        setIsVisible(true)

        // 清除之前的定时器
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current)
        }

        // 设置自动隐藏定时器
        hideTimeoutRef.current = setTimeout(() => {
            hideError()
        }, duration)
    }

    // 隐藏错误提示
    const hideError = () => {
        setIsVisible(false)

        // 清除定时器
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current)
            hideTimeoutRef.current = null
        }

        // 通知主进程关闭窗口
        setTimeout(() => {
            window.electronAPI.closeErrorWindow()
        }, 400)
    }

    return (
        <div className="error-container">
            <div
                id="error-notification"
                className={`error-notification ${isVisible ? 'show' : ''}`}
            >
                <div className="error-content">
                    <span className="error-message" id="error-message">
                        {message}
                    </span>
                    <button className="error-close-btn" id="error-close-btn" onClick={hideError}>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default Error
