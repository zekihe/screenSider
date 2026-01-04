on run argv
    set windowName to item 1 of argv
    
    tell application "System Events"
        -- 查找所有进程
        repeat with proc in processes
            try
                -- 查找进程中的所有窗口
                repeat with win in windows of proc
                    try
                        -- 检查窗口名称是否包含目标名称
                        if name of win contains windowName then
                            -- 激活进程并将窗口置于最前面
                            set frontmost of proc to true
                            -- 强制窗口到前面
                            perform action "AXRaise" of win
                            -- 设置为主要窗口
                            set value of attribute "AXMain" of win to true
                            return "Activated: " & name of win
                        end if
                    end try
                end repeat
            end try
        end repeat
        return "Window not found: " & windowName
    end tell
end run