import React, { useState, useEffect, useRef } from 'react'
import './ScreenSelector.styl'

function ScreenSelector() {
    const [allSources, setAllSources] = useState([])
    const [selectedSource, setSelectedSource] = useState(null)
    const [currentTab, setCurrentTab] = useState('screen')
    const [isLoading, setIsLoading] = useState(true)
    const shareBtnRef = useRef(null)

    useEffect(() => {
        // Request screen sources from main process
        if (window.electronAPI) {
            window.electronAPI.requestSources()

            // Listen for screen sources from main process
            window.electronAPI.onScreenSources((event, sources) => {
                console.log('Received screen sources:', sources)
                setAllSources(sources)
                setIsLoading(false)
            })
        }

        return () => {
            // Clean up event listeners if needed
        }
    }, [])

    // Handle tab click
    const handleTabClick = (type) => {
        setCurrentTab(type)
        // Clear selected source when tab changes
        setSelectedSource(null)
    }

    // Handle source selection
    const handleSourceSelect = (source) => {
        setSelectedSource(source)
    }

    // Handle cancel
    const handleCancel = () => {
        if (window.electronAPI) {
            window.electronAPI.cancelScreenSelect()
        }
    }

    // Handle share
    const handleShare = () => {
        if (selectedSource && window.electronAPI) {
            window.electronAPI.confirmScreenSelect(selectedSource)
        }
    }

    // Filter sources based on current tab
    const filteredSources = allSources.filter((source) => {
        if (currentTab === 'window') {
            return source.type === 'window' || (source.id && source.id.startsWith('window'))
        } else if (currentTab === 'screen') {
            return source.type === 'screen' || (source.id && source.id.startsWith('screen'))
        }
        return true
    })

    return (
        <div className="screen-selector-container">
            <div className="header">
                <h1>Choose what to share with Screen Recorder Pro</h1>
                <p>The application will be able to see the contents of your screen</p>
            </div>

            <div className="tabs">
                <div
                    className={`tab ${currentTab === 'screen' ? 'active' : ''}`}
                    data-type="screen"
                    onClick={() => handleTabClick('screen')}
                >
                    Entire Screen
                </div>
                <div
                    className={`tab ${currentTab === 'window' ? 'active' : ''}`}
                    data-type="window"
                    onClick={() => handleTabClick('window')}
                >
                    Window
                </div>
            </div>

            <div className="content">
                {isLoading ? (
                    <div className="loading">Loading sources...</div>
                ) : filteredSources.length > 0 ? (
                    <div className="source-grid" id="sourceGrid">
                        {filteredSources.map((source) => (
                            <div
                                key={source.id}
                                className={`source-item ${selectedSource?.id === source.id ? 'selected' : ''}`}
                                data-source-id={source.id}
                                onClick={() => handleSourceSelect(source)}
                            >
                                <div className="source-thumbnail">
                                    <img
                                        src={source.thumbnail?.toDataURL() || ''}
                                        alt={source.name}
                                    />
                                </div>
                                <div className="source-name">{source.name}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="no-sources">No sources available</div>
                )}
            </div>

            <div className="footer">
                <div className="audio-note">
                    <div className="audio-icon"></div>
                    <span>To share audio, share a window instead</span>
                </div>
                <div className="btn-group">
                    <button className="btn cancel" id="cancelBtn" onClick={handleCancel}>
                        Cancel
                    </button>
                    <button
                        ref={shareBtnRef}
                        className="btn share"
                        id="shareBtn"
                        disabled={!selectedSource}
                        onClick={handleShare}
                    >
                        Share
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ScreenSelector
