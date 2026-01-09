import React, { useEffect, useState } from 'react'
import './Settings.styl'

function Settings() {
    const [selectedFormat, setSelectedFormat] = useState('mp4')
    const [isVisible, setIsVisible] = useState(false) // 控制动画显示的状态

    useEffect(() => {
        // 从主进程获取当前选择的格式
        if (window.electronAPI && window.electronAPI.onSetSelectedFormat) {
            window.electronAPI.onSetSelectedFormat((event, format) => {
                setSelectedFormat(format)
            })
        }

        // 添加动画类
        setTimeout(() => {
            setIsVisible(true)
        }, 10) // 短暂延迟确保DOM已渲染

        // 点击窗口外部关闭窗口
        const handleBodyClick = (e) => {
            if (e.target === document.body) {
                // 添加关闭动画
                setIsVisible(false)
                // 动画完成后关闭窗口
                setTimeout(() => {
                    window.electronAPI.closeSettingsWindow()
                }, 300)
            }
        }

        document.addEventListener('click', handleBodyClick)
        return () => {
            document.removeEventListener('click', handleBodyClick)
        }
    }, [])

    const handleClose = () => {
        // 添加关闭动画
        setIsVisible(false)
        // 动画完成后关闭窗口
        setTimeout(() => {
            window.electronAPI.closeSettingsWindow()
        }, 300)
    }

    const handleFormatChange = (e) => {
        const newFormat = e.target.value
        setSelectedFormat(newFormat)
        window.electronAPI.setFormat(newFormat)
    }

    return (
        <div className={`settings-container ${isVisible ? 'visible' : ''}`}>
            <div className="settings-header">
                <h1>Settings</h1>
                <button id="close-btn" className="close-btn" onClick={handleClose}>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
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

            <div className="settings-content">
                <div className="setting-item">
                    <label htmlFor="format-select">Video Format</label>
                    <select
                        id="format-select"
                        className="format-select"
                        value={selectedFormat}
                        onChange={handleFormatChange}
                    >
                        <option value="webm">WebM</option>
                        <option value="mp4">MP4</option>
                    </select>
                </div>
            </div>
        </div>
    )
}

export default Settings
